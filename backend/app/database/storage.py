from __future__ import annotations

from uuid import UUID


class MemoryStorage:
    """Deterministic local storage address generator used before Supabase is configured."""

    def upload(self, path: str, filename: str, content_type: str, content: bytes) -> str:
        if not content:
            raise ValueError("Image file is empty")
        return f"https://storage.local/{path}/{filename}"


def draft_before_path(draft_id: UUID) -> str:
    return f"report-drafts/{draft_id}/before"


def issue_after_path(issue_id: UUID) -> str:
    return f"issues/{issue_id}/after"
