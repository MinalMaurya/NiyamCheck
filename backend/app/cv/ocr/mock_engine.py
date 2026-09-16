import time
from typing import List, Optional
from PIL import Image

from backend.app.cv.ocr.base import OCREngine
from backend.app.schemas.declarations import BoundingBox
from backend.app.schemas.ocr import OCRResult, OCRTextBox


# Standard synthetic Legal Metrology packaged commodity label declarations
DEFAULT_SYNTHETIC_LINES = [
    ("PARLE-G ORIGINAL GLUCOSE BISCUITS", 0.08, 0.10, 0.15, 0.85, 0.98),
    ("NET WEIGHT: 250 g", 0.20, 0.10, 0.26, 0.45, 0.96),
    ("M.R.P. Rs. 30.00 (INCL. OF ALL TAXES)", 0.28, 0.10, 0.35, 0.65, 0.97),
    ("UNIT SALE PRICE: Rs. 0.12 / g", 0.36, 0.10, 0.42, 0.55, 0.94),
    ("MFD. DATE: 07/2026", 0.45, 0.10, 0.51, 0.45, 0.95),
    ("BEST BEFORE 6 MONTHS FROM PACKAGING", 0.52, 0.10, 0.58, 0.70, 0.93),
    ("MANUFACTURED & PACKED BY: PARLE PRODUCTS PVT. LTD., NORTH LEVEL CROSSING, VILE PARLE EAST, MUMBAI - 400057, MAHARASHTRA", 0.62, 0.10, 0.73, 0.90, 0.96),
    ("FOR CONSUMER FEEDBACK CONTACT MANAGER AT ABOVE ADDRESS OR CALL 1800-22-7799 OR EMAIL: CS@PARLE.BIZ", 0.76, 0.10, 0.85, 0.90, 0.95),
    ("COUNTRY OF ORIGIN: INDIA", 0.87, 0.10, 0.92, 0.48, 0.99),
]


class MockOCREngine(OCREngine):
    """
    High-fidelity mock OCR engine.
    Allows testing the full pipeline, Web UI, and Android app without GPU or heavy model weights.
    """

    def __init__(self, synthetic_lines: Optional[List[tuple]] = None):
        self._synthetic_lines = synthetic_lines or DEFAULT_SYNTHETIC_LINES

    @property
    def engine_name(self) -> str:
        return "NiyamCheck-MockOCR-v1.0"

    def extract(self, pil_image: Image.Image) -> OCRResult:
        start_time = time.time()
        boxes: List[OCRTextBox] = []
        raw_lines: List[str] = []

        for idx, (text, ymin, xmin, ymax, xmax, conf) in enumerate(self._synthetic_lines):
            boxes.append(
                OCRTextBox(
                    text=text,
                    confidence=conf,
                    bounding_box=BoundingBox(
                        ymin=ymin,
                        xmin=xmin,
                        ymax=ymax,
                        xmax=xmax,
                        confidence=conf,
                    ),
                    line_number=idx + 1,
                    block_number=1,
                )
            )
            raw_lines.append(text)

        elapsed_ms = (time.time() - start_time) * 1000.0

        return OCRResult(
            raw_text="\n".join(raw_lines),
            boxes=boxes,
            line_count=len(boxes),
            engine_used=self.engine_name,
            processing_time_ms=round(elapsed_ms, 2),
        )
