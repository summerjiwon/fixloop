from fastapi import Depends, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from app.config import get_settings
from app.schemas import ProofOfFixResult, TriageRequest, VisualTriageResult, VerifyRequest
from app.services.ai import VisionProvider, get_vision_provider


app = FastAPI(title="FixLoop API", version="0.1.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=get_settings().cors_origins,
    allow_credentials=False,
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)


def vision_provider() -> VisionProvider:
    try:
        return get_vision_provider()
    except RuntimeError as error:
        raise HTTPException(status_code=503, detail=str(error)) from error


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
