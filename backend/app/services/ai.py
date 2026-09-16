import asyncio
import math
from typing import Protocol

import httpx

from app.config import get_settings
from app.schemas import ProofOfFixResult, TriageRequest, VisualTriageResult, VerifyRequest


TRIAGE_POLICY = """
당신은 시설 운영 신고를 분류하는 AI입니다. 사진에서 실제로 보이는 사실만 판단하고, 모든 텍스트 값은 한국어로 작성하세요.

공간(area)은 화장실, 도서관, 출입구, 복도, 계단, 휴게공간, 강의실, 사무실, 주차장, 미분류 공간 중 사진과 문맥에 가장 맞는 하나를 사용하세요. 같은 공간은 같은 이름으로 일관되게 분류하세요.
문제 분류(issue_type)는 소모품 부족, 시설 파손, 유리·창호, 배관·누수, 청결, 안전, 설비 고장, 기타 중 하나를 사용하세요.
심각도 기준: LOW(낮음)=화장실 휴지 없음 같은 소모품 부족 또는 경미한 청결 문제, MEDIUM(중간)=문 경첩 고장처럼 운영에 영향을 주지만 즉시 위험하지 않은 문제, HIGH(높음)=유리 파손처럼 다칠 위험이 있는 문제, CRITICAL(긴급)=파이프 파손·큰 누수·화재·감전 위험처럼 즉시 조치가 필요한 문제입니다.
operator_comment에는 관리자가 바로 이해할 수 있도록 확인 대상과 다음 조치를 한두 문장으로 적으세요. 사진으로 원인, 안전성, 수리 완료를 단정하지 말고 불확실하면 현장 확인을 요청하세요.
""".strip()


class VisionProvider(Protocol):
    """Provider boundary. Concrete SDK calls must stay behind this interface."""

    async def triage(self, request: TriageRequest) -> VisualTriageResult: ...

    async def verify(self, request: VerifyRequest) -> ProofOfFixResult: ...


class IssueEmbeddingProvider(Protocol):
    async def embed(self, issue_text: str) -> list[float]: ...


class MockVisionProvider:
    """Deterministic provider used for local development and contract tests."""

    async def triage(self, request: TriageRequest) -> VisualTriageResult:
        context = f"{request.location_context} {request.reporter_text or ''}".lower()
        if any(word in context for word in ("파이프", "큰 누수", "화재", "감전")):
            severity = "CRITICAL"
        elif any(word in context for word in ("유리", "파손")):
            severity = "HIGH"
        elif "경첩" in context:
            severity = "MEDIUM"
        else:
            severity = "LOW" if "휴지" in context else "MEDIUM"
        return VisualTriageResult(
            area=next((area for area in ("화장실", "도서관", "출입구", "복도", "계단", "휴게공간") if area in context), "미분류 공간"),
            asset="unknown_asset",
            issue_type="시설 확인 필요",
            title="현장 사진 확인 필요",
            description="사진을 기반으로 운영팀의 현장 확인이 필요합니다.",
            severity=severity,
            confidence=0.5,
            operator_comment="사진과 현장 상태를 확인한 뒤 담당자에게 조치를 배정하세요.",
        )

    async def verify(self, request: VerifyRequest) -> ProofOfFixResult:
        return ProofOfFixResult(
            same_asset=True,
            visible_issue_resolved=False,
            confidence=0.5,
            reason="Mock provider result. The production provider must compare the two submitted photos.",
            limitations=["사진만으로 실제 작동 여부는 확인할 수 없습니다."],
        )


class OpenAIResponsesVisionProvider:
    """OpenAI Responses adapter. API calls and API keys stay exclusively in the backend."""

    def __init__(self, api_key: str, model: str) -> None:
        from openai import OpenAI

        self.client = OpenAI(api_key=api_key)
        self.model = model

    async def triage(self, request: TriageRequest) -> VisualTriageResult:
        return await asyncio.to_thread(self._triage_sync, request)

    def _triage_sync(self, request: TriageRequest) -> VisualTriageResult:
        response = self.client.responses.create(
            model=self.model,
            store=False,
            instructions=TRIAGE_POLICY,
            input=[{"role": "user", "content": [
                {"type": "input_text", "text": f"Location: {request.location_context}\nReporter note: {request.reporter_text or 'None'}"},
                {"type": "input_image", "image_url": str(request.before_image_url), "detail": "high"},
            ]}],
            text={"format": {"type": "json_schema", "name": "visual_triage", "strict": True, "schema": VisualTriageResult.model_json_schema()}},
        )
        return VisualTriageResult.model_validate_json(response.output_text)

    async def verify(self, request: VerifyRequest) -> ProofOfFixResult:
        return await asyncio.to_thread(self._verify_sync, request)

    def _verify_sync(self, request: VerifyRequest) -> ProofOfFixResult:
        response = self.client.responses.create(
            model=self.model,
            store=False,
            instructions=(
                "Compare the Before and After facility photos. Estimate only visual evidence; "
                "do not assert actual repair quality or functional safety. Return the requested JSON schema."
            ),
            input=[{"role": "user", "content": [
                {"type": "input_text", "text": f"Issue context: {request.issue_context}"},
                {"type": "input_image", "image_url": str(request.before_image_url), "detail": "high"},
                {"type": "input_image", "image_url": str(request.after_image_url), "detail": "high"},
            ]}],
            text={"format": {"type": "json_schema", "name": "proof_of_fix", "strict": True, "schema": ProofOfFixResult.model_json_schema()}},
        )
        return ProofOfFixResult.model_validate_json(response.output_text)


