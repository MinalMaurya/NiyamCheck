import sys
from pathlib import Path

# Add project root to sys.path
root_dir = str(Path(__file__).resolve().parent.parent)
if root_dir not in sys.path:
    sys.path.insert(0, root_dir)

from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware

from backend.config import settings
from backend.database import init_db
from backend.exceptions import InspectionStageError
from backend.api.v1.analyze import router as analyze_router
from backend.api.v1.inspections import router as inspections_router
from backend.api.v1.legal import router as legal_router

try:
    init_db()
except Exception as exc:  # pragma: no cover - infrastructure-dependent startup behavior
    print(f"Database initialization warning: {exc}")

app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.VERSION,
    description=(
        "NiyamCheck — Legal Metrology Compliance Inspection Platform. "
        "Milestones 1-7: Full End-to-End Compliance Verification Pipeline, "
        "Multi-Image Package Aggregation, Authoritative Legal RAG, PWA, "
        "Real-World Hardening & SIH Demo Readiness."
    ),
    docs_url="/docs",
    redoc_url="/redoc",
    openapi_url=f"{settings.API_V1_STR}/openapi.json",
)

# Enable CORS for Web frontend & Android clients
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


import logging
import traceback

logger = logging.getLogger("niyamcheck")


@app.exception_handler(InspectionStageError)
async def inspection_stage_error_handler(request: Request, exc: InspectionStageError):
    """Formats pipeline stage errors into consistent structured diagnostics and logs to server console."""
    logger.error(
        f"[InspectionStageError] Stage: {exc.stage} | Error Code: {exc.error_code} | "
        f"Message: {exc.message} | Details: {exc.details}"
    )
    if exc.traceback_str:
        logger.error(f"Traceback:\n{exc.traceback_str}")
    return JSONResponse(
        status_code=exc.status_code,
        content=exc.to_dict(),
    )


@app.exception_handler(404)
async def custom_api_404_handler(request: Request, exc):
    """Provides clear diagnostic errors when an API route is not found."""
    if request.url.path.startswith("/api/"):
        return JSONResponse(
            status_code=404,
            content={
                "success": False,
                "stage": "upload",
                "error_code": "ENDPOINT_NOT_FOUND",
                "message": f"API endpoint '{request.url.path}' was not found on this server.",
                "details": f"Method {request.method} on '{request.url.path}' is not a registered route. Verify the backend route configuration.",
            },
        )
    return JSONResponse(status_code=404, content={"detail": "Not Found"})


@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception):
    """
    Catches any unexpected server exceptions during inspection processing.
    Logs the full traceback to development terminal while returning clean structured JSON to client.
    """
    tb = traceback.format_exc()
    logger.error(f"[UnhandledException] Exception: {type(exc).__name__}: {str(exc)}\n{tb}")

    return JSONResponse(
        status_code=500,
        content={
            "success": False,
            "stage": "compliance_check",
            "error_code": "INTERNAL_SERVER_ERROR",
            "message": f"An unexpected error occurred: {str(exc) or type(exc).__name__}",
            "details": f"{type(exc).__name__}: {str(exc)}",
            "detail": f"{type(exc).__name__}: {str(exc)}",
        },
    )


# Mount Routers
app.include_router(analyze_router, prefix=f"{settings.API_V1_STR}/analyze", tags=["Analysis"])
app.include_router(inspections_router, prefix=f"{settings.API_V1_STR}/inspections", tags=["Inspections"])
app.include_router(legal_router, prefix=f"{settings.API_V1_STR}/legal", tags=["Legal Knowledge Base"])


@app.get("/", tags=["Root"])
async def root():
    return {
        "service": settings.PROJECT_NAME,
        "version": settings.VERSION,
        "milestone": "Milestone 1: OCR + Product Information Extraction",
        "milestones": "Milestones 1-7: OCR, Rule Engine, Evidence Mapping, Aggregation, Legal RAG, PWA & Field Hardening",
        "endpoints": {
            "single_image": f"{settings.API_V1_STR}/analyze/image",
            "inspections": f"{settings.API_V1_STR}/inspections",
            "legal": f"{settings.API_V1_STR}/legal",
        },
        "docs_url": "/docs",
        "docs": "/docs",
    }


@app.get(f"{settings.API_V1_STR}/health", tags=["System Health"])
async def api_health():
    return {
        "status": "healthy",
        "service": settings.PROJECT_NAME,
        "version": settings.VERSION,
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("backend.main:app", host="0.0.0.0", port=8000, reload=True)
