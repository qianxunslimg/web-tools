from __future__ import annotations

from functools import lru_cache
from pathlib import Path

from loguru import logger
from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict
from pytz import timezone


APP_DIR = Path(__file__).resolve().parents[1]
BACKEND_DIR = APP_DIR.parent


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=(str(BACKEND_DIR / ".env"),),
        env_file_encoding="utf-8",
        extra="ignore",
    )

    APP_NAME: str = Field(default="web tools")
    APP_VERSION: str = Field(default="0.1.0")
    API_PREFIX: str = Field(default="/api/v1")
    ENVIRONMENT: str = Field(default="local")
    TIME_ZONE: str = Field(default="Asia/Shanghai")

    LOG_LEVEL: str = Field(default="INFO")
    LOG_DIR: str = Field(default=str(APP_DIR / "site_data" / "logs"))
    OPS_DATA_DIR: str = Field(default=str(APP_DIR / "site_data" / "ops"))
    FORM_DATA_DIR: str = Field(default=str(APP_DIR / "site_data" / "forms"))

    DOCS_URL: str = Field(default="/docs")
    OPENAPI_URL: str = Field(default="/openapi.json")

    CORS_ALLOW_ORIGINS: str = Field(default="*")
    CORS_ALLOW_CREDENTIALS: bool = Field(default=False)

    DATABASE_URL: str = Field(default="mysql://user:password@db:3306/database")
    DB_ENABLED: bool = Field(default=False)
    DB_GENERATE_SCHEMAS: bool = Field(default=False)

    EXTERNAL_REQUEST_TIMEOUT_SECONDS: int = Field(default=20)

    def ensure_directories(self):
        Path(self.LOG_DIR).mkdir(parents=True, exist_ok=True)
        Path(self.OPS_DATA_DIR).mkdir(parents=True, exist_ok=True)
        Path(self.FORM_DATA_DIR).mkdir(parents=True, exist_ok=True)

    def get_cors_origins(self):
        origins = [item.strip() for item in self.CORS_ALLOW_ORIGINS.split(",") if item.strip()]
        return origins or ["*"]

    def log_config(self):
        def _mask_database_url(value):
            if "@" not in value or "://" not in value:
                return value
            prefix, suffix = value.split("@", 1)
            if ":" not in prefix:
                return value
            protocol, credential = prefix.split("://", 1)
            if ":" not in credential:
                return value
            username, _ = credential.split(":", 1)
            return "{}://{}:****@{}".format(protocol, username, suffix)

        logger.info("App Configuration:")
        for field_name, value in self.model_dump().items():
            if field_name == "DATABASE_URL":
                value = _mask_database_url(value)
            logger.info("{}: {}", field_name, value)


@lru_cache(maxsize=1)
def get_settings():
    return Settings()


settings = get_settings()


def get_time_zone():
    return timezone(settings.TIME_ZONE)
