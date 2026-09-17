from typing import List, Optional
from fastapi import APIRouter, Query, HTTPException, status
from pydantic import BaseModel, Field

from backend.legal_knowledge.service import legal_knowledge_service
from backend.legal_knowledge.models import LegalDocument, KnowledgeBaseStatus

router = APIRouter()


class SearchResultItem(BaseModel):
    chunk_id: str
    title: str
    rule_number: str
    section: str
    text: str
    score: float
    source_url: str
    citation: str


class LegalSearchResponse(BaseModel):
    query: str
    count: int
    results: List[SearchResultItem]


@router.get(
    "/sources",
    response_model=List[LegalDocument],
    summary="List Authoritative Legal Sources",
    description="Returns all versioned, official Government of India statutory instruments in the legal knowledge base.",
)
async def list_legal_sources():
    return legal_knowledge_service.list_sources()


@router.get(
    "/search",
    response_model=LegalSearchResponse,
    summary="Search Authoritative Legal Provisions",
    description="Lexically searches official Legal Metrology statutory provisions and returns ranked chunks with citations.",
)
async def search_legal_provisions(
    q: str = Query(..., min_length=2, description="Statutory search query (e.g. 'net quantity', 'maximum retail price')"),
    top_k: int = Query(5, ge=1, le=20, description="Maximum number of provisions to retrieve"),
):
    results = legal_knowledge_service.search_provisions(q, top_k=top_k)
    return LegalSearchResponse(
        query=q,
        count=len(results),
        results=[SearchResultItem(**r) for r in results],
    )


@router.get(
    "/status",
    response_model=KnowledgeBaseStatus,
    summary="Knowledge Base Status & Provenance",
    description="Returns total document and chunk counts, retrieval engine type, indexing timestamp, and active sources.",
)
async def get_legal_status():
    return legal_knowledge_service.get_status()
