import asyncio
from typing import Protocol

from app.config import get_settings
from app.schemas import ProofOfFixResult, TriageRequest, VisualTriageResult, VerifyRequest


class VisionProvider(Protocol):
    """Provider boundary. Concrete SDK calls must stay behind this interface."""

    async def triage(self, request: TriageRequest) -> VisualTriageResult: ...

    async def verify(self, request: VerifyRequest) -> ProofOfFixResult: ...


class MockVisionProvider:
    """Deterministic provider used for local development and contract tests."""

    async def triage(self, request: TriageRequest) -> VisualTriageResult:
        context = f"{request.location_context} {request.reporter_text or ''}".lower()
        severity = "HIGH" if any(word in context for word in ("위험", "화재", "누수")) else "MEDIUM"
        return VisualTriageResult(
            asset="unknown_asset",
            issue_type="needs_manual_review",
            title="현장 사진 확인 필요",
            description="Mock provider result. Configure a production vision provider before deployment.",
            severity=severity,
            confidence=0.5,
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
            instructions=(
                "You are a facilities incident analyst. Analyze only what is visually observable. "
                "Return the requested JSON schema; never claim a fact that the image cannot support."
            ),
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

def get_vision_provider() -> VisionProvider:
    settings = get_settings()
    if settings.ai_provider == "mock":
        return MockVisionProvider()
    if settings.ai_provider == "openai":
        if not settings.ai_api_key:
            raise RuntimeError("AI_API_KEY is required when AI_PROVIDER=openai")
        return OpenAIResponsesVisionProvider(settings.ai_api_key, settings.openai_model)
    raise RuntimeError(
        f"Unsupported AI_PROVIDER={settings.ai_provider!r}. Add its SDK adapter behind VisionProvider."
    )
