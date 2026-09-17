import io
import unittest
from PIL import Image, ImageDraw
from fastapi.testclient import TestClient

from backend.main import app


def create_test_image_bytes() -> bytes:
    img = Image.new("RGB", (400, 300), color=(200, 200, 200))
    draw = ImageDraw.Draw(img)
    draw.text((20, 20), "PARLE-G ORIGINAL GLUCOSE BISCUITS", fill=(0, 0, 0))
    draw.text((20, 60), "NET WEIGHT: 250 g", fill=(0, 0, 0))
    draw.text((20, 100), "MRP: Rs. 30.00", fill=(0, 0, 0))
    buf = io.BytesIO()
    img.save(buf, format="JPEG")
    return buf.getvalue()


class TestMilestone4API(unittest.TestCase):
    def setUp(self):
        self.client = TestClient(app)

    def test_get_legal_sources(self):
        res = self.client.get("/api/v1/legal/sources")
        self.assertEqual(res.status_code, 200)
        sources = res.json()
        self.assertIsInstance(sources, list)
        self.assertGreaterEqual(len(sources), 4)

        source_ids = [s["source_id"] for s in sources]
        self.assertIn("PCR-2011", source_ids)
        self.assertIn("LMA-2009", source_ids)

        # Check official URL presence
        for s in sources:
            self.assertTrue(s["source_url"].startswith("https://consumeraffairs.nic.in/"))

    def test_search_legal_provisions(self):
        res = self.client.get("/api/v1/legal/search?q=net%20quantity&top_k=3")
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertEqual(data["query"], "net quantity")
        self.assertGreater(data["count"], 0)

        first_hit = data["results"][0]
        self.assertIn("chunk_id", first_hit)
        self.assertIn("section", first_hit)
        self.assertIn("citation", first_hit)
        self.assertTrue(first_hit["source_url"].startswith("https://consumeraffairs.nic.in/"))

    def test_search_validation_min_length(self):
        res = self.client.get("/api/v1/legal/search?q=a")
        self.assertEqual(res.status_code, 422)

    def test_get_legal_status(self):
        res = self.client.get("/api/v1/legal/status")
        self.assertEqual(res.status_code, 200)
        status_data = res.json()
        self.assertGreaterEqual(status_data["documents_count"], 4)
        self.assertGreaterEqual(status_data["chunks_count"], 10)
        self.assertIn("Keyword", status_data["retrieval_method"])
        self.assertIn("last_indexed", status_data)

    def test_analyze_image_returns_legal_basis(self):
        img_bytes = create_test_image_bytes()
        files = {"file": ("test.jpg", io.BytesIO(img_bytes), "image/jpeg")}
        res = self.client.post("/api/v1/analyze/image", files=files)
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertTrue(data["success"])
        self.assertIn("compliance", data)

        evaluations = data["compliance"]["evaluations"]
        # Verify legal basis is attached to evaluations
        nq_eval = next((e for e in evaluations if e["rule_id"] == "LM-NQ-001"), None)
        self.assertIsNotNone(nq_eval)
        self.assertIn("legal_basis", nq_eval)
        self.assertGreater(len(nq_eval["legal_basis"]), 0)
        self.assertEqual(nq_eval["legal_basis"][0]["section"], "6(1)(c)")


if __name__ == "__main__":
    unittest.main()
