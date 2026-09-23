import json
from datetime import datetime
from typing import Optional, List, Dict, Any

from sqlalchemy import String, DateTime, Boolean, Text, Integer, JSON, or_, func
from sqlalchemy.orm import Mapped, mapped_column

from backend.database import Base, SessionLocal
from backend.inspections.models import InspectionSession


class InspectionSessionDB(Base):
    __tablename__ = "inspection_sessions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    inspection_id: Mapped[str] = mapped_column(String(120), unique=True, index=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)
    product_category: Mapped[Optional[str]] = mapped_column(String(200), nullable=True)
    status: Mapped[str] = mapped_column(String(80), nullable=False)
    summary: Mapped[str] = mapped_column(Text, nullable=False)
    requirements_checked: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    passed: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    review: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    potential_issues: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    session_data: Mapped[str] = mapped_column(JSON, nullable=False)
    is_deleted: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)


class PostgreSQLInspectionStore:
    """Persistent PostgreSQL-capable inspection store with SQLite fallback for local dev."""

    def __init__(self):
        self._images: dict = {}

    def save(self, session: InspectionSession) -> None:
        db = SessionLocal()
        try:
            payload = session.model_dump(mode="json")
            record = db.query(InspectionSessionDB).filter_by(inspection_id=session.inspection_id).first()
            if record is None:
                record = InspectionSessionDB(
                    inspection_id=session.inspection_id,
                    created_at=session.created_at,
                    product_category=session.product_category,
                    status=session.status.value if hasattr(session.status, "value") else str(session.status),
                    summary=session.summary,
                    requirements_checked=session.requirements_checked,
                    passed=session.passed,
                    review=session.review,
                    potential_issues=session.potential_issues,
                    session_data=payload,
                )
                db.add(record)
            else:
                record.created_at = session.created_at
                record.product_category = session.product_category
                record.status = session.status.value if hasattr(session.status, "value") else str(session.status)
                record.summary = session.summary
                record.requirements_checked = session.requirements_checked
                record.passed = session.passed
                record.review = session.review
                record.potential_issues = session.potential_issues
                record.session_data = payload
            db.commit()
        finally:
            db.close()

    def get(self, inspection_id: str) -> Optional[InspectionSession]:
        db = SessionLocal()
        try:
            record = db.query(InspectionSessionDB).filter_by(inspection_id=inspection_id, is_deleted=False).first()
            if record is None:
                return None
            return InspectionSession.model_validate(record.session_data)
        finally:
            db.close()

    def list_all(
        self,
        status: Optional[str] = None,
        category: Optional[str] = None,
        search: Optional[str] = None,
        limit: int = 50,
        offset: int = 0,
    ) -> List[InspectionSession]:
        db = SessionLocal()
        try:
            query = db.query(InspectionSessionDB).filter(InspectionSessionDB.is_deleted == False)

            if status and status.strip():
                clean_status = status.strip()
                query = query.filter(InspectionSessionDB.status.ilike(clean_status))

            if category and category.strip():
                clean_category = category.strip()
                query = query.filter(InspectionSessionDB.product_category.ilike(f"%{clean_category}%"))

            if search and search.strip():
                clean_search = search.strip()
                search_pattern = f"%{clean_search}%"
                query = query.filter(
                    or_(
                        InspectionSessionDB.inspection_id.ilike(search_pattern),
                        InspectionSessionDB.product_category.ilike(search_pattern),
                        InspectionSessionDB.summary.ilike(search_pattern),
                    )
                )

            query = query.order_by(InspectionSessionDB.created_at.desc())

            if offset > 0:
                query = query.offset(offset)

            if limit is not None and limit > 0:
                query = query.limit(limit)

            records = query.all()
            return [InspectionSession.model_validate(r.session_data) for r in records]
        finally:
            db.close()

    def get_stats(self) -> Dict[str, Any]:
        db = SessionLocal()
        try:
            total = db.query(func.count(InspectionSessionDB.id)).filter(InspectionSessionDB.is_deleted == False).scalar() or 0

            status_rows = (
                db.query(InspectionSessionDB.status, func.count(InspectionSessionDB.id))
                .filter(InspectionSessionDB.is_deleted == False)
                .group_by(InspectionSessionDB.status)
                .all()
            )
            compliant = 0
            non_compliant = 0
            needs_review = 0
            for st_raw, count in status_rows:
                st = (st_raw or "").strip().upper()
                if st in ("COMPLIANT", "PASS"):
                    compliant += count
                elif st in ("NON_COMPLIANT", "FAIL", "POTENTIAL_ISSUE", "POTENTIAL_ISSUES"):
                    non_compliant += count
                else:
                    needs_review += count

            cat_rows = (
                db.query(InspectionSessionDB.product_category, func.count(InspectionSessionDB.id))
                .filter(InspectionSessionDB.is_deleted == False)
                .group_by(InspectionSessionDB.product_category)
                .all()
            )
            category_breakdown: Dict[str, int] = {}
            for cat_raw, count in cat_rows:
                cat_label = cat_raw.strip() if (cat_raw and cat_raw.strip()) else "Unknown"
                category_breakdown[cat_label] = category_breakdown.get(cat_label, 0) + count

            session_data_rows = (
                db.query(InspectionSessionDB.session_data)
                .filter(InspectionSessionDB.is_deleted == False)
                .all()
            )
            violations: Dict[str, int] = {}
            finalized_count = 0

            for (s_data,) in session_data_rows:
                if not s_data:
                    continue
                data = json.loads(s_data) if isinstance(s_data, str) else s_data
                if not isinstance(data, dict):
                    continue

                if data.get("is_finalized"):
                    finalized_count += 1

                findings = data.get("findings")
                if not findings and "compliance" in data and isinstance(data["compliance"], dict):
                    findings = data["compliance"].get("evaluations")

                if isinstance(findings, list):
                    for f in findings:
                        if isinstance(f, dict):
                            f_status = str(f.get("status") or "").upper()
                            rule_id = f.get("rule_id") or f.get("id") or ""
                            if rule_id and f_status in ("FAIL", "POTENTIAL_ISSUE", "NON_COMPLIANT"):
                                violations[rule_id] = violations.get(rule_id, 0) + 1

            compliance_rate_pct = round((compliant / total) * 100, 2) if total > 0 else 0.0
            top_violations = dict(sorted(violations.items(), key=lambda x: x[1], reverse=True))

            return {
                "total": total,
                "compliant": compliant,
                "non_compliant": non_compliant,
                "needs_review": needs_review,
                "compliance_rate_pct": compliance_rate_pct,
                "top_violations": top_violations,
                "category_breakdown": category_breakdown,
                "finalized_count": finalized_count,
            }
        finally:
            db.close()

    def delete(self, inspection_id: str) -> bool:
        if inspection_id in self._images:
            del self._images[inspection_id]
        db = SessionLocal()
        try:
            record = db.query(InspectionSessionDB).filter_by(inspection_id=inspection_id).first()
            if record is None:
                return False
            record.is_deleted = True
            db.commit()
            return True
        finally:
            db.close()

    def save_image(self, inspection_id: str, image_id: str, image_bytes: bytes, mime_type: str = "image/jpeg") -> None:
        if inspection_id not in self._images:
            self._images[inspection_id] = {}
        self._images[inspection_id][image_id] = (image_bytes, mime_type)

    def get_image(self, inspection_id: str, image_id: str) -> Optional[tuple]:
        return self._images.get(inspection_id, {}).get(image_id)

    def delete_image(self, inspection_id: str, image_id: str) -> bool:
        if inspection_id in self._images and image_id in self._images[inspection_id]:
            del self._images[inspection_id][image_id]
            return True
        return False

    def clear(self) -> None:
        self._images.clear()
        db = SessionLocal()
        try:
            db.query(InspectionSessionDB).delete()
            db.commit()
        finally:
            db.close()


postgresql_inspection_store = PostgreSQLInspectionStore()
