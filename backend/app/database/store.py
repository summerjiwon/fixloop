from __future__ import annotations

from dataclasses import dataclass
from datetime import UTC, datetime
from uuid import UUID, uuid4

from app.schemas import (
    InsightItem,
    InsightsResponse,
    IssueDetail,
    IssueImage,
    IssueListItem,
    IssueStatus,
    IssueVerification,
    SimilarIssue,
    VisualTriageResult,
)


class NotFoundError(Exception):
    pass


class InvalidStateError(Exception):
    pass


@dataclass
class ReportDraft:
    id: UUID
    location_id: UUID
    before_image_url: str
    reporter_text: str | None
    analysis: VisualTriageResult


class InMemoryStore:
    """Local development store. Its API mirrors the Supabase adapter's application contract."""

    def __init__(self) -> None:
        self.locations: dict[UUID, str] = {}
        self.drafts: dict[UUID, ReportDraft] = {}
        self.issues: dict[UUID, IssueListItem] = {}
        self.images: dict[UUID, list[IssueImage]] = {}
        self.matches: dict[UUID, list[SimilarIssue]] = {}
        self.verifications: dict[UUID, IssueVerification] = {}
        self.seed_location_id = UUID("00000000-0000-0000-0000-000000000001")
        self.locations[self.seed_location_id] = "Demo location"

    def assert_location(self, location_id: UUID) -> None:
        if location_id not in self.locations:
            raise NotFoundError("Location not found")

    def create_draft(
        self,
        location_id: UUID,
        before_image_url: str,
        reporter_text: str | None,
        analysis: VisualTriageResult,
        draft_id: UUID | None = None,
    ) -> ReportDraft:
        self.assert_location(location_id)
        draft = ReportDraft(draft_id or uuid4(), location_id, before_image_url, reporter_text, analysis)
        self.drafts[draft.id] = draft
        return draft

    def confirm_draft(self, draft_id: UUID) -> IssueDetail:
        draft = self.drafts.pop(draft_id, None)
        if not draft:
            raise NotFoundError("Report draft not found")

        now = datetime.now(UTC)
        issue_id = uuid4()
        issue = IssueListItem(
            id=issue_id,
            location_id=draft.location_id,
            title=draft.analysis.title,
            description=draft.analysis.description,
            category=draft.analysis.issue_type,
            asset_name=draft.analysis.asset,
            severity=draft.analysis.severity,
            status="OPEN",
            ai_confidence=draft.analysis.confidence,
            created_at=now,
        )
        self.issues[issue_id] = issue
        self.images[issue_id] = [
            IssueImage(id=uuid4(), image_url=draft.before_image_url, type="BEFORE", created_at=now)
        ]
        self.matches[issue_id] = self._find_similar(issue)
        return self.get_issue(issue_id)

    def _find_similar(self, target: IssueListItem) -> list[SimilarIssue]:
        target_terms = set(f"{target.asset_name} {target.category} {target.title}".lower().split())
        candidates: list[SimilarIssue] = []
        for issue in self.issues.values():
            if issue.id == target.id:
                continue
            terms = set(f"{issue.asset_name} {issue.category} {issue.title}".lower().split())
            overlap = len(target_terms & terms)
            similarity = overlap / max(len(target_terms | terms), 1)
            if issue.location_id == target.location_id:
                similarity = min(similarity + 0.2, 1.0)
            if similarity >= 0.2:
                candidates.append(
                    SimilarIssue(
                        issue_id=issue.id,
                        title=issue.title,
                        severity=issue.severity,
                        status=issue.status,
                        similarity=round(similarity, 2),
                    )
                )
        return sorted(candidates, key=lambda item: item.similarity, reverse=True)[:5]

    def list_issues(
        self, status: IssueStatus | None = None, severity: str | None = None
    ) -> list[IssueListItem]:
        items = list(self.issues.values())
        if status:
            items = [item for item in items if item.status == status]
        if severity:
            items = [item for item in items if item.severity == severity]
        return sorted(items, key=lambda item: item.created_at, reverse=True)

    def get_issue(self, issue_id: UUID) -> IssueDetail:
        issue = self.issues.get(issue_id)
        if not issue:
            raise NotFoundError("Issue not found")
        return IssueDetail(
            **issue.model_dump(),
            images=self.images.get(issue_id, []),
            similar_issues=self.matches.get(issue_id, []),
            verification=self.verifications.get(issue_id),
        )

    def update_status(self, issue_id: UUID, status: IssueStatus) -> IssueDetail:
        if status == "RESOLVED":
            raise InvalidStateError("Use the dedicated resolve endpoint for RESOLVED status")
        issue = self.issues.get(issue_id)
        if not issue:
            raise NotFoundError("Issue not found")
        self.issues[issue_id] = issue.model_copy(update={"status": status})
        return self.get_issue(issue_id)

    def add_after_image(self, issue_id: UUID, image_url: str) -> IssueDetail:
        issue = self.issues.get(issue_id)
        if not issue:
            raise NotFoundError("Issue not found")
        self.images.setdefault(issue_id, []).append(
            IssueImage(id=uuid4(), image_url=image_url, type="AFTER", created_at=datetime.now(UTC))
        )
        if issue.status != "RESOLVED":
            self.issues[issue_id] = issue.model_copy(update={"status": "VERIFYING"})
        return self.get_issue(issue_id)

    def get_before_after(self, issue_id: UUID) -> tuple[IssueDetail, str, str]:
        detail = self.get_issue(issue_id)
        before = next((image.image_url for image in detail.images if image.type == "BEFORE"), None)
        after = next((image.image_url for image in reversed(detail.images) if image.type == "AFTER"), None)
        if not before or not after:
            raise InvalidStateError("Both Before and After images are required before verification")
        return detail, before, after

    def save_verification(self, issue_id: UUID, verification: IssueVerification) -> IssueDetail:
        self.get_issue(issue_id)
        self.verifications[issue_id] = verification
        return self.get_issue(issue_id)

    def resolve(self, issue_id: UUID) -> IssueDetail:
        issue = self.issues.get(issue_id)
        if not issue:
            raise NotFoundError("Issue not found")
        if issue_id not in self.verifications:
            raise InvalidStateError("Run Before/After verification before final approval")
        self.issues[issue_id] = issue.model_copy(
            update={"status": "RESOLVED", "resolved_at": datetime.now(UTC)}
        )
        return self.get_issue(issue_id)

    def get_insights(self) -> InsightsResponse:
        """SQL-equivalent deterministic aggregation for local mode; AI never calculates these numbers."""
        issues = list(self.issues.values())
        by_location: dict[str, int] = {}
        by_category: dict[str, int] = {}
        for issue in issues:
            location_name = self.locations.get(issue.location_id, str(issue.location_id))
            by_location[location_name] = by_location.get(location_name, 0) + 1
            by_category[issue.category] = by_category.get(issue.category, 0) + 1

        insights: list[InsightItem] = []
        if by_category:
            category, count = max(by_category.items(), key=lambda item: item[1])
            insights.append(
                InsightItem(
                    kind="repeat_issue",
                    title=f"반복 문제: {category}",
                    detail=f"최근 30일 동안 {category} 유형 이슈가 {count}건 접수되었습니다.",
                    metric=f"{count}건",
                )
            )
        if by_location:
            location, count = max(by_location.items(), key=lambda item: item[1])
            total = max(len(issues), 1)
            percentage = round(count / total * 100)
            insights.append(
                InsightItem(
                    kind="location_concentration",
                    title=f"문제 집중 지점: {location}",
                    detail=f"전체 최근 이슈의 {percentage}%가 이 지점에서 발생했습니다.",
                    metric=f"{percentage}%",
                )
            )
        if insights:
            insights.append(
                InsightItem(
                    kind="recommendation",
                    title="권장 조치",
                    detail="반복 이슈가 많은 설비와 지점을 우선 점검하고, 처리 전후 사진을 남겨 추세를 확인하세요.",
                    metric="운영 권장",
                )
            )
        return InsightsResponse(
            period_days=30,
            total_issues=len(issues),
            by_location=by_location,
            by_category=by_category,
            insights=insights,
        )
