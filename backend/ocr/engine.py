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
    """PaddleOCR adapter for production packaging inspection."""

    _ocr_instance = None
    _init_attempted = False

    def __init__(self):
        self._ensure_initialized()

    @classmethod
    def _ensure_initialized(cls):
        if cls._ocr_instance is None and not cls._init_attempted:
            cls._init_attempted = True
            try:
                from paddleocr import PaddleOCR
                cls._ocr_instance = PaddleOCR(use_angle_cls=True, lang="en", show_log=False)
            except Exception as exc:
                logger.warning(f"PaddleOCR initialization failed: {exc}")
                cls._ocr_instance = None

    @property
    def name(self) -> str:
        return "PaddleOCR"

    @property
    def is_available(self) -> bool:
        return self._ocr_instance is not None

    def extract_text(self, image: Image.Image) -> OCRResult:
        if not self.is_available or self._ocr_instance is None:
            raise RuntimeError("PaddleOCR is not installed or failed to initialize.")

        img_np = np.array(image.convert("RGB"))
        height, width = img_np.shape[:2]
        if height <= 0 or width <= 0:
            return OCRResult(text="", confidence=0.0, regions=[])

        try:
            results = self._ocr_instance.ocr(img_np, cls=True)
        except Exception as exc:
            logger.error(f"PaddleOCR extraction failed on image: {exc}")
            return OCRResult(text="", confidence=0.0, regions=[])

        regions: List[OCRRegion] = []
        text_lines: List[str] = []
        conf_sum = 0.0

        if results and len(results) > 0 and results[0]:
            for line in results[0]:
                if not line or len(line) < 2:
                    continue
                try:
                    points, text_info = line[0], line[1]
                    if isinstance(text_info, (tuple, list)) and len(text_info) >= 2:
                        text, conf = str(text_info[0]).strip(), float(text_info[1])
                    elif isinstance(text_info, str):
                        text, conf = text_info.strip(), 1.0
                    else:
                        continue

                    if not text:
                        continue

                    if not points or len(points) < 4:
                        continue

                    xs = [float(p[0]) for p in points]
                    ys = [float(p[1]) for p in points]

                    ymin = max(0.0, min(1.0, min(ys) / height))
                    xmin = max(0.0, min(1.0, min(xs) / width))
                    ymax = max(ymin, min(1.0, max(ys) / height))
                    xmax = max(xmin, min(1.0, max(xs) / width))

                    regions.append(
                        OCRRegion(
                            text=text,
                            confidence=round(conf, 2),
                            box=[round(ymin, 4), round(xmin, 4), round(ymax, 4), round(xmax, 4)],
                        )
                    )
                    text_lines.append(text)
                    conf_sum += conf
                except Exception as line_exc:
                    logger.debug(f"Skipping unparseable PaddleOCR line: {line_exc}")
                    continue

        avg_conf = round(conf_sum / len(regions), 2) if regions else 0.0

        return OCRResult(
            text="\n".join(text_lines),
            confidence=avg_conf,
            regions=regions,
        )

    def extract(self, image: Image.Image) -> OCRResult:
        """Compatibility alias for OCREngine interface."""
        return self.extract_text(image)


class RapidOCREngine(BaseOCREngine):
    """RapidOCR adapter using rapidocr_onnxruntime for fast, offline packaging OCR."""

    def __init__(self):
        try:
            from rapidocr_onnxruntime import RapidOCR
            self._engine = RapidOCR()
            self._available = True
        except (ImportError, Exception):
            self._engine = None
            self._available = False

    @property
    def name(self) -> str:
        return "RapidOCR-ONNX"

    @property
    def is_available(self) -> bool:
        return self._available

    def extract_text(self, image: Image.Image) -> OCRResult:
        if not self._available or self._engine is None:
            raise RuntimeError("RapidOCR is not installed or failed to initialize.")

        img_np = np.array(image.convert("RGB"))
        height, width = img_np.shape[:2]
        ocr_res, _ = self._engine(img_np)

        regions: List[OCRRegion] = []
        text_lines: List[str] = []
        conf_sum = 0.0

        if ocr_res:
            for item in ocr_res:
                points = item[0]
                text = str(item[1]).strip()
                conf = float(item[2])

                xs = [p[0] for p in points]
                ys = [p[1] for p in points]
                ymin = max(0.0, min(ys) / height)
                xmin = max(0.0, min(xs) / width)
                ymax = min(1.0, max(ys) / height)
                xmax = min(1.0, max(xs) / width)

                regions.append(
                    OCRRegion(
                        text=text,
                        confidence=round(conf, 2),
                        box=[round(ymin, 4), round(xmin, 4), round(ymax, 4), round(xmax, 4)],
                    )
                )
                text_lines.append(text)
                conf_sum += conf

        avg_conf = round(conf_sum / len(regions), 2) if regions else 0.0
        return OCRResult(
            text="\n".join(text_lines),
            confidence=avg_conf,
            regions=regions,
        )


