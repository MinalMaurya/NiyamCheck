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
from backend.api.v1.inspections import router as inspections_router
from backend.api.v1.legal import router as legal_router

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
