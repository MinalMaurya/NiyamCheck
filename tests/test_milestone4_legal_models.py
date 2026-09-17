import unittest
from backend.legal_knowledge.models import (
    DocumentType,
    DocumentStatus,
    Citation,
    LegalDocument,
    LegalChunk,
    LegalBasis,
    KnowledgeBaseStatus,
    GroundedLegalExplanation,
)


class TestMilestone4LegalModels(unittest.TestCase):
    def test_citation_formatting(self):
        citation = Citation(
            source_title="Legal Metrology (Packaged Commodities) Rules, 2011",
            authority="Department of Consumer Affairs, Government of India",
            rule_number="Rule 6",
            section="6(1)(c)",
            official_url="https://consumeraffairs.nic.in/acts-and-rules/legal-metrology/the-legal-metrology-packaged-commodities-rules-2011",
            version="G.S.R. 427(E)",
            publication_date="2011-06-24",
        )
        formatted = citation.format_citation()
        self.assertIn("Rule 6", formatted)
        self.assertIn("6(1)(c)", formatted)
        self.assertIn("G.S.R. 427(E)", formatted)
        self.assertIn("https://consumeraffairs.nic.in", formatted)

    def test_legal_document_model(self):
        doc = LegalDocument(
            source_id="TEST-DOC-01",
            title="Test Statutory Rules 2026",
            authority="Department of Consumer Affairs",
            document_type=DocumentType.RULES,
            publication_date="2026-01-01",
            effective_date="2026-04-01",
            version="GSR 100(E)",
            source_url="https://consumeraffairs.nic.in/test",
            jurisdiction="India",
            status=DocumentStatus.ACTIVE,
            content="Sample text",
        )
        self.assertEqual(doc.source_id, "TEST-DOC-01")
        self.assertEqual(doc.document_type, DocumentType.RULES)
        self.assertEqual(doc.status, DocumentStatus.ACTIVE)

    def test_legal_basis_model_score_validation(self):
        citation = Citation(
            source_title="Test Rules",
            authority="Govt",
            rule_number="Rule 1",
            section="1(a)",
            official_url="https://gov.in",
            version="v1",
            publication_date="2020-01-01",
        )
        basis = LegalBasis(
            chunk_id="CHUNK-01",
            rule_number="Rule 1",
            section="1(a)",
            source="Test Rules",
            citation=citation,
            retrieval_score=0.88,
            excerpt="Statutory excerpt",
            official_url="https://gov.in",
        )
        self.assertEqual(basis.retrieval_score, 0.88)
        self.assertEqual(basis.chunk_id, "CHUNK-01")

        # Invalid score should fail pydantic validation
        with self.assertRaises(Exception):
            LegalBasis(
                chunk_id="CHUNK-02",
                rule_number="Rule 1",
                section="1(a)",
                source="Test Rules",
                citation=citation,
                retrieval_score=1.5,  # > 1.0
                excerpt="Excerpt",
                official_url="https://gov.in",
            )


if __name__ == "__main__":
    unittest.main()
