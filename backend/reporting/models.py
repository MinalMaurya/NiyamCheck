from datetime import datetime
from typing import Dict, Optional, List, Any
from pydantic import BaseModel, Field

from backend.compliance.models import ComplianceResult, ComplianceStatus
from backend.evidence.models import EvidenceItem


class InspectionReport(BaseModel):
    """
    Standardized, exportable Legal Metrology packaging compliance inspection report.
    Suitable for JSON export, PDF generation, enforcement archives, and client apps.
    """
    inspection_id: str
    generated_at: datetime = Field(default_factory=datetime.utcnow)
    overall_status: ComplianceStatus
    summary: str
    image_count: int
    product_information: Dict[str, Optional[str]] = Field(default_factory=dict)
    compliance: ComplianceResult
    findings: List[str] = Field(default_factory=list)
    evidence: List[EvidenceItem] = Field(default_factory=list)
    limitations: List[str] = Field(default_factory=list)
    integrity_hash: str = Field(..., description="Deterministic SHA-256 hash of the canonical inspection data")
