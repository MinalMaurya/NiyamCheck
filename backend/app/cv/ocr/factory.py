import logging
from typing import Optional

from backend.app.core.config import settings
from backend.app.cv.ocr.base import OCREngine
from backend.app.cv.ocr.mock_engine import MockOCREngine
from backend.app.cv.ocr.paddle_engine import PaddleOCREngine

logger = logging.getLogger(__name__)


def get_ocr_engine(engine_name: Optional[str] = None) -> OCREngine:
    """
    Factory function returning the configured OCR engine instance.
    Defaults to settings.OCR_ENGINE.
    """
    selected = (engine_name or settings.OCR_ENGINE).upper()

    if selected == "PADDLE":
        paddle_engine = PaddleOCREngine()
        if paddle_engine._ocr is not None:
            return paddle_engine
        logger.warning("PaddleOCR library not detected. Falling back to MockOCREngine.")
        return MockOCREngine()

    return MockOCREngine()
