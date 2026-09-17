import unittest
from backend.legal_knowledge.chunks import chunk_registry


class TestMilestone4Chunking(unittest.TestCase):
    def test_chunk_registry_population(self):
        chunks = chunk_registry.list_chunks()
        self.assertGreater(len(chunks), 10)

    def test_rule_6_subrules_chunking(self):
        # Verify specific sub-rule chunks exist with exact statutory hierarchy
        chunk_6a = chunk_registry.get_chunk("PCR-2011-6-1-A")
        self.assertIsNotNone(chunk_6a)
        self.assertEqual(chunk_6a.rule_number, "Rule 6")
        self.assertEqual(chunk_6a.section, "6(1)(a)")
        self.assertIn("manufacturer", chunk_6a.text.lower())
        self.assertIn("address", chunk_6a.text.lower())

        chunk_6c = chunk_registry.get_chunk("PCR-2011-6-1-C")
        self.assertIsNotNone(chunk_6c)
        self.assertEqual(chunk_6c.rule_number, "Rule 6")
        self.assertEqual(chunk_6c.section, "6(1)(c)")
        self.assertIn("net quantity", chunk_6c.text.lower())
        self.assertIn("standard unit", chunk_6c.text.lower())

        chunk_6da = chunk_registry.get_chunk("PCR-2011-6-1-DA")
        self.assertIsNotNone(chunk_6da)
        self.assertEqual(chunk_6da.section, "6(1)(da)")
        self.assertIn("maximum retail price", chunk_6da.text.lower())
        self.assertIn("inclusive of all taxes", chunk_6da.text.lower())

    def test_section_18_act_chunking(self):
        chunk_sec18 = chunk_registry.get_chunk("LMA-2009-SEC-18-1")
        self.assertIsNotNone(chunk_sec18)
        self.assertEqual(chunk_sec18.rule_number, "Section 18")
        self.assertIn("pre-packaged commodity", chunk_sec18.text.lower())
        self.assertIn("standard quantities", chunk_sec18.text.lower())


if __name__ == "__main__":
    unittest.main()
