import re
from typing import Optional, List
from backend.app.schemas.declarations import (
    DeclarationField,
    DeclarationState,
    NetQuantityValue,
    BoundingBox,
)
from backend.app.schemas.ocr import OCRTextBox


class NetQuantityExtractor:
    """
    Extracts Net Quantity declarations under Rule 12 & Second Schedule
    of Legal Metrology (Packaged Commodities) Rules, 2011.
    """

    NET_QTY_REGEX = re.compile(
        r"(?:NET\s*(?:WT\.?|WEIGHT|QTY\.?|QUANTITY|VOL\.?|VOLUME|CONTENT|MASS)|QUANTITY|WEIGHT)"
        r"[^\d\n]*"
        r"(\d+(?:\.\d+)?)\s*"
        r"(kg|g|gm|grams?|ml|millilitres?|l|ltr|litres?|m|metres?|cm|mm|units?|pieces?|pcs|N)\b",
        re.IGNORECASE,
    )

    MULTI_PACK_REGEX = re.compile(
        r"(\d+)\s*(?:x|X)\s*(\d+(?:\.\d+)?)\s*(kg|g|gm|ml|l|ltr|units?|N)\b",
        re.IGNORECASE,
    )

    STANDALONE_QTY_REGEX = re.compile(
        r"\b(\d+(?:\.\d+)?)\s*(kg|g|gm|ml|l|ltr|litres?|m|metres?|units?|N)\b",
        re.IGNORECASE,
    )

    UNIT_NORMALIZATION = {
        "g": ("g", 1.0),
        "gm": ("g", 1.0),
        "grams": ("g", 1.0),
        "gram": ("g", 1.0),
        "kg": ("g", 1000.0),
        "ml": ("ml", 1.0),
        "millilitres": ("ml", 1.0),
        "millilitre": ("ml", 1.0),
        "l": ("ml", 1000.0),
        "ltr": ("ml", 1000.0),
        "litres": ("ml", 1000.0),
        "litre": ("ml", 1000.0),
        "m": ("m", 1.0),
        "metres": ("m", 1.0),
        "cm": ("m", 0.01),
        "units": ("units", 1.0),
        "unit": ("units", 1.0),
        "n": ("units", 1.0),
        "pcs": ("units", 1.0),
        "pieces": ("units", 1.0),
    }

    def extract(
        self, raw_text: str, boxes: List[OCRTextBox]
    ) -> DeclarationField[NetQuantityValue]:
        # 1. Check for multi-pack declaration (e.g., 4 x 50 g)
        for box in boxes:
            multi_match = self.MULTI_PACK_REGEX.search(box.text)
            if multi_match:
                count = int(multi_match.group(1))
                mag = float(multi_match.group(2))
                raw_unit = multi_match.group(3).lower()
                norm_unit, multiplier = self.UNIT_NORMALIZATION.get(raw_unit, (raw_unit, 1.0))
                total_norm = count * mag * multiplier

                return DeclarationField[NetQuantityValue](
                    state=DeclarationState.PRESENT,
                    value=NetQuantityValue(
                        magnitude=mag,
                        unit=raw_unit,
                        normalized_magnitude=total_norm,
                        normalized_unit=norm_unit,
                        is_multi_pack=True,
                        pack_count=count,
                    ),
                    raw_text=box.text.strip(),
                    confidence=box.confidence,
                    bounding_box=box.bounding_box,
                    notes=f"Multi-pack declaration detected ({count} items of {mag} {raw_unit}).",
                )

        # 2. Check for explicit Net Quantity keyword match
        for box in boxes:
            match = self.NET_QTY_REGEX.search(box.text)
            if match:
                mag = float(match.group(1))
                raw_unit = match.group(2).lower()
                norm_unit, multiplier = self.UNIT_NORMALIZATION.get(raw_unit, (raw_unit, 1.0))

                return DeclarationField[NetQuantityValue](
                    state=DeclarationState.PRESENT,
                    value=NetQuantityValue(
                        magnitude=mag,
                        unit=raw_unit,
                        normalized_magnitude=mag * multiplier,
                        normalized_unit=norm_unit,
                        is_multi_pack=False,
                    ),
                    raw_text=box.text.strip(),
                    confidence=box.confidence,
                    bounding_box=box.bounding_box,
                    notes="Net quantity declaration verified with explicit keyword prefix.",
                )

        # 3. Check across concatenated raw_text
        match = self.NET_QTY_REGEX.search(raw_text)
        if match:
            mag = float(match.group(1))
            raw_unit = match.group(2).lower()
            norm_unit, multiplier = self.UNIT_NORMALIZATION.get(raw_unit, (raw_unit, 1.0))
            matched_text = match.group(0)
            matching_box = next((b for b in boxes if matched_text in b.text or b.text in matched_text), None)

            return DeclarationField[NetQuantityValue](
                state=DeclarationState.PRESENT,
                value=NetQuantityValue(
                    magnitude=mag,
                    unit=raw_unit,
                    normalized_magnitude=mag * multiplier,
                    normalized_unit=norm_unit,
                    is_multi_pack=False,
                ),
                raw_text=matched_text.strip(),
                confidence=matching_box.confidence if matching_box else 0.85,
                bounding_box=matching_box.bounding_box if matching_box else None,
                notes="Net quantity extracted from multi-line text.",
            )

        # 4. Fallback: Standalone quantity (e.g. 500g printed prominently without "Net Qty" label)
        for box in boxes:
            match = self.STANDALONE_QTY_REGEX.search(box.text)
            if match:
                mag = float(match.group(1))
                raw_unit = match.group(2).lower()
                norm_unit, multiplier = self.UNIT_NORMALIZATION.get(raw_unit, (raw_unit, 1.0))

                return DeclarationField[NetQuantityValue](
                    state=DeclarationState.UNCLEAR,
                    value=NetQuantityValue(
                        magnitude=mag,
                        unit=raw_unit,
                        normalized_magnitude=mag * multiplier,
                        normalized_unit=norm_unit,
                        is_multi_pack=False,
                    ),
                    raw_text=box.text.strip(),
                    confidence=box.confidence * 0.70,
                    bounding_box=box.bounding_box,
                    notes="Quantity found but lacks explicit 'Net Qty / Net Weight' prefix.",
                )

        return DeclarationField[NetQuantityValue](
            state=DeclarationState.MISSING,
            notes="Net quantity declaration not detected on package image.",
        )
