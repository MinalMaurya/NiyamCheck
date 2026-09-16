import re
from typing import Optional, List
from backend.app.schemas.declarations import (
    DeclarationField,
    DeclarationState,
    DateValue,
    BoundingBox,
)
from backend.app.schemas.ocr import OCRTextBox


class DateExtractor:
    """
    Extracts Date of Manufacture / Packing / Import and Expiry
    under Legal Metrology Rule 6(1)(d).
    """

    MONTH_NAMES = {
        "jan": 1, "january": 1, "feb": 2, "february": 2, "mar": 3, "march": 3,
        "apr": 4, "april": 4, "may": 5, "jun": 6, "june": 6,
        "jul": 7, "july": 7, "aug": 8, "august": 8, "sep": 9, "september": 9,
        "oct": 10, "october": 10, "nov": 11, "november": 11, "dec": 12, "december": 12
    }

    # Matches MM/YYYY, MM/YY, DD/MM/YYYY with prefixes like MFD, MFG, PKD, PACKED
    DATE_PREFIX_REGEX = re.compile(
        r"(?:M(?:FD|FG)\.?|DATE\s*OF\s*M(?:FG|ANUFACTURING)|P(?:KD|ACKED)\.?|DATE\s*OF\s*PACK(?:ING)?|IMP(?:ORTED)?\.?)"
        r"[^\d\n]*"
        r"(?:(\d{1,2})[\/\.-])?"
        r"(\d{1,2}|[a-zA-Z]{3,9})[\/\.-]"
        r"(\d{2,4})\b",
        re.IGNORECASE,
    )

    EXPIRY_REGEX = re.compile(
        r"(?:BEST\s*BEFORE|USE\s*BY|EXP(?:IRY)?\.?|EXP\s*DATE)"
        r"[^\d\n]*"
        r"([^\n\r]+)",
        re.IGNORECASE,
    )

    STANDALONE_DATE_REGEX = re.compile(
        r"\b(?:(\d{1,2})[\/\.-])?(\d{1,2}|[a-zA-Z]{3,9})[\/\.-](20\d{2}|\d{2})\b",
        re.IGNORECASE,
    )

    def extract(
        self, raw_text: str, boxes: List[OCRTextBox]
    ) -> DeclarationField[DateValue]:
        expiry_info = self._extract_expiry_text(raw_text, boxes)

        # 1. Search with explicit MFD / PKD prefix
        for box in boxes:
            match = self.DATE_PREFIX_REGEX.search(box.text)
            if match:
                date_val = self._parse_match(match, box.text)
                if date_val:
                    date_val.expiry_date = expiry_info
                    return DeclarationField[DateValue](
                        state=DeclarationState.PRESENT,
                        value=date_val,
                        raw_text=box.text.strip(),
                        confidence=box.confidence,
                        bounding_box=box.bounding_box,
                        notes=f"{date_val.date_type.capitalize()} date verified.",
                    )

        # 2. Search raw text
        match = self.DATE_PREFIX_REGEX.search(raw_text)
        if match:
            date_val = self._parse_match(match, match.group(0))
            if date_val:
                date_val.expiry_date = expiry_info
                matching_box = next((b for b in boxes if match.group(0) in b.text or b.text in match.group(0)), None)
                return DeclarationField[DateValue](
                    state=DeclarationState.PRESENT,
                    value=date_val,
                    raw_text=match.group(0).strip(),
                    confidence=matching_box.confidence if matching_box else 0.85,
                    bounding_box=matching_box.bounding_box if matching_box else None,
                    notes=f"{date_val.date_type.capitalize()} date found in text.",
                )

        # 3. Fallback: Standalone date without explicit prefix
        for box in boxes:
            match = self.STANDALONE_DATE_REGEX.search(box.text)
            if match:
                date_val = self._parse_match(match, box.text, default_type="unknown")
                if date_val:
                    date_val.expiry_date = expiry_info
                    return DeclarationField[DateValue](
                        state=DeclarationState.UNCLEAR,
                        value=date_val,
                        raw_text=box.text.strip(),
                        confidence=box.confidence * 0.70,
                        bounding_box=box.bounding_box,
                        notes="Date detected but lacks clear 'MFD / PKD' statutory designation.",
                    )

        return DeclarationField[DateValue](
            state=DeclarationState.MISSING,
            notes="Date of manufacture or packing not found on scanned packaging surface.",
        )

    def _parse_match(self, match, raw_str: str, default_type: str = "manufacture") -> Optional[DateValue]:
        d_str, m_str, y_str = match.group(1), match.group(2), match.group(3)

        # Determine type
        low = raw_str.lower()
        if "pkd" in low or "packed" in low:
            dtype = "packing"
        elif "imp" in low or "import" in low:
            dtype = "import"
        elif "mfd" in low or "mfg" in low or "manufactur" in low:
            dtype = "manufacture"
        else:
            dtype = default_type

        # Parse month
        month = None
        if m_str.isdigit():
            m_int = int(m_str)
            if 1 <= m_int <= 12:
                month = m_int
        elif m_str.lower() in self.MONTH_NAMES:
            month = self.MONTH_NAMES[m_str.lower()]

        # Parse year
        if not y_str.isdigit():
            return None
        year = int(y_str)
        if year < 100:
            year += 2000

        # Parse day if present
        day = int(d_str) if d_str and d_str.isdigit() and 1 <= int(d_str) <= 31 else None

        return DateValue(
            date_type=dtype,
            month=month,
            year=year,
            day=day,
            raw_string=raw_str.strip(),
        )

    def _extract_expiry_text(self, raw_text: str, boxes: List[OCRTextBox]) -> Optional[str]:
        for box in boxes:
            m = self.EXPIRY_REGEX.search(box.text)
            if m:
                return box.text.strip()
        m = self.EXPIRY_REGEX.search(raw_text)
        if m:
            return m.group(0).strip()
        return None
