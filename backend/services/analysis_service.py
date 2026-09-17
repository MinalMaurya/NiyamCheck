import io
from typing import Optional, List
from PIL import Image

from backend.image_quality.checker import quality_checker
from backend.ocr.engine import get_ocr_engine
from backend.extraction.extractor import field_extractor
from backend.compliance.rule_engine import compliance_engine
from backend.evidence.mapper import evidence_mapper
from backend.legal_knowledge.service import legal_knowledge_service
from backend.inspections.models import InspectionImage, PanelType
from backend.schemas.analysis import (
    ImageAnalysisResponse,
    ImageQualityResult,
    ImageQualityStatus,
    OCRResult,
    ExtractedFields,
)


class AnalysisService:
    """
    Coordinates the NiyamCheck pipeline:
    Image Ingestion -> Image Quality Check -> OCR -> Field Extraction -> Compliance -> Evidence Mapping.
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
                compliance=None,
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
                compliance=None,
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

        # 4. Deterministic Legal Metrology Compliance Evaluation (Milestone 2)
        compliance_res = compliance_engine.evaluate(fields_res)

        # 5. Evidence Mapping (Milestone 3)
        evidence_items = evidence_mapper.map_evidence(
            ocr_result=ocr_res,
            fields=fields_res,
            compliance_result=compliance_res,
            image_id="img-001",
            panel="UNKNOWN",
        )

        # 6. Authoritative Legal Knowledge Retrieval (Milestone 4)
        legal_knowledge_service.attach_legal_basis(compliance_res)

        return ImageAnalysisResponse(
            success=True,
            image_quality=quality_res,
            ocr=ocr_res,
            fields=fields_res,
            compliance=compliance_res,
            evidence=evidence_items,
        )

    def analyze_inspection_image(
        self,
        image_bytes: bytes,
        image_id: str,
        filename: Optional[str] = None,
        panel: PanelType = PanelType.UNKNOWN,
    ) -> InspectionImage:
        """Processes an image for inclusion in a multi-image InspectionSession."""
        try:
            pil_image = Image.open(io.BytesIO(image_bytes))
            pil_image.verify()
            pil_image = Image.open(io.BytesIO(image_bytes))
            quality_res = quality_checker.check_image(pil_image)
        except Exception as exc:
            quality_res = ImageQualityResult(
                status=ImageQualityStatus.POOR,
                score=0.0,
                issues=[f"Corrupted image format: {str(exc)}"],
            )
            pil_image = Image.new("RGB", (300, 300), color=(128, 128, 128))

        # 2. Resilient OCR Extraction
        try:
            engine = get_ocr_engine(self.ocr_engine_name)
            ocr_res = engine.extract_text(pil_image)
        except Exception as ocr_exc:
            ocr_res = OCRResult(text="", confidence=0.0, regions=[])
            if hasattr(quality_res, "issues") and quality_res.issues is not None:
                quality_res.issues.append(f"OCR extraction encountered an error: {str(ocr_exc)}")

        # 3. Canonical Field Extraction
        try:
            fields_res = field_extractor.extract(ocr_res, quality_res)
        except Exception:
            fields_res = ExtractedFields()

        # 4. Compliance Evaluation
        try:
            compliance_res = compliance_engine.evaluate(fields_res)
        except Exception:
            from backend.compliance.models import ComplianceResult, ComplianceStatus
            compliance_res = ComplianceResult(
                status=ComplianceStatus.NEEDS_REVIEW,
                summary="Insufficient readable declaration information could be verified.",
                rules_checked=0,
            )

        # 5. Evidence Mapping
        try:
            evidence_items = evidence_mapper.map_evidence(
                ocr_result=ocr_res,
                fields=fields_res,
                compliance_result=compliance_res,
                image_id=image_id,
                panel=panel.value if isinstance(panel, PanelType) else str(panel),
            )
        except Exception:
            evidence_items = []

        # 6. Authoritative Legal Knowledge Retrieval (Milestone 4)
        try:
            legal_knowledge_service.attach_legal_basis(compliance_res)
        except Exception:
            pass

        return InspectionImage(
            image_id=image_id,
            filename=filename,
            panel=panel,
            quality=quality_res,
            ocr=ocr_res,
            fields=fields_res,
            compliance=compliance_res,
            evidence=evidence_items,
        )



analysis_service = AnalysisService()

