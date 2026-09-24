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
    product_category: Optional[str] = Field("Packaged Food", description="Classified packaged commodity category")
    product_information: Dict[str, Optional[str]] = Field(default_factory=dict)
    compliance: ComplianceResult
    findings: List[str] = Field(default_factory=list)
    structured_findings: List[Dict[str, Any]] = Field(default_factory=list)
    submitted_panels: List[str] = Field(default_factory=list, description="List of packaging panels submitted")
    panel_details: List[Dict[str, Any]] = Field(default_factory=list, description="Per-panel inspection metadata")
    package_coverage: Dict[str, Any] = Field(default_factory=dict, description="Standard 6-panel coverage assessment")
    summary_counts: Dict[str, int] = Field(default_factory=dict, description="Counts of findings by status")
    what_you_can_do_next: List[str] = Field(default_factory=list, description="Practical next steps for consumers")
    disclaimer: str = Field(
        "This is an AI-assisted informational analysis based on the submitted evidence and referenced sources. It is not a final legal determination. NiyamCheck does not determine that a company has legally violated a requirement solely from this inspection.",
        description="AI-assisted informational analysis disclaimer",
    )
    evidence: List[EvidenceItem] = Field(default_factory=list)
    limitations: List[str] = Field(default_factory=list)
    integrity_hash: str = Field(..., description="Deterministic SHA-256 hash of the canonical inspection data")
    officer_name: Optional[str] = Field(None, description="Inspecting officer name")
    officer_id: Optional[str] = Field(None, description="Inspecting officer badge or ID")
    officer_notes: Optional[str] = Field(None, description="Officer observations and field remarks")
    finding_reviews: Dict[str, Any] = Field(default_factory=dict, description="Officer review decisions per rule ID")
    final_verdict: Optional[str] = Field(None, description="Officer final enforcement verdict")
    is_finalized: bool = Field(False, description="Whether the inspection has been officially signed and finalized")
    finalized_at: Optional[datetime] = Field(None, description="Timestamp of officer finalization")
    establishment_name: Optional[str] = Field(None, description="Retail store or premises inspected")
    sampling_location: Optional[str] = Field(None, description="Physical location or city of inspection")
    batch_sample_id: Optional[str] = Field(None, description="Physical field sample or memo reference ID")

