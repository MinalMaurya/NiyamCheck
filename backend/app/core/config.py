from typing import List
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    PROJECT_NAME: str = "NiyamCheck"
    VERSION: str = "0.1.0"
    API_V1_STR: str = "/api/v1"
    DESCRIPTION: str = (
        "Legal Metrology (Packaged Commodities) Rules, 2011 Compliance Verification API. "
        "Unified service for Web and Android applications."
    )

    # OCR Configuration
    # Options: "AUTO", "PADDLE", "TESSERACT", "MOCK"
    OCR_ENGINE: str = "AUTO"

    # Image Quality Assessment (IQA) Thresholds
    IQA_BLUR_THRESHOLD: float = 100.0  # Minimum Laplacian variance for acceptable focus
    IQA_GLARE_THRESHOLD: float = 0.15  # Max proportion of saturated pixels (15%)
    IQA_MIN_WIDTH: int = 400          # Minimum image width in pixels
    IQA_MIN_HEIGHT: int = 400         # Minimum image height in pixels

    # CORS Settings (Mobile apps & Web frontend)
    CORS_ORIGINS: List[str] = ["*"]

    model_config = SettingsConfigDict(case_sensitive=True, env_file=".env", extra="ignore")


settings = Settings()
