from enum import Enum
from datetime import datetime
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field

from backend.schemas.analysis import (
    ImageQualityResult,
    OCRResult,
    ExtractedFields,
)
from backend.compliance.models import ComplianceResult, ComplianceStatus
from backend.evidence.models import EvidenceItem


class PanelType(str, Enum):
    FRONT = "FRONT"
    BACK = "BACK"
    LEFT = "LEFT"
    RIGHT = "RIGHT"
    TOP = "TOP"
    BOTTOM = "BOTTOM"
    OTHER = "OTHER"
    UNKNOWN = "UNKNOWN"


class InspectionImage(BaseModel):
    """Encapsulates the individual analysis of one packaging image/panel."""
    image_id: str
    filename: Optional[str] = None
    panel: PanelType = PanelType.UNKNOWN
    quality: ImageQualityResult
    ocr: OCRResult
    fields: ExtractedFields
    compliance: ComplianceResult
    evidence: List[EvidenceItem] = Field(default_factory=list)
    image_url: Optional[str] = Field(None, description="Direct endpoint to fetch packaging image file")


class InspectionSession(BaseModel):
    """
    Unified multi-image inspection session for a pre-packaged commodity.
    Holds single or multi-angle photos with aggregated findings and evidence.
    """
    inspection_id: str
    created_at: datetime = Field(default_factory=datetime.utcnow)
    product_category: Optional[str] = Field("Packaged Food", description="Detected or assigned packaged product category")
    images: List[InspectionImage] = Field(default_factory=list)
    combined_fields: ExtractedFields
    compliance: ComplianceResult
    evidence: List[EvidenceItem] = Field(default_factory=list)
    status: ComplianceStatus
    summary: str
    requirements_checked: int = Field(0, description="Total statutory requirements checked")
    passed: int = Field(0, description="Requirements passed")
    review: int = Field(0, description="Requirements needing review / ambiguous / single-panel unobserved")
    potential_issues: int = Field(0, description="Potential issues / statutory non-compliances")
    findings: List[Any] = Field(default_factory=list, description="Detailed findings list for UI and reporting")

