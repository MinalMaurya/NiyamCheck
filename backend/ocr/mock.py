from typing import List, Optional, Tuple
from PIL import Image

from backend.ocr.base import BaseOCREngine
from backend.schemas.analysis import OCRResult, OCRRegion

# Realistic synthetic package lines for development & testing
DEFAULT_MOCK_LINES = [
    ("PARLE-G ORIGINAL GLUCOSE BISCUITS", 0.98, [0.08, 0.10, 0.15, 0.85]),
    ("NET WEIGHT: 250 g", 0.96, [0.20, 0.10, 0.26, 0.45]),
    ("M.R.P. Rs. 30.00 (INCL. OF ALL TAXES)", 0.97, [0.28, 0.10, 0.35, 0.65]),
    ("UNIT SALE PRICE: Rs. 0.12 / g", 0.94, [0.36, 0.10, 0.42, 0.55]),
    ("MFD. DATE: 07/2026", 0.95, [0.45, 0.10, 0.51, 0.45]),
    ("BEST BEFORE 6 MONTHS FROM PACKAGING", 0.93, [0.52, 0.10, 0.58, 0.70]),
    ("MANUFACTURED BY: PARLE PRODUCTS PVT. LTD., NORTH LEVEL CROSSING, VILE PARLE EAST, MUMBAI - 400057, MAHARASHTRA", 0.96, [0.62, 0.10, 0.73, 0.90]),
    ("FOR CONSUMER COMPLAINTS CALL 1800-22-7799 OR EMAIL: CS@PARLE.BIZ", 0.95, [0.76, 0.10, 0.85, 0.90]),
    ("COUNTRY OF ORIGIN: INDIA", 0.99, [0.87, 0.10, 0.92, 0.48]),
]


class MockOCREngine(BaseOCREngine):
    """
    High-fidelity mock OCR engine for offline development and test suites.
    Provides realistic packaging text and bounding coordinates without requiring GPU/models.
    """

    def __init__(self, synthetic_lines: Optional[List[Tuple[str, float, List[float]]]] = None):
        self._lines = synthetic_lines if synthetic_lines is not None else DEFAULT_MOCK_LINES

    @property
    def name(self) -> str:
        return "NiyamCheck-MockOCR-v1.0"

    def set_custom_text(self, lines: List[Tuple[str, float, List[float]]]):
        """Override mock lines for specific unit tests."""
        self._lines = lines

    def extract_text(self, image: Image.Image) -> OCRResult:
        regions: List[OCRRegion] = []
        text_lines: List[str] = []
        conf_sum = 0.0

        for text, conf, box in self._lines:
            regions.append(
                OCRRegion(
                    text=text,
                    confidence=conf,
                    box=box,
                )
            )
            text_lines.append(text)
            conf_sum += conf

        avg_conf = round(conf_sum / len(self._lines), 2) if self._lines else 0.0

        return OCRResult(
            text="\n".join(text_lines),
            confidence=avg_conf,
            regions=regions,
        )
