from datetime import datetime
from typing import Optional, Dict, Any
from pydantic import BaseModel, Field

from backend.app.schemas.iqa import ImageQualityReport
from backend.app.schemas.ocr import OCRResult
from backend.app.schemas.declarations import ExtractedDeclarations


class ImageMetadata(BaseModel):
    width: int
    height: int
    format: Optional[str] = None
    file_size_bytes: int


class PipelineAnalysisResponse(BaseModel):
    """
    Unified response payload returned by /api/v1/analyze/pipeline.
    Consumed identically by the responsive Web frontend and native Android application.
    """
    session_id: str = Field(..., description="Unique inspection transaction identifier")
    timestamp: datetime = Field(default_factory=datetime.utcnow)
    client_platform: str = Field("unknown", description="'web', 'android', 'curl', etc.")
    status: str = Field(..., description="'SUCCESS', 'QUALITY_REJECTED', or 'PARTIAL_SUCCESS'")
    image_metadata: ImageMetadata
    quality_report: ImageQualityReport
    ocr_result: Optional[OCRResult] = None
    extracted_declarations: Optional[ExtractedDeclarations] = None
    summary: str = Field(..., description="High-level human readable status of this analysis step")
