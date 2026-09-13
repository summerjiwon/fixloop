from datetime import UTC, datetime
from uuid import UUID, uuid4

from fastapi import Depends, FastAPI, File, Form, HTTPException, UploadFile, status
from fastapi.middleware.cors import CORSMiddleware

from app.config import get_settings
from app.database.storage import MemoryStorage, draft_before_path, issue_after_path
from app.database.store import InMemoryStore, InvalidStateError, NotFoundError
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
from app.services.ai import VisionProvider, get_vision_provider


app = FastAPI(title="FixLoop API", version="0.1.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=get_settings().cors_origins,
    allow_credentials=False,
    allow_methods=["GET", "POST", "PATCH"],
    allow_headers=["*"],
)

store = InMemoryStore()
storage = MemoryStorage()


def vision_provider() -> VisionProvider:
    try:
        return get_vision_provider()
    except RuntimeError as error:
        raise HTTPException(status_code=503, detail=str(error)) from error


def get_store() -> InMemoryStore:
    if get_settings().data_backend != "memory":
        raise HTTPException(
            status_code=503,
            detail="Supabase persistence is not configured. Set DATA_BACKEND=memory for local development.",
        )
    return store


def require_image(file: UploadFile) -> None:
    if not file.content_type or not file.content_type.startswith("image/"):
        raise HTTPException(status_code=422, detail="Only image uploads are accepted")


def translate_domain_error(error: Exception) -> HTTPException:
    if isinstance(error, NotFoundError):
        return HTTPException(status_code=404, detail=str(error))
    if isinstance(error, InvalidStateError):
        return HTTPException(status_code=409, detail=str(error))
    return HTTPException(status_code=500, detail="Unexpected persistence error")


@app.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok"}


@app.post("/api/ai/triage", response_model=VisualTriageResult)
async def triage(
    request: TriageRequest, provider: VisionProvider = Depends(vision_provider)
) -> VisualTriageResult:
    """Validate a provider's visual-triage output before it can reach a future issue flow."""
    return await provider.triage(request)


@app.post("/api/ai/verify", response_model=ProofOfFixResult)
async def verify(
    request: VerifyRequest, provider: VisionProvider = Depends(vision_provider)
) -> ProofOfFixResult:
    """Return a photo-based estimate; issue resolution remains an admin-only Day 5+ action."""
    return await provider.verify(request)


@app.post("/api/reports/analyze", response_model=ReportAnalysisResponse, status_code=status.HTTP_201_CREATED)
async def analyze_report(
    location_id: UUID = Form(...),
    reporter_text: str | None = Form(default=None),
    image: UploadFile = File(...),
    local_store: InMemoryStore = Depends(get_store),
    provider: VisionProvider = Depends(vision_provider),
) -> ReportAnalysisResponse:
    """Stage a Before image and analysis until the reporter explicitly confirms the issue."""
    require_image(image)
    draft_id = uuid4()
    try:
        file_bytes = await image.read()
        image_url = storage.upload(
            draft_before_path(draft_id), image.filename or "before.jpg", image.content_type, file_bytes
        )
        analysis = await provider.triage(
            TriageRequest(
                before_image_url=image_url,
                location_context=f"location:{location_id}",
                reporter_text=reporter_text,
            )
        )
        local_store.create_draft(location_id, image_url, reporter_text, analysis, draft_id)
    except (NotFoundError, ValueError) as error:
        raise translate_domain_error(error) from error
    return ReportAnalysisResponse(draft_id=draft_id, analysis=analysis)


@app.post("/api/reports/{draft_id}/confirm", response_model=IssueDetail, status_code=status.HTTP_201_CREATED)
async def confirm_report(
    draft_id: UUID, local_store: InMemoryStore = Depends(get_store)
) -> IssueDetail:
    try:
        return local_store.confirm_draft(draft_id)
    except Exception as error:
        raise translate_domain_error(error) from error


@app.post("/api/reports", response_model=IssueDetail, status_code=status.HTTP_201_CREATED)
async def submit_report(
    location_id: UUID = Form(...),
    reporter_text: str | None = Form(default=None),
    image: UploadFile = File(...),
    local_store: InMemoryStore = Depends(get_store),
    provider: VisionProvider = Depends(vision_provider),
) -> IssueDetail:
    """Public QR flow: analyze, validate, and create the issue in one reporter action."""
    analysis = await analyze_report(location_id, reporter_text, image, local_store, provider)
    return await confirm_report(analysis.draft_id, local_store)


@app.get("/api/issues", response_model=list[IssueListItem])
async def list_issues(
    status_filter: IssueStatus | None = None,
    severity: str | None = None,
    local_store: InMemoryStore = Depends(get_store),
) -> list[IssueListItem]:
    return local_store.list_issues(status_filter, severity)


@app.get("/api/issues/{issue_id}", response_model=IssueDetail)
async def get_issue(issue_id: UUID, local_store: InMemoryStore = Depends(get_store)) -> IssueDetail:
    try:
        return local_store.get_issue(issue_id)
    except Exception as error:
        raise translate_domain_error(error) from error


@app.patch("/api/issues/{issue_id}/status", response_model=IssueDetail)
async def update_issue_status(
    issue_id: UUID,
    request: StatusUpdateRequest,
    local_store: InMemoryStore = Depends(get_store),
) -> IssueDetail:
    try:
        return local_store.update_status(issue_id, request.status)
    except Exception as error:
        raise translate_domain_error(error) from error


@app.post("/api/issues/{issue_id}/after", response_model=IssueDetail)
async def upload_after_image(
    issue_id: UUID,
    image: UploadFile = File(...),
    local_store: InMemoryStore = Depends(get_store),
) -> IssueDetail:
    require_image(image)
    try:
        file_bytes = await image.read()
        image_url = storage.upload(
            issue_after_path(issue_id), image.filename or "after.jpg", image.content_type, file_bytes
        )
        return local_store.add_after_image(issue_id, image_url)
    except (NotFoundError, ValueError) as error:
        raise translate_domain_error(error) from error


@app.post("/api/issues/{issue_id}/verify", response_model=IssueDetail)
async def verify_issue(
    issue_id: UUID,
    local_store: InMemoryStore = Depends(get_store),
    provider: VisionProvider = Depends(vision_provider),
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
async def resolve_issue(issue_id: UUID, local_store: InMemoryStore = Depends(get_store)) -> IssueDetail:
    """The only route allowed to put an issue into RESOLVED."""
    try:
        return local_store.resolve(issue_id)
    except Exception as error:
        raise translate_domain_error(error) from error


@app.get("/api/insights", response_model=InsightsResponse)
async def get_insights(local_store: InMemoryStore = Depends(get_store)) -> InsightsResponse:
    return local_store.get_insights()
