import re
from typing import List, Dict, Any, Optional, Tuple

from backend.schemas.analysis import (
    CompletenessAssessment,
    InterpretationAssessment,
)
from backend.extraction.patterns import (
    NUTRITION_EXCLUSIONS,
    PIN_CODE_PATTERN,
    US_ZIP_PATTERN,
    INDIAN_STATES,
    TAX_INCLUSIVE_PATTERN,
    MRP_PATTERN,
    DATE_PREFIX_PATTERN,
    EXPIRY_PATTERN,
    EMAIL_PATTERN,
    PHONE_PATTERN,
    WEBSITE_PATTERN,
)


class SemanticPackagingExtractor:
    """
    Contextual Semantic Information Extractor & Disambiguator.
    Addresses key real-world packaging challenges:
    1. Distinguishes nutrition table gram weights from true Net Quantity.
    2. Disambiguates multiple dates (Mfg vs. Pkd vs. Expiry vs. Batch).
    3. Separates corporate roles (Manufacturer vs. Packer vs. Importer vs. Marketer).
    4. Evaluates statutory declaration completeness across mandatory sub-elements.
    """

    VALID_UNITS = {"g", "gm", "gram", "grams", "kg", "kgs", "kilogram", "kilograms",
                   "ml", "millilitre", "millilitres", "l", "ltr", "litre", "litres",
                   "m", "metre", "metres", "cm", "mm", "units", "unit", "pieces", "pcs", "n"}

    def assess_completeness(
        self,
        field_name: str,
        value: Optional[str],
        raw_text: Optional[str] = None,
    ) -> CompletenessAssessment:
        """
        Evaluates whether all mandatory statutory sub-elements are present.
        """
        if not value or not value.strip():
            return CompletenessAssessment(
                is_complete=False,
                completeness_score=0.0,
                missing_components=["declaration_presence"],
                present_components=[],
                details={"reason": "Declaration was not observed"},
            )

        val_str = value.strip()
        raw_str = (raw_text or value).strip()
        present: List[str] = []
        missing: List[str] = []

        if field_name == "net_quantity":
            # Mandatory: 1) Numeric magnitude, 2) Recognized standard SI metric unit
            has_num = bool(re.search(r"\b\d+(?:\.\d+)?\b", val_str))
            unit_match = re.search(r"\b([a-zA-Z]+)\b", val_str)
            has_valid_unit = False
            if unit_match:
                unit_token = unit_match.group(1).lower()
                has_valid_unit = unit_token in self.VALID_UNITS

            if has_num:
                present.append("numeric_magnitude")
            else:
                missing.append("numeric_magnitude")

            if has_valid_unit:
                present.append("standard_metric_unit")
            else:
                missing.append("standard_metric_unit")

            # Check if explicit "Net Qty" or "Net Wt" prefix was included
            if any(k in raw_str.upper() for k in ["NET WT", "NET WEIGHT", "NET QTY", "NET QUANTITY", "NET CONTENT", "NET VOLUME"]):
                present.append("statutory_prefix")
            else:
                missing.append("statutory_prefix")

        elif field_name == "mrp":
            # Mandatory: 1) Price magnitude, 2) Currency symbol (₹ / Rs.), 3) Tax inclusion clause
            has_num = bool(re.search(r"\d+(?:\.\d+)?", val_str))
            has_curr = bool(re.search(r"(?:₹|Rs\.?|INR)", raw_str, re.IGNORECASE))
            has_tax = bool(TAX_INCLUSIVE_PATTERN.search(raw_str) or "tax" in val_str.lower())

            if has_num:
                present.append("numeric_price")
            else:
                missing.append("numeric_price")

            if has_curr:
                present.append("currency_symbol")
            else:
                missing.append("currency_symbol")

            if has_tax:
                present.append("tax_inclusive_statement")
            else:
                missing.append("tax_inclusive_statement")

        elif field_name == "address":
            # Mandatory: 1) Locality/Premises, 2) State or City, 3) 6-digit postal PIN code
            has_pin = bool(PIN_CODE_PATTERN.search(raw_str) or US_ZIP_PATTERN.search(raw_str))
            has_state = any(s.upper() in raw_str.upper() for s in INDIAN_STATES)
            has_premises = len(val_str.split()) >= 3

            if has_premises:
                present.append("premises_or_street")
            else:
                missing.append("premises_or_street")

            if has_state:
                present.append("city_or_state")
            else:
                missing.append("city_or_state")

            if has_pin:
                present.append("postal_pin_code")
            else:
                missing.append("postal_pin_code")

        elif field_name == "date_information":
            # Mandatory: 1) Month & Year, 2) Statutory Prefix (MFD / PKD)
            has_date_format = bool(re.search(r"\b\d{1,2}[/-]\d{2,4}\b", raw_str) or re.search(r"\b[A-Za-z]{3}[-\s]\d{2,4}\b", raw_str))
            has_prefix = bool(DATE_PREFIX_PATTERN.search(raw_str))

            if has_date_format:
                present.append("month_and_year")
            else:
                missing.append("month_and_year")

            if has_prefix:
                present.append("statutory_prefix_mfd_pkd")
            else:
                missing.append("statutory_prefix_mfd_pkd")

        elif field_name == "consumer_care":
            # Mandatory: 1) Actionable contact channel (phone/email/address), 2) Care heading/cell
            has_phone = bool(PHONE_PATTERN.search(raw_str))
            has_email = bool(EMAIL_PATTERN.search(raw_str))
            has_web = bool(WEBSITE_PATTERN.search(raw_str))
            has_channel = has_phone or has_email or has_web

            if has_channel:
                present.append("actionable_contact_channel")
            else:
                missing.append("actionable_contact_channel")

            if any(k in raw_str.upper() for k in ["CARE", "COMPLAINT", "CONSUMER", "FEEDBACK", "HELP", "TOLL FREE"]):
                present.append("designated_redressal_cell")
            else:
                missing.append("designated_redressal_cell")

        elif field_name == "product_name":
            # Generic commodity name
            if len(val_str) >= 3 and any(c.isalpha() for c in val_str):
                present.append("generic_commodity_name")
            else:
                missing.append("generic_commodity_name")

        elif field_name == "manufacturer":
            if len(val_str) >= 4 and any(c.isalpha() for c in val_str):
                present.append("corporate_entity_name")
            else:
                missing.append("corporate_entity_name")

        elif field_name == "country_of_origin":
            if len(val_str) >= 2 and any(c.isalpha() for c in val_str):
                present.append("country_name")
            else:
                missing.append("country_name")

        total_req = len(present) + len(missing)
        score = round(len(present) / total_req, 2) if total_req > 0 else 1.0
        is_complete = len(missing) == 0

        return CompletenessAssessment(
            is_complete=is_complete,
            completeness_score=score,
            missing_components=missing,
            present_components=present,
            details={"evaluated_string": val_str},
        )

    def disambiguate_interpretation(
        self,
        field_name: str,
        value: Optional[str],
        raw_text: Optional[str] = None,
    ) -> InterpretationAssessment:
        """
        Verifies semantic interpretation to ensure declarations are not confused
        with competing nutritional or decorative elements.
        """
        if not value:
            return InterpretationAssessment(
                is_correctly_interpreted=True,
                disambiguation_type="NONE",
                confidence=0.0,
            )

        val_upper = value.upper()
        raw_upper = (raw_text or value).upper()

        if field_name == "net_quantity":
            # Ensure it is NOT a nutritional table fact (fat, protein, carbs)
            is_nutrition = any(k in raw_upper for k in NUTRITION_EXCLUSIONS)
            if is_nutrition:
                return InterpretationAssessment(
                    is_correctly_interpreted=False,
                    disambiguation_type="NUTRITIONAL_CONFUSION",
                    confidence=0.30,
                    notes="Value was extracted from nutritional table rather than statutory Net Quantity",
                )
            return InterpretationAssessment(
                is_correctly_interpreted=True,
                disambiguation_type="STATUTORY_NET_WEIGHT",
                confidence=0.95,
                notes="Disambiguated from nutritional table values",
            )

        elif field_name == "date_information":
            # Check if this is an expiry date or best before period mistakenly extracted as Mfg date
            is_expiry = bool(EXPIRY_PATTERN.search(raw_upper)) and not bool(DATE_PREFIX_PATTERN.search(raw_upper))
            if is_expiry:
                return InterpretationAssessment(
                    is_correctly_interpreted=False,
                    disambiguation_type="EXPIRY_DATE_CONFUSION",
                    confidence=0.40,
                    notes="Date appears to be expiry or best-before date rather than mandatory manufacture/packing date",
                )
            return InterpretationAssessment(
                is_correctly_interpreted=True,
                disambiguation_type="MFG_DATE_VERIFIED",
                confidence=0.92,
                notes="Verified manufacturing/packing date",
            )

        elif field_name == "mrp":
            # Ensure it is not a serving calorie or percentage number
            if any(k in raw_upper for k in ["CALORIE", "CALORIES", "KCAL", "SERVING", "%"]):
                return InterpretationAssessment(
                    is_correctly_interpreted=False,
                    disambiguation_type="CALORIE_CONFUSION",
                    confidence=0.30,
                    notes="Numeric figure extracted from nutritional calorie declaration",
                )
            return InterpretationAssessment(
                is_correctly_interpreted=True,
                disambiguation_type="STATUTORY_MRP_VERIFIED",
                confidence=0.96,
                notes="Verified Maximum Retail Price",
            )

        return InterpretationAssessment(
            is_correctly_interpreted=True,
            disambiguation_type="STANDARD_VERIFIED",
            confidence=0.90,
        )


semantic_extractor = SemanticPackagingExtractor()
