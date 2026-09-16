import re
from typing import Optional, Tuple, List
from backend.app.schemas.declarations import (
    DeclarationField,
    DeclarationState,
    MRPValue,
    UnitSalePriceValue,
    BoundingBox,
)
from backend.app.schemas.ocr import OCRTextBox


class MRPExtractor:
    """
    Extracts Maximum Retail Price (MRP) and Unit Sale Price (USP)
    from packaging text and OCR bounding boxes.
    """

    MRP_REGEX = re.compile(
        r"(?:M\.?R\.?P\.?|MAX(?:IMUM)?\s*RETAIL\s*PRICE|PRICE|MRP)"
        r"[^\d₹Rs\n]*"
        r"(?:₹|Rs\.?|INR)?\s*"
        r"(\d+(?:\.\d{1,2})?)"
        r"(?:\s*/-|\s*INR)?",
        re.IGNORECASE,
    )

    STANDALONE_PRICE_REGEX = re.compile(
        r"(?:₹|Rs\.?)\s*(\d+(?:\.\d{1,2})?)(?:\s*/-)?",
        re.IGNORECASE,
    )

    USP_REGEX = re.compile(
        r"(?:U\.?S\.?P\.?|UNIT\s*SALE\s*PRICE)"
        r"[^\d₹Rs\n]*"
        r"(?:₹|Rs\.?|INR)?\s*"
        r"(\d+(?:\.\d{1,2})?)"
        r"\s*(?:/|per)\s*"
        r"([a-zA-Z]+)",
        re.IGNORECASE,
    )

    TAX_INCLUSIVE_REGEX = re.compile(
        r"(?:INCL\.?|INCLUSIVE)\s*(?:OF)?\s*ALL\s*TAXES",
        re.IGNORECASE,
    )

    def extract(
        self, raw_text: str, boxes: List[OCRTextBox]
    ) -> Tuple[DeclarationField[MRPValue], DeclarationField[UnitSalePriceValue]]:
        mrp_field = self._extract_mrp(raw_text, boxes)
        usp_field = self._extract_usp(raw_text, boxes)
        return mrp_field, usp_field

    def _extract_mrp(
        self, raw_text: str, boxes: List[OCRTextBox]
    ) -> DeclarationField[MRPValue]:
        # 1. Search line by line or box by box for primary MRP match
        for box in boxes:
            match = self.MRP_REGEX.search(box.text)
            if match:
                amount = float(match.group(1))
                incl_taxes = bool(
                    self.TAX_INCLUSIVE_REGEX.search(box.text)
                    or self.TAX_INCLUSIVE_REGEX.search(raw_text)
                )
                return DeclarationField[MRPValue](
                    state=DeclarationState.PRESENT,
                    value=MRPValue(
                        amount=amount,
                        currency="INR",
                        raw_string=box.text.strip(),
                        inclusive_of_all_taxes=incl_taxes,
                    ),
                    raw_text=box.text.strip(),
                    confidence=box.confidence,
                    bounding_box=box.bounding_box,
                    notes="MRP successfully localized with explicit prefix."
                )

        # 2. Check full raw text if multi-line split
        match = self.MRP_REGEX.search(raw_text)
        if match:
            amount = float(match.group(1))
            matching_box = self._find_best_matching_box(match.group(0), boxes)
            incl_taxes = bool(self.TAX_INCLUSIVE_REGEX.search(raw_text))
            return DeclarationField[MRPValue](
                state=DeclarationState.PRESENT,
                value=MRPValue(
                    amount=amount,
                    currency="INR",
                    raw_string=match.group(0).strip(),
                    inclusive_of_all_taxes=incl_taxes,
                ),
                raw_text=match.group(0).strip(),
                confidence=matching_box.confidence if matching_box else 0.85,
                bounding_box=matching_box.bounding_box if matching_box else None,
                notes="MRP localized from multi-line text block."
            )

        # 3. Fallback: Standalone currency symbol
        for box in boxes:
            match = self.STANDALONE_PRICE_REGEX.search(box.text)
            if match:
                amount = float(match.group(1))
                return DeclarationField[MRPValue](
                    state=DeclarationState.UNCLEAR,
                    value=MRPValue(
                        amount=amount,
                        currency="INR",
                        raw_string=box.text.strip(),
                        inclusive_of_all_taxes=False,
                    ),
                    raw_text=box.text.strip(),
                    confidence=box.confidence * 0.75,
                    bounding_box=box.bounding_box,
                    notes="Price found but missing explicit 'MRP' or 'Inclusive of all taxes' declaration.",
                )

        return DeclarationField[MRPValue](
            state=DeclarationState.MISSING,
            notes="No Maximum Retail Price (MRP) declaration detected on scanned surface.",
        )

    def _extract_usp(
        self, raw_text: str, boxes: List[OCRTextBox]
    ) -> DeclarationField[UnitSalePriceValue]:
        for box in boxes:
            match = self.USP_REGEX.search(box.text)
            if match:
                price = float(match.group(1))
                unit = match.group(2).strip().lower()
                return DeclarationField[UnitSalePriceValue](
                    state=DeclarationState.PRESENT,
                    value=UnitSalePriceValue(
                        price_per_unit=price,
                        unit=unit,
                    ),
                    raw_text=box.text.strip(),
                    confidence=box.confidence,
                    bounding_box=box.bounding_box,
                    notes="Unit Sale Price detected and parsed.",
                )

        match = self.USP_REGEX.search(raw_text)
        if match:
            price = float(match.group(1))
            unit = match.group(2).strip().lower()
            matching_box = self._find_best_matching_box(match.group(0), boxes)
            return DeclarationField[UnitSalePriceValue](
                state=DeclarationState.PRESENT,
                value=UnitSalePriceValue(
                    price_per_unit=price,
                    unit=unit,
                ),
                raw_text=match.group(0).strip(),
                confidence=matching_box.confidence if matching_box else 0.85,
                bounding_box=matching_box.bounding_box if matching_box else None,
                notes="Unit Sale Price found in text.",
            )

        return DeclarationField[UnitSalePriceValue](
            state=DeclarationState.NOT_APPLICABLE,
            notes="Unit Sale Price declaration not detected or not applicable for single unit pack.",
        )

    def _find_best_matching_box(self, text: str, boxes: List[OCRTextBox]) -> Optional[OCRTextBox]:
        for box in boxes:
            if text in box.text or box.text in text:
                return box
        return None
