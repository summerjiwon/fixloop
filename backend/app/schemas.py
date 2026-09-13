from typing import Literal

from pydantic import BaseModel, Field, HttpUrl


Severity = Literal["LOW", "MEDIUM", "HIGH", "CRITICAL"]


class VisualTriageResult(BaseModel):
    """Validated, display-safe result of analysing a reporter's Before photo."""

    asset: str = Field(min_length=1, max_length=120)
    issue_type: str = Field(min_length=1, max_length=120)
    title: str = Field(min_length=1, max_length=160)
    description: str = Field(min_length=1, max_length=1000)
    severity: Severity
    confidence: float = Field(ge=0, le=1)


class ProofOfFixResult(BaseModel):
    """Photo-based estimate only; never a final resolution decision."""

    same_asset: bool
    visible_issue_resolved: bool
    confidence: float = Field(ge=0, le=1)
    reason: str = Field(min_length=1, max_length=1000)
    limitations: list[str] = Field(min_length=1, max_length=10)


class TriageRequest(BaseModel):
    """Day 1 JSON endpoint input. Upload orchestration arrives in Day 2/3."""

    before_image_url: HttpUrl
    location_context: str = Field(min_length=1, max_length=500)
    reporter_text: str | None = Field(default=None, max_length=1000)


class VerifyRequest(BaseModel):
    """Day 1 JSON endpoint input for testing Before/After provider integration."""

    before_image_url: HttpUrl
    after_image_url: HttpUrl
    issue_context: str = Field(min_length=1, max_length=1000)
