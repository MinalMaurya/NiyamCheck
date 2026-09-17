import unittest
from backend.compliance.models import ComplianceResult, ComplianceStatus, RuleEvaluation, RuleStatus
from backend.compliance.rule_engine import compliance_engine
from backend.schemas.analysis import ExtractedFields, FieldResult, ExtractionStatus
from backend.legal_knowledge.service import legal_knowledge_service
from backend.legal_knowledge.explainer import grounded_legal_explainer


class TestMilestone4ComplianceSupport(unittest.TestCase):
    def test_attach_legal_basis_to_evaluations(self):
        fields = ExtractedFields(
            product_name=FieldResult[str](status=ExtractionStatus.PRESENT, value="TEST PRODUCT", confidence=0.9),
            net_quantity=FieldResult[str](status=ExtractionStatus.PRESENT, value="250 g", confidence=0.95),
            mrp=FieldResult[str](status=ExtractionStatus.PRESENT, value="₹ 50.00", confidence=0.92),
        )
        comp = compliance_engine.evaluate(fields)
        # Before attach, legal_basis is empty
        for ev in comp.evaluations:
            self.assertEqual(len(ev.legal_basis), 0)

        # Attach legal basis
        legal_knowledge_service.attach_legal_basis(comp)

        # Deterministic status must NOT be changed by RAG
        self.assertEqual(comp.status, ComplianceStatus.PARTIALLY_VERIFIABLE)

        # Net quantity evaluation must have supporting legal basis
        nq_eval = next(e for e in comp.evaluations if e.rule_id == "LM-NQ-001")
        self.assertGreater(len(nq_eval.legal_basis), 0)
        primary_basis = nq_eval.legal_basis[0]
        self.assertEqual(primary_basis.rule_number, "Rule 6")
        self.assertEqual(primary_basis.section, "6(1)(c)")
        self.assertTrue(primary_basis.official_url.startswith("https://consumeraffairs.nic.in/"))

        # MRP evaluation must have Rule 6(1)(da)
        mrp_eval = next(e for e in comp.evaluations if e.rule_id == "LM-MRP-001")
        self.assertGreater(len(mrp_eval.legal_basis), 0)
        self.assertEqual(mrp_eval.legal_basis[0].section, "6(1)(da)")

    def test_no_legal_basis_for_unknown_query(self):
        eval_unknown = RuleEvaluation(
            rule_id="LM-UNKNOWN-999",
            name="Unknown Requirement",
            category="Custom",
            requirement="Something not in law",
            status=RuleStatus.FAIL,
            reason="Not present",
            evidence=None,
            confidence=0.0,
            field="unknown_field",
        )
        comp = ComplianceResult(
            status=ComplianceStatus.NON_COMPLIANT,
            summary="Custom check",
            rules_checked=1,
            rules_passed=0,
            rules_failed=1,
            rules_unclear=0,
            rules_not_verifiable=0,
            rules_not_applicable=0,
            evaluations=[eval_unknown],
            findings=[],
        )
        legal_knowledge_service.attach_legal_basis(comp)
        # Should be empty (No Source = No Claim)
        self.assertEqual(len(comp.evaluations[0].legal_basis), 0)

    def test_explainer_rejects_hallucinated_llm_citations(self):
        # LLM response citing a fake chunk ID
        bad_llm_output = {
            "explanation": "According to Section 999 of the imaginary rules...",
            "source_chunk_ids": ["PCR-2011-FAKE-CHUNK-99"],
            "uncertainty": None,
            "unsupported_claims": [],
        }
        explanation = grounded_legal_explainer.validate_llm_explanation(
            rule_id="LM-NQ-001",
            llm_payload=bad_llm_output,
            retrieved_chunk_ids=["PCR-2011-6-1-C"],
        )
        self.assertFalse(explanation.is_grounded)
        self.assertIn("REJECTED", explanation.explanation)
        self.assertIn("PCR-2011-FAKE-CHUNK-99", explanation.unsupported_claims)

    def test_explainer_accepts_valid_grounded_llm_citations(self):
        good_llm_output = {
            "explanation": "Rule 6(1)(c) mandates net quantity declaration in standard metric units.",
            "source_chunk_ids": ["PCR-2011-6-1-C"],
            "uncertainty": None,
            "unsupported_claims": [],
        }
        explanation = grounded_legal_explainer.validate_llm_explanation(
            rule_id="LM-NQ-001",
            llm_payload=good_llm_output,
            retrieved_chunk_ids=["PCR-2011-6-1-C"],
        )
        self.assertTrue(explanation.is_grounded)
        self.assertEqual(explanation.source_chunk_ids, ["PCR-2011-6-1-C"])


if __name__ == "__main__":
    unittest.main()
