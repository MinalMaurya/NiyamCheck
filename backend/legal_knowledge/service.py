from datetime import datetime
from typing import List, Optional, Dict, Any

from backend.compliance.models import ComplianceResult, RuleEvaluation
from backend.legal_knowledge.models import LegalBasis, KnowledgeBaseStatus, LegalDocument
from backend.legal_knowledge.documents import DocumentRegistry, document_registry
from backend.legal_knowledge.chunks import ChunkRegistry, chunk_registry
from backend.legal_knowledge.retriever import LegalRetriever, KeywordRetriever, keyword_retriever
from backend.legal_knowledge.citations import CitationManager, citation_manager
from backend.legal_knowledge.explainer import GroundedLegalExplainer, grounded_legal_explainer


class LegalKnowledgeService:
    """
    Facade service orchestrating authoritative Legal Knowledge Base retrieval,
    citation verification, and finding support.
    """

    RULE_QUERY_MAP = {
        "LM-PN-001": "Rule 6 6(1)(b) common generic name commodity product identity",
        "LM-NQ-001": "Rule 6 6(1)(c) net quantity standard unit weight measure metric units Rule 9",
        "LM-MRP-001": "Rule 6 6(1)(da) retail sale price Maximum Retail Price MRP inclusive of all taxes Section 18",
        "LM-MFG-001": "Rule 6 6(1)(a) name and address manufacturer packer importer",
        "LM-ADDR-001": "Rule 6 6(1)(a) address manufacturer postal address premises pin code",
        "LM-DATE-001": "Rule 6 6(1)(d) month and year manufacture pre-packed import date",
        "LM-CARE-001": "Rule 6 6(1)(e) consumer complaints telephone number email address customer care",
        "LM-COO-001": "Rule 6 6(1)(f) country of origin manufacture assembly imported products",
    }

    def __init__(
        self,
        docs: Optional[DocumentRegistry] = None,
        chunks: Optional[ChunkRegistry] = None,
        retriever: Optional[LegalRetriever] = None,
        citations: Optional[CitationManager] = None,
        explainer: Optional[GroundedLegalExplainer] = None,
    ):
        self.doc_registry = docs or document_registry
        self.chunk_registry = chunks or chunk_registry
        self.retriever = retriever or keyword_retriever
        self.citation_manager = citations or citation_manager
        self.explainer = explainer or grounded_legal_explainer

    def query_for_rule(self, rule_id: str, field_name: str) -> str:
        """Generates a targeted statutory search query for a rule."""
        if rule_id in self.RULE_QUERY_MAP:
            return self.RULE_QUERY_MAP[rule_id]
        return field_name.replace('_', ' ')

    def retrieve_legal_basis(self, rule_id: str, field_name: str, top_k: int = 2) -> List[LegalBasis]:
        """
        Retrieves supporting statutory provisions for a specific rule finding.
        Returns empty list if no reliable source is found (No Source = No Claim).
        """
        query = self.query_for_rule(rule_id, field_name)
        results = self.retriever.search(query, top_k=top_k, threshold=0.35)

        bases: List[LegalBasis] = []
        for r in results:
            basis = self.citation_manager.build_legal_basis(r.chunk, r.score)
            bases.append(basis)

        return bases

    def attach_legal_basis(self, compliance_result: ComplianceResult) -> ComplianceResult:
        """
        Attaches retrieved LegalBasis items to each RuleEvaluation in the compliance result.
        Does NOT modify the deterministic evaluation status (PASS/FAIL/etc.).
        """
        for ev in compliance_result.evaluations:
            bases = self.retrieve_legal_basis(ev.rule_id, ev.field, top_k=2)
            ev.legal_basis = bases

            # Generate grounded explanation
            explanation = self.explainer.generate_deterministic_explanation(
                rule_id=ev.rule_id,
                rule_name=ev.name,
                status=ev.status,
                field=ev.field,
                evidence_text=str(ev.evidence) if ev.evidence else None,
                legal_basis=bases,
            )
            # Update evaluation reason with legal citation context if available
            if bases:
                primary = bases[0]
                ev.reason = f"{ev.reason} [Statutory basis: {primary.source}, {primary.rule_number} ({primary.section})]"

        return compliance_result

    def search_provisions(self, query: str, top_k: int = 5) -> List[Dict[str, Any]]:
        """Transparent search interface for statutory provisions."""
        results = self.retriever.search(query, top_k=top_k, threshold=0.20)
        output = []
        for r in results:
            output.append({
                "chunk_id": r.chunk.chunk_id,
                "title": r.chunk.document_title,
                "rule_number": r.rule_number,
                "section": r.section,
                "text": r.chunk.text,
                "score": r.score,
                "source_url": r.citation.official_url,
                "citation": r.citation.format_citation(),
            })
        return output

    def list_sources(self) -> List[LegalDocument]:
        """Returns all loaded authoritative legal documents."""
        return self.doc_registry.list_documents()

    def get_status(self) -> KnowledgeBaseStatus:
        """Returns knowledge base provenance and indexing statistics."""
        docs = self.doc_registry.list_documents()
        sources_summary = [
            {
                "source_id": d.source_id,
                "title": d.title,
                "authority": d.authority,
                "type": d.document_type.value,
                "version": d.version,
                "effective_date": d.effective_date,
                "status": d.status.value,
                "official_url": d.source_url,
            }
            for d in docs
        ]

        return KnowledgeBaseStatus(
            documents_count=len(docs),
            chunks_count=self.chunk_registry.count(),
            retrieval_method="Keyword / Lexical BM25 (Deterministic)",
            last_indexed=datetime.utcnow().isoformat(),
            sources=sources_summary,
        )


legal_knowledge_service = LegalKnowledgeService()
