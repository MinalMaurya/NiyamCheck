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
    word_count: Optional[int] = Field(None, description="Total words detected")

    def model_post_init(self, __context: Any) -> None:
        if self.word_count is None:
            self.word_count = len(self.text.split()) if self.text else 0


# --- Multimodal Assessment Schemas Addressing the Packaging Research Gap ---

class CompletenessAssessment(BaseModel):
    """Evaluates whether all statutory sub-elements of a declaration are present."""
    is_complete: bool = True
    completeness_score: float = Field(1.0, ge=0.0, le=1.0)
    missing_components: List[str] = Field(default_factory=list)
    present_components: List[str] = Field(default_factory=list)
    details: Optional[Dict[str, Any]] = None


class ReadabilityAssessment(BaseModel):
    """Evaluates local visual clarity, contrast, and text height on the declaration crop."""
    is_readable: bool = True
    readability_score: float = Field(1.0, ge=0.0, le=1.0)
    local_contrast: float = 0.0
    blur_score: float = 0.0
    estimated_font_height_ratio: float = 0.0
    is_distorted: bool = False
    details: Optional[Dict[str, Any]] = None


class PlacementAssessment(BaseModel):
    """Evaluates spatial placement compliance (e.g. Principal Display Panel, grouping)."""
    is_appropriately_placed: Optional[bool] = None
    panel: str = "UNKNOWN"
    is_on_pdp: bool = False
    layout_zone: str = "BODY"  # HEADER, BODY, FOOTER, CRIMPS
    grouping_verified: bool = True
    details: Optional[Dict[str, Any]] = None


class InterpretationAssessment(BaseModel):
    """Evaluates semantic disambiguation from competing text (nutritional tables, multiple dates)."""
    is_correctly_interpreted: bool = True
    disambiguation_type: str = "STANDARD"
    confidence: float = Field(1.0, ge=0.0, le=1.0)
    notes: Optional[str] = None


class MultimodalAssessment(BaseModel):
    """
    Unified multimodal verification package combining completeness,
    readability, placement, and semantic interpretation.
    """
    completeness: CompletenessAssessment = Field(default_factory=CompletenessAssessment)
    readability: ReadabilityAssessment = Field(default_factory=ReadabilityAssessment)
    placement: PlacementAssessment = Field(default_factory=PlacementAssessment)
    interpretation: InterpretationAssessment = Field(default_factory=InterpretationAssessment)
    overall_multimodal_score: float = Field(1.0, ge=0.0, le=1.0)


T = TypeVar("T")


class FieldResult(BaseModel, Generic[T]):
    value: Optional[T] = Field(None, description="Extracted canonical value")
    status: ExtractionStatus = Field(ExtractionStatus.NOT_VERIFIABLE, description="Extraction certainty state")
    confidence: float = Field(0.0, ge=0.0, le=1.0, description="Extraction confidence score")
    raw_text: Optional[str] = Field(None, description="Verbatim text snippet from label")
    source_panel: Optional[str] = Field(None, description="Packaging panel where value was primarily detected")
    source_image_id: Optional[str] = Field(None, description="Image ID where value was primarily detected")
    additional_sources: Optional[List[Dict[str, Any]]] = Field(default_factory=list, description="Other panels where same value was observed")
    conflicts: Optional[List[Dict[str, Any]]] = Field(default_factory=list, description="Conflicting values detected across different panels")
    # Multimodal assessment addressing the packaging compliance research gap
    multimodal: Optional[MultimodalAssessment] = Field(
        None, description="Multimodal evaluation: completeness, readability, placement, and semantic interpretation"
    )


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


from backend.compliance.models import ComplianceResult
from backend.evidence.models import EvidenceItem


class ImageAnalysisResponse(BaseModel):
    """
    Unified response format for POST /api/v1/analyze/image
    covering Milestone 1 (IQA, OCR, Fields), Milestone 2 (Compliance), and Milestone 3 (Evidence).
    """
    success: bool = True
    image_quality: ImageQualityResult
    ocr: OCRResult
    fields: ExtractedFields
    compliance: Optional[ComplianceResult] = Field(
        None, description="Deterministic Legal Metrology compliance findings (Milestone 2)"
    )
    evidence: List[EvidenceItem] = Field(
        default_factory=list, description="Extracted visual evidence bounding regions (Milestone 3)"
    )
