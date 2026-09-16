from abc import ABC, abstractmethod
from PIL import Image
from backend.app.schemas.ocr import OCRResult


class OCREngine(ABC):
    """Abstract Base Class for OCR providers (PaddleOCR, Tesseract, VLM, or Mock)."""

    @property
    @abstractmethod
    def engine_name(self) -> str:
        """Returns the unique name/version of this OCR engine."""
        pass

    @abstractmethod
    def extract(self, pil_image: Image.Image) -> OCRResult:
        """
        Executes text detection and recognition on the provided PIL Image.
        Returns normalized bounding boxes, confidence scores, and raw text.
        """
        pass
