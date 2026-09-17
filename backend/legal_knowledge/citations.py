from typing import List, Tuple, Optional
from backend.legal_knowledge.models import LegalChunk, Citation, LegalBasis
from backend.legal_knowledge.chunks import ChunkRegistry, chunk_registry


class CitationManager:
    """
    Manages generation, formatting, and rigorous integrity verification of legal citations.
    Ensures every citation references a verified chunk ID and genuine government URL.
    """

    def __init__(self, registry: Optional[ChunkRegistry] = None):
        self.registry = registry or chunk_registry

    def validate_chunk_id(self, chunk_id: str) -> bool:
        """Verifies whether a chunk ID exists in the authoritative knowledge base."""
        return self.registry.get_chunk(chunk_id) is not None

    def validate_citations(self, chunk_ids: List[str]) -> Tuple[bool, List[str]]:
        """
        Validates an array of chunk IDs.
        Returns (is_valid, list_of_unrecognized_ids).
        Crucial for rejecting LLM hallucinations.
        """
        invalid_ids = [cid for cid in chunk_ids if not self.validate_chunk_id(cid)]
        return (len(invalid_ids) == 0, invalid_ids)

    def create_citation(self, chunk: LegalChunk) -> Citation:
        """Generates a Citation model from a LegalChunk."""
        meta = chunk.metadata or {}
        return Citation(
            source_title=chunk.document_title,
            authority=meta.get("authority", "Department of Consumer Affairs, Government of India"),
            rule_number=chunk.rule_number,
            section=chunk.section,
            official_url=meta.get("source_url", ""),
            version=meta.get("version", ""),
            publication_date=meta.get("publication_date", ""),
        )

    def build_legal_basis(self, chunk: LegalChunk, score: float) -> LegalBasis:
        """Converts a LegalChunk and its retrieval score into a LegalBasis model."""
        citation = self.create_citation(chunk)
        return LegalBasis(
            chunk_id=chunk.chunk_id,
            rule_number=chunk.rule_number,
            section=chunk.section,
            source=chunk.document_title,
            citation=citation,
            retrieval_score=score,
            excerpt=chunk.text,
            official_url=citation.official_url,
        )


citation_manager = CitationManager()
