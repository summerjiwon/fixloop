from datetime import UTC, datetime
from functools import lru_cache
from io import BytesIO
from uuid import UUID, uuid4

from fastapi import Depends, FastAPI, File, Form, HTTPException, Response, UploadFile, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from PIL import Image, UnidentifiedImageError

from app.config import get_settings
from app.database.storage import MemoryStorage, SupabaseStorage, draft_before_path, issue_after_path
from app.database.store import InMemoryStore, InvalidStateError, NotFoundError
from app.database.supabase_store import SupabaseStore
from app.schemas import (
    InsightsResponse,
    IssueDetail,
    IssueListItem,
    IssueStatus,
    IssueVerification,
    ProofOfFixResult,
    ReportAnalysisResponse,
    StatusUpdateRequest,
    TriageRequest,
    VisualTriageResult,
    VerifyRequest,
)
from app.services.ai import VisionProvider, get_issue_embedding_provider, get_vision_provider


app = FastAPI(title="FixLoop API", version="0.1.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=get_settings().cors_origins,
    allow_credentials=False,
    allow_methods=["GET", "POST", "PATCH"],
    allow_headers=["*"],
)

memory_store = InMemoryStore()
memory_storage = MemoryStorage()
bearer_scheme = HTTPBearer(auto_error=False)
ALLOWED_IMAGE_MIME_TYPES = {"image/jpeg", "image/png", "image/webp"}
IMAGE_MIME_TYPES = {"JPEG": "image/jpeg", "PNG": "image/png", "WEBP": "image/webp"}
MAX_AI_IMAGE_DIMENSION = 1600


def vision_provider() -> VisionProvider:
    try:
        return get_vision_provider()
    except RuntimeError as error:
        raise HTTPException(status_code=503, detail=str(error)) from error


async def enrich_similar_issues(issue: IssueDetail, local_store: InMemoryStore | SupabaseStore) -> IssueDetail:
    """Keep a successful report even when optional similarity enrichment is unavailable."""
    if not isinstance(local_store, SupabaseStore):
        return issue
    provider = get_issue_embedding_provider()
    if not provider:
        return issue
    issue_text = f"공간: {issue.area}\n설비: {issue.asset_name}\n분류: {issue.category}\n제목: {issue.title}\n설명: {issue.description}"
    try:
        local_store.save_embedding(issue.id, await provider.embed(issue_text))
        return local_store.get_issue(issue.id)
    except Exception:
        return issue


async def run_ai_analysis(provider: VisionProvider, request: TriageRequest) -> VisualTriageResult:
    """Turn a temporary provider failure into a safe, CORS-compatible API response."""
    try:
        return await provider.triage(request)
    except Exception as error:
        # Gemini and other providers can temporarily reject requests while under
        # load.  Do not leak SDK internals or let an unhandled 500 lose CORS
        # headers, which browsers otherwise report only as "Failed to fetch".
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="AI 분석 서비스가 일시적으로 혼잡합니다. 잠시 후 다시 시도해주세요.",
        ) from error


@lru_cache
def get_supabase_auth_client():
    settings = get_settings()
    if not settings.supabase_url or not settings.supabase_service_role_key:
        raise RuntimeError("Supabase server credentials are required for administrator authentication")
    from supabase import create_client

    return create_client(settings.supabase_url, settings.supabase_service_role_key)


def require_admin(credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme)) -> None:
    """Protect operator-only routes while leaving the QR reporting route public."""
    settings = get_settings()
    if not settings.auth_required:
        return
    if not credentials or credentials.scheme.lower() != "bearer":
        raise HTTPException(status_code=401, detail="관리자 로그인이 필요합니다.")
    if not settings.allowed_admin_emails:
        raise HTTPException(status_code=503, detail="관리자 이메일이 설정되지 않았습니다.")
    try:
        user = get_supabase_auth_client().auth.get_user(credentials.credentials).user
    except Exception as error:
        raise HTTPException(status_code=401, detail="로그인 정보를 확인할 수 없습니다.") from error
    email = (getattr(user, "email", None) or "").lower()
    if email not in settings.allowed_admin_emails:
        raise HTTPException(status_code=403, detail="관리자 권한이 없습니다.")


