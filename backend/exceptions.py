from typing import Optional, Dict, Any


# Standard Pipeline Stages
STAGE_UPLOAD = "upload"
STAGE_IMAGE_VALIDATION = "image_validation"
STAGE_IMAGE_PREPROCESSING = "image_preprocessing"
STAGE_OCR = "ocr"
STAGE_FIELD_EXTRACTION = "field_extraction"
STAGE_PRODUCT_CLASSIFICATION = "product_classification"
STAGE_LEGAL_RETRIEVAL = "legal_retrieval"
STAGE_COMPLIANCE_CHECK = "compliance_check"
STAGE_EVIDENCE_MAPPING = "evidence_mapping"
STAGE_REPORT_GENERATION = "report_generation"


class InspectionStageError(Exception):
    """
    Structured exception raised when an inspection pipeline stage fails.
    Carries the pipeline stage, error code, user message, diagnostic details,
    optional traceback, and appropriate HTTP status code.
    """

    def __init__(
        self,
        stage: str,
        error_code: str,
        message: str,
        details: Optional[str] = None,
        status_code: int = 400,
        traceback_str: Optional[str] = None,
    ):
        self.stage = stage
        self.error_code = error_code
        self.message = message
        self.details = details or message
        self.status_code = status_code
        self.traceback_str = traceback_str
        super().__init__(message)

    def to_dict(self, include_traceback: bool = False) -> Dict[str, Any]:
        data: Dict[str, Any] = {
            "success": False,
            "stage": self.stage,
            "error_code": self.error_code,
            "message": self.message,
            "details": self.details,
            "detail": self.message,  # Backward compatibility for standard FastAPI clients
        }
        if include_traceback and self.traceback_str:
            data["traceback"] = self.traceback_str
        return data

