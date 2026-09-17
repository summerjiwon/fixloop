from __future__ import annotations

from collections import Counter
from datetime import UTC, datetime
from typing import Any, Callable
from uuid import UUID, uuid4

from app.database.store import ACTIVE_STATUSES, STATUS_TRANSITIONS, InvalidStateError, NotFoundError, ReportDraft
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

    def create_pending_issue(
        self, location_id: UUID, before_image_path: str, reporter_text: str | None, issue_id: UUID | None = None
    ) -> IssueDetail:
        """Store a reporter submission immediately, before external AI calls run."""
        self.assert_location(location_id)
        issue_id = issue_id or uuid4()
        self.client.table("issues").insert(
            {
                "id": str(issue_id),
                "location_id": str(location_id),
                "area": "분석 대기",
                "title": "사진 분석 중",
                "description": reporter_text or "AI가 현장 사진을 분석하고 있습니다.",
                "category": "분석 대기",
                "asset_name": "분석 중",
                "severity": "LOW",
                "status": "ANALYZING",
                "ai_confidence": 0,
                "operator_comment": "AI 분석이 완료되면 분류와 권장 조치가 자동으로 반영됩니다.",
            }
        ).execute()
        self.client.table("issue_images").insert(
            {"issue_id": str(issue_id), "image_path": before_image_path, "type": "BEFORE"}
        ).execute()
        # Avoid extra signed-URL, verification and similarity queries on the public QR path.
        return IssueDetail(
            id=issue_id,
            location_id=location_id,
            area="분석 대기",
            title="사진 분석 중",
            description=reporter_text or "AI가 현장 사진을 분석하고 있습니다.",
            category="분석 대기",
            asset_name="분석 중",
            severity="LOW",
            status="ANALYZING",
            ai_confidence=0,
            operator_comment="AI 분석이 완료되면 분류와 권장 조치가 자동으로 반영됩니다.",
            created_at=datetime.now(UTC),
            images=[],
            similar_issues=[],
        )

    def apply_analysis(self, issue_id: UUID, analysis: VisualTriageResult) -> IssueDetail:
        self._row(
            self.client.table("issues").select("id").eq("id", str(issue_id)).maybe_single().execute(),
            "Issue not found",
        )
        self.client.table("issues").update(
            {
                "area": analysis.area,
                "title": analysis.title,
                "description": analysis.description,
                "category": analysis.issue_type,
                "asset_name": analysis.asset,
                "severity": analysis.severity,
                "status": "OPEN",
                "ai_confidence": analysis.confidence,
                "operator_comment": analysis.operator_comment,
            }
        ).eq("id", str(issue_id)).execute()
        return self.get_issue(issue_id)

    def mark_analysis_failed(self, issue_id: UUID) -> IssueDetail:
        self._row(
            self.client.table("issues").select("id").eq("id", str(issue_id)).maybe_single().execute(),
            "Issue not found",
        )
        self.client.table("issues").update(
            {
                "status": "ANALYSIS_FAILED",
                "title": "AI 분석 지연",
                "operator_comment": "AI 분석에 실패했습니다. 사진은 안전하게 접수되어 운영팀이 직접 확인할 수 있습니다.",
            }
        ).eq("id", str(issue_id)).execute()
        return self.get_issue(issue_id)

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
                "area": analysis.area,
                "title": analysis.title,
                "description": analysis.description,
                "category": analysis.issue_type,
                "asset_name": analysis.asset,
                "severity": analysis.severity,
                "status": "OPEN",
                "ai_confidence": analysis.confidence,
                "operator_comment": analysis.operator_comment,
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
        try:
            rows = self._rows(self.client.rpc("find_similar_issues_for_issue", {"p_issue_id": str(issue_id)}).execute())
        except Exception:
            # Existing projects keep operating until the versioned migration is applied.
            return []
        candidates: list[SimilarIssue] = []
        for row in rows:
            candidate = self._row(
                self.client.table("issues").select("id,title,severity,status").eq("id", row["issue_id"]).maybe_single().execute(),
                "Similar issue not found",
            )
            candidates.append(
                SimilarIssue(
                    issue_id=candidate["id"], title=candidate["title"], severity=candidate["severity"],
                    status=candidate["status"], similarity=row["similarity"],
                )
            )
        return candidates

    def save_embedding(self, issue_id: UUID, embedding: list[float]) -> None:
        vector_text = "[" + ",".join(f"{value:.8f}" for value in embedding) + "]"
        self.client.rpc(
            "set_issue_embedding", {"p_issue_id": str(issue_id), "p_embedding": vector_text}
        ).execute()

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
        if status in {"RESOLVED", "NO_ISSUE"}:
            raise InvalidStateError("Use a dedicated final-decision endpoint for terminal statuses")
        issue = self.get_issue(issue_id)
        if status not in STATUS_TRANSITIONS.get(issue.status, set()):
            raise InvalidStateError("This status change does not match the issue workflow")
        self.client.table("issues").update({"status": status}).eq("id", str(issue_id)).execute()
        return self.get_issue(issue_id)

    def mark_no_issue(self, issue_id: UUID) -> IssueDetail:
        issue = self.get_issue(issue_id)
        if issue.status not in ACTIVE_STATUSES:
            raise InvalidStateError("A closed issue cannot be classified again")
        self.client.table("issues").update(
            {"status": "NO_ISSUE", "resolved_at": datetime.now(UTC).isoformat()}
        ).eq("id", str(issue_id)).execute()
        return self.get_issue(issue_id)

    def add_after_image(self, issue_id: UUID, image_url: str) -> IssueDetail:
        issue = self.get_issue(issue_id)
        self.client.table("issue_images").insert(
            {"issue_id": str(issue_id), "image_path": image_url, "type": "AFTER"}
        ).execute()
        if issue.status in ACTIVE_STATUSES:
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
        issue = self.get_issue(issue_id)
        self.client.table("issue_verifications").upsert(
            {"issue_id": str(issue_id), **verification.model_dump(mode="json")}
        ).execute()
        return self.get_issue(issue_id)

    def resolve(self, issue_id: UUID) -> IssueDetail:
        issue = self.get_issue(issue_id)
        verification = self._rows(
            self.client.table("issue_verifications").select("issue_id").eq("issue_id", str(issue_id)).execute()
        )
        if not verification:
            raise InvalidStateError("Run Before/After verification before final approval")
        if issue.status != "VERIFYING":
            raise InvalidStateError("Move the issue to VERIFYING before final approval")
        self.client.table("issues").update(
            {"status": "RESOLVED", "resolved_at": datetime.now(UTC).isoformat()}
        ).eq("id", str(issue_id)).execute()
        return self.get_issue(issue_id)

    def get_insights(self) -> InsightsResponse:
        issues = [issue for issue in self.list_issues() if issue.status != "NO_ISSUE"]
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
