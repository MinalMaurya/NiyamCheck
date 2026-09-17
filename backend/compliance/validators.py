import re
from typing import Tuple, Optional
from backend.compliance.models import RuleStatus
from backend.schemas.analysis import FieldResult, ExtractionStatus

# Standard metric and counting units recognized under Legal Metrology Second Schedule
VALID_UNITS_REGEX = re.compile(
    r"\b(kg|g|gm|grams?|ml|millilitres?|l|ltr|litres?|m|metres?|cm|mm|units?|pieces?|pcs|N)\b",
    re.IGNORECASE,
)
NUMERIC_MAGNITUDE_REGEX = re.compile(r"\b\d+(?:\.\d+)?\b")


def validate_product_name(field: FieldResult[str]) -> Tuple[RuleStatus, str, Optional[str], float]:
    """Validates presence and clarity of common or generic product name."""
    if field.status == ExtractionStatus.PRESENT and field.value:
        return (
            RuleStatus.PASS,
            f"Product identification detected: '{field.value}'.",
            field.raw_text or field.value,
            field.confidence,
        )
    if field.status == ExtractionStatus.UNCLEAR:
        return (
            RuleStatus.UNCLEAR,
            "Candidate product identification text detected but lacks clarity or confidence.",
            field.raw_text or field.value,
            field.confidence,
        )
    if field.status == ExtractionStatus.NOT_VERIFIABLE:
        return (
            RuleStatus.NOT_VERIFIABLE,
            "Product identification could not be verified from the submitted image view.",
            None,
            0.0,
        )
    if field.status == ExtractionStatus.NOT_APPLICABLE:
        return (
            RuleStatus.NOT_APPLICABLE,
            "Product identification rule is not applicable.",
            None,
            1.0,
        )
    # MISSING
    return (
        RuleStatus.FAIL,
        "Product identification / generic name is missing from the scanned package.",
        None,
        max(0.80, field.confidence),
    )


def validate_net_quantity(field: FieldResult[str]) -> Tuple[RuleStatus, str, Optional[str], float]:
    """
    Validates presence, numerical magnitude, and valid unit of measurement for net quantity.
    Prevents false pass if a bare number without unit was extracted.
    """
    if field.status == ExtractionStatus.PRESENT and field.value:
        val_str = field.value.strip()
        has_num = bool(NUMERIC_MAGNITUDE_REGEX.search(val_str))
        has_unit = bool(VALID_UNITS_REGEX.search(val_str))

        if has_num and has_unit:
            return (
                RuleStatus.PASS,
                f"Net quantity declaration detected with valid numeric magnitude and unit: '{field.value}'.",
                field.raw_text or field.value,
                field.confidence,
            )
        elif has_num and not has_unit:
            return (
                RuleStatus.FAIL,
                f"Net quantity value '{field.value}' was detected but lacks a mandatory standard unit of measurement (e.g. g, kg, ml).",
                field.raw_text or field.value,
                field.confidence,
            )
        else:
            return (
                RuleStatus.UNCLEAR,
                f"Quantity declaration text '{field.value}' could not be unambiguously parsed into magnitude and unit.",
                field.raw_text or field.value,
                field.confidence,
            )

    if field.status == ExtractionStatus.UNCLEAR:
        return (
            RuleStatus.UNCLEAR,
            "Quantity text detected but lacks explicit 'Net Qty / Net Weight' declaration prefix.",
            field.raw_text or field.value,
            field.confidence,
        )
    if field.status == ExtractionStatus.NOT_VERIFIABLE:
        return (
            RuleStatus.NOT_VERIFIABLE,
            "Net quantity declaration could not be verified from the submitted image view.",
            None,
            0.0,
        )
    if field.status == ExtractionStatus.NOT_APPLICABLE:
        return (
            RuleStatus.NOT_APPLICABLE,
            "Net quantity declaration is not applicable.",
            None,
            1.0,
        )
    # MISSING
    return (
        RuleStatus.FAIL,
        "Net quantity declaration is missing from the scanned package.",
        None,
        max(0.85, field.confidence),
    )


