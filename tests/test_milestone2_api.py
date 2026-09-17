import io
import unittest
from PIL import Image, ImageDraw
from fastapi.testclient import TestClient

from backend.main import app


class TestMilestone2API(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.client = TestClient(app)

        # Generate a balanced, valid synthetic test image in memory
        img = Image.new("RGB", (500, 500), color=(180, 180, 180))
        draw = ImageDraw.Draw(img)
        draw.rectangle([20, 20, 480, 480], outline=(20, 20, 20), width=3)
        draw.text((40, 40), "BRITANNIA GOOD DAY BISCUITS", fill=(10, 10, 10))
        draw.text((40, 100), "NET QUANTITY: 200 g", fill=(10, 10, 10))
        draw.text((40, 160), "M.R.P. Rs. 40.00 (INCL. OF ALL TAXES)", fill=(10, 10, 10))
        buf = io.BytesIO()
        img.save(buf, format="JPEG")
        cls.valid_image_bytes = buf.getvalue()

    def test_analyze_image_contains_compliance(self):
        """Verify POST /api/v1/analyze/image returns compliance findings alongside Milestone 1 fields."""
        response = self.client.post(
            "/api/v1/analyze/image",
            files={"file": ("product.jpg", self.valid_image_bytes, "image/jpeg")},
        )
        self.assertEqual(response.status_code, 200)
        data = response.json()

        # Milestone 1 structures must be preserved
        self.assertTrue(data["success"])
        self.assertIn("image_quality", data)
        self.assertIn("ocr", data)
        self.assertIn("fields", data)

        # Milestone 2 compliance structure must be present
        self.assertIn("compliance", data)
        comp = data["compliance"]
        self.assertIsNotNone(comp)

        # Verify compliance attributes
        self.assertIn("status", comp)
        self.assertIn(comp["status"], [
            "COMPLIANT", "NON_COMPLIANT", "PARTIALLY_VERIFIABLE", "NOT_VERIFIABLE"
        ])
        self.assertIn("summary", comp)
        self.assertIn("rules_checked", comp)
        self.assertEqual(comp["rules_checked"], 8)
        self.assertIn("rules_passed", comp)
        self.assertIn("rules_failed", comp)
        self.assertIn("rules_unclear", comp)
        self.assertIn("rules_not_verifiable", comp)
        self.assertIn("evaluations", comp)
        self.assertIsInstance(comp["evaluations"], list)
        self.assertEqual(len(comp["evaluations"]), 8)
        self.assertIn("findings", comp)
        self.assertIsInstance(comp["findings"], list)

        # Verify individual rule evaluation structure
        first_eval = comp["evaluations"][0]
        self.assertIn("rule_id", first_eval)
        self.assertIn("name", first_eval)
        self.assertIn("status", first_eval)
        self.assertIn("reason", first_eval)
        self.assertIn("confidence", first_eval)
        self.assertIn("field", first_eval)


if __name__ == "__main__":
    unittest.main()
