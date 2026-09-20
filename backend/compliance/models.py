from enum import Enum
from typing import Optional, List, Union, Any, Dict
from pydantic import BaseModel, Field


class RuleStatus(str, Enum):
    """
    Evaluation outcome for an individual Legal Metrology rule.
    UNCLEAR and NOT_VERIFIABLE have distinct legal/technical meanings:
    - PASS: Requirement satisfied with verified presence and compliant formatting.
    - FAIL / POTENTIAL_ISSUE: Statutory requirement unfulfilled or contradictory.
    - UNCLEAR / REVIEW: Text detected in candidate area but ambiguous or below confidence threshold.
    - NOT_VERIFIABLE: Missing packaging panel / obscured area; cannot ascertain.
    - NOT_APPLICABLE: Rule does not apply to this category/origin.
    """
    PASS = "PASS"
    FAIL = "FAIL"
    UNCLEAR = "UNCLEAR"
    REVIEW = "REVIEW"
    POTENTIAL_ISSUE = "POTENTIAL_ISSUE"
    NOT_APPLICABLE = "NOT_APPLICABLE"
    NOT_VERIFIABLE = "NOT_VERIFIABLE"


class ComplianceStatus(str, Enum):
    """
    Conservative overall compliance assessment.
    Never overclaims full statutory compliance from partial packaging scans.
    """
    COMPLIANT = "COMPLIANT"
    NON_COMPLIANT = "NON_COMPLIANT"
    PARTIALLY_VERIFIABLE = "PARTIALLY_VERIFIABLE"
    NOT_VERIFIABLE = "NOT_VERIFIABLE"
    NEEDS_REVIEW = "NEEDS_REVIEW"
    POTENTIAL_ISSUES = "POTENTIAL_ISSUES"
    ANALYSIS_UNAVAILABLE = "ANALYSIS_UNAVAILABLE"


class RuleCategory(str, Enum):
    PRODUCT_IDENTITY = "Product Identification"
    QUANTITY = "Quantity Declaration"
    PRICING = "Pricing Declaration"
    MANUFACTURER = "Manufacturer & Responsible Entity"
    ADDRESS = "Address & Origin"
    DATES = "Date Information"
    CONSUMER_CARE = "Consumer Care"
    ORIGIN = "Country of Origin"


class RuleSeverity(str, Enum):
    MANDATORY = "MANDATORY"
    CONDITIONAL = "CONDITIONAL"


class RuleDefinition(BaseModel):
    """Catalog definition of a Legal Metrology requirement."""
    rule_id: str = Field(..., description="Unique rule code, e.g. LM-PN-001")
    name: str = Field(..., description="Human-readable rule title")
    category: RuleCategory = Field(..., description="Rule domain category")
    description: str = Field(..., description="Contextual description of the statutory rule")
    requirement: str = Field(..., description="Exact declaration requirement under Legal Metrology")
    field_name: str = Field(..., description="Related field in ExtractedFields")
    severity: RuleSeverity = Field(RuleSeverity.MANDATORY, description="MANDATORY or CONDITIONAL")
    applicable_categories: Optional[List[str]] = Field(None, description="Categories where rule applies; None indicates all pre-packaged commodities")
    legal_source_ref: Optional[str] = Field(None, description="Statutory rule section or schedule citation")
    expected_declaration: Optional[str] = Field(None, description="Expected declaration text/format")
    evidence_required: Optional[str] = Field(None, description="Description of evidence required to verify compliance")


class RuleEvaluation(BaseModel):
    """Detailed evaluation result for a single rule check."""
    rule_id: str
    name: str
    category: str
    requirement: str
    status: RuleStatus
    reason: str = Field(..., description="Transparent rationale explaining the evaluation")
    evidence: Optional[Union[str, Any]] = Field(None, description="Verbatim raw text or detected value serving as visual evidence")
    confidence: float = Field(0.0, ge=0.0, le=1.0, description="Confidence inherited or derived from extraction")
    field: str
    package_panel: Optional[str] = Field("UNKNOWN", description="Panel location where evidence was located")
    detected_value: Optional[str] = Field(None, description="Extracted canonical value if detected")
    explanation: Optional[str] = Field(None, description="Detailed statutory explanation of finding")
    legal_source: Optional[str] = Field(None, description="Authoritative statutory source reference")
    applicability: Optional[str] = Field("MANDATORY", description="Applicability status for evaluated commodity category")
    expected_declaration: Optional[str] = Field(None, description="Expected declaration format")
    evidence_required: Optional[str] = Field(None, description="Nature of evidence required to verify compliance")
    why_flagged: Optional[str] = Field(None, description="Clear plain-language explanation of why this item was flagged")
    what_can_i_do: Optional[str] = Field(None, description="Actionable recommendation for rectification or packaging verification")
    # Multimodal verification dimensions addressing the packaging research gap
    completeness_status: Optional[str] = Field("COMPLETE", description="Statutory sub-element completeness (COMPLETE, PARTIAL, INCOMPLETE)")
    readability_status: Optional[str] = Field("CLEAR", description="Visual readability (CLEAR, DISTORTED, ILLEGIBLE)")
    placement_status: Optional[str] = Field("COMPLIANT_PDP", description="Layout placement (COMPLIANT_PDP, SECONDARY_PANEL, NON_COMPLIANT_PLACEMENT, NOT_APPLICABLE)")
    interpretation_status: Optional[str] = Field("VERIFIED", description="Semantic disambiguation (VERIFIED, AMBIGUOUS, MISINTERPRETED)")
    multimodal_assessment: Optional[Dict[str, Any]] = Field(None, description="Detailed multimodal assessment sub-scores")
    legal_basis: List[Any] = Field(
        default_factory=list,
        description="Supporting statutory legal provisions retrieved from authoritative knowledge base (Milestone 4)",
    )


class ComplianceResult(BaseModel):
    """Aggregate Legal Metrology compliance findings for a package scan."""
    status: ComplianceStatus
    summary: str = Field(..., description="Conservative, plain-text summary of verification outcome")
    rules_checked: int = Field(..., description="Total rules evaluated")
    rules_passed: int = Field(0, description="Count of rules with status PASS")
    rules_failed: int = Field(0, description="Count of rules with status FAIL")
    rules_unclear: int = Field(0, description="Count of rules with status UNCLEAR")
    rules_not_verifiable: int = Field(0, description="Count of rules with status NOT_VERIFIABLE")
    rules_not_applicable: int = Field(0, description="Count of rules with status NOT_APPLICABLE")
    evaluations: List[RuleEvaluation] = Field(default_factory=list)
    findings: List[str] = Field(default_factory=list, description="Human-readable summary bullet points")

