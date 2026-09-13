from __future__ import annotations

from pathlib import PurePosixPath
from uuid import UUID, uuid4


class MemoryStorage:
    """Deterministic local storage address generator used before Supabase is configured."""

    def upload(self, path: str, filename: str, content_type: str, content: bytes) -> str:
        if not content:
            raise ValueError("Image file is empty")
        return f"https://storage.local/{path}/{filename}"

    def signed_url(self, path: str) -> str:
        return path


class SupabaseStorage:
    """Private Supabase Storage wrapper; the database persists object paths, never public URLs."""

    def __init__(self, client: object, bucket: str) -> None:
        self.bucket = client.storage.from_(bucket)

    def upload(self, path: str, filename: str, content_type: str, content: bytes) -> str:
        if not content:
            raise ValueError("Image file is empty")
        safe_name = PurePosixPath(filename).name or "upload.jpg"
        object_path = f"{path}/{uuid4().hex}-{safe_name}"
        self.bucket.upload(
            path=object_path,
            file=content,
            file_options={"content-type": content_type, "upsert": "false"},
        )
        return object_path

    def signed_url(self, path: str, expires_in: int = 3600) -> str:
        response = self.bucket.create_signed_url(path, expires_in)
        if isinstance(response, dict):
            url = response.get("signedURL") or response.get("signedUrl")
        else:
            url = getattr(response, "signed_url", None) or getattr(response, "signedURL", None)
        if not url:
            raise RuntimeError("Supabase did not return a signed Storage URL")
        return str(url)


def draft_before_path(draft_id: UUID) -> str:
    return f"report-drafts/{draft_id}/before"


def issue_after_path(issue_id: UUID) -> str:
    return f"issues/{issue_id}/after"