class GeminiVisionProvider:
    """Gemini adapter using image bytes and Pydantic-backed JSON output."""

    def __init__(self, api_key: str, model: str) -> None:
        from google import genai
        from google.genai import types

        self.client = genai.Client(api_key=api_key)
        self.types = types
        self.model = model

    async def triage(self, request: TriageRequest) -> VisualTriageResult:
        inline_images = None
        if request._ai_image_bytes and request._ai_image_mime_type:
            inline_images = [(request._ai_image_bytes, request._ai_image_mime_type)]
        return await asyncio.to_thread(
            self._generate,
            VisualTriageResult,
            f"{TRIAGE_POLICY}\n\n신고 위치 문맥: {request.location_context}\n"
            f"신고자 설명: {request.reporter_text or '없음'}",
            [str(request.before_image_url)],
            inline_images,
        )

    async def verify(self, request: VerifyRequest) -> ProofOfFixResult:
        return await asyncio.to_thread(
            self._generate,
            ProofOfFixResult,
            "Compare the Before and After facility photos. Estimate only visible evidence; "
            "do not assert actual repair quality or functional safety. "
            f"Issue context: {request.issue_context}.",
            [str(request.before_image_url), str(request.after_image_url)],
        )

    def _generate(
        self,
        schema: type[VisualTriageResult] | type[ProofOfFixResult],
        prompt: str,
        image_urls: list[str],
        inline_images: list[tuple[bytes, str]] | None = None,
    ):
        parts = [prompt]
        if inline_images:
            for image_bytes, mime_type in inline_images:
                parts.append(self.types.Part.from_bytes(data=image_bytes, mime_type=mime_type))
        else:
            with httpx.Client(timeout=30, follow_redirects=True) as http:
                for image_url in image_urls:
                    response = http.get(image_url)
                    response.raise_for_status()
                    mime_type = response.headers.get("content-type", "image/jpeg").split(";", 1)[0]
                    parts.append(self.types.Part.from_bytes(data=response.content, mime_type=mime_type))
        response = self.client.models.generate_content(
            model=self.model,
            contents=parts,
            config=self.types.GenerateContentConfig(
                response_mime_type="application/json", response_schema=schema
            ),
        )
        return schema.model_validate_json(response.text)


class GeminiEmbeddingProvider:
    """Generate normalized 1,536-dimension vectors for same-location issue matching."""

    def __init__(self, api_key: str, model: str) -> None:
        from google import genai
        from google.genai import types

        self.client = genai.Client(api_key=api_key)
        self.types = types
        self.model = model

    async def embed(self, issue_text: str) -> list[float]:
        return await asyncio.to_thread(self._embed_sync, issue_text)

    def _embed_sync(self, issue_text: str) -> list[float]:
        response = self.client.models.embed_content(
            model=self.model,
            contents=issue_text,
            config=self.types.EmbedContentConfig(
                task_type="SEMANTIC_SIMILARITY", output_dimensionality=1536
            ),
        )
        values = list(response.embeddings[0].values)
        if len(values) != 1536:
            raise RuntimeError("Gemini embedding dimension must be 1536")
        magnitude = math.sqrt(sum(value * value for value in values))
        if not magnitude:
            raise RuntimeError("Gemini returned an empty embedding")
        return [value / magnitude for value in values]

def get_vision_provider() -> VisionProvider:
    settings = get_settings()
    if settings.ai_provider == "mock":
        return MockVisionProvider()
    if settings.ai_provider == "openai":
        if not settings.ai_api_key:
            raise RuntimeError("AI_API_KEY is required when AI_PROVIDER=openai")
        return OpenAIResponsesVisionProvider(settings.ai_api_key, settings.openai_model)
    if settings.ai_provider == "gemini":
        if not settings.gemini_api_key:
            raise RuntimeError("GEMINI_API_KEY is required when AI_PROVIDER=gemini")
        return GeminiVisionProvider(settings.gemini_api_key, settings.gemini_model)
    raise RuntimeError(
        f"Unsupported AI_PROVIDER={settings.ai_provider!r}. Add its SDK adapter behind VisionProvider."
    )


def get_issue_embedding_provider() -> IssueEmbeddingProvider | None:
    settings = get_settings()
    if settings.data_backend != "supabase":
        return None
    if settings.ai_provider == "gemini" and settings.gemini_api_key:
        return GeminiEmbeddingProvider(settings.gemini_api_key, settings.embedding_model)
    return None
