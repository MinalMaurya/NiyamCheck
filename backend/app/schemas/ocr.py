from typing import List, Optional
from pydantic import BaseModel, Field
from backend.app.schemas.declarations import BoundingBox


class OCRTextBox(BaseModel):
    """Represents a localized word or text segment recognized by OCR."""
    text: str = Field(..., description="Recognized string")
    confidence: float = Field(1.0, ge=0.0, le=1.0, description="OCR confidence score")
    bounding_box: BoundingBox
    line_number: Optional[int] = None
    block_number: Optional[int] = None


class OCRResult(BaseModel):
    """Structured OCR extraction output."""
    raw_text: str = Field(..., description="Full concatenated text detected in the image")
    boxes: List[OCRTextBox] = Field(default_factory=list, description="Localized text bounding boxes")
    line_count: int = Field(0, description="Total recognized text lines")
    engine_used: str = Field(..., description="Identifier of the OCR engine used")
    processing_time_ms: float = Field(0.0, description="Inference latency in milliseconds")
