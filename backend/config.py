from typing import List
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    PROJECT_NAME: str = "NiyamCheck"
    VERSION: str = "0.1.0"
    API_V1_STR: str = "/api/v1"
    DESCRIPTION: str = "NiyamCheck API — Legal Metrology Compliance Inspection Platform"

    # OCR Configuration: "AUTO", "APPLE_VISION", "TESSERACT", "PADDLE", "MOCK"
    OCR_ENGINE: str = "AUTO"

    # Image Quality Thresholds
    IQA_BLUR_THRESHOLD_GOOD: float = 100.0
    IQA_BLUR_THRESHOLD_ACCEPTABLE: float = 40.0
    IQA_MIN_WIDTH: int = 300
    IQA_MIN_HEIGHT: int = 300
    IQA_BRIGHTNESS_MIN_ACCEPTABLE: float = 45.0
    IQA_BRIGHTNESS_MAX_ACCEPTABLE: float = 240.0
    IQA_CONTRAST_MIN_ACCEPTABLE: float = 20.0

    # CORS: Allow local development frontend by default without unrestricted wildcard
    CORS_ORIGINS: List[str] = [
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    ]

    # File Upload Security: 25 MB max per image
    MAX_UPLOAD_SIZE_BYTES: int = 25 * 1024 * 1024

    # Database configuration.
    # The default local setup uses SQLite so the app runs reliably in standard developer environments.
    # Set DATABASE_URL to a PostgreSQL URL in production or on a Postgres-enabled machine.
    DATABASE_URL: str = "sqlite:///./niyamcheck.db"
    DATABASE_ECHO: bool = False

    model_config = SettingsConfigDict(case_sensitive=True, env_file=".env", extra="ignore")


settings = Settings()
