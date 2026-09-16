import sys
from pathlib import Path

# Add project root to sys.path
root_dir = str(Path(__file__).resolve().parent.parent)
if root_dir not in sys.path:
    sys.path.insert(0, root_dir)

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from backend.config import settings
from backend.api.v1.analyze import router as analyze_router

app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.VERSION,
    description="NiyamCheck — Legal Metrology Compliance Inspection Platform. Milestone 1: OCR + Product Information Extraction.",
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

# Mount Milestone 1 endpoint: POST /api/v1/analyze/image
app.include_router(analyze_router, prefix=f"{settings.API_V1_STR}/analyze", tags=["Analysis"])


@app.get("/", tags=["Root"])
async def root():
    return {
        "service": settings.PROJECT_NAME,
        "milestone": "Milestone 1: OCR + Product Information Extraction",
        "api_endpoint": f"{settings.API_V1_STR}/analyze/image",
        "docs_url": "/docs",
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