def validate_mrp(field: FieldResult[str]) -> Tuple[RuleStatus, str, Optional[str], float]:
    """Validates presence and parseability of Maximum Retail Price (MRP)."""
    if field.status == ExtractionStatus.PRESENT and field.value:
        has_num = bool(re.search(r"\d+", field.value))
        if has_num:
            return (
                RuleStatus.PASS,
                f"Maximum Retail Price (MRP) declaration detected and parseable: '{field.value}'.",
                field.raw_text or field.value,
                field.confidence,
            )
        return (
            RuleStatus.UNCLEAR,
            f"MRP text detected but numeric price could not be verified: '{field.value}'.",
            field.raw_text or field.value,
            field.confidence,
        )

    if field.status == ExtractionStatus.UNCLEAR:
        return (
            RuleStatus.UNCLEAR,
            "Price figures detected but lacks mandatory 'MRP' or 'Inclusive of all taxes' statutory declaration.",
            field.raw_text or field.value,
            field.confidence,
        )
    if field.status == ExtractionStatus.NOT_VERIFIABLE:
        return (
            RuleStatus.NOT_VERIFIABLE,
            "MRP declaration could not be verified from the submitted image view.",
            None,
            0.0,
        )
    if field.status == ExtractionStatus.NOT_APPLICABLE:
        return (
            RuleStatus.NOT_APPLICABLE,
            "MRP declaration is not applicable.",
            None,
            1.0,
        )
    # MISSING
    return (
        RuleStatus.FAIL,
        "Maximum Retail Price (MRP) declaration is missing from the scanned package.",
        None,
        max(0.85, field.confidence),
    )


def validate_manufacturer(field: FieldResult[str]) -> Tuple[RuleStatus, str, Optional[str], float]:
    """Validates presence of manufacturer or responsible entity name."""
    if field.status == ExtractionStatus.PRESENT and field.value:
        return (
            RuleStatus.PASS,
            f"Manufacturer / responsible entity detected: '{field.value}'.",
            field.raw_text or field.value,
            field.confidence,
        )
    if field.status == ExtractionStatus.UNCLEAR:
        return (
            RuleStatus.UNCLEAR,
            "Candidate manufacturer entity detected but identity requires manual review.",
            field.raw_text or field.value,
            field.confidence,
        )
    if field.status == ExtractionStatus.NOT_VERIFIABLE:
        return (
            RuleStatus.NOT_VERIFIABLE,
            "Manufacturer details could not be verified from the submitted image view.",
            None,
            0.0,
        )
    if field.status == ExtractionStatus.NOT_APPLICABLE:
        return (
            RuleStatus.NOT_APPLICABLE,
            "Manufacturer declaration is not applicable.",
            None,
            1.0,
        )
    # MISSING
    return (
        RuleStatus.FAIL,
        "Name of manufacturer / responsible entity is missing from the scanned package.",
        None,
        max(0.85, field.confidence),
    )


def validate_address(field: FieldResult[str]) -> Tuple[RuleStatus, str, Optional[str], float]:
    """Validates presence of manufacturer or packer address."""
    if field.status == ExtractionStatus.PRESENT and field.value:
        return (
            RuleStatus.PASS,
            f"Address of manufacturer / packer detected: '{field.value}'.",
            field.raw_text or field.value,
            field.confidence,
        )
    if field.status == ExtractionStatus.UNCLEAR:
        return (
            RuleStatus.UNCLEAR,
            "Partial address or location detected but full postal address/PIN code requires verification.",
            field.raw_text or field.value,
            field.confidence,
        )
    if field.status == ExtractionStatus.NOT_VERIFIABLE:
        return (
            RuleStatus.NOT_VERIFIABLE,
            "Address details could not be verified from the submitted image view.",
            None,
            0.0,
        )
    if field.status == ExtractionStatus.NOT_APPLICABLE:
        return (
            RuleStatus.NOT_APPLICABLE,
            "Address declaration is not applicable.",
            None,
            1.0,
        )
    # MISSING
    return (
        RuleStatus.FAIL,
        "Complete address of manufacturer / packer is missing from the scanned package.",
        None,
        max(0.85, field.confidence),
    )


