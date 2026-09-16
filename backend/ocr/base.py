from abc import ABC, abstractmethod
from PIL import Image
from backend.schemas.analysis import OCRResult


class BaseOCREngine(ABC):
    """Abstract interface for pluggable OCR engines."""

    @property
    @abstractmethod
    def name(self) -> str:
        """Returns engine identifier."""
        pass

    @abstractmethod
    def extract_text(self, image: Image.Image) -> OCRResult:
        """
        Extracts raw text, line regions, and confidence scores from an image.
        """
        pass
