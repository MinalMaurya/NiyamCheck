from enum import Enum
from datetime import datetime
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field


class DocumentType(str, Enum):
    ACT = "ACT"
    RULES = "RULES"
    AMENDMENT = "AMENDMENT"
    NOTIFICATION = "NOTIFICATION"
    CIRCULAR = "CIRCULAR"


class DocumentStatus(str, Enum):
    ACTIVE = "ACTIVE"
    AMENDED = "AMENDED"
    REPEALED = "REPEALED"
    SUPERSEDED = "SUPERSEDED"
    UNVERIFIED = "UNVERIFIED"


class Citation(BaseModel):
    """
    Standardized statutory citation pointing to an authoritative legal source.
    Traceable to official Government of India publications.
    """
    source_title: str = Field(..., description="Official title of Act, Rule, or Order")
    authority: str = Field(..., description="Issuing authority, e.g. Department of Consumer Affairs")
    rule_number: str = Field(..., description="Primary rule or section designation, e.g. Rule 6")
    section: str = Field(..., description="Precise sub-rule, subsection, or clause, e.g. 6(1)(c)")
    official_url: str = Field(..., description="Official .gov.in or .nic.in source publication URL")
    version: str = Field(..., description="Statutory version, e.g. GSR 427(E)")
    publication_date: str = Field(..., description="Date of official gazette notification (YYYY-MM-DD)")

    def format_citation(self) -> str:
        """Produces standard statutory legal citation string."""
        return (
            f"{self.source_title}, {self.rule_number}, {self.section} "
            f"({self.version}, notified {self.publication_date}). "
            f"Authority: {self.authority}. Source: {self.official_url}"
        )


class LegalDocument(BaseModel):
    """
    Complete authoritative legal document (Act, Statutory Rules, or Amendment Order).
    Designed with complete provenance and versioning metadata.
    """
    source_id: str = Field(..., description="Unique document code, e.g. PCR-2011, LMA-2009")
    title: str = Field(..., description="Official document title")
    authority: str = Field(..., description="Government entity with statutory jurisdiction")
    document_type: DocumentType = Field(..., description="ACT, RULES, AMENDMENT, etc.")
    publication_date: str = Field(..., description="Publication date in Gazette of India")
    effective_date: str = Field(..., description="Statutory commencement date")
    version: str = Field(..., description="Notification number or version string")
    source_url: str = Field(..., description="Official government web link")
    jurisdiction: str = Field("India", description="Sovereign jurisdiction")
    status: DocumentStatus = Field(DocumentStatus.ACTIVE, description="ACTIVE, AMENDED, etc.")
    content: str = Field(..., description="Full text or preamble of statutory instrument")
    metadata: Dict[str, Any] = Field(default_factory=dict)


class LegalChunk(BaseModel):
    """
    Hierarchical legal chunk preserving exact statutory structure:
    Act -> Section -> Rule -> Sub-rule -> Clause -> Proviso.
    """
    chunk_id: str = Field(..., description="Unique chunk key, e.g. PCR-2011-R6-1-C")
    source_id: str = Field(..., description="Parent document identifier")
    document_title: str = Field(..., description="Title of parent statutory document")
    rule_number: str = Field(..., description="Rule or Section identifier")
    section: str = Field(..., description="Exact statutory sub-designation")
    subsection: Optional[str] = None
    clause: Optional[str] = None
    heading: Optional[str] = None
    text: str = Field(..., description="Verbatim statutory text of provision")
    effective_from: str = Field(..., description="Commencement date of this chunk's wording")
    effective_to: Optional[str] = Field(None, description="Date superseded if amended")
    keywords: List[str] = Field(default_factory=list, description="Statutory indexing terms")
    metadata: Dict[str, Any] = Field(default_factory=dict)


class LegalBasis(BaseModel):
    """
    Supporting statutory legal provision retrieved for a deterministic rule evaluation.
    Provides legal transparency and citation without altering deterministic compliance logic.
    """
    chunk_id: str
    rule_number: str
    section: str
    source: str
    citation: Citation
    retrieval_score: float = Field(..., ge=0.0, le=1.0, description="Confidence of legal retrieval match (separate from OCR)")
    excerpt: str = Field(..., description="Verbatim statutory text of the supporting provision")
    official_url: str


class KnowledgeBaseStatus(BaseModel):
    """Transparency status of the authoritative legal knowledge repository."""
    documents_count: int
    chunks_count: int
    retrieval_method: str
    last_indexed: str
    sources: List[Dict[str, Any]]


class GroundedLegalExplanation(BaseModel):
    """
    Structured legal explanation model.
    Guarantees strict source-grounding: only citations referencing known chunk IDs are valid.
    """
    rule_id: str
    explanation: str
    source_chunk_ids: List[str] = Field(default_factory=list)
    uncertainty: Optional[str] = None
    unsupported_claims: List[str] = Field(default_factory=list)
    is_grounded: bool = True