def validate_dates(field: FieldResult[str]) -> Tuple[RuleStatus, str, Optional[str], float]:
    """Validates presence of date of manufacture or packing."""
    if field.status == ExtractionStatus.PRESENT and field.value:
        return (
            RuleStatus.PASS,
            f"Manufacturing or packing date detected: '{field.value}'.",
            field.raw_text or field.value,
            field.confidence,
        )
    if field.status == ExtractionStatus.UNCLEAR:
        return (
            RuleStatus.UNCLEAR,
            "Date detected on packaging but lacks clear statutory 'MFD / PKD' designation.",
            field.raw_text or field.value,
            field.confidence,
        )
    if field.status == ExtractionStatus.NOT_VERIFIABLE:
        return (
            RuleStatus.NOT_VERIFIABLE,
            "Date information could not be verified from the submitted image view.",
            None,
            0.0,
        )
    if field.status == ExtractionStatus.NOT_APPLICABLE:
        return (
            RuleStatus.NOT_APPLICABLE,
            "Date declaration is not applicable.",
            None,
            1.0,
        )
    # MISSING
    return (
        RuleStatus.FAIL,
        "Date of manufacture or packing is missing from the scanned package.",
        None,
        max(0.85, field.confidence),
    )


def validate_consumer_care(field: FieldResult[str]) -> Tuple[RuleStatus, str, Optional[str], float]:
    """Validates presence of consumer care / grievance redressal contact information."""
    if field.status == ExtractionStatus.PRESENT and field.value:
        return (
            RuleStatus.PASS,
            f"Consumer care contact details detected: '{field.value}'.",
            field.raw_text or field.value,
            field.confidence,
        )
    if field.status == ExtractionStatus.UNCLEAR:
        return (
            RuleStatus.UNCLEAR,
            "Consumer care heading detected but helpline phone/email could not be parsed.",
            field.raw_text or field.value,
            field.confidence,
        )
    if field.status == ExtractionStatus.NOT_VERIFIABLE:
        return (
            RuleStatus.NOT_VERIFIABLE,
            "Consumer care details could not be verified from the submitted image view.",
            None,
            0.0,
        )
    if field.status == ExtractionStatus.NOT_APPLICABLE:
        return (
            RuleStatus.NOT_APPLICABLE,
            "Consumer care declaration is not applicable.",
            None,
            1.0,
        )
    # MISSING
    return (
        RuleStatus.FAIL,
        "Consumer care details (phone number, email, or address) are missing from the scanned package.",
        None,
        max(0.85, field.confidence),
    )


def validate_country_of_origin(field: FieldResult[str]) -> Tuple[RuleStatus, str, Optional[str], float]:
    """Validates presence of country of origin declaration where applicable."""
    if field.status == ExtractionStatus.PRESENT and field.value:
        return (
            RuleStatus.PASS,
            f"Country of origin explicitly declared: '{field.value}'.",
            field.raw_text or field.value,
            field.confidence,
        )
    if field.status == ExtractionStatus.NOT_APPLICABLE:
        return (
            RuleStatus.NOT_APPLICABLE,
            "Country of origin declaration is not applicable or not required for this domestic pack.",
            None,
            1.0,
        )
    if field.status == ExtractionStatus.UNCLEAR:
        return (
            RuleStatus.UNCLEAR,
            "Country of origin wording detected but origin name could not be verified.",
            field.raw_text or field.value,
            field.confidence,
        )
    if field.status == ExtractionStatus.NOT_VERIFIABLE:
        return (
            RuleStatus.NOT_VERIFIABLE,
            "Country of origin could not be verified from the submitted image view.",
            None,
            0.0,
        )
    # MISSING
    return (
        RuleStatus.FAIL,
        "Country of origin declaration is missing where applicable.",
        None,
        max(0.80, field.confidence),
    )