@lru_cache
def get_supabase_services() -> tuple[SupabaseStore, SupabaseStorage]:
    settings = get_settings()
    if not settings.supabase_url or not settings.supabase_service_role_key:
        raise RuntimeError("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required for Supabase mode")
    from supabase import create_client

    client = create_client(settings.supabase_url, settings.supabase_service_role_key)
    supabase_storage = SupabaseStorage(client, settings.storage_bucket)
    return SupabaseStore(client, supabase_storage.signed_url), supabase_storage


def get_store() -> InMemoryStore | SupabaseStore:
    settings = get_settings()
    if settings.data_backend == "memory":
        return memory_store
    if settings.data_backend == "supabase":
        try:
            return get_supabase_services()[0]
        except RuntimeError as error:
            raise HTTPException(status_code=503, detail=str(error)) from error
    raise HTTPException(status_code=503, detail="DATA_BACKEND must be memory or supabase")


def get_storage() -> MemoryStorage | SupabaseStorage:
    settings = get_settings()
    if settings.storage_backend == "memory" and settings.data_backend == "memory":
        return memory_storage
    if settings.storage_backend == "supabase" and settings.data_backend == "supabase":
        try:
            return get_supabase_services()[1]
        except RuntimeError as error:
            raise HTTPException(status_code=503, detail=str(error)) from error
    raise HTTPException(
        status_code=503,
        detail="Use STORAGE_BACKEND=supabase together with DATA_BACKEND=supabase in production",
    )


async def read_validated_image(file: UploadFile) -> tuple[bytes, str]:
    """Accept only real JPEG, PNG, or WebP files within the configured size limit."""
    settings = get_settings()
    if file.content_type not in ALLOWED_IMAGE_MIME_TYPES:
        raise HTTPException(status_code=422, detail="JPG, PNG 또는 WebP 사진만 올릴 수 있습니다.")
    content = await file.read(settings.max_upload_bytes + 1)
    if not content:
        raise HTTPException(status_code=422, detail="빈 파일은 올릴 수 없습니다.")
    if len(content) > settings.max_upload_bytes:
        raise HTTPException(status_code=413, detail=f"사진 용량은 {settings.max_upload_bytes // (1024 * 1024)}MB 이하여야 합니다.")
    try:
        with Image.open(BytesIO(content)) as image:
            image.verify()
        with Image.open(BytesIO(content)) as image:
            if image.width * image.height > 40_000_000:
                raise HTTPException(status_code=422, detail="사진 해상도가 너무 큽니다.")
            actual_mime_type = IMAGE_MIME_TYPES.get(image.format or "")
    except (UnidentifiedImageError, OSError, SyntaxError, Image.DecompressionBombError) as error:
        raise HTTPException(status_code=422, detail="정상적인 이미지 파일이 아닙니다.") from error
    if not actual_mime_type or actual_mime_type != file.content_type:
        raise HTTPException(status_code=422, detail="파일 형식과 이미지 내용이 일치하지 않습니다.")
    return content, actual_mime_type


def optimize_image_for_ai(content: bytes) -> tuple[bytes, str]:
    """Make a compact AI-only copy while preserving the reporter's original upload."""
    with Image.open(BytesIO(content)) as image:
        image = image.convert("RGB")
        image.thumbnail((MAX_AI_IMAGE_DIMENSION, MAX_AI_IMAGE_DIMENSION), Image.Resampling.LANCZOS)
        optimized = BytesIO()
        image.save(optimized, format="JPEG", quality=82, optimize=True)
    return optimized.getvalue(), "image/jpeg"


def translate_domain_error(error: Exception) -> HTTPException:
    if isinstance(error, NotFoundError):
        return HTTPException(status_code=404, detail=str(error))
    if isinstance(error, InvalidStateError):
        return HTTPException(status_code=409, detail=str(error))
    return HTTPException(status_code=500, detail="Unexpected persistence error")


