from typing import List, Callable, Dict, Tuple, Optional
from backend.compliance.models import RuleDefinition, RuleCategory, RuleSeverity, RuleStatus
from backend.schemas.analysis import FieldResult
import backend.compliance.validators as val

# Initial Rule Catalog for Milestone 2
DEFAULT_RULES: List[RuleDefinition] = [
    RuleDefinition(
        rule_id="LM-PN-001",
        name="Product Identification",
        category=RuleCategory.PRODUCT_IDENTITY,
        description="The common or generic name of the pre-packaged commodity must be printed on the principal display panel.",
        requirement="Common or generic commodity name must be declared.",
        field_name="product_name",
        severity=RuleSeverity.MANDATORY,
    ),
    RuleDefinition(
        rule_id="LM-NQ-001",
        name="Net Quantity Declaration",
        category=RuleCategory.QUANTITY,
        description="The net quantity in standard units of weight, measure, or number must be declared on the package.",
        requirement="Net quantity must contain both a numeric value and standard unit of measurement.",
        field_name="net_quantity",
        severity=RuleSeverity.MANDATORY,
    ),
    RuleDefinition(
        rule_id="LM-MRP-001",
        name="Maximum Retail Price (MRP)",
        category=RuleCategory.PRICING,
        description="Maximum Retail Price inclusive of all taxes must be declared on the retail package.",
        requirement="MRP must declare retail price inclusive of all taxes in INR.",
        field_name="mrp",
        severity=RuleSeverity.MANDATORY,
    ),
    RuleDefinition(
        rule_id="LM-MFG-001",
        name="Manufacturer / Responsible Entity",
        category=RuleCategory.MANUFACTURER,
        description="Name and identity of the manufacturer, packer, or importer responsible for the package must be stated.",
        requirement="Name of manufacturer, packer, or importer must be declared.",
        field_name="manufacturer",
        severity=RuleSeverity.MANDATORY,
    ),
    RuleDefinition(
        rule_id="LM-ADDR-001",
        name="Address of Manufacturer / Packer",
        category=RuleCategory.ADDRESS,
        description="Complete postal address including city, state, or PIN code of the manufacturer or packer must be declared.",
        requirement="Postal address of responsible entity must be declared.",
        field_name="address",
        severity=RuleSeverity.MANDATORY,
    ),
    RuleDefinition(
        rule_id="LM-DATE-001",
        name="Date Information (Mfg / Packing)",
        category=RuleCategory.DATES,
        description="Month and year of manufacture, packing, or import must be printed on the package.",
        requirement="Date of manufacture, packing, or import must be declared.",
        field_name="date_information",
        severity=RuleSeverity.MANDATORY,
    ),
    RuleDefinition(
        rule_id="LM-CARE-001",
        name="Consumer Care Details",
        category=RuleCategory.CONSUMER_CARE,
        description="Name, address, telephone number, and/or email address of the person or office for consumer grievance redressal must be declared.",
        requirement="Helpline phone number, email address, or grievance cell details must be provided.",
        field_name="consumer_care",
        severity=RuleSeverity.MANDATORY,
    ),
    RuleDefinition(
        rule_id="LM-COO-001",
        name="Country of Origin",
        category=RuleCategory.ORIGIN,
        description="Country of origin must be stated where mandatory or declared for packaged goods.",
        requirement="Country of origin must be explicitly stated where applicable.",
        field_name="country_of_origin",
        severity=RuleSeverity.CONDITIONAL,
    ),
]

# Map rule IDs to their corresponding validator function
RULE_VALIDATOR_MAP: Dict[str, Callable[[FieldResult[str]], Tuple[RuleStatus, str, Optional[str], float]]] = {
    "LM-PN-001": val.validate_product_name,
    "LM-NQ-001": val.validate_net_quantity,
    "LM-MRP-001": val.validate_mrp,
    "LM-MFG-001": val.validate_manufacturer,
    "LM-ADDR-001": val.validate_address,
    "LM-DATE-001": val.validate_dates,
    "LM-CARE-001": val.validate_consumer_care,
    "LM-COO-001": val.validate_country_of_origin,
}
