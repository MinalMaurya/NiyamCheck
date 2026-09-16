from enum import Enum
from typing import Optional, List, Dict, Any, Generic, TypeVar
from pydantic import BaseModel, Field


class ImageQualityStatus(str, Enum):
    GOOD = "GOOD"
    ACCEPTABLE = "ACCEPTABLE"
    POOR = "POOR"


class ExtractionStatus(str, Enum):
    """
    Field extraction states.
    Note: These are extraction certainty states, NOT legal compliance decisions.
    """
    PRESENT = "PRESENT"
    MISSING = "MISSING"
    UNCLEAR = "UNCLEAR"
    NOT_APPLICABLE = "NOT_APPLICABLE"
    NOT_VERIFIABLE = "NOT_VERIFIABLE"


class QualityDetails(BaseModel):
    width: int
    height: int
    sharpness_variance: float
    brightness_mean: float
    contrast_std: float


class ImageQualityResult(BaseModel):
    status: ImageQualityStatus = Field(..., description="'GOOD', 'ACCEPTABLE', or 'POOR'")
    score: float = Field(..., ge=0.0, le=1.0, description="Normalized quality score between 0.0 and 1.0")
    issues: List[str] = Field(default_factory=list, description="Actionable feedback for the user")
    details: Optional[QualityDetails] = None


class OCRRegion(BaseModel):
    text: str
    confidence: Optional[float] = Field(None, ge=0.0, le=1.0)
    box: Optional[List[float]] = Field(
        None, description="Normalized bounding coordinates [ymin, xmin, ymax, xmax]"
    )


class OCRResult(BaseModel):
    text: str = Field(..., description="Concatenated raw OCR text")
    confidence: Optional[float] = Field(None, description="Overall OCR average confidence")
    regions: List[OCRRegion] = Field(default_factory=list, description="Extracted text regions with bounding boxes")


T = TypeVar("T")


class FieldResult(BaseModel, Generic[T]):
    value: Optional[T] = Field(None, description="Extracted canonical value")
    status: ExtractionStatus = Field(ExtractionStatus.NOT_VERIFIABLE, description="Extraction certainty state")
    confidence: float = Field(0.0, ge=0.0, le=1.0, description="Extraction confidence score")
    raw_text: Optional[str] = Field(None, description="Verbatim text snippet from label")


class ExtractedFields(BaseModel):
    product_name: FieldResult[str] = Field(default_factory=lambda: FieldResult[str](status=ExtractionStatus.NOT_VERIFIABLE))
    manufacturer: FieldResult[str] = Field(default_factory=lambda: FieldResult[str](status=ExtractionStatus.NOT_VERIFIABLE))
    packer: FieldResult[str] = Field(default_factory=lambda: FieldResult[str](status=ExtractionStatus.NOT_APPLICABLE))
    importer: FieldResult[str] = Field(default_factory=lambda: FieldResult[str](status=ExtractionStatus.NOT_APPLICABLE))
    address: FieldResult[str] = Field(default_factory=lambda: FieldResult[str](status=ExtractionStatus.NOT_VERIFIABLE))
    net_quantity: FieldResult[str] = Field(default_factory=lambda: FieldResult[str](status=ExtractionStatus.NOT_VERIFIABLE))
    mrp: FieldResult[str] = Field(default_factory=lambda: FieldResult[str](status=ExtractionStatus.NOT_VERIFIABLE))
    date_information: FieldResult[str] = Field(default_factory=lambda: FieldResult[str](status=ExtractionStatus.NOT_VERIFIABLE))
    consumer_care: FieldResult[str] = Field(default_factory=lambda: FieldResult[str](status=ExtractionStatus.NOT_VERIFIABLE))
    country_of_origin: FieldResult[str] = Field(default_factory=lambda: FieldResult[str](status=ExtractionStatus.NOT_VERIFIABLE))


class ImageAnalysisResponse(BaseModel):
    """
    Exact response format for POST /api/v1/analyze/image
    as specified in Milestone 1.
    """
    success: bool = True
    image_quality: ImageQualityResult
    ocr: OCRResult
    fields: ExtractedFields
