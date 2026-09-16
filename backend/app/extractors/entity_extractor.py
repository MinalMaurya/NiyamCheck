import re
from typing import Optional, List, Tuple
from backend.app.schemas.declarations import (
    DeclarationField,
    DeclarationState,
    ManufacturerValue,
    GenericNameValue,
    CountryOfOriginValue,
    BoundingBox,
)
from backend.app.schemas.ocr import OCRTextBox


class EntityExtractor:
    """
    Extracts Manufacturer/Packer/Importer address, Generic Name,
    and Country of Origin under Legal Metrology Rule 6(1)(a), (b), (e).
    """

    PIN_CODE_REGEX = re.compile(r"\b([1-9]\d{2}\s?\d{3})\b")

    MFG_ENTITY_REGEX = re.compile(
        r"(?:M(?:FD|ANFACTURED|ANUFACTURING)|P(?:KD|ACKED|ACKAGING)|M(?:KTD|ARKETED)|IMP(?:ORTED)?)"
        r"[^\w\n]*(?:&|AND)?\s*(?:BY)?[:\s-]*([^\n\r]+)",
        re.IGNORECASE,
    )

    COUNTRY_OF_ORIGIN_REGEX = re.compile(
        r"(?:COUNTRY\s*OF\s*ORIGIN|MADE\s*IN|PRODUCT\s*OF)[:\s-]*([a-zA-Z\s]+)",
        re.IGNORECASE,
    )

    INDIAN_STATES = [
        "Andhra Pradesh", "Arunachal Pradesh", "Assam", "Bihar", "Chhattisgarh",
        "Goa", "Gujarat", "Haryana", "Himachal Pradesh", "Jharkhand", "Karnataka",
        "Kerala", "Madhya Pradesh", "Maharashtra", "Manipur", "Meghalaya", "Mizoram",
        "Nagaland", "Odisha", "Punjab", "Rajasthan", "Sikkim", "Tamil Nadu",
        "Telangana", "Tripura", "Uttar Pradesh", "Uttarakhand", "West Bengal",
        "Delhi", "Chandigarh", "Puducherry"
    ]

    def extract(
        self, raw_text: str, boxes: List[OCRTextBox]
    ) -> Tuple[
        DeclarationField[ManufacturerValue],
        DeclarationField[GenericNameValue],
        DeclarationField[CountryOfOriginValue],
    ]:
        mfg_field = self._extract_manufacturer(raw_text, boxes)
        generic_field = self._extract_generic_name(raw_text, boxes)
        origin_field = self._extract_country_of_origin(raw_text, boxes)
        return mfg_field, generic_field, origin_field

    def _extract_manufacturer(
        self, raw_text: str, boxes: List[OCRTextBox]
    ) -> DeclarationField[ManufacturerValue]:
        matched_box = None
        extracted_name = None
        extracted_address = None
        pin_code = None
        state_found = None

        # 1. Look for entity indicator in boxes
        for idx, box in enumerate(boxes):
            m = self.MFG_ENTITY_REGEX.search(box.text)
            if m:
                matched_box = box
                extracted_name = m.group(1).strip()
                # Address often spans this box or next consecutive box
                address_parts = [extracted_name]
                if idx + 1 < len(boxes):
                    next_text = boxes[idx + 1].text
                    # if next box doesn't look like an MRP or Date, it could be address
                    if not any(k in next_text.upper() for k in ["MRP", "RS.", "MFD", "NET WT", "CONSUMER"]):
                        address_parts.append(next_text)
                extracted_address = ", ".join(address_parts)
                break

        # 2. Extract PIN code and State across text
        pin_m = self.PIN_CODE_REGEX.search(raw_text)
        if pin_m:
            pin_code = pin_m.group(1).replace(" ", "")

        for state in self.INDIAN_STATES:
            if state.upper() in raw_text.upper():
                state_found = state
                break

        if extracted_address or pin_code:
            notes = "Manufacturer/packer details identified."
            if not pin_code:
                notes += " (Warning: Missing 6-digit postal PIN code)."

            return DeclarationField[ManufacturerValue](
                state=DeclarationState.PRESENT,
                value=ManufacturerValue(
                    role="manufacturer",
                    name=extracted_name,
                    full_address=extracted_address or raw_text[:120],
                    pin_code=pin_code,
                    state=state_found,
                ),
                raw_text=matched_box.text if matched_box else None,
                confidence=matched_box.confidence if matched_box else 0.85,
                bounding_box=matched_box.bounding_box if matched_box else None,
                notes=notes,
            )

        return DeclarationField[ManufacturerValue](
            state=DeclarationState.MISSING,
            notes="Name and address of manufacturer/packer not found.",
        )

    def _extract_generic_name(
        self, raw_text: str, boxes: List[OCRTextBox]
    ) -> DeclarationField[GenericNameValue]:
        # Usually one of the earliest prominent lines without legal boilerplate
        candidate_box = None
        for box in boxes:
            t = box.text.strip()
            # Ignore short noise or obvious declaration labels
            if len(t) > 4 and not any(
                prefix in t.upper()
                for prefix in ["MRP", "NET", "MFD", "PKD", "EXP", "USE BY", "BATCH", "INGREDIENTS", "CALL", "EMAIL", "MADE IN"]
            ):
                candidate_box = box
                break

        if candidate_box:
            return DeclarationField[GenericNameValue](
                state=DeclarationState.PRESENT,
                value=GenericNameValue(name=candidate_box.text.strip()),
                raw_text=candidate_box.text.strip(),
                confidence=candidate_box.confidence,
                bounding_box=candidate_box.bounding_box,
                notes="Generic/brand commodity name identified.",
            )

        # Fallback to first line if available
        first_line = raw_text.split("\n")[0] if raw_text else None
        if first_line and len(first_line) > 3:
            return DeclarationField[GenericNameValue](
                state=DeclarationState.UNCLEAR,
                value=GenericNameValue(name=first_line.strip()),
                raw_text=first_line.strip(),
                confidence=0.70,
                notes="Candidate generic name inferred from top text line.",
            )

        return DeclarationField[GenericNameValue](
            state=DeclarationState.MISSING,
            notes="Generic or common name of commodity not detected.",
        )

    def _extract_country_of_origin(
        self, raw_text: str, boxes: List[OCRTextBox]
    ) -> DeclarationField[CountryOfOriginValue]:
        for box in boxes:
            m = self.COUNTRY_OF_ORIGIN_REGEX.search(box.text)
            if m:
                country = m.group(1).strip()
                return DeclarationField[CountryOfOriginValue](
                    state=DeclarationState.PRESENT,
                    value=CountryOfOriginValue(country=country),
                    raw_text=box.text.strip(),
                    confidence=box.confidence,
                    bounding_box=box.bounding_box,
                    notes="Country of origin explicitly declared.",
                )

        m = self.COUNTRY_OF_ORIGIN_REGEX.search(raw_text)
        if m:
            country = m.group(1).strip()
            return DeclarationField[CountryOfOriginValue](
                state=DeclarationState.PRESENT,
                value=CountryOfOriginValue(country=country),
                raw_text=m.group(0).strip(),
                confidence=0.90,
                notes="Country of origin detected in package text.",
            )

        return DeclarationField[CountryOfOriginValue](
            state=DeclarationState.NOT_APPLICABLE,
            notes="Country of origin declaration not detected or not applicable.",
        )
