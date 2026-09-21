import os
import socket
import sys
from pathlib import Path

# Ensure project root is in sys.path when executed directly
project_root = str(Path(__file__).resolve().parents[2])
if project_root not in sys.path:
    sys.path.insert(0, project_root)

from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware

from backend.app.core.config import settings
from backend.app.api.v1.router import api_router
from backend.exceptions import InspectionStageError

app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.VERSION,
    description=settings.DESCRIPTION,
    docs_url="/docs",
    redoc_url="/redoc",
    openapi_url=f"{settings.API_V1_STR}/openapi.json",
)

# Enable CORS for Web frontend (localhost:3000, 5173) and mobile clients
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


import logging
import traceback

logger = logging.getLogger("niyamcheck.app")


@app.exception_handler(InspectionStageError)
async def inspection_stage_error_handler(request: Request, exc: InspectionStageError):
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


@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception):
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


# Mount versioned API routes (analyze, inspections, legal)
app.include_router(api_router, prefix=settings.API_V1_STR)


@app.get("/", tags=["Root"])
async def root():
    return {
        "service": settings.PROJECT_NAME,
        "tagline": "Automated Legal Metrology Compliance Verification System",
        "version": settings.VERSION,
        "docs": "/docs",
        "docs_url": "/docs",
        "api_v1": settings.API_V1_STR,
    }


def get_available_port(default_port: int = 8000):
    """Return a free local port, honoring PORT if explicitly set."""
    env_port = os.getenv("PORT")
    if env_port:
        try:
            return int(env_port)
        except ValueError:
            pass

    for port in (default_port, 8001, 8002, 8080, 5000):
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
            sock.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
            try:
                sock.bind(("0.0.0.0", port))
                return port
            except OSError:
                continue

    return default_port


if __name__ == "__main__":
    import uvicorn
    port = get_available_port()
    print(f"Starting backend on port {port}")
    uvicorn.run("backend.app.main:app", host="0.0.0.0", port=port, reload=True)
