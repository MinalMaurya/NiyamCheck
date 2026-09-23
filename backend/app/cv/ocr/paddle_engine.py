import time
from typing import List
from PIL import Image
import numpy as np

from backend.app.cv.ocr.base import OCREngine
from backend.app.schemas.declarations import BoundingBox
from backend.app.schemas.ocr import OCRResult, OCRTextBox


class PaddleOCREngine(OCREngine):
    """
    Production OCR adapter for PaddleOCR.
    Handles packaging text orientation, angles, and wild packaging print.
    """

    _ocr_instance = None
    _init_attempted = False

    def __init__(self, use_angle_cls: bool = True, lang: str = "en"):
        self.use_angle_cls = use_angle_cls
        self.lang = lang
        self._ensure_initialized()

    @classmethod
    def _ensure_initialized(cls, use_angle_cls: bool = True, lang: str = "en"):
        if cls._ocr_instance is None and not cls._init_attempted:
            cls._init_attempted = True
            try:
                from paddleocr import PaddleOCR
                cls._ocr_instance = PaddleOCR(use_angle_cls=use_angle_cls, lang=lang, show_log=False)
            except Exception:
                cls._ocr_instance = None

    @property
    def _ocr(self):
        return self._ocr_instance

    @property
    def engine_name(self) -> str:
        return "PaddleOCR-v2.7" if self._ocr_instance is not None else "PaddleOCR-NotInstalled"

    def extract(self, pil_image: Image.Image) -> OCRResult:
        if self._ocr_instance is None:
            raise RuntimeError(
                "PaddleOCR is not installed. Install via `pip install paddlepaddle paddleocr` "
                "or set OCR_ENGINE=MOCK in settings."
            )

        start_time = time.time()
        img_np = np.array(pil_image.convert("RGB"))
        height, width = img_np.shape[:2]
        if height <= 0 or width <= 0:
            return OCRResult(
                raw_text="",
                boxes=[],
                line_count=0,
                engine_used=self.engine_name,
                processing_time_ms=0.0,
            )

        try:
            results = self._ocr_instance.ocr(img_np, cls=self.use_angle_cls)
        except Exception:
            results = None

        boxes: List[OCRTextBox] = []
        raw_lines: List[str] = []

        if results and len(results) > 0 and results[0]:
            for idx, line in enumerate(results[0]):
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

                    boxes.append(
                        OCRTextBox(
                            text=text,
                            confidence=round(conf, 3),
                            bounding_box=BoundingBox(
                                ymin=round(ymin, 4),
                                xmin=round(xmin, 4),
                                ymax=round(ymax, 4),
                                xmax=round(xmax, 4),
                                confidence=round(conf, 3),
                            ),
                            line_number=idx + 1,
                        )
                    )
                    raw_lines.append(text)
                except Exception:
                    continue

        elapsed_ms = (time.time() - start_time) * 1000.0

        return OCRResult(
            raw_text="\n".join(raw_lines),
            boxes=boxes,
            line_count=len(boxes),
            engine_used=self.engine_name,
            processing_time_ms=round(elapsed_ms, 2),
        )

    def extract_text(self, pil_image: Image.Image):
        """Cross-compatibility alias for BaseOCREngine interface."""
        return self.extract(pil_image)
