import io
import uuid
from datetime import datetime
from typing import Optional
from PIL import Image
from fastapi import APIRouter, UploadFile, File, Form, Header, HTTPException, status
from pydantic import BaseModel

from backend.app.core.config import settings
from backend.app.schemas.iqa import ImageQualityReport, QualityVerdict
from backend.app.schemas.ocr import OCRResult
from backend.app.schemas.declarations import ExtractedDeclarations
from backend.app.schemas.pipeline import PipelineAnalysisResponse, ImageMetadata
from backend.app.cv.iqa.quality_checker import quality_checker
from backend.app.cv.ocr.factory import get_ocr_engine
from backend.app.extractors.pipeline_extractor import pipeline_extractor

router = APIRouter()


class TextExtractRequest(BaseModel):
    raw_text: str
    client_platform: Optional[str] = "web"


@router.post(
    "/pipeline",
    response_model=PipelineAnalysisResponse,
    summary="Full Compliance Pre-Processing Pipeline (IQA -> OCR -> Extraction)",
    description=(
        "Primary unified endpoint for both Web and Android applications. "
        "Performs Image Quality Assessment (IQA), Multi-Engine OCR, and "
        "Canonical Legal Metrology declaration extraction."
    ),
)
async def run_pipeline(
    file: UploadFile = File(..., description="Package image file (JPEG, PNG, WebP)"),
    client_platform: Optional[str] = Form(
        None, description="Client platform indicator: 'android', 'web', etc."
    ),
    x_client_platform: Optional[str] = Header(None, alias="X-Client-Platform"),
):
    platform = x_client_platform or client_platform or "unknown"
    session_id = str(uuid.uuid4())

    # Read and validate image
    contents = await file.read()
    if not contents:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Uploaded file is empty.",
        )

    try:
        pil_image = Image.open(io.BytesIO(contents))
        pil_image.verify()  # Verify integrity
        # Re-open after verify() because verify() empties the buffer
        pil_image = Image.open(io.BytesIO(contents))
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Invalid or corrupted image format: {str(exc)}",
        )

    width, height = pil_image.size
    img_meta = ImageMetadata(
        width=width,
        height=height,
        format=pil_image.format or "JPEG",
        file_size_bytes=len(contents),
    )

    # 1. Step: Image Quality Assessment (IQA)
    quality_report = quality_checker.evaluate_image(pil_image)

    # If critical failure, report back so mobile app can prompt user to retake
    if quality_report.verdict == QualityVerdict.FAILED and not quality_report.is_acceptable_for_ocr:
        return PipelineAnalysisResponse(
            session_id=session_id,
            timestamp=datetime.utcnow(),
            client_platform=platform,
            status="QUALITY_REJECTED",
            image_metadata=img_meta,
            quality_report=quality_report,
            ocr_result=None,
            extracted_declarations=None,
            summary="Image quality rejected. " + quality_report.summary,
        )

    # 2. Step: OCR Text & Bounding Box Extraction
    ocr_engine = get_ocr_engine()
    ocr_result = ocr_engine.extract(pil_image)

    # 3. Step: Canonical Legal Metrology Field Extraction
    extracted = pipeline_extractor.extract_from_ocr(ocr_result)

    return PipelineAnalysisResponse(
        session_id=session_id,
        timestamp=datetime.utcnow(),
        client_platform=platform,
        status="SUCCESS",
        image_metadata=img_meta,
        quality_report=quality_report,
        ocr_result=ocr_result,
        extracted_declarations=extracted,
        summary="Image processed successfully. Declarations extracted for Legal Metrology verification.",
    )


@router.post(
    "/quality",
    response_model=ImageQualityReport,
    summary="Standalone Image Quality Assessment (IQA)",
    description="Fast (<20ms) endpoint for live mobile camera previews to validate focus and lighting before upload.",
)
async def check_quality(
    file: UploadFile = File(..., description="Package image file"),
):
    contents = await file.read()
    try:
        pil_image = Image.open(io.BytesIO(contents))
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Invalid image format: {str(exc)}",
        )
    return quality_checker.evaluate_image(pil_image)


@router.post(
    "/ocr",
    response_model=OCRResult,
    summary="Standalone OCR Text & Bounding Box Extraction",
    description="Runs OCR detection and recognition on an uploaded packaging image.",
)
async def run_ocr(
    file: UploadFile = File(..., description="Package image file"),
):
    contents = await file.read()
    try:
        pil_image = Image.open(io.BytesIO(contents))
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Invalid image format: {str(exc)}",
        )
    ocr_engine = get_ocr_engine()
    return ocr_engine.extract(pil_image)


@router.post(
    "/extract",
    response_model=ExtractedDeclarations,
    summary="Extract Declarations from OCR Result or Raw Text",
    description="Parses structured Legal Metrology declarations from pre-computed OCR text tokens.",
)
async def extract_declarations(payload: TextExtractRequest):
    from backend.app.schemas.ocr import OCRResult, OCRTextBox
    from backend.app.schemas.declarations import BoundingBox

    lines = [line.strip() for line in payload.raw_text.split("\n") if line.strip()]
    boxes = [
        OCRTextBox(
            text=line,
            confidence=0.95,
            bounding_box=BoundingBox(
                ymin=round(idx * 0.1, 2),
                xmin=0.1,
                ymax=round((idx + 1) * 0.1, 2),
                xmax=0.9,
                confidence=0.95,
            ),
            line_number=idx + 1,
        )
        for idx, line in enumerate(lines)
    ]
    ocr_result = OCRResult(
        raw_text=payload.raw_text,
        boxes=boxes,
        line_count=len(boxes),
        engine_used="ExternalTextPayload",
        processing_time_ms=1.0,
    )
    return pipeline_extractor.extract_from_ocr(ocr_result)


@router.get(
    "/sample-declaration",
    response_model=PipelineAnalysisResponse,
    summary="Get Sample Pipeline Response for UI Development",
    description="Returns a full canonical mock pipeline response for web frontend and Android developers to test rendering immediately.",
)
async def get_sample_declaration():
    # Generate mock sample response
    dummy_img = Image.new("RGB", (640, 640), color=(240, 240, 240))
    q_report = quality_checker.evaluate_image(dummy_img)
    ocr_engine = get_ocr_engine("MOCK")
    ocr_res = ocr_engine.extract(dummy_img)
    extracted = pipeline_extractor.extract_from_ocr(ocr_res)

    return PipelineAnalysisResponse(
        session_id="sample-mock-session-001",
        timestamp=datetime.utcnow(),
        client_platform="mock-preview",
        status="SUCCESS",
        image_metadata=ImageMetadata(
            width=640,
            height=640,
            format="JPEG",
            file_size_bytes=42800,
        ),
        quality_report=q_report,
        ocr_result=ocr_res,
        extracted_declarations=extracted,
        summary="Sample mock response for client UI and Android widget development.",
    )
