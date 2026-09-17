from typing import Optional, List, Dict, Any, Union
from pydantic import BaseModel, Field


class BoundingBox(BaseModel):
    """
    Normalized bounding box coordinates relative to image dimensions (0.0 to 1.0).
    Uses project standard: [ymin, xmin, ymax, xmax].
    """
    ymin: float = Field(..., ge=0.0, le=1.0, description="Top edge (0.0 - 1.0)")
    xmin: float = Field(..., ge=0.0, le=1.0, description="Left edge (0.0 - 1.0)")
    ymax: float = Field(..., ge=0.0, le=1.0, description="Bottom edge (0.0 - 1.0)")
    xmax: float = Field(..., ge=0.0, le=1.0, description="Right edge (0.0 - 1.0)")

    @property
    def x(self) -> float:
        return self.xmin

    @property
    def y(self) -> float:
        return self.ymin

    @property
    def width(self) -> float:
        return round(max(0.0, self.xmax - self.xmin), 4)

    @property
    def height(self) -> float:
        return round(max(0.0, self.ymax - self.ymin), 4)

    def to_list(self) -> List[float]:
        return [self.ymin, self.xmin, self.ymax, self.xmax]

    def to_dict(self) -> Dict[str, float]:
        return {
            "ymin": self.ymin,
            "xmin": self.xmin,
            "ymax": self.ymax,
            "xmax": self.xmax,
            "x": self.x,
            "y": self.y,
            "width": self.width,
            "height": self.height,
        }


class EvidenceItem(BaseModel):
    """
    Audit-grade evidence item linking an evaluation finding directly to
    the origin image, OCR text, and localized bounding box coordinates.
    """
    evidence_id: str = Field(..., description="Unique identifier for this piece of evidence, e.g. ev-001")
    image_id: str = Field(..., description="ID of source package image / panel, e.g. img-001")
    rule_id: str = Field(..., description="Related Legal Metrology rule ID, e.g. LM-NQ-001")
    field: str = Field(..., description="Target declaration field name")
    text: str = Field(..., description="Verbatim text detected by OCR")
    confidence: float = Field(..., ge=0.0, le=1.0, description="Detection confidence score")
    bounding_box: Optional[BoundingBox] = Field(None, description="Localized bounding box if available")
    source: str = Field("ocr", description="Data source provider ('ocr', 'metadata', etc.)")
    panel: Optional[str] = Field("UNKNOWN", description="Package panel location (FRONT, BACK, etc.)")


class RuleEvidence(BaseModel):
    """
    Structured evidence payload embedded inside RuleEvaluation.
    Maintains backward compatibility with string equality and string casting.
    """
    text: str
    image_id: Optional[str] = None
    bounding_box: Optional[BoundingBox] = None
    confidence: float = Field(1.0, ge=0.0, le=1.0)
    panel: Optional[str] = "UNKNOWN"

    def __eq__(self, other: Any) -> bool:
        if isinstance(other, str):
            return self.text == other
        if isinstance(other, RuleEvidence):
            return (
                self.text == other.text
                and self.image_id == other.image_id
                and self.bounding_box == other.bounding_box
            )
        return super().__eq__(other)

    def __str__(self) -> str:
        return self.text
