import os
import json
from pathlib import Path
from typing import Dict, List, Optional
from backend.legal_knowledge.models import LegalDocument, DocumentType, DocumentStatus


class DocumentRegistry:
    """
    Loads, validates, and serves authoritative Government of India legal documents.
    Preserves versioning, commencement dates, and official URLs.
    """

    def __init__(self, sources_dir: Optional[str] = None):
        if sources_dir:
            self.sources_dir = Path(sources_dir)
        else:
            # Default to project data/legal/sources
            project_root = Path(__file__).resolve().parent.parent.parent
            self.sources_dir = project_root / "data" / "legal" / "sources"

        self._documents: Dict[str, LegalDocument] = {}
        self._raw_data: Dict[str, dict] = {}
        self.load_all()

    def load_all(self) -> None:
        """Loads all JSON legal source files from configured directory."""
        self._documents.clear()
        self._raw_data.clear()

        if not self.sources_dir.exists():
            return

        for filepath in sorted(self.sources_dir.glob("*.json")):
            try:
                with open(filepath, "r", encoding="utf-8") as f:
                    data = json.load(f)

                source_id = data.get("source_id")
                if not source_id:
                    continue

                doc = LegalDocument(
                    source_id=source_id,
                    title=data.get("title", ""),
                    authority=data.get("authority", ""),
                    document_type=DocumentType(data.get("document_type", "RULES")),
                    publication_date=data.get("publication_date", ""),
                    effective_date=data.get("effective_date", ""),
                    version=data.get("version", ""),
                    source_url=data.get("source_url", ""),
                    jurisdiction=data.get("jurisdiction", "India"),
                    status=DocumentStatus(data.get("status", "ACTIVE")),
                    content=data.get("content", ""),
                    metadata=data.get("metadata", {}),
                )
                self._documents[source_id] = doc
                self._raw_data[source_id] = data
            except Exception as exc:
                print(f"[DocumentRegistry] Warning: Failed to load legal file {filepath}: {exc}")

    def get_document(self, source_id: str) -> Optional[LegalDocument]:
        return self._documents.get(source_id)

    def list_documents(self) -> List[LegalDocument]:
        return list(self._documents.values())

    def get_raw_data(self, source_id: str) -> Optional[dict]:
        return self._raw_data.get(source_id)

    def count(self) -> int:
        return len(self._documents)


document_registry = DocumentRegistry()
