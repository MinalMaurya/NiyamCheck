import re
from typing import Optional, List
from backend.app.schemas.declarations import (
    DeclarationField,
    DeclarationState,
    ConsumerCareValue,
    BoundingBox,
)
from backend.app.schemas.ocr import OCRTextBox


class ConsumerCareExtractor:
    """
    Extracts Consumer Care / Grievance Redressal details
    under Legal Metrology Rule 6(1)(da).
    """

    EMAIL_REGEX = re.compile(
        r"[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+",
        re.IGNORECASE,
    )

    PHONE_REGEX = re.compile(
        r"(?:(?:CALL|TEL|PH|PHONE|TOLL[\s-]*FREE|HELPLINE|NO\.?)[^\d\n]*)?"
        r"\b(1800[\s-]*\d{2,4}[\s-]*\d{3,4}|\+91[\s-]*\d{10}|\b\d{3,4}[\s-]*\d{6,8}\b)",
        re.IGNORECASE,
    )

    CARE_KEYWORD_REGEX = re.compile(
        r"(?:CONSUMER\s*(?:CARE|CELL|FEEDBACK|GRIEVANCE)|CUSTOMER\s*(?:CARE|SERVICE|SUPPORT)|FOR\s*COMPLAINTS)",
        re.IGNORECASE,
    )

    def extract(
        self, raw_text: str, boxes: List[OCRTextBox]
    ) -> DeclarationField[ConsumerCareValue]:
        email_found = None
        phone_found = None
        matched_box = None

        # 1. Search line by line
        for box in boxes:
            if not email_found:
                m_email = self.EMAIL_REGEX.search(box.text)
                if m_email:
                    email_found = m_email.group(0).strip()
                    matched_box = box

            if not phone_found:
                m_phone = self.PHONE_REGEX.search(box.text)
                if m_phone:
                    phone_found = m_phone.group(1).strip()
                    if not matched_box:
                        matched_box = box

        # 2. Search raw text if not yet found
        if not email_found:
            m_email = self.EMAIL_REGEX.search(raw_text)
            if m_email:
                email_found = m_email.group(0).strip()

        if not phone_found:
            m_phone = self.PHONE_REGEX.search(raw_text)
            if m_phone:
                phone_found = m_phone.group(1).strip()

        has_keywords = bool(self.CARE_KEYWORD_REGEX.search(raw_text))

        if email_found or phone_found:
            confidence = 0.95 if (email_found and phone_found) else 0.85
            state = DeclarationState.PRESENT
            notes = "Consumer care contact channel detected."
            if not (email_found and phone_found):
                notes += " (Legal Metrology typically mandates telephone and email)."

            return DeclarationField[ConsumerCareValue](
                state=state,
                value=ConsumerCareValue(
                    helpline_number=phone_found,
                    email=email_found,
                    address="At manufacturer / above address" if has_keywords else None,
                ),
                raw_text=matched_box.text if matched_box else None,
                confidence=confidence,
                bounding_box=matched_box.bounding_box if matched_box else None,
                notes=notes,
            )

        if has_keywords:
            return DeclarationField[ConsumerCareValue](
                state=DeclarationState.UNCLEAR,
                notes="Consumer feedback heading detected but helpline number/email could not be parsed.",
            )

        return DeclarationField[ConsumerCareValue](
            state=DeclarationState.MISSING,
            notes="No consumer care details (email, helpline number) found on scanned package.",
        )
