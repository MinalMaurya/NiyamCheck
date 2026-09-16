import logging
from typing import Optional, List
from PIL import Image
import numpy as np

from backend.config import settings
from backend.ocr.base import BaseOCREngine
from backend.ocr.mock import MockOCREngine
from backend.schemas.analysis import OCRResult, OCRRegion

logger = logging.getLogger(__name__)


class TesseractEngine(BaseOCREngine):
    """Tesseract OCR adapter using pytesseract."""

    def __init__(self):
        try:
            import pytesseract
            self._pytesseract = pytesseract
            # Quick check if binary is reachable
            self._available = True
        except ImportError:
            self._pytesseract = None
            self._available = False

    @property
    def name(self) -> str:
        return "Tesseract-OCR"

    @property
    def is_available(self) -> bool:
        return self._available

    def extract_text(self, image: Image.Image) -> OCRResult:
        if not self._available:
            raise RuntimeError("pytesseract is not installed.")

        # Extract data dictionary with bounding boxes
        data = self._pytesseract.image_to_data(image, output_type=self._pytesseract.Output.DICT)
        width, height = image.size

        regions: List[OCRRegion] = []
        text_lines: List[str] = []
        conf_sum = 0.0
        conf_count = 0

        n_boxes = len(data["text"])
        for i in range(n_boxes):
            word = data["text"][i].strip()
            conf = float(data["conf"][i])
            if word and conf > 0:
                conf_norm = round(conf / 100.0, 2)
                ymin = round(data["top"][i] / height, 4)
                xmin = round(data["left"][i] / width, 4)
                ymax = round((data["top"][i] + data["height"][i]) / height, 4)
                xmax = round((data["left"][i] + data["width"][i]) / width, 4)

                regions.append(
                    OCRRegion(
                        text=word,
                        confidence=conf_norm,
                        box=[ymin, xmin, ymax, xmax],
                    )
                )
                text_lines.append(word)
                conf_sum += conf_norm
                conf_count += 1

        avg_conf = round(conf_sum / conf_count, 2) if conf_count > 0 else 0.0

        return OCRResult(
            text=" ".join(text_lines),
            confidence=avg_conf,
            regions=regions,
        )


class PaddleEngine(BaseOCREngine):
    """PaddleOCR adapter."""

    def __init__(self):
        try:
            from paddleocr import PaddleOCR
            self._ocr = PaddleOCR(use_angle_cls=True, lang="en", show_log=False)
            self._available = True
        except (ImportError, Exception):
            self._ocr = None
            self._available = False

    @property
    def name(self) -> str:
        return "PaddleOCR"

    @property
    def is_available(self) -> bool:
        return self._available

    def extract_text(self, image: Image.Image) -> OCRResult:
        if not self._available:
            raise RuntimeError("PaddleOCR is not installed.")

        img_np = np.array(image.convert("RGB"))
        height, width = img_np.shape[:2]
        results = self._ocr.ocr(img_np, cls=True)

        regions: List[OCRRegion] = []
        text_lines: List[str] = []
        conf_sum = 0.0

        if results and results[0]:
            for line in results[0]:
                points, (text, conf) = line
                xs = [p[0] for p in points]
                ys = [p[1] for p in points]
                ymin = max(0.0, min(ys) / height)
                xmin = max(0.0, min(xs) / width)
                ymax = min(1.0, max(ys) / height)
                xmax = min(1.0, max(xs) / width)

                regions.append(
                    OCRRegion(
                        text=text.strip(),
                        confidence=round(float(conf), 2),
                        box=[round(ymin, 4), round(xmin, 4), round(ymax, 4), round(xmax, 4)],
                    )
                )
                text_lines.append(text.strip())
                conf_sum += float(conf)

        avg_conf = round(conf_sum / len(regions), 2) if regions else 0.0

        return OCRResult(
            text="\n".join(text_lines),
            confidence=avg_conf,
            regions=regions,
        )


def get_ocr_engine(engine_name: Optional[str] = None) -> BaseOCREngine:
    """
    Factory function returning a configured OCR engine.
    Supports 'MOCK', 'TESSERACT', 'PADDLE', or 'AUTO'.
    Falls back gracefully to MockOCREngine if external libraries are not installed.
    """
    selected = (engine_name or settings.OCR_ENGINE).upper()

    if selected == "TESSERACT":
        tess = TesseractEngine()
        if tess.is_available:
            return tess
        logger.warning("Tesseract requested but not available. Falling back to MockOCREngine.")
        return MockOCREngine()

    if selected == "PADDLE":
        paddle = PaddleEngine()
        if paddle.is_available:
            return paddle
        logger.warning("PaddleOCR requested but not available. Falling back to MockOCREngine.")
        return MockOCREngine()

    # Default to MockOCREngine for testability and portability
    return MockOCREngine()
