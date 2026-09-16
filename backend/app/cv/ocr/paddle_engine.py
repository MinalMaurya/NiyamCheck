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

    def __init__(self, use_angle_cls: bool = True, lang: str = "en"):
        self.use_angle_cls = use_angle_cls
        self.lang = lang
        self._ocr = None
        self._initialize_engine()

    def _initialize_engine(self):
        try:
            from paddleocr import PaddleOCR
            self._ocr = PaddleOCR(use_angle_cls=self.use_angle_cls, lang=self.lang, show_log=False)
        except ImportError:
            self._ocr = None

    @property
    def engine_name(self) -> str:
        return "PaddleOCR-v2.7" if self._ocr is not None else "PaddleOCR-NotInstalled"

    def extract(self, pil_image: Image.Image) -> OCRResult:
        if self._ocr is None:
            raise RuntimeError(
                "PaddleOCR is not installed. Install via `pip install paddlepaddle paddleocr` "
                "or set OCR_ENGINE=MOCK in settings."
            )

        start_time = time.time()
        img_np = np.array(pil_image.convert("RGB"))
        height, width = img_np.shape[:2]

        results = self._ocr.ocr(img_np, cls=self.use_angle_cls)
        boxes: List[OCRTextBox] = []
        raw_lines: List[str] = []

        if results and results[0]:
            for idx, line in enumerate(results[0]):
                points, (text, conf) = line
                # points: [[x1, y1], [x2, y2], [x3, y3], [x4, y4]]
                xs = [p[0] for p in points]
                ys = [p[1] for p in points]
                ymin = max(0.0, min(ys) / height)
                xmin = max(0.0, min(xs) / width)
                ymax = min(1.0, max(ys) / height)
                xmax = min(1.0, max(xs) / width)

                boxes.append(
                    OCRTextBox(
                        text=text.strip(),
                        confidence=round(float(conf), 3),
                        bounding_box=BoundingBox(
                            ymin=round(ymin, 4),
                            xmin=round(xmin, 4),
                            ymax=round(ymax, 4),
                            xmax=round(xmax, 4),
                            confidence=round(float(conf), 3),
                        ),
                        line_number=idx + 1,
                    )
                )
                raw_lines.append(text.strip())

        elapsed_ms = (time.time() - start_time) * 1000.0

        return OCRResult(
            raw_text="\n".join(raw_lines),
            boxes=boxes,
            line_count=len(boxes),
            engine_used=self.engine_name,
            processing_time_ms=round(elapsed_ms, 2),
        )
