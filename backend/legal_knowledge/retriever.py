import re
import math
from abc import ABC, abstractmethod
from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field

from backend.legal_knowledge.models import LegalChunk, Citation
from backend.legal_knowledge.chunks import ChunkRegistry, chunk_registry


class RetrievalResult(BaseModel):
    """Encapsulates a ranked retrieval hit with citation provenance."""
    chunk: LegalChunk
    score: float = Field(..., ge=0.0, le=1.0)
    source_id: str
    rule_number: str
    section: str
    citation: Citation


class LegalRetriever(ABC):
    """Abstract interface for legal knowledge base retrieval."""

    @abstractmethod
    def search(
        self,
        query: str,
        top_k: int = 3,
        threshold: float = 0.35,
        filters: Optional[Dict[str, Any]] = None,
    ) -> List[RetrievalResult]:
        pass


class KeywordRetriever(LegalRetriever):
    """
    Deterministic lexical and BM25-style keyword retriever.
    Scores chunks based on term frequencies, keyword overlaps, exact phrase boosts,
    and statutory section indicators.
    """

    STOPWORDS = {
        "a", "an", "and", "are", "as", "at", "be", "by", "for", "from",
        "has", "he", "in", "is", "it", "its", "of", "on", "that", "the",
        "to", "was", "were", "will", "with"
    }

    def __init__(self, registry: Optional[ChunkRegistry] = None):
        self.registry = registry or chunk_registry

    def _tokenize(self, text: str) -> List[str]:
        if not text:
            return []
        clean = re.sub(r"[^\w\d]+", " ", text.lower())
        tokens = [t for t in clean.split() if len(t) > 1 and t not in self.STOPWORDS]
        return tokens

    def search(
        self,
        query: str,
        top_k: int = 3,
        threshold: float = 0.35,
        filters: Optional[Dict[str, Any]] = None,
    ) -> List[RetrievalResult]:
        if not query or not query.strip():
            return []

        query_tokens = self._tokenize(query)
        if not query_tokens:
            return []

        clean_query = " ".join(query_tokens)
        query_set = set(query_tokens)
        chunks = self.registry.list_chunks()

        # Filter by source_id or status if requested
        if filters:
            if "source_id" in filters:
                chunks = [c for c in chunks if c.source_id == filters["source_id"]]

        scored_results: List[RetrievalResult] = []

        for chunk in chunks:
            # Build target document text for scoring
            corpus_parts = [
                chunk.rule_number,
                chunk.section,
                chunk.heading or "",
                chunk.text,
                " ".join(chunk.keywords),
            ]
            full_corpus = " ".join(corpus_parts).lower()
            corpus_tokens = self._tokenize(full_corpus)
            if not corpus_tokens:
                continue

            corpus_set = set(corpus_tokens)

            # 1. Jaccard token overlap
            intersection = query_set.intersection(corpus_set)
            overlap_ratio = len(intersection) / max(1, len(query_set))

            # 2. Keyword matching bonus
            keyword_hits = sum(1 for kw in chunk.keywords if kw.lower() in query.lower() or any(tok in kw.lower() for tok in query_tokens))
            keyword_score = min(0.3, keyword_hits * 0.1)

            # 3. Exact phrase match bonus
            phrase_bonus = 0.0
            for window_size in [4, 3, 2]:
                if len(query_tokens) >= window_size:
                    for i in range(len(query_tokens) - window_size + 1):
                        ngram = " ".join(query_tokens[i:i + window_size])
                        if ngram in full_corpus:
                            phrase_bonus += 0.15 * window_size
                            break

            # 4. Heading / Section match bonus
            heading_bonus = 0.0
            if any(tok in (chunk.heading or "").lower() for tok in query_tokens):
                heading_bonus += 0.2
            if any(tok in chunk.section.lower() for tok in query_tokens):
                heading_bonus += 0.25

            # Combine and normalize score to [0.0, 1.0]
            raw_score = (overlap_ratio * 0.5) + keyword_score + min(0.3, phrase_bonus) + min(0.2, heading_bonus)
            final_score = round(min(1.0, raw_score), 4)

            if final_score >= threshold:
                meta = chunk.metadata or {}
                citation = Citation(
                    source_title=chunk.document_title,
                    authority=meta.get("authority", "Department of Consumer Affairs, Government of India"),
                    rule_number=chunk.rule_number,
                    section=chunk.section,
                    official_url=meta.get("source_url", ""),
                    version=meta.get("version", ""),
                    publication_date=meta.get("publication_date", ""),
                )
                scored_results.append(
                    RetrievalResult(
                        chunk=chunk,
                        score=final_score,
                        source_id=chunk.source_id,
                        rule_number=chunk.rule_number,
                        section=chunk.section,
                        citation=citation,
                    )
                )

        # Sort descending by score
        scored_results.sort(key=lambda r: r.score, reverse=True)
        return scored_results[:top_k]


keyword_retriever = KeywordRetriever()
