import io
from typing import Optional
from PIL import Image

from backend.image_quality.checker import quality_checker
from backend.ocr.engine import get_ocr_engine
from backend.extraction.extractor import field_extractor
from backend.schemas.analysis import (
    ImageAnalysisResponse,
    ImageQualityResult,
    ImageQualityStatus,
    OCRResult,
    ExtractedFields,
)


class AnalysisService:
    """
    Coordinates the Milestone 1 pipeline:
    Image Ingestion -> Image Quality Check -> OCR -> Field Extraction.
    """

    def __init__(self, ocr_engine_name: Optional[str] = None):
        self.ocr_engine_name = ocr_engine_name

    def analyze_image_bytes(
        self,
        image_bytes: bytes,
        ocr_engine_name: Optional[str] = None,
    ) -> ImageAnalysisResponse:
        """Process raw image bytes from multipart upload or file read."""
        if not image_bytes:
            empty_quality = ImageQualityResult(
                status=ImageQualityStatus.POOR,
                score=0.0,
                issues=["Image file is empty or missing."],
                details=None,
            )
            empty_ocr = OCRResult(text="", confidence=0.0, regions=[])
            empty_fields = ExtractedFields()
            return ImageAnalysisResponse(
                success=False,
                image_quality=empty_quality,
                ocr=empty_ocr,
                fields=empty_fields,
            )

        try:
            pil_image = Image.open(io.BytesIO(image_bytes))
            # Test image reading
            pil_image.verify()
            pil_image = Image.open(io.BytesIO(image_bytes))
        except Exception as exc:
            corrupted_quality = ImageQualityResult(
                status=ImageQualityStatus.POOR,
                score=0.0,
                issues=[f"Invalid or corrupted image format: {str(exc)}"],
                details=None,
            )
            empty_ocr = OCRResult(text="", confidence=0.0, regions=[])
            empty_fields = ExtractedFields()
            return ImageAnalysisResponse(
                success=False,
                image_quality=corrupted_quality,
                ocr=empty_ocr,
                fields=empty_fields,
            )

        return self.analyze_pil_image(pil_image, ocr_engine_name=ocr_engine_name)

    def analyze_pil_image(
        self,
        pil_image: Image.Image,
        ocr_engine_name: Optional[str] = None,
    ) -> ImageAnalysisResponse:
        """Process a PIL Image object."""
        # 1. Image Quality Assessment
        quality_res = quality_checker.check_image(pil_image)

        # 2. OCR Extraction
        engine = get_ocr_engine(ocr_engine_name or self.ocr_engine_name)
        ocr_res = engine.extract_text(pil_image)

        # 3. Structured Field Extraction
        fields_res = field_extractor.extract(ocr_res, quality_res)

        return ImageAnalysisResponse(
            success=True,
            image_quality=quality_res,
            ocr=ocr_res,
            fields=fields_res,
        )


analysis_service = AnalysisService()
