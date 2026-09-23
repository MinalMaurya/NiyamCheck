from datetime import datetime
from enum import Enum
from typing import List, Optional
from pydantic import BaseModel, Field


class ProductStatus(str, Enum):
    NOT_CHECKED = "NOT_CHECKED"
    CHECKED = "CHECKED"
    ISSUES_FOUND = "ISSUES_FOUND"
    NEEDS_REVIEW = "NEEDS_REVIEW"


class ProductBase(BaseModel):
    product_name: str = Field(..., min_length=1, max_length=250, description="Common or brand product name")
    brand_name: str = Field(..., min_length=1, max_length=200, description="Brand or manufacturer label")
    category: str = Field(..., min_length=1, max_length=150, description="Product category for Legal Metrology rules")
    product_code: str = Field(..., min_length=1, max_length=100, description="SKU, Barcode, or GTIN identifier")
    description: Optional[str] = Field(None, max_length=1000, description="Optional product description or notes")


class ProductCreate(ProductBase):
    vendor_id: Optional[str] = Field("VEND-001", description="Vendor identifier (defaults to dev context VEND-001)")


class ProductUpdate(BaseModel):
    product_name: Optional[str] = Field(None, min_length=1, max_length=250)
    brand_name: Optional[str] = Field(None, min_length=1, max_length=200)
    category: Optional[str] = Field(None, min_length=1, max_length=150)
    product_code: Optional[str] = Field(None, min_length=1, max_length=100)
    description: Optional[str] = Field(None, max_length=1000)
    status: Optional[ProductStatus] = Field(None)


class ProductOut(ProductBase):
    product_id: str = Field(..., description="Unique product ID")
    vendor_id: str = Field(..., description="Owner vendor ID")
    status: ProductStatus = Field(ProductStatus.NOT_CHECKED, description="Compliance status of the product")
    latest_inspection_id: Optional[str] = Field(None, description="Most recent InspectionSession ID")
    inspection_ids: List[str] = Field(default_factory=list, description="Historical list of linked inspection IDs")
    created_at: datetime = Field(..., description="Creation timestamp")
    updated_at: datetime = Field(..., description="Last update timestamp")

    class Config:
        from_attributes = True


class ProductListResponse(BaseModel):
    total: int = Field(..., description="Total products matching query")
    items: List[ProductOut] = Field(..., description="List of products")
