from datetime import datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, Field, HttpUrl, PrivateAttr


Severity = Literal["LOW", "MEDIUM", "HIGH", "CRITICAL"]
IssueStatus = Literal["ANALYZING", "ANALYSIS_FAILED", "OPEN", "IN_PROGRESS", "VERIFYING", "RESOLVED", "NO_ISSUE"]
ImageType = Literal["BEFORE", "AFTER"]


class VisualTriageResult(BaseModel):
    """Validated, display-safe result of analysing a reporter's Before photo."""

    area: str = Field(min_length=1, max_length=80, description="공간 분류. 예: 화장실, 도서관, 출입구")
    asset: str = Field(min_length=1, max_length=120)
    issue_type: str = Field(min_length=1, max_length=120, description="한국어 문제 분류")
    title: str = Field(min_length=1, max_length=160)
    description: str = Field(min_length=1, max_length=1000)
    severity: Severity
    confidence: float = Field(ge=0, le=1)
    operator_comment: str = Field(min_length=1, max_length=500, description="관리자용 한국어 조치 코멘트")


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
    # QR uploads keep this transient image in memory so Gemini does not need to
    # download the same photo back from Storage before analysing it.
    _ai_image_bytes: bytes | None = PrivateAttr(default=None)
    _ai_image_mime_type: str | None = PrivateAttr(default=None)


class VerifyRequest(BaseModel):
    """Day 1 JSON endpoint input for testing Before/After provider integration."""

    before_image_url: HttpUrl
    after_image_url: HttpUrl
    issue_context: str = Field(min_length=1, max_length=1000)


class ReportAnalysisResponse(BaseModel):
    draft_id: UUID
    analysis: VisualTriageResult


class IssueImage(BaseModel):
    id: UUID
    image_url: str
    type: ImageType
    created_at: datetime


class SimilarIssue(BaseModel):
    issue_id: UUID
    title: str
    severity: Severity
    status: IssueStatus
    similarity: float = Field(ge=0, le=1)


class IssueVerification(BaseModel):
    same_asset: bool
    visible_issue_resolved: bool
    confidence: float = Field(ge=0, le=1)
    reason: str
    limitations: list[str]
    created_at: datetime


class IssueListItem(BaseModel):
    id: UUID
    location_id: UUID
    area: str
    title: str
    description: str
    category: str
    asset_name: str
    severity: Severity
    status: IssueStatus
    ai_confidence: float = Field(ge=0, le=1)
    operator_comment: str
    created_at: datetime
    resolved_at: datetime | None = None


class IssueDetail(IssueListItem):
    images: list[IssueImage]
    similar_issues: list[SimilarIssue]
    verification: IssueVerification | None = None


class PublicReportStatus(BaseModel):
    """Reporter-safe status: no private photos, text, notes, or similar-issue data."""

    id: UUID
    area: str
    title: str
    category: str
    asset_name: str
    severity: Severity
    status: IssueStatus
    ai_confidence: float = Field(ge=0, le=1)
    created_at: datetime
    resolved_at: datetime | None = None


class StatusUpdateRequest(BaseModel):
    status: IssueStatus


class InsightItem(BaseModel):
    kind: Literal["repeat_issue", "location_concentration", "recommendation"]
    title: str
    detail: str
    metric: str


class InsightsResponse(BaseModel):
    period_days: int
    total_issues: int
    by_location: dict[str, int]
    by_category: dict[str, int]
    insights: list[InsightItem]