@app.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/api/local-images/{image_id}")
async def get_local_image(image_id: str) -> Response:
    """Serve a temporary local-memory upload to the local dashboard and a vision provider."""
    image = memory_storage.read(image_id) if get_settings().storage_backend == "memory" else None
    if not image:
        raise HTTPException(status_code=404, detail="Local image not found")
    content, content_type = image
    return Response(content=content, media_type=content_type)


@app.post("/api/ai/triage", response_model=VisualTriageResult)
async def triage(
    request: TriageRequest,
    provider: VisionProvider = Depends(vision_provider),
    _: None = Depends(require_admin),
) -> VisualTriageResult:
    """Validate a provider's visual-triage output before it can reach a future issue flow."""
    return await run_ai_analysis(provider, request)


@app.post("/api/ai/verify", response_model=ProofOfFixResult)
async def verify(
    request: VerifyRequest,
    provider: VisionProvider = Depends(vision_provider),
    _: None = Depends(require_admin),
) -> ProofOfFixResult:
    """Return a photo-based estimate; issue resolution remains an admin-only Day 5+ action."""
    return await provider.verify(request)


@app.post("/api/reports/analyze", response_model=ReportAnalysisResponse, status_code=status.HTTP_201_CREATED)
async def analyze_report(
    location_id: UUID = Form(...),
    reporter_text: str | None = Form(default=None),
    image: UploadFile = File(...),
    local_store: InMemoryStore | SupabaseStore = Depends(get_store),
    local_storage: MemoryStorage | SupabaseStorage = Depends(get_storage),
    provider: VisionProvider = Depends(vision_provider),
) -> ReportAnalysisResponse:
    """Stage a Before image and analysis until the reporter explicitly confirms the issue."""
    draft_id = uuid4()
    try:
        file_bytes, content_type = await read_validated_image(image)
        image_path = local_storage.upload(
            draft_before_path(draft_id), image.filename or "before.jpg", content_type, file_bytes
        )
        ai_image_bytes, ai_image_mime_type = optimize_image_for_ai(file_bytes)
        triage_request = TriageRequest(
            before_image_url=local_storage.signed_url(image_path),
            location_context=f"location:{location_id}",
            reporter_text=reporter_text,
        )
        triage_request._ai_image_bytes = ai_image_bytes
        triage_request._ai_image_mime_type = ai_image_mime_type
        analysis = await run_ai_analysis(
            provider,
            triage_request,
        )
        local_store.create_draft(location_id, image_path, reporter_text, analysis, draft_id)
    except (NotFoundError, ValueError) as error:
        raise translate_domain_error(error) from error
    return ReportAnalysisResponse(draft_id=draft_id, analysis=analysis)


@app.post("/api/reports/{draft_id}/confirm", response_model=IssueDetail, status_code=status.HTTP_201_CREATED)
async def confirm_report(
    draft_id: UUID,
    local_store: InMemoryStore | SupabaseStore = Depends(get_store),
    _: None = Depends(require_admin),
) -> IssueDetail:
    try:
        return await enrich_similar_issues(local_store.confirm_draft(draft_id), local_store)
    except Exception as error:
        raise translate_domain_error(error) from error


@app.post("/api/reports", response_model=IssueDetail, status_code=status.HTTP_201_CREATED)
async def submit_report(
    location_id: UUID = Form(...),
    reporter_text: str | None = Form(default=None),
    image: UploadFile = File(...),
    local_store: InMemoryStore | SupabaseStore = Depends(get_store),
    local_storage: MemoryStorage | SupabaseStorage = Depends(get_storage),
    provider: VisionProvider = Depends(vision_provider),
) -> IssueDetail:
    """Public QR flow: analyze, validate, and create the issue in one reporter action."""
    analysis = await analyze_report(location_id, reporter_text, image, local_store, local_storage, provider)
    return await confirm_report(analysis.draft_id, local_store)


