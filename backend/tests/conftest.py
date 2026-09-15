"""Stable test configuration that never calls external AI or database services."""

import os


# Set these before pytest imports app.main from the test modules.  Developers can
# keep real credentials in backend/.env without making the unit tests upload
# photos, create Supabase rows, or call Gemini.
os.environ.update(
    {
        "AI_PROVIDER": "mock",
        "DATA_BACKEND": "memory",
        "STORAGE_BACKEND": "memory",
        "AUTH_REQUIRED": "false",
    }
)
