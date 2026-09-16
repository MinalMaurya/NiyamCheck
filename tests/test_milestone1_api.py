import io
import unittest
from PIL import Image, ImageDraw
from fastapi.testclient import TestClient

from backend.main import app
from backend.schemas.analysis import ExtractionStatus, ImageQualityStatus


class TestMilestone1API(unittest.TestCase):
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

    def test_root_endpoint(self):
        response = self.client.get("/")
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data["service"], "NiyamCheck")
        self.assertIn("Milestone 1", data["milestone"])

    def test_health_endpoints(self):
        res1 = self.client.get("/api/v1/health")
        self.assertEqual(res1.status_code, 200)
        self.assertEqual(res1.json()["status"], "healthy")

        res2 = self.client.get("/api/v1/analyze/health")
        self.assertEqual(res2.status_code, 200)
        self.assertEqual(res2.json()["status"], "healthy")

    def test_analyze_image_endpoint_success(self):
        """Primary endpoint: POST /api/v1/analyze/image with valid multipart upload."""
        response = self.client.post(
            "/api/v1/analyze/image",
            files={"file": ("product_sample.jpg", self.valid_image_bytes, "image/jpeg")},
        )
        self.assertEqual(response.status_code, 200)
        data = response.json()

        # 1. Root structure
        self.assertTrue(data["success"])
        self.assertIn("image_quality", data)
        self.assertIn("ocr", data)
        self.assertIn("fields", data)

        # 2. Image Quality structure
        iq = data["image_quality"]
        self.assertIn(iq["status"], ["GOOD", "ACCEPTABLE", "POOR"])
        self.assertIsInstance(iq["score"], float)
        self.assertIsInstance(iq["issues"], list)

        # 3. OCR structure
        ocr = data["ocr"]
        self.assertIsInstance(ocr["text"], str)
        self.assertIsInstance(ocr["regions"], list)

        # 4. Fields structure
        fields = data["fields"]
        required_field_keys = [
            "product_name", "manufacturer", "packer", "importer", "address",
            "net_quantity", "mrp", "date_information", "consumer_care", "country_of_origin"
        ]
        for k in required_field_keys:
            self.assertIn(k, fields)
            self.assertIn("status", fields[k])
            self.assertIn("confidence", fields[k])
            self.assertIn(fields[k]["status"], [
                "PRESENT", "MISSING", "UNCLEAR", "NOT_APPLICABLE", "NOT_VERIFIABLE"
            ])

        # Verify specific parsed fields from default mock packaging
        self.assertEqual(fields["mrp"]["status"], ExtractionStatus.PRESENT.value)
        self.assertEqual(fields["net_quantity"]["status"], ExtractionStatus.PRESENT.value)

    def test_empty_file_returns_400(self):
        """Empty file upload should return 400 Bad Request."""
        response = self.client.post(
            "/api/v1/analyze/image",
            files={"file": ("empty.jpg", b"", "image/jpeg")},
        )
        self.assertEqual(response.status_code, 400)
        self.assertIn("empty", response.json()["detail"].lower())

    def test_corrupted_file_returns_422(self):
        """Corrupted/invalid file bytes should return 422 Unprocessable Entity."""
        response = self.client.post(
            "/api/v1/analyze/image",
            files={"file": ("corrupted.jpg", b"bad_corrupted_data", "image/jpeg")},
        )
        self.assertEqual(response.status_code, 422)


if __name__ == "__main__":
    unittest.main()
