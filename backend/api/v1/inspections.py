from typing import List, Optional
from fastapi import APIRouter, UploadFile, File, Form, HTTPException, status, Response

from backend.inspections.models import InspectionSession, PanelType, InspectionImage
from backend.inspections.store import inspection_store
from backend.inspections.aggregator import session_aggregator
from backend.reporting.models import InspectionReport
from backend.reporting.report_service import report_service
from backend.config import settings
from backend.services.analysis_service import analysis_service

router = APIRouter()


def _parse_panel(raw_panel: Optional[str]) -> PanelType:
    if not raw_panel:
        return PanelType.UNKNOWN
    clean = raw_panel.strip().upper()
    try:
        return PanelType(clean)
    except ValueError:
        return PanelType.UNKNOWN


@router.post(
    "",
    response_model=InspectionSession,
    summary="Create Multi-Image Package Inspection Session",
    description=(
        "Upload one or more packaging panel images (e.g. front, back, sides). "
        "Each image is analyzed with IQA, OCR, and field extraction. "
        "Declarations are aggregated deterministically and verified against Legal Metrology rules."
    ),
)
async def create_inspection(
    files: List[UploadFile] = File(..., description="One or more packaging image files"),
    panels: Optional[List[str]] = Form(
        None,
        description="Optional list of packaging panel types corresponding to the uploaded files (FRONT, BACK, etc.)",
    ),
    inspection_id: Optional[str] = Form(
        None,
        description="Optional pre-assigned inspection ID",
    ),
):
    if not files:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="At least one packaging image file must be provided.",
        )

    # Normalize panels if sent as comma-separated or single string
    panel_list: List[str] = []
    if panels:
        for p in panels:
            if "," in p:
                panel_list.extend([x.strip() for x in p.split(",") if x.strip()])
            else:
                panel_list.append(p.strip())

    analyzed_images: List[InspectionImage] = []
    file_contents_list: List[tuple] = []
    for idx, file in enumerate(files):
        contents = await file.read()
        if not contents:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Uploaded file '{file.filename or idx}' is empty.",
            )
        if len(contents) > settings.MAX_UPLOAD_SIZE_BYTES:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Uploaded file '{file.filename or idx}' exceeds maximum size limit of {settings.MAX_UPLOAD_SIZE_BYTES // (1024 * 1024)}MB.",
            )

        raw_panel = panel_list[idx] if idx < len(panel_list) else None
        panel_type = _parse_panel(raw_panel)
        image_id = f"img-{idx+1:03d}"

        inspection_image = analysis_service.analyze_inspection_image(
            image_bytes=contents,
            image_id=image_id,
            filename=file.filename,
            panel=panel_type,
        )
        analyzed_images.append(inspection_image)
        file_contents_list.append((image_id, contents, file.content_type or "image/jpeg"))

    # Aggregate session findings across all uploaded packaging panels
    session = session_aggregator.aggregate_session(
        images=analyzed_images,
        inspection_id=inspection_id,
    )

    # Cache image binaries and populate image_url for direct client display
    for image_id, raw_bytes, mime_type in file_contents_list:
        inspection_store.save_image(session.inspection_id, image_id, raw_bytes, mime_type)

    for img in session.images:
        img.image_url = f"/api/v1/inspections/{session.inspection_id}/images/{img.image_id}"

    # Persist session to store
    inspection_store.save(session)

    return session


@router.get(
    "",
    response_model=List[InspectionSession],
    summary="List all Inspection Sessions",
    description="Returns all packaging inspection sessions stored in the current environment.",
)
async def list_inspections():
    return inspection_store.list_all()


@router.get(
    "/{inspection_id}",
    response_model=InspectionSession,
    summary="Get Inspection Session Details",
    description="Retrieves the complete aggregated inspection session by inspection ID.",
)
async def get_inspection(inspection_id: str):
    session = inspection_store.get(inspection_id)
    if not session:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Inspection session '{inspection_id}' not found.",
        )
    return session


@router.get(
    "/{inspection_id}/report",
    summary="Download Inspection Report (PDF)",
    description="Generates and streams a structured Legal Metrology inspection report in PDF format.",
)
async def download_inspection_report_pdf(inspection_id: str):
    session = inspection_store.get(inspection_id)
    if not session:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Inspection session '{inspection_id}' not found.",
        )

    pdf_bytes = report_service.generate_pdf(session)
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={
            "Content-Disposition": f'attachment; filename="inspection_{inspection_id}.pdf"',
            "Content-Type": "application/pdf",
        },
    )


@router.get(
    "/{inspection_id}/report.json",
    response_model=InspectionReport,
    summary="Get Inspection Report (JSON)",
    description="Returns the structured JSON inspection report with findings, evidence index, and audit hash.",
)
async def get_inspection_report_json(inspection_id: str):
    session = inspection_store.get(inspection_id)
    if not session:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Inspection session '{inspection_id}' not found.",
        )

    return report_service.build_report(session)


@router.get(
    "/{inspection_id}/images/{image_id}",
    summary="Get Inspection Panel Image",
    description="Retrieves the stored raw packaging panel image for visual evidence inspection.",
)
async def get_inspection_image(inspection_id: str, image_id: str):
    image_data = inspection_store.get_image(inspection_id, image_id)
    if not image_data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Image '{image_id}' for inspection session '{inspection_id}' not found.",
        )
    content, media_type = image_data
    return Response(content=content, media_type=media_type)
