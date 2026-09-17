from typing import Dict, List, Optional
from backend.legal_knowledge.models import LegalChunk
from backend.legal_knowledge.documents import DocumentRegistry, document_registry


class ChunkRegistry:
    """
    Parses and serves granular, hierarchically structured LegalChunk instances.
    Preserves Act -> Section / Rule -> Sub-rule -> Clause statutory hierarchy.
    """

    def __init__(self, doc_reg: Optional[DocumentRegistry] = None):
        self.doc_registry = doc_reg or document_registry
        self._chunks: Dict[str, LegalChunk] = {}
        self.build_chunks()

    def build_chunks(self) -> None:
        """Parses loaded legal documents into discrete, cited statutory chunks."""
        self._chunks.clear()

        for doc in self.doc_registry.list_documents():
            raw = self.doc_registry.get_raw_data(doc.source_id)
            if not raw:
                continue

            # 1. Parse rules if present (e.g. PCR-2011, PCAR-2021)
            if "rules" in raw:
                for r in raw["rules"]:
                    rule_num = r.get("rule_number", "")
                    rule_heading = r.get("heading", "")
                    rule_text = r.get("text", "")

                    # Subrules / clauses
                    subrules = r.get("subrules", [])
                    if subrules:
                        for sr in subrules:
                            subrule_num = sr.get("subrule_number", "")
                            clause = sr.get("clause", "")
                            heading = sr.get("heading", rule_heading)
                            text = sr.get("text", "")
                            keywords = sr.get("keywords", [])

                            # Build clean deterministic chunk ID
                            clean_sub = subrule_num.replace("(", "-").replace(")", "").replace(" ", "").upper()
                            chunk_id = f"{doc.source_id}-{clean_sub}"

                            chunk = LegalChunk(
                                chunk_id=chunk_id,
                                source_id=doc.source_id,
                                document_title=doc.title,
                                rule_number=rule_num,
                                section=subrule_num,
                                subsection=subrule_num,
                                clause=clause,
                                heading=heading,
                                text=text,
                                effective_from=doc.effective_date,
                                effective_to=None,
                                keywords=keywords,
                                metadata={
                                    "authority": doc.authority,
                                    "source_url": doc.source_url,
                                    "version": doc.version,
                                    "publication_date": doc.publication_date,
                                },
                            )
                            self._chunks[chunk_id] = chunk
                    else:
                        # Top-level rule chunk
                        clean_num = rule_num.replace(" ", "-").upper()
                        chunk_id = f"{doc.source_id}-{clean_num}"
                        chunk = LegalChunk(
                            chunk_id=chunk_id,
                            source_id=doc.source_id,
                            document_title=doc.title,
                            rule_number=rule_num,
                            section=rule_num,
                            heading=rule_heading,
                            text=rule_text,
                            effective_from=doc.effective_date,
                            effective_to=None,
                            keywords=[],
                            metadata={
                                "authority": doc.authority,
                                "source_url": doc.source_url,
                                "version": doc.version,
                                "publication_date": doc.publication_date,
                            },
                        )
                        self._chunks[chunk_id] = chunk

            # 2. Parse sections if present (e.g. LMA-2009)
            if "sections" in raw:
                for s in raw["sections"]:
                    sec_num = s.get("section_number", "")
                    sec_heading = s.get("heading", "")
                    sec_text = s.get("text", "")

                    subsections = s.get("subsections", [])
                    if subsections:
                        for sub in subsections:
                            sub_num = sub.get("subsection_number", "")
                            text = sub.get("text", "")

                            clean_sub = sub_num.replace("(", "-").replace(")", "").replace(" ", "").upper()
                            chunk_id = f"{doc.source_id}-SEC-{clean_sub}"

                            chunk = LegalChunk(
                                chunk_id=chunk_id,
                                source_id=doc.source_id,
                                document_title=doc.title,
                                rule_number=sec_num,
                                section=f"Section {sub_num}",
                                subsection=sub_num,
                                heading=sec_heading,
                                text=text,
                                effective_from=doc.effective_date,
                                effective_to=None,
                                keywords=["pre-packaged commodity", "statutory requirement", "penalty", "declarations"],
                                metadata={
                                    "authority": doc.authority,
                                    "source_url": doc.source_url,
                                    "version": doc.version,
                                    "publication_date": doc.publication_date,
                                },
                            )
                            self._chunks[chunk_id] = chunk
                    else:
                        clean_num = sec_num.replace(" ", "-").upper()
                        chunk_id = f"{doc.source_id}-{clean_num}"
                        chunk = LegalChunk(
                            chunk_id=chunk_id,
                            source_id=doc.source_id,
                            document_title=doc.title,
                            rule_number=sec_num,
                            section=sec_num,
                            heading=sec_heading,
                            text=sec_text,
                            effective_from=doc.effective_date,
                            keywords=[],
                            metadata={
                                "authority": doc.authority,
                                "source_url": doc.source_url,
                                "version": doc.version,
                                "publication_date": doc.publication_date,
                            },
                        )
                        self._chunks[chunk_id] = chunk

    def get_chunk(self, chunk_id: str) -> Optional[LegalChunk]:
        return self._chunks.get(chunk_id)

    def list_chunks(self) -> List[LegalChunk]:
        return list(self._chunks.values())

    def count(self) -> int:
        return len(self._chunks)


chunk_registry = ChunkRegistry()