@app.get("/api/issues", response_model=list[IssueListItem])
async def list_issues(
    status_filter: IssueStatus | None = None,
    severity: str | None = None,
    local_store: InMemoryStore | SupabaseStore = Depends(get_store),
    _: None = Depends(require_admin),
) -> list[IssueListItem]:
    return local_store.list_issues(status_filter, severity)


@app.get("/api/issues/{issue_id}", response_model=IssueDetail)
async def get_issue(
    issue_id: UUID,
    local_store: InMemoryStore | SupabaseStore = Depends(get_store),
    _: None = Depends(require_admin),
) -> IssueDetail:
    try:
        return local_store.get_issue(issue_id)
    except Exception as error:
        raise translate_domain_error(error) from error


@app.patch("/api/issues/{issue_id}/status", response_model=IssueDetail)
async def update_issue_status(
    issue_id: UUID,
    request: StatusUpdateRequest,
    local_store: InMemoryStore | SupabaseStore = Depends(get_store),
    _: None = Depends(require_admin),
) -> IssueDetail:
    try:
        return local_store.update_status(issue_id, request.status)
    except Exception as error:
        raise translate_domain_error(error) from error


@app.post("/api/issues/{issue_id}/after", response_model=IssueDetail)
async def upload_after_image(
    issue_id: UUID,
    image: UploadFile = File(...),
    local_store: InMemoryStore | SupabaseStore = Depends(get_store),
    local_storage: MemoryStorage | SupabaseStorage = Depends(get_storage),
    _: None = Depends(require_admin),
) -> IssueDetail:
    try:
        file_bytes, content_type = await read_validated_image(image)
        image_url = local_storage.upload(
            issue_after_path(issue_id), image.filename or "after.jpg", content_type, file_bytes
        )
        return local_store.add_after_image(issue_id, image_url)
    except (NotFoundError, ValueError) as error:
        raise translate_domain_error(error) from error


@app.post("/api/issues/{issue_id}/verify", response_model=IssueDetail)
async def verify_issue(
    issue_id: UUID,
    local_store: InMemoryStore | SupabaseStore = Depends(get_store),
    provider: VisionProvider = Depends(vision_provider),
    _: None = Depends(require_admin),
) -> IssueDetail:
    try:
        issue, before_url, after_url = local_store.get_before_after(issue_id)
        result = await provider.verify(
            VerifyRequest(
                before_image_url=before_url,
                after_image_url=after_url,
                issue_context=f"{issue.asset_name}: {issue.description}",
            )
        )
        verification = IssueVerification(**result.model_dump(), created_at=datetime.now(UTC))
        return local_store.save_verification(issue_id, verification)
    except Exception as error:
        raise translate_domain_error(error) from error


@app.post("/api/issues/{issue_id}/resolve", response_model=IssueDetail)
async def resolve_issue(
    issue_id: UUID,
    local_store: InMemoryStore | SupabaseStore = Depends(get_store),
    _: None = Depends(require_admin),
) -> IssueDetail:
    """The only route allowed to put an issue into RESOLVED."""
    try:
        return local_store.resolve(issue_id)
    except Exception as error:
        raise translate_domain_error(error) from error


@app.post("/api/issues/{issue_id}/no-issue", response_model=IssueDetail)
async def mark_no_issue(
    issue_id: UUID,
    local_store: InMemoryStore | SupabaseStore = Depends(get_store),
    _: None = Depends(require_admin),
) -> IssueDetail:
    """Close an inspected report that is not an actual facility issue."""
    try:
        return local_store.mark_no_issue(issue_id)
    except Exception as error:
        raise translate_domain_error(error) from error


@app.get("/api/insights", response_model=InsightsResponse)
async def get_insights(
    local_store: InMemoryStore | SupabaseStore = Depends(get_store),
    _: None = Depends(require_admin),
) -> InsightsResponse:
    return local_store.get_insights()
