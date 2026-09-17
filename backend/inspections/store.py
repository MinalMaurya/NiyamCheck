from abc import ABC, abstractmethod
from typing import Dict, Optional, List
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
    def list_all(self) -> List[InspectionSession]:
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
    """
    In-memory storage for inspection sessions during development and testing.
    Allows seamlessly dropping in a database repository (e.g. Postgres) later.
    """

    def __init__(self):
        self._store: Dict[str, InspectionSession] = {}
        self._images: Dict[str, Dict[str, tuple]] = {}

    def save(self, session: InspectionSession) -> None:
        self._store[session.inspection_id] = session

    def get(self, inspection_id: str) -> Optional[InspectionSession]:
        return self._store.get(inspection_id)

    def list_all(self) -> List[InspectionSession]:
        return list(self._store.values())

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


inspection_store = InMemoryInspectionStore()
