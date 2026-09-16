import re
from typing import List, Optional

from backend.schemas.analysis import (
    OCRResult,
    ImageQualityResult,
    ImageQualityStatus,
    ExtractedFields,
    FieldResult,
    ExtractionStatus,
)
from backend.extraction.patterns import (
    MRP_PATTERN,
    STANDALONE_PRICE_PATTERN,
    TAX_INCLUSIVE_PATTERN,
    NET_QTY_PATTERN,
    MULTI_PACK_PATTERN,
    STANDALONE_QTY_PATTERN,
    DATE_PREFIX_PATTERN,
    EXPIRY_PATTERN,
    STANDALONE_DATE_PATTERN,
    EMAIL_PATTERN,
    PHONE_PATTERN,
    CARE_KEYWORD_PATTERN,
    PIN_CODE_PATTERN,
    MFG_NAME_PATTERN,
    PACKED_BY_PATTERN,
    IMPORTED_BY_PATTERN,
    COUNTRY_OF_ORIGIN_PATTERN,
    INDIAN_STATES,
)


class FieldExtractor:
    """
    Open-world structured declaration extractor.
    Extracts product declarations without assuming a closed-set catalog of products.
    Assigns extraction states (PRESENT, MISSING, UNCLEAR, NOT_APPLICABLE, NOT_VERIFIABLE).
    """

    def extract(
        self, ocr_result: OCRResult, quality_result: Optional[ImageQualityResult] = None
    ) -> ExtractedFields:
        raw_text = ocr_result.text or ""
        regions = ocr_result.regions or []
        region_texts = [r.text.strip() for r in regions if r.text.strip()]

        # Heuristic: Check if the scanned view has sufficient textual coverage.
        # If image quality is POOR or text is very sparse (< 3 lines),
        # unobserved fields must be NOT_VERIFIABLE (cannot falsely claim MISSING).
        is_poor_quality = quality_result is not None and quality_result.status == ImageQualityStatus.POOR
        is_sparse = len(region_texts) < 3 or len(raw_text.strip()) < 30
        insufficient_context = is_poor_quality or is_sparse

        # 1. Product Name (open-world extraction)
        product_name_res = self._extract_product_name(region_texts, raw_text, insufficient_context)

        # 2. Manufacturer
        mfg_res = self._extract_manufacturer(region_texts, raw_text, insufficient_context)

        # 3. Packer
        packer_res = self._extract_packer(region_texts, raw_text)

        # 4. Importer
        importer_res = self._extract_importer(region_texts, raw_text)

        # 5. Address
        address_res = self._extract_address(region_texts, raw_text, insufficient_context)

        # 6. Net Quantity
        net_qty_res = self._extract_net_quantity(region_texts, raw_text, insufficient_context)

        # 7. Maximum Retail Price (MRP)
        mrp_res = self._extract_mrp(region_texts, raw_text, insufficient_context)

        # 8. Date Information
        date_res = self._extract_date_information(region_texts, raw_text, insufficient_context)

        # 9. Consumer Care
        care_res = self._extract_consumer_care(region_texts, raw_text, insufficient_context)

        # 10. Country of Origin
        origin_res = self._extract_country_of_origin(region_texts, raw_text)

        return ExtractedFields(
            product_name=product_name_res,
            manufacturer=mfg_res,
            packer=packer_res,
            importer=importer_res,
            address=address_res,
            net_quantity=net_qty_res,
            mrp=mrp_res,
            date_information=date_res,
            consumer_care=care_res,
            country_of_origin=origin_res,
        )

    def _extract_product_name(
        self, lines: List[str], raw_text: str, insufficient_context: bool
    ) -> FieldResult[str]:
        # Identify topmost non-declaration line as candidate product name
        for line in lines:
            t = line.strip()
            # Ignore standard declaration boilerplate keywords
            if len(t) >= 3 and not any(
                k in t.upper()
                for k in [
                    "MRP", "NET", "MFD", "PKD", "EXP", "USE BY", "BATCH",
                    "INGREDIENTS", "CALL", "EMAIL", "MADE IN", "PACKED BY",
                    "MANUFACTURED", "CONSUMER", "CUSTOMER", "PRICE", "Rs.", "₹"
                ]
            ):
                return FieldResult[str](
                    value=t,
                    status=ExtractionStatus.PRESENT,
                    confidence=0.90,
                    raw_text=t,
                )

        if lines:
            # Fallback: first line with lower confidence
            first = lines[0].strip()
            return FieldResult[str](
                value=first,
                status=ExtractionStatus.UNCLEAR,
                confidence=0.60,
                raw_text=first,
            )

        return FieldResult[str](
            value=None,
            status=ExtractionStatus.NOT_VERIFIABLE if insufficient_context else ExtractionStatus.MISSING,
            confidence=0.0,
        )

    def _extract_manufacturer(
        self, lines: List[str], raw_text: str, insufficient_context: bool
    ) -> FieldResult[str]:
        for line in lines:
            m = MFG_NAME_PATTERN.search(line)
            if m:
                name = m.group(1).strip()
                return FieldResult[str](
                    value=name,
                    status=ExtractionStatus.PRESENT,
                    confidence=0.92,
                    raw_text=line,
                )

        m = MFG_NAME_PATTERN.search(raw_text)
        if m:
            name = m.group(1).strip()
            return FieldResult[str](
                value=name,
                status=ExtractionStatus.PRESENT,
                confidence=0.88,
                raw_text=m.group(0),
            )

        return FieldResult[str](
            value=None,
            status=ExtractionStatus.NOT_VERIFIABLE if insufficient_context else ExtractionStatus.MISSING,
            confidence=0.0,
        )

    def _extract_packer(self, lines: List[str], raw_text: str) -> FieldResult[str]:
        for line in lines:
            m = PACKED_BY_PATTERN.search(line)
            if m:
                packer = m.group(1).strip()
                return FieldResult[str](
                    value=packer,
                    status=ExtractionStatus.PRESENT,
                    confidence=0.90,
                    raw_text=line,
                )
        return FieldResult[str](
            value=None,
            status=ExtractionStatus.NOT_APPLICABLE,
            confidence=0.0,
        )

    def _extract_importer(self, lines: List[str], raw_text: str) -> FieldResult[str]:
        for line in lines:
            m = IMPORTED_BY_PATTERN.search(line)
            if m:
                importer = m.group(1).strip()
                return FieldResult[str](
                    value=importer,
                    status=ExtractionStatus.PRESENT,
                    confidence=0.90,
                    raw_text=line,
                )
        return FieldResult[str](
            value=None,
            status=ExtractionStatus.NOT_APPLICABLE,
            confidence=0.0,
        )

    def _extract_address(
        self, lines: List[str], raw_text: str, insufficient_context: bool
    ) -> FieldResult[str]:
        pin_match = PIN_CODE_PATTERN.search(raw_text)
        pin = pin_match.group(1).replace(" ", "") if pin_match else None

        state_found = None
        for state in INDIAN_STATES:
            if state.upper() in raw_text.upper():
                state_found = state
                break

        # Find line containing address or pin
        address_line = None
        for idx, line in enumerate(lines):
            if pin and pin in line:
                address_line = line
                # Merge preceding line if it was part of address
                if idx > 0 and ("LTD" in lines[idx - 1].upper() or "PVT" in lines[idx - 1].upper()):
                    address_line = f"{lines[idx - 1]}, {address_line}"
                break
            if "BY:" in line.upper() and ("," in line or state_found):
                address_line = line
                break

        if address_line:
            return FieldResult[str](
                value=address_line.strip(),
                status=ExtractionStatus.PRESENT,
                confidence=0.90,
                raw_text=address_line.strip(),
            )

        if pin or state_found:
            snippet = f"PIN: {pin or 'N/A'}, State: {state_found or 'N/A'}"
            return FieldResult[str](
                value=snippet,
                status=ExtractionStatus.UNCLEAR,
                confidence=0.65,
                raw_text=snippet,
            )

        return FieldResult[str](
            value=None,
            status=ExtractionStatus.NOT_VERIFIABLE if insufficient_context else ExtractionStatus.MISSING,
            confidence=0.0,
        )

    def _extract_net_quantity(
        self, lines: List[str], raw_text: str, insufficient_context: bool
    ) -> FieldResult[str]:
        # Multi-pack check (e.g., 4 x 50 g)
        for line in lines:
            m = MULTI_PACK_PATTERN.search(line)
            if m:
                val = f"{m.group(1)} x {m.group(2)} {m.group(3)}"
                return FieldResult[str](
                    value=val,
                    status=ExtractionStatus.PRESENT,
                    confidence=0.95,
                    raw_text=line.strip(),
                )

        # Standard Net Qty with prefix
        for line in lines:
            m = NET_QTY_PATTERN.search(line)
            if m:
                val = f"{m.group(1)} {m.group(2)}"
                return FieldResult[str](
                    value=val,
                    status=ExtractionStatus.PRESENT,
                    confidence=0.96,
                    raw_text=line.strip(),
                )

        m = NET_QTY_PATTERN.search(raw_text)
        if m:
            val = f"{m.group(1)} {m.group(2)}"
            return FieldResult[str](
                value=val,
                status=ExtractionStatus.PRESENT,
                confidence=0.90,
                raw_text=m.group(0).strip(),
            )

        # Standalone quantity check
        for line in lines:
            m = STANDALONE_QTY_PATTERN.search(line)
            if m:
                val = f"{m.group(1)} {m.group(2)}"
                return FieldResult[str](
                    value=val,
                    status=ExtractionStatus.UNCLEAR,
                    confidence=0.70,
                    raw_text=line.strip(),
                )

        return FieldResult[str](
            value=None,
            status=ExtractionStatus.NOT_VERIFIABLE if insufficient_context else ExtractionStatus.MISSING,
            confidence=0.0,
        )

    def _extract_mrp(
        self, lines: List[str], raw_text: str, insufficient_context: bool
    ) -> FieldResult[str]:
        for line in lines:
            m = MRP_PATTERN.search(line)
            if m:
                amount = m.group(1)
                incl = " (incl. of all taxes)" if TAX_INCLUSIVE_PATTERN.search(line) or TAX_INCLUSIVE_PATTERN.search(raw_text) else ""
                val = f"₹ {amount}{incl}"
                return FieldResult[str](
                    value=val,
                    status=ExtractionStatus.PRESENT,
                    confidence=0.96,
                    raw_text=line.strip(),
                )

        m = MRP_PATTERN.search(raw_text)
        if m:
            amount = m.group(1)
            val = f"₹ {amount}"
            return FieldResult[str](
                value=val,
                status=ExtractionStatus.PRESENT,
                confidence=0.90,
                raw_text=m.group(0).strip(),
            )

        # Standalone currency/price
        for line in lines:
            m = STANDALONE_PRICE_PATTERN.search(line)
            if m:
                val = f"₹ {m.group(1)}"
                return FieldResult[str](
                    value=val,
                    status=ExtractionStatus.UNCLEAR,
                    confidence=0.70,
                    raw_text=line.strip(),
                )

        return FieldResult[str](
            value=None,
            status=ExtractionStatus.NOT_VERIFIABLE if insufficient_context else ExtractionStatus.MISSING,
            confidence=0.0,
        )

    def _extract_date_information(
        self, lines: List[str], raw_text: str, insufficient_context: bool
    ) -> FieldResult[str]:
        for line in lines:
            m = DATE_PREFIX_PATTERN.search(line)
            if m:
                val = line.strip()
                return FieldResult[str](
                    value=val,
                    status=ExtractionStatus.PRESENT,
                    confidence=0.95,
                    raw_text=val,
                )

        m = DATE_PREFIX_PATTERN.search(raw_text)
        if m:
            return FieldResult[str](
                value=m.group(0).strip(),
                status=ExtractionStatus.PRESENT,
                confidence=0.88,
                raw_text=m.group(0).strip(),
            )

        # Standalone date
        for line in lines:
            m = STANDALONE_DATE_PATTERN.search(line)
            if m:
                return FieldResult[str](
                    value=line.strip(),
                    status=ExtractionStatus.UNCLEAR,
                    confidence=0.65,
                    raw_text=line.strip(),
                )

        return FieldResult[str](
            value=None,
            status=ExtractionStatus.NOT_VERIFIABLE if insufficient_context else ExtractionStatus.MISSING,
            confidence=0.0,
        )

    def _extract_consumer_care(
        self, lines: List[str], raw_text: str, insufficient_context: bool
    ) -> FieldResult[str]:
        email_match = EMAIL_PATTERN.search(raw_text)
        phone_match = PHONE_PATTERN.search(raw_text)
        has_heading = bool(CARE_KEYWORD_PATTERN.search(raw_text))

        details: List[str] = []
        if phone_match:
            details.append(f"Phone: {phone_match.group(1).strip()}")
        if email_match:
            details.append(f"Email: {email_match.group(0).strip()}")

        if details:
            combined = ", ".join(details)
            return FieldResult[str](
                value=combined,
                status=ExtractionStatus.PRESENT,
                confidence=0.95 if (phone_match and email_match) else 0.85,
                raw_text=combined,
            )

        if has_heading:
            return FieldResult[str](
                value="Consumer Cell heading detected",
                status=ExtractionStatus.UNCLEAR,
                confidence=0.60,
                raw_text="Consumer Care",
            )

        return FieldResult[str](
            value=None,
            status=ExtractionStatus.NOT_VERIFIABLE if insufficient_context else ExtractionStatus.MISSING,
            confidence=0.0,
        )

    def _extract_country_of_origin(self, lines: List[str], raw_text: str) -> FieldResult[str]:
        for line in lines:
            m = COUNTRY_OF_ORIGIN_PATTERN.search(line)
            if m:
                country = m.group(1).strip()
                return FieldResult[str](
                    value=country,
                    status=ExtractionStatus.PRESENT,
                    confidence=0.98,
                    raw_text=line.strip(),
                )

        m = COUNTRY_OF_ORIGIN_PATTERN.search(raw_text)
        if m:
            country = m.group(1).strip()
            return FieldResult[str](
                value=country,
                status=ExtractionStatus.PRESENT,
                confidence=0.90,
                raw_text=m.group(0).strip(),
            )

        return FieldResult[str](
            value=None,
            status=ExtractionStatus.NOT_VERIFIABLE,
            confidence=0.0,
        )


field_extractor = FieldExtractor()
