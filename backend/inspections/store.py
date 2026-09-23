from abc import ABC, abstractmethod
from datetime import datetime, timezone
from typing import Dict, Optional, List

from backend.database import init_db
from backend.inspections.db_store import postgresql_inspection_store
from backend.inspections.models import InspectionSession


class InspectionStore(ABC):
    """Abstract interface for inspection persistence."""

    @abstractmethod
    def save(self, session: InspectionSession) -> None:
        pass

    @abstractmethod
    def get(self, inspection_id: str) -> Optional[InspectionSession]:
        pass

    @abstractmethod
    def list_all(
        self,
        status: Optional[str] = None,
        category: Optional[str] = None,
        search: Optional[str] = None,
        limit: int = 50,
        offset: int = 0,
    ) -> List[InspectionSession]:
        pass

    @abstractmethod
    def delete(self, inspection_id: str) -> bool:
        pass

    @abstractmethod
    def save_image(self, inspection_id: str, image_id: str, image_bytes: bytes, mime_type: str = "image/jpeg") -> None:
        pass

    @abstractmethod
    def get_image(self, inspection_id: str, image_id: str) -> Optional[tuple]:
        pass

    @abstractmethod
    def delete_image(self, inspection_id: str, image_id: str) -> bool:
        pass

    @abstractmethod
    def clear(self) -> None:
        pass


class InMemoryInspectionStore(InspectionStore):
    """Fallback in-memory storage for development when the database is unavailable."""

    def __init__(self):
        self._store: Dict[str, InspectionSession] = {}
        self._images: Dict[str, Dict[str, tuple]] = {}

    def save(self, session: InspectionSession) -> None:
        self._store[session.inspection_id] = session

    def get(self, inspection_id: str) -> Optional[InspectionSession]:
        return self._store.get(inspection_id)

    def list_all(
        self,
        status: Optional[str] = None,
        category: Optional[str] = None,
        search: Optional[str] = None,
        limit: int = 50,
        offset: int = 0,
    ) -> List[InspectionSession]:
        results: List[InspectionSession] = []
        for session in self._store.values():
            if getattr(session, "is_deleted", False):
                continue

            if status and status.strip():
                clean_status = status.strip().upper()
                session_status = session.status.value if hasattr(session.status, "value") else str(session.status)
                if session_status.strip().upper() != clean_status:
                    continue

            if category and category.strip():
                clean_cat = category.strip().lower()
                session_cat = (getattr(session, "product_category", None) or "").strip().lower()
                if clean_cat not in session_cat:
                    continue

            if search and search.strip():
                term = search.strip().lower()
                insp_id = (getattr(session, "inspection_id", "") or "").lower()
                prod_cat = (getattr(session, "product_category", "") or "").lower()
                summ = (getattr(session, "summary", "") or "").lower()
                if term not in insp_id and term not in prod_cat and term not in summ:
                    continue

            results.append(session)

        def sort_key(s: InspectionSession):
            dt = getattr(s, "created_at", None)
            if isinstance(dt, datetime):
                return dt.timestamp() if dt.tzinfo else dt.replace(tzinfo=timezone.utc).timestamp()
            if isinstance(dt, str):
                try:
                    return datetime.fromisoformat(dt).timestamp()
                except Exception:
                    pass
            return 0.0

        results.sort(key=sort_key, reverse=True)

        if offset > 0:
            results = results[offset:]

        if limit is not None and limit > 0:
            results = results[:limit]

        return results

    def delete(self, inspection_id: str) -> bool:
        if inspection_id in self._images:
            del self._images[inspection_id]
        if inspection_id in self._store:
            del self._store[inspection_id]
            return True
        return False

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
        self._store.clear()
        self._images.clear()


class DatabaseInspectionStore(InspectionStore):
    """Production-ready SQLAlchemy-backed inspection store with graceful fallback."""

    def __init__(self):
        self._fallback = InMemoryInspectionStore()
        self._use_db = False
        try:
            init_db()
            self._use_db = True
        except Exception as exc:  # pragma: no cover - infrastructure-dependent
            print(f"Database unavailable; using in-memory store. Details: {exc}")

    def save(self, session: InspectionSession) -> None:
        if self._use_db:
            postgresql_inspection_store.save(session)
            return
        self._fallback.save(session)

    def get(self, inspection_id: str) -> Optional[InspectionSession]:
        if self._use_db:
            return postgresql_inspection_store.get(inspection_id)
        return self._fallback.get(inspection_id)

    def list_all(
        self,
        status: Optional[str] = None,
        category: Optional[str] = None,
        search: Optional[str] = None,
        limit: int = 50,
        offset: int = 0,
    ) -> List[InspectionSession]:
        if self._use_db:
            return postgresql_inspection_store.list_all(
                status=status,
                category=category,
                search=search,
                limit=limit,
                offset=offset,
            )
        return self._fallback.list_all(
            status=status,
            category=category,
            search=search,
            limit=limit,
            offset=offset,
        )

    def delete(self, inspection_id: str) -> bool:
        if self._use_db:
            return postgresql_inspection_store.delete(inspection_id)
        return self._fallback.delete(inspection_id)

    def save_image(self, inspection_id: str, image_id: str, image_bytes: bytes, mime_type: str = "image/jpeg") -> None:
        if self._use_db:
            postgresql_inspection_store.save_image(inspection_id, image_id, image_bytes, mime_type)
            return
        self._fallback.save_image(inspection_id, image_id, image_bytes, mime_type)

    def get_image(self, inspection_id: str, image_id: str) -> Optional[tuple]:
        if self._use_db:
            return postgresql_inspection_store.get_image(inspection_id, image_id)
        return self._fallback.get_image(inspection_id, image_id)

    def delete_image(self, inspection_id: str, image_id: str) -> bool:
        if self._use_db:
            return postgresql_inspection_store.delete_image(inspection_id, image_id)
        return self._fallback.delete_image(inspection_id, image_id)

    def clear(self) -> None:
        if self._use_db:
            postgresql_inspection_store.clear()
            return
        self._fallback.clear()


inspection_store = DatabaseInspectionStore()
