import unittest
from backend.legal_knowledge.documents import document_registry


class TestMilestone4Ingestion(unittest.TestCase):
    def test_official_sources_ingestion(self):
        docs = document_registry.list_documents()
        self.assertGreaterEqual(len(docs), 4)

        source_ids = {d.source_id for d in docs}
        self.assertIn("LMA-2009", source_ids)
        self.assertIn("PCR-2011", source_ids)
        self.assertIn("PCAR-2021", source_ids)
        self.assertIn("PCAR-2022", source_ids)

    def test_pcr_2011_metadata(self):
        doc = document_registry.get_document("PCR-2011")
        self.assertIsNotNone(doc)
        self.assertEqual(doc.title, "Legal Metrology (Packaged Commodities) Rules, 2011")
        self.assertEqual(doc.version, "G.S.R. 427(E)")
        self.assertTrue(doc.source_url.startswith("https://consumeraffairs.nic.in/"))
        self.assertIn("Department of Consumer Affairs", doc.authority)
        self.assertEqual(doc.status.value, "ACTIVE")

    def test_lma_2009_metadata(self):
        doc = document_registry.get_document("LMA-2009")
        self.assertIsNotNone(doc)
        self.assertEqual(doc.title, "The Legal Metrology Act, 2009")
        self.assertEqual(doc.version, "Act No. 1 of 2010")
        self.assertTrue(doc.source_url.startswith("https://consumeraffairs.nic.in/"))


if __name__ == "__main__":
    unittest.main()
