from typing import List
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    PROJECT_NAME: str = "NiyamCheck"
    VERSION: str = "0.1.0"
    API_V1_STR: str = "/api/v1"
    DESCRIPTION: str = "NiyamCheck API — Legal Metrology Compliance Inspection Platform"

    # OCR Configuration: "MOCK", "TESSERACT", "PADDLE", "EASYOCR", "AUTO"
    OCR_ENGINE: str = "MOCK"

    # Image Quality Thresholds
    IQA_BLUR_THRESHOLD_GOOD: float = 100.0
    IQA_BLUR_THRESHOLD_ACCEPTABLE: float = 40.0
    IQA_MIN_WIDTH: int = 300
    IQA_MIN_HEIGHT: int = 300
    IQA_BRIGHTNESS_MIN_ACCEPTABLE: float = 45.0
    IQA_BRIGHTNESS_MAX_ACCEPTABLE: float = 240.0
    IQA_CONTRAST_MIN_ACCEPTABLE: float = 20.0

    # CORS
    CORS_ORIGINS: List[str] = ["*"]

    model_config = SettingsConfigDict(case_sensitive=True, env_file=".env", extra="ignore")


settings = Settings()
