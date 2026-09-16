from enum import Enum
from typing import Optional, Generic, TypeVar, List
from pydantic import BaseModel, Field


class DeclarationState(str, Enum):
    """
    Core Legal Metrology declaration state model.
    Prevents false allegations when print is merely illegible or panel is not provided.
    """
    PRESENT = "PRESENT"
    MISSING = "MISSING"
    UNCLEAR = "UNCLEAR"
    NOT_APPLICABLE = "NOT_APPLICABLE"
    NOT_VERIFIABLE = "NOT_VERIFIABLE"


class BoundingBox(BaseModel):
    """Normalized bounding box coordinates (0.0 to 1.0 relative to image dimensions)."""
    ymin: float = Field(..., ge=0.0, le=1.0, description="Top edge (0.0 - 1.0)")
    xmin: float = Field(..., ge=0.0, le=1.0, description="Left edge (0.0 - 1.0)")
    ymax: float = Field(..., ge=0.0, le=1.0, description="Bottom edge (0.0 - 1.0)")
    xmax: float = Field(..., ge=0.0, le=1.0, description="Right edge (0.0 - 1.0)")
    confidence: float = Field(1.0, ge=0.0, le=1.0, description="Detection confidence")


T = TypeVar("T")


class DeclarationField(BaseModel, Generic[T]):
    """Wrapper for any Legal Metrology declaration field with legal state and visual evidence."""
    state: DeclarationState = DeclarationState.MISSING
    value: Optional[T] = None
    raw_text: Optional[str] = None
    confidence: float = Field(0.0, ge=0.0, le=1.0)
    bounding_box: Optional[BoundingBox] = None
    notes: Optional[str] = None


# Specific canonical declaration payload types

class GenericNameValue(BaseModel):
    name: str = Field(..., description="Common or generic name of commodity")
    category: Optional[str] = None


class NetQuantityValue(BaseModel):
    magnitude: float = Field(..., description="Numerical quantity magnitude")
    unit: str = Field(..., description="Original printed unit, e.g., g, kg, ml, l, units, N")
    normalized_magnitude: Optional[float] = Field(None, description="Standardized SI magnitude")
    normalized_unit: Optional[str] = Field(None, description="Standardized SI unit (g, kg, ml, L)")
    is_multi_pack: bool = False
    pack_count: Optional[int] = None


class MRPValue(BaseModel):
    amount: float = Field(..., ge=0.0, description="Maximum Retail Price in INR")
    currency: str = "INR"
    raw_string: str = Field(..., description="Verbatim text printed on label (e.g. ₹ 45.00)")
    inclusive_of_all_taxes: bool = True


class UnitSalePriceValue(BaseModel):
    price_per_unit: float = Field(..., ge=0.0)
    unit: str = Field(..., description="Base unit, e.g., per g, per 100g, per ml, per unit")


class DateValue(BaseModel):
    date_type: str = Field("manufacture", description="Type: 'manufacture', 'packing', or 'import'")
    month: Optional[int] = Field(None, ge=1, le=12)
    year: int = Field(..., ge=1900, le=2100)
    day: Optional[int] = Field(None, ge=1, le=31)
    raw_string: str
    expiry_date: Optional[str] = None


class ManufacturerValue(BaseModel):
    role: str = Field("manufacturer", description="'manufacturer', 'packer', or 'importer'")
    name: Optional[str] = None
    full_address: Optional[str] = None
    pin_code: Optional[str] = Field(None, description="6-digit Indian PIN code")
    state: Optional[str] = None


class ConsumerCareValue(BaseModel):
    helpline_number: Optional[str] = None
    email: Optional[str] = None
    address: Optional[str] = None
    contact_person: Optional[str] = None


class CountryOfOriginValue(BaseModel):
    country: str = "India"


class ExtractedDeclarations(BaseModel):
    """Container for all canonical Legal Metrology Rule 6 declarations."""
    generic_name: DeclarationField[GenericNameValue] = Field(
        default_factory=lambda: DeclarationField[GenericNameValue](state=DeclarationState.MISSING)
    )
    net_quantity: DeclarationField[NetQuantityValue] = Field(
        default_factory=lambda: DeclarationField[NetQuantityValue](state=DeclarationState.MISSING)
    )
    mrp: DeclarationField[MRPValue] = Field(
        default_factory=lambda: DeclarationField[MRPValue](state=DeclarationState.MISSING)
    )
    unit_sale_price: DeclarationField[UnitSalePriceValue] = Field(
        default_factory=lambda: DeclarationField[UnitSalePriceValue](state=DeclarationState.NOT_APPLICABLE)
    )
    dates: DeclarationField[DateValue] = Field(
        default_factory=lambda: DeclarationField[DateValue](state=DeclarationState.MISSING)
    )
    manufacturer: DeclarationField[ManufacturerValue] = Field(
        default_factory=lambda: DeclarationField[ManufacturerValue](state=DeclarationState.MISSING)
    )
    consumer_care: DeclarationField[ConsumerCareValue] = Field(
        default_factory=lambda: DeclarationField[ConsumerCareValue](state=DeclarationState.MISSING)
    )
    country_of_origin: DeclarationField[CountryOfOriginValue] = Field(
        default_factory=lambda: DeclarationField[CountryOfOriginValue](state=DeclarationState.NOT_APPLICABLE)
    )
