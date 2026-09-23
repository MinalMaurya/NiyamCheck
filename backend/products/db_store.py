import json
import uuid
from datetime import datetime
from typing import List, Optional

from sqlalchemy import String, DateTime, Boolean, Text, Integer, JSON
from sqlalchemy.orm import Mapped, mapped_column

from backend.database import Base, SessionLocal
from backend.schemas.product import ProductCreate, ProductUpdate, ProductOut, ProductStatus


class ProductDB(Base):
    __tablename__ = "products"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    product_id: Mapped[str] = mapped_column(String(120), unique=True, index=True, nullable=False)
    vendor_id: Mapped[str] = mapped_column(String(120), index=True, nullable=False)
    product_name: Mapped[str] = mapped_column(String(250), nullable=False)
    brand_name: Mapped[str] = mapped_column(String(200), nullable=False)
    category: Mapped[str] = mapped_column(String(150), nullable=False)
    product_code: Mapped[str] = mapped_column(String(100), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    status: Mapped[str] = mapped_column(String(80), default=ProductStatus.NOT_CHECKED.value, nullable=False)
    latest_inspection_id: Mapped[Optional[str]] = mapped_column(String(120), nullable=True)
    inspection_ids: Mapped[Optional[list]] = mapped_column(JSON, default=list, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)
    is_deleted: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    def to_schema(self) -> ProductOut:
        return ProductOut(
            product_id=self.product_id,
            vendor_id=self.vendor_id,
            product_name=self.product_name,
            brand_name=self.brand_name,
            category=self.category,
            product_code=self.product_code,
            description=self.description,
            status=ProductStatus(self.status) if self.status in ProductStatus.__members__ else ProductStatus.NOT_CHECKED,
            latest_inspection_id=self.latest_inspection_id,
            inspection_ids=self.inspection_ids or [],
            created_at=self.created_at,
            updated_at=self.updated_at,
        )


class PostgreSQLProductStore:
    """Persistent PostgreSQL/SQLite product store matching NiyamCheck db_store conventions."""

    def create(self, product_in: ProductCreate, product_id: Optional[str] = None) -> ProductOut:
        db = SessionLocal()
        try:
            pid = product_id or f"prod_{uuid.uuid4().hex[:10]}"
            now = datetime.utcnow()
            record = ProductDB(
                product_id=pid,
                vendor_id=product_in.vendor_id or "VEND-001",
                product_name=product_in.product_name.strip(),
                brand_name=product_in.brand_name.strip(),
                category=product_in.category.strip(),
                product_code=product_in.product_code.strip(),
                description=product_in.description.strip() if product_in.description else None,
                status=ProductStatus.NOT_CHECKED.value,
                latest_inspection_id=None,
                inspection_ids=[],
                created_at=now,
                updated_at=now,
                is_deleted=False,
            )
            db.add(record)
            db.commit()
            db.refresh(record)
            return record.to_schema()
        finally:
            db.close()

    def get(self, product_id: str) -> Optional[ProductOut]:
        db = SessionLocal()
        try:
            record = (
                db.query(ProductDB)
                .filter_by(product_id=product_id, is_deleted=False)
                .first()
            )
            if record is None:
                return None
            return record.to_schema()
        finally:
            db.close()

    def list_all(
        self,
        vendor_id: Optional[str] = None,
        category: Optional[str] = None,
        status: Optional[str] = None,
        search: Optional[str] = None,
    ) -> List[ProductOut]:
        db = SessionLocal()
        try:
            query = db.query(ProductDB).filter_by(is_deleted=False)
            if vendor_id:
                query = query.filter(ProductDB.vendor_id == vendor_id)
            if category and category != "ALL":
                query = query.filter(ProductDB.category.ilike(f"%{category}%"))
            if status and status != "ALL":
                query = query.filter(ProductDB.status == status)
            if search:
                pattern = f"%{search.strip()}%"
                query = query.filter(
                    (ProductDB.product_name.ilike(pattern))
                    | (ProductDB.brand_name.ilike(pattern))
                    | (ProductDB.product_code.ilike(pattern))
                    | (ProductDB.product_id.ilike(pattern))
                )
            records = query.order_by(ProductDB.updated_at.desc()).all()
            return [r.to_schema() for r in records]
        finally:
            db.close()

    def update(self, product_id: str, updates: ProductUpdate) -> Optional[ProductOut]:
        db = SessionLocal()
        try:
            record = (
                db.query(ProductDB)
                .filter_by(product_id=product_id, is_deleted=False)
                .first()
            )
            if record is None:
                return None

            update_data = updates.model_dump(exclude_unset=True)
            for field, value in update_data.items():
                if field == "status" and value is not None:
                    record.status = value.value if hasattr(value, "value") else str(value)
                elif hasattr(record, field) and value is not None:
                    setattr(record, field, value)

            record.updated_at = datetime.utcnow()
            db.commit()
            db.refresh(record)
            return record.to_schema()
        finally:
            db.close()

    def delete(self, product_id: str) -> bool:
        db = SessionLocal()
        try:
            record = db.query(ProductDB).filter_by(product_id=product_id).first()
            if record is None:
                return False
            record.is_deleted = True
            record.updated_at = datetime.utcnow()
            db.commit()
            return True
        finally:
            db.close()

    def link_inspection(
        self, product_id: str, inspection_id: str, status: Optional[str] = None
    ) -> Optional[ProductOut]:
        """
        Associate an InspectionSession with a product and optionally synchronize status.
        Does not alter inspection pipeline data; updates only product audit trail.
        """
        db = SessionLocal()
        try:
            record = (
                db.query(ProductDB)
                .filter_by(product_id=product_id, is_deleted=False)
                .first()
            )
            if record is None:
                return None

            current_ids = list(record.inspection_ids or [])
            if inspection_id not in current_ids:
                current_ids.insert(0, inspection_id)
                record.inspection_ids = current_ids

            record.latest_inspection_id = inspection_id
            if status:
                record.status = status
            record.updated_at = datetime.utcnow()
            db.commit()
            db.refresh(record)
            return record.to_schema()
        finally:
            db.close()

    def clear(self) -> None:
        db = SessionLocal()
        try:
            db.query(ProductDB).delete()
            db.commit()
        finally:
            db.close()


product_store = PostgreSQLProductStore()
