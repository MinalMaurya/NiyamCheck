import io
import unittest
from PIL import Image, ImageDraw
from fastapi.testclient import TestClient

from backend.app.main import app
from backend.app.schemas.declarations import DeclarationState


class TestAPIEndpoints(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.client = TestClient(app)

        # Create a clean synthetic in-memory image for upload tests
        img = Image.new("RGB", (500, 500), color="white")
        draw = ImageDraw.Draw(img)
        draw.text((50, 50), "PARLE-G BISCUITS", fill="black")
        draw.text((50, 100), "NET WT: 250 g", fill="black")
        draw.text((50, 150), "MRP Rs. 30.00", fill="black")
        draw.text((50, 200), "MFD: 08/2026", fill="black")
        buf = io.BytesIO()
        img.save(buf, format="JPEG")
        cls.test_image_bytes = buf.getvalue()

    def test_root_endpoint(self):
        response = self.client.get("/")
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data["service"], "NiyamCheck")
        self.assertIn("docs", data)

    def test_health_endpoint(self):
        response = self.client.get("/api/v1/health")
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data["status"], "healthy")
        self.assertEqual(data["service"], "NiyamCheck")

    def test_sample_declaration_endpoint(self):
        response = self.client.get("/api/v1/analyze/sample-declaration")
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data["status"], "SUCCESS")
        self.assertIn("quality_report", data)
        self.assertIn("ocr_result", data)
        self.assertIn("extracted_declarations", data)
        # Verify declaration fields
        decls = data["extracted_declarations"]
        self.assertEqual(decls["mrp"]["state"], DeclarationState.PRESENT.value)

    def test_quality_check_endpoint(self):
        response = self.client.post(
            "/api/v1/analyze/quality",
            files={"file": ("test.jpg", self.test_image_bytes, "image/jpeg")},
        )
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertIn("verdict", data)
        self.assertIn("sharpness", data)
        self.assertIn("glare", data)
        self.assertEqual(data["width"], 500)
        self.assertEqual(data["height"], 500)

    def test_ocr_endpoint(self):
        response = self.client.post(
            "/api/v1/analyze/ocr",
            files={"file": ("test.jpg", self.test_image_bytes, "image/jpeg")},
        )
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertIn("boxes", data)
        self.assertIn("raw_text", data)
        self.assertGreater(data["line_count"], 0)

    def test_extract_text_endpoint(self):
        payload = {
            "raw_text": (
                "AMUL BUTTER\n"
                "NET QUANTITY: 500 g\n"
                "M.R.P. Rs. 275.00 (INCL. OF ALL TAXES)\n"
                "MFD. DATE: 08/2026\n"
                "CALL 1800-258-3333 OR EMAIL: CARE@AMUL.COOP"
            ),
            "client_platform": "web",
        }
        response = self.client.post("/api/v1/analyze/extract", json=payload)
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data["mrp"]["state"], DeclarationState.PRESENT.value)
        self.assertEqual(data["mrp"]["value"]["amount"], 275.0)
        self.assertEqual(data["net_quantity"]["value"]["magnitude"], 500.0)
        self.assertEqual(data["consumer_care"]["value"]["helpline_number"], "1800-258-3333")

    def test_full_pipeline_web_client(self):
        response = self.client.post(
            "/api/v1/analyze/pipeline",
            files={"file": ("packaging.jpg", self.test_image_bytes, "image/jpeg")},
            data={"client_platform": "web"},
        )
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data["status"], "SUCCESS")
        self.assertEqual(data["client_platform"], "web")
        self.assertIsNotNone(data["quality_report"])
        self.assertIsNotNone(data["ocr_result"])
        self.assertIsNotNone(data["extracted_declarations"])

    def test_full_pipeline_android_client(self):
        response = self.client.post(
            "/api/v1/analyze/pipeline",
            headers={"X-Client-Platform": "android"},
            files={"file": ("camera_capture.jpg", self.test_image_bytes, "image/jpeg")},
        )
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data["status"], "SUCCESS")
        self.assertEqual(data["client_platform"], "android")
        self.assertIn("session_id", data)


if __name__ == "__main__":
    unittest.main()
