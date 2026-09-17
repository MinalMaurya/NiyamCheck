from fastapi import APIRouter
from backend.app.core.config import settings
from backend.app.api.v1.endpoints import analyze

from backend.api.v1.inspections import router as inspections_router
from backend.api.v1.legal import router as legal_router

api_router = APIRouter()

# Register endpoint routers
api_router.include_router(analyze.router, prefix="/analyze", tags=["Analysis & Inspection"])
api_router.include_router(inspections_router, prefix="/inspections", tags=["Inspections"])
api_router.include_router(legal_router, prefix="/legal", tags=["Legal Knowledge Base"])


@api_router.get("/health", tags=["System Health"])
async def health_check():
    """System health check and active configuration metadata."""
    return {
        "status": "healthy",
        "service": settings.PROJECT_NAME,
        "version": settings.VERSION,
        "ocr_engine": settings.OCR_ENGINE,
        "iqa_enabled": True,
    }
