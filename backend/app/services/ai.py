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


def get_vision_provider() -> VisionProvider:
    settings = get_settings()
    if settings.ai_provider == "mock":
        return MockVisionProvider()
    raise RuntimeError(
        f"Unsupported AI_PROVIDER={settings.ai_provider!r}. Add its SDK adapter behind VisionProvider."
    )
