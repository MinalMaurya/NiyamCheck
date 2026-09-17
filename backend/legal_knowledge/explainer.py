from typing import Optional, List, Dict, Any
from backend.compliance.models import RuleStatus
from backend.legal_knowledge.models import GroundedLegalExplanation, LegalBasis
from backend.legal_knowledge.citations import citation_manager


class GroundedLegalExplainer:
    """
    Generates transparent, source-grounded legal explanations for compliance findings.
    Provides a deterministic offline template engine and strict validation for optional LLMs.
    """

    def generate_deterministic_explanation(
        self,
        rule_id: str,
        rule_name: str,
        status: RuleStatus,
        field: str,
        evidence_text: Optional[str],
        legal_basis: List[LegalBasis],
    ) -> GroundedLegalExplanation:
        """Generates plain, neutral legal context grounded strictly in retrieved sources."""
        if not legal_basis:
            return GroundedLegalExplanation(
                rule_id=rule_id,
                explanation="No authoritative legal provision was retrieved from the configured knowledge base for this finding.",
                source_chunk_ids=[],
                uncertainty="No matching statutory provision found above confidence threshold.",
                unsupported_claims=[],
                is_grounded=True,
            )

        primary_basis = legal_basis[0]
        citation_str = f"{primary_basis.source}, {primary_basis.rule_number} ({primary_basis.section})"
        chunk_ids = [b.chunk_id for b in legal_basis]

        if status == RuleStatus.PASS:
            explanation = (
                f"The packaging declaration for '{rule_name}' was detected and satisfied the deterministic validation checks. "
                f"Supporting statutory provision retrieved from the knowledge base: {citation_str}."
            )
        elif status == RuleStatus.FAIL:
            explanation = (
                f"The packaging declaration for '{rule_name}' does not satisfy statutory validation requirements. "
                f"Supporting legal mandate: {citation_str} requires: '{primary_basis.excerpt}'."
            )
        elif status == RuleStatus.UNCLEAR:
            explanation = (
                f"The available image evidence for '{rule_name}' is ambiguous or below detection thresholds. "
                f"Relevant statutory provision: {citation_str}."
            )
        elif status == RuleStatus.NOT_APPLICABLE:
            explanation = (
                f"The requirement for '{rule_name}' is conditional or not applicable to this scanned commodity. "
                f"Governing statutory reference: {citation_str}."
            )
        else:  # NOT_VERIFIABLE
            explanation = (
                f"The packaging declaration for '{rule_name}' could not be verified from the submitted view. "
                f"Statutory mandate under {citation_str}."
            )

        return GroundedLegalExplanation(
            rule_id=rule_id,
            explanation=explanation,
            source_chunk_ids=chunk_ids,
            uncertainty=None,
            unsupported_claims=[],
            is_grounded=True,
        )

    def validate_llm_explanation(
        self,
        rule_id: str,
        llm_payload: Dict[str, Any],
        retrieved_chunk_ids: List[str],
    ) -> GroundedLegalExplanation:
        """
        Validates LLM-generated output against retrieved chunk IDs.
        REJECTS the explanation if it cites unknown chunk IDs or hallucinated sources.
        """
        cited_ids = llm_payload.get("source_chunk_ids", [])
        explanation_text = llm_payload.get("explanation", "")

        # 1. Verify all cited chunk IDs exist in the authoritative knowledge base
        all_valid, invalid_ids = citation_manager.validate_citations(cited_ids)

        # 2. Verify all cited chunk IDs were actually retrieved in the current query
        unretrieved_ids = [cid for cid in cited_ids if cid not in retrieved_chunk_ids]

        if not all_valid or unretrieved_ids:
            # Hallucination detected: Reject output and fall back to safe message
            return GroundedLegalExplanation(
                rule_id=rule_id,
                explanation="[REJECTED: LLM output cited unverified or unretrieved legal sources.]",
                source_chunk_ids=[],
                uncertainty="LLM response failed citation grounding verification.",
                unsupported_claims=invalid_ids + unretrieved_ids,
                is_grounded=False,
            )

        return GroundedLegalExplanation(
            rule_id=rule_id,
            explanation=explanation_text,
            source_chunk_ids=cited_ids,
            uncertainty=llm_payload.get("uncertainty"),
            unsupported_claims=llm_payload.get("unsupported_claims", []),
            is_grounded=True,
        )


grounded_legal_explainer = GroundedLegalExplainer()
