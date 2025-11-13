"""
Application configuration using Pydantic Settings
"""

from typing import List
from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Application settings loaded from environment variables"""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=True,
        extra="ignore",
    )

    # Server
    HOST: str = Field(default="0.0.0.0", description="Server host")
    PORT: int = Field(default=8000, description="Server port")
    ENVIRONMENT: str = Field(default="development", description="Environment (development/production)")
    DEBUG: bool = Field(default=True, description="Debug mode")
    LOG_LEVEL: str = Field(default="INFO", description="Logging level")

    # Database
    DATABASE_URL: str = Field(
        default="sqlite+aiosqlite:///./whisperflow.db",
        description="Database connection URL"
    )

    # Redis
    REDIS_URL: str = Field(
        default="redis://localhost:6379/0",
        description="Redis connection URL"
    )

    # OpenAI API
    OPENAI_API_KEY: str = Field(description="OpenAI API key")
    OPENAI_ORG_ID: str = Field(default="", description="OpenAI organization ID")

    # Whisper Configuration
    WHISPER_MODEL: str = Field(default="whisper-1", description="Whisper model name")
    WHISPER_LANGUAGE: str = Field(default="ru", description="Default language for transcription")
    WHISPER_TEMPERATURE: float = Field(default=0.0, description="Whisper temperature")

    # GPT Configuration
    GPT_MODEL: str = Field(default="gpt-3.5-turbo", description="GPT model for formatting")
    GPT_TEMPERATURE: float = Field(default=0.7, description="GPT temperature")
    GPT_MAX_TOKENS: int = Field(default=2000, description="Max tokens for GPT response")

    # Security
    SECRET_KEY: str = Field(description="Secret key for JWT and encryption")
    JWT_SECRET: str = Field(description="JWT secret key")
    ALLOWED_ORIGINS: List[str] = Field(
        default=["http://localhost:5173", "http://localhost:3000"],
        description="CORS allowed origins"
    )

    # CORS
    CORS_ALLOW_CREDENTIALS: bool = Field(default=True, description="CORS allow credentials")
    CORS_ALLOW_METHODS: str = Field(
        default="GET,POST,PUT,DELETE,OPTIONS",
        description="CORS allowed methods"
    )
    CORS_ALLOW_HEADERS: str = Field(default="*", description="CORS allowed headers")

    # File Upload
    MAX_UPLOAD_SIZE: int = Field(
        default=26214400,  # 25 MB
        description="Maximum file upload size in bytes"
    )
    UPLOAD_DIR: str = Field(
        default="/tmp/whisperflow/uploads",
        description="Directory for uploaded files"
    )

    # Task Queue
    CELERY_BROKER_URL: str = Field(
        default="redis://localhost:6379/0",
        description="Celery broker URL"
    )
    CELERY_RESULT_BACKEND: str = Field(
        default="redis://localhost:6379/0",
        description="Celery result backend URL"
    )

    # Monitoring
    SENTRY_DSN: str = Field(default="", description="Sentry DSN for error tracking")
    PROMETHEUS_PORT: int = Field(default=9090, description="Prometheus metrics port")

    # Rate Limiting
    RATE_LIMIT_PER_MINUTE: int = Field(default=60, description="Rate limit per minute")
    RATE_LIMIT_PER_HOUR: int = Field(default=1000, description="Rate limit per hour")

    @property
    def is_production(self) -> bool:
        """Check if running in production environment"""
        return self.ENVIRONMENT == "production"

    @property
    def is_development(self) -> bool:
        """Check if running in development environment"""
        return self.ENVIRONMENT == "development"

    def __init__(self, **kwargs):
        super().__init__(**kwargs)
        # Parse ALLOWED_ORIGINS if it's a string
        if isinstance(self.ALLOWED_ORIGINS, str):
            self.ALLOWED_ORIGINS = [
                origin.strip() for origin in self.ALLOWED_ORIGINS.split(",")
            ]


# Create settings instance
settings = Settings()
