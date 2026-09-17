import unittest
from backend.legal_knowledge.retriever import keyword_retriever


class TestMilestone4Retrieval(unittest.TestCase):
    def test_retrieve_net_quantity(self):
        results = keyword_retriever.search("net quantity standard unit measurement", top_k=3)
        self.assertGreater(len(results), 0)
        top = results[0]
        self.assertEqual(top.section, "6(1)(c)")
        self.assertGreaterEqual(top.score, 0.5)
        self.assertLessEqual(top.score, 1.0)
        self.assertIn("net quantity", top.chunk.text.lower())

    def test_retrieve_mrp(self):
        results = keyword_retriever.search("maximum retail price mrp inclusive of all taxes", top_k=3)
        self.assertGreater(len(results), 0)
        top = results[0]
        self.assertEqual(top.section, "6(1)(da)")
        self.assertGreaterEqual(top.score, 0.5)
        self.assertIn("maximum retail price", top.chunk.text.lower())

    def test_retrieve_consumer_care(self):
        results = keyword_retriever.search("consumer complaints telephone number email address care", top_k=3)
        self.assertGreater(len(results), 0)
        top = results[0]
        self.assertEqual(top.section, "6(1)(e)")
        self.assertIn("consumer complaints", top.chunk.text.lower())

    def test_retrieve_country_of_origin(self):
        results = keyword_retriever.search("country of origin manufacture assembly imported products", top_k=3)
        self.assertGreater(len(results), 0)
        top = results[0]
        self.assertEqual(top.section, "6(1)(f)")
        self.assertIn("country of origin", top.chunk.text.lower())

    def test_no_match_returns_empty(self):
        # Queries with zero semantic relevance to Legal Metrology must return empty (No Source = No Claim)
        results = keyword_retriever.search("astrophysics planetary nebula cosmic ray detection", top_k=3, threshold=0.35)
        self.assertEqual(len(results), 0)

    def test_empty_query_handling(self):
        self.assertEqual(keyword_retriever.search(""), [])
        self.assertEqual(keyword_retriever.search("   "), [])


if __name__ == "__main__":
    unittest.main()
