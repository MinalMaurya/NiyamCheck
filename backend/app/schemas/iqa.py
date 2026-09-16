from enum import Enum
from typing import List, Optional
from pydantic import BaseModel, Field


class QualityVerdict(str, Enum):
    PASSED = "PASSED"
    WARNING = "WARNING"
    FAILED = "FAILED"


class MetricScore(BaseModel):
    name: str
    score: float
    threshold: float
    passed: bool
    description: str


class QualityIssue(BaseModel):
    issue_type: str = Field(..., description="e.g., 'BLURRY', 'GLARE', 'LOW_RESOLUTION', 'UNDEREXPOSED'")
    severity: str = Field("warning", description="'critical', 'warning', or 'info'")
    message: str
    recommendation: str


class ImageQualityReport(BaseModel):
    """Assessment of image suitability for OCR and legal verification."""
    verdict: QualityVerdict
    is_acceptable_for_ocr: bool
    width: int
    height: int
    sharpness: MetricScore
    glare: MetricScore
    brightness: MetricScore
    issues: List[QualityIssue] = Field(default_factory=list)
    summary: str
