from fastapi import APIRouter, UploadFile, File, HTTPException, status
from backend.services.analysis_service import analysis_service
from backend.schemas.analysis import ImageAnalysisResponse

router = APIRouter()


@router.post(
    "/image",
    response_model=ImageAnalysisResponse,
    summary="Analyze Product Package Image (IQA -> OCR -> Field Extraction)",
    description=(
        "Unified mobile and web endpoint for Milestone 1. "
        "Accepts a product/package image via multipart/form-data, evaluates image quality, "
        "runs OCR text and bounding region extraction, and extracts structured declarations."
    ),
)
async def analyze_image(
    file: UploadFile = File(..., description="Product package image (JPEG, PNG, WebP)"),
):
    """
    Primary API Endpoint for Milestone 1:
    POST /api/v1/analyze/image
    """
    contents = await file.read()
    if not contents:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Uploaded file is empty. Please provide a valid package image.",
        )

    response = analysis_service.analyze_image_bytes(contents)
    if not response.success:
        # Check if corrupted
        issues = response.image_quality.issues
        detail_msg = issues[0] if issues else "Unable to process uploaded image file."
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=detail_msg,
        )

    return response


@router.get(
    "/health",
    summary="API Health Check",
    description="Returns service availability status and active version.",
)
async def health_check():
    return {
        "status": "healthy",
        "service": "NiyamCheck Milestone 1 API",
        "version": "0.1.0",
        "endpoints": ["/api/v1/analyze/image"],
    }
