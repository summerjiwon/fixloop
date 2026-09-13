from __future__ import annotations

from collections import Counter
from datetime import UTC, datetime
from typing import Any, Callable
from uuid import UUID, uuid4

from app.database.store import InvalidStateError, NotFoundError, ReportDraft
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


class SupabaseStore:
    """Production persistence implementation backed by Supabase PostgreSQL.

    The service-role client is server-only. Image rows keep private object paths and are
    converted to short-lived URLs only when an API response or AI request needs one.
    """

    def __init__(self, client: Any, sign_image_url: Callable[[str], str]) -> None:
        self.client = client
        self.sign_image_url = sign_image_url

    @staticmethod
    def _row(response: Any, message: str) -> dict[str, Any]:
        data = response.data
        if isinstance(data, list):
            data = data[0] if data else None
        if not data:
            raise NotFoundError(message)
        return data

    @staticmethod
    def _rows(response: Any) -> list[dict[str, Any]]:
        return list(response.data or [])

    @staticmethod
    def _issue(row: dict[str, Any]) -> IssueListItem:
        return IssueListItem.model_validate(row)

    def assert_location(self, location_id: UUID) -> None:
        self._row(
            self.client.table("locations").select("id").eq("id", str(location_id)).maybe_single().execute(),
            "Location not found",
        )

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
        self.client.table("report_drafts").insert(
            {
                "id": str(draft.id),
                "location_id": str(location_id),
                "before_image_path": before_image_url,
                "reporter_text": reporter_text,
                "analysis": analysis.model_dump(mode="json"),
            }
        ).execute()
        return draft

    def confirm_draft(self, draft_id: UUID) -> IssueDetail:
        draft = self._row(
            self.client.table("report_drafts").select("*").eq("id", str(draft_id)).maybe_single().execute(),
            "Report draft not found",
        )
        analysis = VisualTriageResult.model_validate(draft["analysis"])
        issue_id = uuid4()
        self.client.table("issues").insert(
            {
                "id": str(issue_id),
                "location_id": draft["location_id"],
                "title": analysis.title,
                "description": analysis.description,
                "category": analysis.issue_type,
                "asset_name": analysis.asset,
                "severity": analysis.severity,
                "status": "OPEN",
                "ai_confidence": analysis.confidence,
            }
        ).execute()
        self.client.table("issue_images").insert(
            {"issue_id": str(issue_id), "image_path": draft["before_image_path"], "type": "BEFORE"}
        ).execute()
        self.client.table("report_drafts").delete().eq("id", str(draft_id)).execute()
        return self.get_issue(issue_id)

    def list_issues(
        self, status: IssueStatus | None = None, severity: str | None = None
    ) -> list[IssueListItem]:
        query = self.client.table("issues").select("*").order("created_at", desc=True)
        if status:
            query = query.eq("status", status)
        if severity:
            query = query.eq("severity", severity)
        return [self._issue(row) for row in self._rows(query.execute())]

    def _images(self, issue_id: UUID) -> list[IssueImage]:
        rows = self._rows(
            self.client.table("issue_images").select("*").eq("issue_id", str(issue_id)).order("created_at").execute()
        )
        return [
            IssueImage(
                id=row["id"],
                image_url=self.sign_image_url(row["image_path"]),
                type=row["type"],
                created_at=row["created_at"],
            )
            for row in rows
        ]

    def _similar(self, issue_id: UUID) -> list[SimilarIssue]:
        rows = self._rows(
            self.client.table("issue_matches").select("candidate_issue_id,similarity").eq("issue_id", str(issue_id)).execute()
        )
        candidates: list[SimilarIssue] = []
        for row in rows:
            candidate = self._row(
                self.client.table("issues").select("id,title,severity,status").eq("id", row["candidate_issue_id"]).maybe_single().execute(),
                "Similar issue not found",
            )
            candidates.append(
                SimilarIssue(
                    issue_id=candidate["id"], title=candidate["title"], severity=candidate["severity"],
                    status=candidate["status"], similarity=row["similarity"],
                )
            )
        return candidates

    def get_issue(self, issue_id: UUID) -> IssueDetail:
        issue = self._issue(
            self._row(
                self.client.table("issues").select("*").eq("id", str(issue_id)).maybe_single().execute(),
                "Issue not found",
            )
        )
        verification_rows = self._rows(
            self.client.table("issue_verifications").select("*").eq("issue_id", str(issue_id)).execute()
        )
        verification = IssueVerification.model_validate(verification_rows[0]) if verification_rows else None
        return IssueDetail(
            **issue.model_dump(), images=self._images(issue_id), similar_issues=self._similar(issue_id), verification=verification
        )

    def update_status(self, issue_id: UUID, status: IssueStatus) -> IssueDetail:
        if status == "RESOLVED":
            raise InvalidStateError("Use the dedicated resolve endpoint for RESOLVED status")
        self.get_issue(issue_id)
        self.client.table("issues").update({"status": status}).eq("id", str(issue_id)).execute()
        return self.get_issue(issue_id)

    def add_after_image(self, issue_id: UUID, image_url: str) -> IssueDetail:
        self.get_issue(issue_id)
        self.client.table("issue_images").insert(
            {"issue_id": str(issue_id), "image_path": image_url, "type": "AFTER"}
        ).execute()
        self.client.table("issues").update({"status": "VERIFYING"}).eq("id", str(issue_id)).execute()
        return self.get_issue(issue_id)

    def get_before_after(self, issue_id: UUID) -> tuple[IssueDetail, str, str]:
        detail = self.get_issue(issue_id)
        before = next((item.image_url for item in detail.images if item.type == "BEFORE"), None)
        after = next((item.image_url for item in reversed(detail.images) if item.type == "AFTER"), None)
        if not before or not after:
            raise InvalidStateError("Both Before and After images are required before verification")
        return detail, before, after

    def save_verification(self, issue_id: UUID, verification: IssueVerification) -> IssueDetail:
        self.get_issue(issue_id)
        self.client.table("issue_verifications").upsert(
            {"issue_id": str(issue_id), **verification.model_dump(mode="json")}
        ).execute()
        return self.get_issue(issue_id)

    def resolve(self, issue_id: UUID) -> IssueDetail:
        self.get_issue(issue_id)
        verification = self._rows(
            self.client.table("issue_verifications").select("issue_id").eq("issue_id", str(issue_id)).execute()
        )
        if not verification:
            raise InvalidStateError("Run Before/After verification before final approval")
        self.client.table("issues").update(
            {"status": "RESOLVED", "resolved_at": datetime.now(UTC).isoformat()}
        ).eq("id", str(issue_id)).execute()
        return self.get_issue(issue_id)

    def get_insights(self) -> InsightsResponse:
        issues = self.list_issues()
        locations = {
            row["id"]: row["name"]
            for row in self._rows(self.client.table("locations").select("id,name").execute())
        }
        by_location = Counter(locations.get(str(issue.location_id), str(issue.location_id)) for issue in issues)
        by_category = Counter(issue.category for issue in issues)
        insights: list[InsightItem] = []
        if by_category:
            category, count = by_category.most_common(1)[0]
            insights.append(InsightItem(kind="repeat_issue", title=f"반복 문제: {category}", detail=f"최근 30일 동안 {category} 유형 이슈가 {count}건 접수되었습니다.", metric=f"{count}건"))
        if by_location:
            location, count = by_location.most_common(1)[0]
            percentage = round(count / max(len(issues), 1) * 100)
            insights.append(InsightItem(kind="location_concentration", title=f"문제 집중 지점: {location}", detail=f"전체 최근 이슈의 {percentage}%가 이 지점에서 발생했습니다.", metric=f"{percentage}%"))
        if insights:
            insights.append(InsightItem(kind="recommendation", title="권장 조치", detail="반복 이슈가 많은 설비와 지점을 우선 점검하고, 처리 전후 사진을 남겨 추세를 확인하세요.", metric="운영 권장"))
        return InsightsResponse(period_days=30, total_issues=len(issues), by_location=dict(by_location), by_category=dict(by_category), insights=insights)
