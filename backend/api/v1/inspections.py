from typing import List, Optional
from fastapi import APIRouter, UploadFile, File, Form, HTTPException, status, Response

from backend.exceptions import InspectionStageError
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
        raise InspectionStageError(
            stage="upload",
            error_code="NO_FILES_PROVIDED",
            message="At least one packaging image file must be provided.",
            status_code=status.HTTP_400_BAD_REQUEST,
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
        try:
            contents = await file.read()
        except Exception as read_exc:
            raise InspectionStageError(
                stage="upload",
                error_code="READ_ERROR",
                message=f"Failed to read uploaded file '{file.filename or idx}'.",
                details=str(read_exc),
                status_code=status.HTTP_400_BAD_REQUEST,
            )

        if not contents:
            raise InspectionStageError(
                stage="upload",
                error_code="EMPTY_FILE",
                message=f"Uploaded file '{file.filename or idx}' is empty.",
                status_code=status.HTTP_400_BAD_REQUEST,
            )
        if len(contents) > settings.MAX_UPLOAD_SIZE_BYTES:
            raise InspectionStageError(
                stage="upload",
                error_code="PAYLOAD_TOO_LARGE",
                message=f"Uploaded file '{file.filename or idx}' exceeds maximum size limit of {settings.MAX_UPLOAD_SIZE_BYTES // (1024 * 1024)}MB.",
                status_code=status.HTTP_400_BAD_REQUEST,
            )

        raw_panel = panel_list[idx] if idx < len(panel_list) else None
        panel_type = _parse_panel(raw_panel)
        image_id = f"img-{idx+1:03d}"

        try:
            inspection_image = analysis_service.analyze_inspection_image(
                image_bytes=contents,
                image_id=image_id,
                filename=file.filename,
                panel=panel_type,
            )
        except InspectionStageError:
            raise
        except Exception as proc_exc:
            import traceback
            tb = traceback.format_exc()
            raise InspectionStageError(
                stage="ocr",
                error_code="OCR_PROCESSING_FAILED",
                message=f"Failed to extract text or evaluate packaging panel '{file.filename or image_id}'.",
                details=str(proc_exc),
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                traceback_str=tb,
            )

        analyzed_images.append(inspection_image)
        file_contents_list.append((image_id, contents, file.content_type or "image/jpeg"))

    # Aggregate session findings across all uploaded packaging panels
    try:
        session = session_aggregator.aggregate_session(
            images=analyzed_images,
            inspection_id=inspection_id,
        )
    except Exception as agg_exc:
        import traceback
        tb = traceback.format_exc()
        raise InspectionStageError(
            stage="compliance_check",
            error_code="AGGREGATION_FAILED",
            message="Failed to aggregate multi-panel declarations and compliance findings.",
            details=str(agg_exc),
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            traceback_str=tb,
        )

    # Cache image binaries and populate image_url for direct client display
    try:
        for image_id, raw_bytes, mime_type in file_contents_list:
            inspection_store.save_image(session.inspection_id, image_id, raw_bytes, mime_type)

        for img in session.images:
            img.image_url = f"/api/v1/inspections/{session.inspection_id}/images/{img.image_id}"

        # Persist session to store
        inspection_store.save(session)
    except Exception as store_exc:
        import traceback
        tb = traceback.format_exc()
        raise InspectionStageError(
            stage="report_generation",
            error_code="STORAGE_PERSISTENCE_FAILED",
            message="Failed to persist inspection session to repository store.",
            details=str(store_exc),
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            traceback_str=tb,
        )

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
        raise InspectionStageError(
            stage="upload",
            error_code="SESSION_NOT_FOUND",
            message=f"Inspection session '{inspection_id}' not found.",
            status_code=status.HTTP_404_NOT_FOUND,
        )
    return session


@router.get(
    "/{inspection_id}/report",
    summary="Download Inspection Report (PDF)",
    description="Generates and streams a structured Legal Metrology inspection report in PDF format.",
)
@router.get("/{inspection_id}/report/pdf", include_in_schema=False)
@router.get("/{inspection_id}/report.pdf", include_in_schema=False)
async def download_inspection_report_pdf(inspection_id: str):
    session = inspection_store.get(inspection_id)
    if not session:
        raise InspectionStageError(
            stage="report_generation",
            error_code="SESSION_NOT_FOUND",
            message=f"Inspection session '{inspection_id}' not found.",
            status_code=status.HTTP_404_NOT_FOUND,
        )

    try:
        pdf_bytes = report_service.generate_pdf(session)
    except Exception as pdf_exc:
        raise InspectionStageError(
            stage="report_generation",
            error_code="PDF_GENERATION_FAILED",
            message="Failed to generate PDF inspection report.",
            details=str(pdf_exc),
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        )

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
@router.get("/{inspection_id}/report/json", response_model=InspectionReport, include_in_schema=False)
async def get_inspection_report_json(inspection_id: str):
    session = inspection_store.get(inspection_id)
    if not session:
        raise InspectionStageError(
            stage="report_generation",
            error_code="SESSION_NOT_FOUND",
            message=f"Inspection session '{inspection_id}' not found.",
            status_code=status.HTTP_404_NOT_FOUND,
        )

    try:
        return report_service.build_report(session)
    except Exception as rep_exc:
        raise InspectionStageError(
            stage="report_generation",
            error_code="REPORT_BUILD_FAILED",
            message="Failed to build JSON inspection report.",
            details=str(rep_exc),
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        )


@router.get(
    "/{inspection_id}/images/{image_id}",
    summary="Get Inspection Panel Image",
    description="Retrieves the stored raw packaging panel image for visual evidence inspection.",
)
async def get_inspection_image(inspection_id: str, image_id: str):
    image_data = inspection_store.get_image(inspection_id, image_id)
    if not image_data:
        raise InspectionStageError(
            stage="evidence_mapping",
            error_code="IMAGE_NOT_FOUND",
            message=f"Image '{image_id}' for inspection session '{inspection_id}' not found.",
            status_code=status.HTTP_404_NOT_FOUND,
        )
    content, media_type = image_data
    return Response(content=content, media_type=media_type)


@router.post(
    "/{inspection_id}/images",
    response_model=InspectionSession,
    summary="Add Packaging Panel Images to an Existing Inspection Session",
    description="Uploads and analyzes additional packaging panel images, re-evaluating the entire session under the same inspection ID.",
)
async def add_inspection_images(
    inspection_id: str,
    files: List[UploadFile] = File(..., description="One or more additional packaging image files"),
    panels: Optional[List[str]] = Form(None, description="Packaging panel types corresponding to the uploaded files"),
):
    session = inspection_store.get(inspection_id)
    if not session:
        raise InspectionStageError(
            stage="upload",
            error_code="SESSION_NOT_FOUND",
            message=f"Inspection session '{inspection_id}' not found.",
            status_code=status.HTTP_404_NOT_FOUND,
        )

    if not files:
        raise InspectionStageError(
            stage="upload",
            error_code="NO_FILES_PROVIDED",
            message="At least one packaging image file must be provided.",
            status_code=status.HTTP_400_BAD_REQUEST,
        )

    # Normalize panels
    panel_list: List[str] = []
    if panels:
        for p in panels:
            if "," in p:
                panel_list.extend([x.strip() for x in p.split(",") if x.strip()])
            else:
                panel_list.append(p.strip())

    existing_images = list(session.images)
    start_idx = len(existing_images)

    new_analyzed_images: List[InspectionImage] = []
    file_contents_list: List[tuple] = []

    for idx, file in enumerate(files):
        try:
            contents = await file.read()
        except Exception as read_exc:
            raise InspectionStageError(
                stage="upload",
                error_code="READ_ERROR",
                message=f"Failed to read uploaded file '{file.filename or idx}'.",
                details=str(read_exc),
                status_code=status.HTTP_400_BAD_REQUEST,
            )

        if not contents:
            raise InspectionStageError(
                stage="upload",
                error_code="EMPTY_FILE",
                message=f"Uploaded file '{file.filename or idx}' is empty.",
                status_code=status.HTTP_400_BAD_REQUEST,
            )

        raw_panel = panel_list[idx] if idx < len(panel_list) else None
        panel_type = _parse_panel(raw_panel)
        image_id = f"img-{start_idx + idx + 1:03d}"

        try:
            inspection_image = analysis_service.analyze_inspection_image(
                image_bytes=contents,
                image_id=image_id,
                filename=file.filename,
                panel=panel_type,
            )
        except InspectionStageError:
            raise
        except Exception as proc_exc:
            raise InspectionStageError(
                stage="ocr",
                error_code="OCR_PROCESSING_FAILED",
                message=f"Failed to extract text or evaluate packaging panel '{file.filename or image_id}'.",
                details=str(proc_exc),
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

        new_analyzed_images.append(inspection_image)
        file_contents_list.append((image_id, contents, file.content_type or "image/jpeg"))

    # Combine existing + new images
    all_images = existing_images + new_analyzed_images

    # Re-aggregate session findings across all images under the same inspection ID
    updated_session = session_aggregator.aggregate_session(
        images=all_images,
        inspection_id=inspection_id,
    )

    # Save new image binaries and populate image_url
    for image_id, raw_bytes, mime_type in file_contents_list:
        inspection_store.save_image(inspection_id, image_id, raw_bytes, mime_type)

    for img in updated_session.images:
        img.image_url = f"/api/v1/inspections/{inspection_id}/images/{img.image_id}"

    # Persist updated session
    inspection_store.save(updated_session)
    return updated_session


@router.delete(
    "/{inspection_id}/images/{image_id}",
    response_model=InspectionSession,
    summary="Remove a Packaging Panel Image from an Inspection Session",
    description="Deletes a packaging panel image, removes all evidence derived from it, and re-evaluates the session under the same inspection ID.",
)
async def delete_inspection_image(inspection_id: str, image_id: str):
    session = inspection_store.get(inspection_id)
    if not session:
        raise InspectionStageError(
            stage="upload",
            error_code="SESSION_NOT_FOUND",
            message=f"Inspection session '{inspection_id}' not found.",
            status_code=status.HTTP_404_NOT_FOUND,
        )

    target_image = next((img for img in session.images if img.image_id == image_id), None)
    if not target_image:
        raise InspectionStageError(
            stage="evidence_mapping",
            error_code="IMAGE_NOT_FOUND",
            message=f"Image '{image_id}' for inspection session '{inspection_id}' not found.",
            status_code=status.HTTP_404_NOT_FOUND,
        )

    # Filter out target image
    remaining_images = [img for img in session.images if img.image_id != image_id]

    # Delete binary from store
    inspection_store.delete_image(inspection_id, image_id)

    # Re-aggregate remaining images under the same inspection ID (eliminates stale evidence)
    updated_session = session_aggregator.aggregate_session(
        images=remaining_images,
        inspection_id=inspection_id,
    )

    for img in updated_session.images:
        img.image_url = f"/api/v1/inspections/{inspection_id}/images/{img.image_id}"

    inspection_store.save(updated_session)
    return updated_session
