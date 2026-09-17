from enum import Enum
from typing import Optional, List, Union, Any
from pydantic import BaseModel, Field


class RuleStatus(str, Enum):
    """
    Evaluation outcome for an individual Legal Metrology rule.
    UNCLEAR and NOT_VERIFIABLE have distinct legal/technical meanings:
    - UNCLEAR: Text detected in candidate area but ambiguous or below confidence threshold.
    - NOT_VERIFIABLE: Missing packaging panel / obscured area; cannot ascertain.
    """
    PASS = "PASS"
    FAIL = "FAIL"
    UNCLEAR = "UNCLEAR"
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
