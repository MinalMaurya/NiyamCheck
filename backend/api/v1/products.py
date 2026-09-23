from typing import Optional
from fastapi import APIRouter, HTTPException, Query, status

from backend.schemas.product import (
    ProductCreate,
    ProductUpdate,
    ProductOut,
    ProductListResponse,
    ProductStatus,
)
from backend.products.db_store import product_store
from backend.inspections.db_store import postgresql_inspection_store

router = APIRouter()


@router.get("", response_model=ProductListResponse, summary="List Vendor Products")
async def list_products(
    vendor_id: Optional[str] = Query(None, description="Filter by Vendor ID"),
    category: Optional[str] = Query(None, description="Filter by category"),
    status: Optional[str] = Query(None, description="Filter by compliance status"),
    search: Optional[str] = Query(None, description="Search by name, brand, or code"),
):
    """
    Retrieve products filtered by vendor, category, compliance status, or search query.
    Used by Sufiya's Vendor/Company module for catalog and compliance tracking.
    """
    items = product_store.list_all(
        vendor_id=vendor_id,
        category=category,
        status=status,
        search=search,
    )
    return ProductListResponse(total=len(items), items=items)


@router.post("", response_model=ProductOut, status_code=status.HTTP_201_CREATED, summary="Create Product")
async def create_product(product_in: ProductCreate):
    """
    Register a new product in the vendor catalog.
    Initial compliance status defaults to NOT_CHECKED.
    """
    if not product_in.product_name or not product_in.product_name.strip():
        raise HTTPException(status_code=400, detail="Product name is required.")
    if not product_in.brand_name or not product_in.brand_name.strip():
        raise HTTPException(status_code=400, detail="Brand name is required.")
    if not product_in.category or not product_in.category.strip():
        raise HTTPException(status_code=400, detail="Product category is required.")
    if not product_in.product_code or not product_in.product_code.strip():
        raise HTTPException(status_code=400, detail="Product code/SKU is required.")

    return product_store.create(product_in)


@router.get("/{product_id}", response_model=ProductOut, summary="Get Product Details")
async def get_product(product_id: str):
    """
    Retrieve full product details including latest inspection and check history.
    """
    product = product_store.get(product_id)
    if not product:
        raise HTTPException(
            status_code=404,
            detail=f"Product with ID '{product_id}' was not found.",
        )
    return product


@router.put("/{product_id}", response_model=ProductOut, summary="Update Product")
async def update_product(product_id: str, updates: ProductUpdate):
    """
    Update product attributes such as name, category, or code.
    """
    product = product_store.update(product_id, updates)
    if not product:
        raise HTTPException(
            status_code=404,
            detail=f"Product with ID '{product_id}' was not found.",
        )
    return product


@router.delete("/{product_id}", summary="Delete Product")
async def delete_product(product_id: str):
    """
    Soft-delete a product from the vendor catalog.
    """
    success = product_store.delete(product_id)
    if not success:
        raise HTTPException(
            status_code=404,
            detail=f"Product with ID '{product_id}' was not found.",
        )
    return {"success": True, "message": f"Product '{product_id}' has been removed."}


@router.post(
    "/{product_id}/link_inspection/{inspection_id}",
    response_model=ProductOut,
    summary="Link Inspection Session to Product",
)
async def link_product_inspection(
    product_id: str,
    inspection_id: str,
    override_status: Optional[str] = Query(None, description="Explicit override status"),
):
    """
    Associates an executed InspectionSession (from Minal's core inspection pipeline)
    with a vendor Product. Automatically synchronizes the product's compliance status
    based on the inspection outcome:
    - PASS / COMPLIANT -> CHECKED
    - FAIL / NON_COMPLIANT / POTENTIAL_ISSUES -> ISSUES_FOUND
    - REVIEW / NEEDS_REVIEW / PARTIALLY_VERIFIABLE -> NEEDS_REVIEW
    """
    product = product_store.get(product_id)
    if not product:
        raise HTTPException(
            status_code=404,
            detail=f"Product with ID '{product_id}' was not found.",
        )

    # Resolve compliance status from actual inspection session if available
    determined_status = override_status
    if not determined_status:
        session = postgresql_inspection_store.get(inspection_id)
        if session:
            sess_status = (
                session.status.value
                if hasattr(session.status, "value")
                else str(session.status).upper()
            )
            if sess_status in ("COMPLIANT", "PASS"):
                determined_status = ProductStatus.CHECKED.value
            elif sess_status in ("NON_COMPLIANT", "FAIL", "POTENTIAL_ISSUE", "POTENTIAL_ISSUES"):
                determined_status = ProductStatus.ISSUES_FOUND.value
            elif sess_status in ("PARTIALLY_VERIFIABLE", "NEEDS_REVIEW", "UNCLEAR", "REVIEW"):
                determined_status = ProductStatus.NEEDS_REVIEW.value
            else:
                determined_status = ProductStatus.CHECKED.value
        else:
            determined_status = ProductStatus.CHECKED.value

    updated = product_store.link_inspection(
        product_id=product_id,
        inspection_id=inspection_id,
        status=determined_status,
    )
    return updated
