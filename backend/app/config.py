from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Runtime configuration loaded from environment variables."""

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    ai_provider: str = "mock"
    ai_api_key: str | None = None
    openai_model: str = "gpt-5-mini"
    embedding_model: str = "text-embedding-3-small"
    allowed_origins: str = "http://localhost:3000,http://127.0.0.1:3000"
    data_backend: str = "memory"
    storage_backend: str = "memory"
    supabase_url: str | None = None
    supabase_service_role_key: str | None = None
    storage_bucket: str = "issue-images"

    @property
    def cors_origins(self) -> list[str]:
        return [origin.strip() for origin in self.allowed_origins.split(",") if origin.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()
