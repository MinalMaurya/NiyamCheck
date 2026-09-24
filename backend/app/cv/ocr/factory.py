import logging
from typing import Optional

from backend.app.core.config import settings
from backend.app.cv.ocr.base import OCREngine
from backend.app.cv.ocr.mock_engine import MockOCREngine
from backend.app.cv.ocr.paddle_engine import PaddleOCREngine

logger = logging.getLogger(__name__)


class EmptyCVOCREngine(OCREngine):
    """Empty fallback engine when requested OCR engine is unavailable."""

    @property
    def engine_name(self) -> str:
        return "Empty-OCR-Fallback"

    def extract(self, pil_image) -> "OCRResult":
        from backend.app.schemas.ocr import OCRResult
        return OCRResult(
            raw_text="",
            boxes=[],
            line_count=0,
            engine_used=self.engine_name,
            processing_time_ms=0.0,
        )


def get_ocr_engine(engine_name: Optional[str] = None) -> OCREngine:
    """
    Factory function returning the configured OCR engine instance.
    Defaults to settings.OCR_ENGINE.
    """
    selected = (engine_name or settings.OCR_ENGINE).upper()

    if selected in ["PADDLE", "AUTO"]:
        paddle_engine = PaddleOCREngine()
        if paddle_engine._ocr is not None:
            return paddle_engine
        if selected == "PADDLE":
            logger.warning("PaddleOCR library not detected. Falling back to EmptyCVOCREngine.")
            return EmptyCVOCREngine()

    if selected == "MOCK":
        return MockOCREngine()

    # Unknown legacy engine names fall back to MockOCREngine for test compatibility
    logger.warning(f"Engine '{selected}' defaulting to MockOCREngine.")
    return MockOCREngine()

