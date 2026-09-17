import unittest
from backend.legal_knowledge.citations import citation_manager
from backend.legal_knowledge.chunks import chunk_registry


class TestMilestone4Citations(unittest.TestCase):
    def test_validate_chunk_id(self):
        self.assertTrue(citation_manager.validate_chunk_id("PCR-2011-6-1-C"))
        self.assertTrue(citation_manager.validate_chunk_id("PCR-2011-6-1-DA"))
        self.assertFalse(citation_manager.validate_chunk_id("FAKE-CHUNK-ID-999"))
        self.assertFalse(citation_manager.validate_chunk_id(""))

    def test_validate_citations_array(self):
        valid_ids = ["PCR-2011-6-1-C", "PCR-2011-6-1-DA"]
        is_valid, invalid = citation_manager.validate_citations(valid_ids)
        self.assertTrue(is_valid)
        self.assertEqual(len(invalid), 0)

        mixed_ids = ["PCR-2011-6-1-C", "HALLUCINATED_ID_404"]
        is_valid_mixed, invalid_mixed = citation_manager.validate_citations(mixed_ids)
        self.assertFalse(is_valid_mixed)
        self.assertEqual(invalid_mixed, ["HALLUCINATED_ID_404"])

    def test_build_legal_basis(self):
        chunk = chunk_registry.get_chunk("PCR-2011-6-1-C")
        self.assertIsNotNone(chunk)
        basis = citation_manager.build_legal_basis(chunk, score=0.92)
        self.assertEqual(basis.chunk_id, "PCR-2011-6-1-C")
        self.assertEqual(basis.rule_number, "Rule 6")
        self.assertEqual(basis.section, "6(1)(c)")
        self.assertEqual(basis.retrieval_score, 0.92)
        self.assertTrue(basis.official_url.startswith("https://consumeraffairs.nic.in/"))
        self.assertIn("standard unit", basis.excerpt.lower())


if __name__ == "__main__":
    unittest.main()