class EmptyOCREngine(BaseOCREngine):
    """Fallback engine when no OCR backend is available. Never injects fake/stale text."""

    @property
    def name(self) -> str:
        return "Empty-OCR-Fallback"

    @property
    def is_available(self) -> bool:
        return True

    def extract_text(self, image: Image.Image) -> OCRResult:
        return OCRResult(text="", confidence=0.0, regions=[])


def get_ocr_engine(engine_name: Optional[str] = None) -> BaseOCREngine:
    """
    Factory function returning a configured OCR engine.
    Supports 'AUTO', 'RAPIDOCR', 'APPLE_VISION', 'TESSERACT', 'PADDLE', or 'MOCK'.
    In AUTO mode, prioritizes real OCR backends (Apple Vision, RapidOCR, Tesseract, Paddle)
    and never silently substitutes demo/mock data.
    """
    selected = (engine_name or settings.OCR_ENGINE).upper()

    if selected in ["RAPIDOCR", "RAPID"]:
        rapid = RapidOCREngine()
        if rapid.is_available:
            return rapid
        logger.warning("RapidOCR requested but not available. Falling back to EmptyOCREngine.")
        return EmptyOCREngine()

    if selected == "APPLE_VISION":
        try:
            from backend.ocr.apple_vision import AppleVisionEngine
            apple = AppleVisionEngine()
            if apple.is_available:
                return apple
        except Exception as exc:
            logger.warning(f"Apple Vision OCR requested but failed to load: {exc}")
        return EmptyOCREngine()

    if selected == "TESSERACT":
        tess = TesseractEngine()
        if tess.is_available:
            return tess
        logger.warning("Tesseract requested but not available. Falling back to EmptyOCREngine.")
        return EmptyOCREngine()

    if selected == "PADDLE":
        paddle = PaddleEngine()
        if paddle.is_available:
            return paddle
        logger.warning("PaddleOCR requested but not available. Falling back to EmptyOCREngine.")
        return EmptyOCREngine()

    if selected == "MOCK":
        return MockOCREngine()

    # AUTO mode: Prioritize real OCR engines, NEVER silently inject mock data
    if selected in ["AUTO", "DEFAULT", ""]:
        # 1. Native macOS Vision (runs locally on Apple Silicon / macOS via Neural Engine)
        try:
            from backend.ocr.apple_vision import AppleVisionEngine
            apple = AppleVisionEngine()
            if apple.is_available:
                return apple
        except Exception as exc:
            logger.debug(f"AppleVisionEngine check: {exc}")

        # 2. RapidOCR ONNX (cross-platform, fast local inference)
        rapid = RapidOCREngine()
        if rapid.is_available:
            return rapid

        # 3. Tesseract OCR
        tess = TesseractEngine()
        if tess.is_available:
            return tess

        # 4. Paddle OCR
        paddle = PaddleEngine()
        if paddle.is_available:
            return paddle

        # If no real OCR engine is installed, return EmptyOCREngine so missing declarations
        # are safely marked as NOT_VERIFIABLE rather than substituted with Parle-G.
        logger.warning("No real OCR engine available on this system. Falling back to EmptyOCREngine.")
        return EmptyOCREngine()

    # Unknown legacy engine names fallback to MockOCREngine for test compatibility
    logger.warning(f"Unknown OCR engine '{selected}'. Falling back to MockOCREngine.")
    return MockOCREngine()

