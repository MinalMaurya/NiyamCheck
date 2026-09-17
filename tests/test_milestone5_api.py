import io
import unittest
from PIL import Image, ImageDraw
from fastapi.testclient import TestClient

from backend.main import app
from backend.config import settings
from backend.inspections.store import inspection_store


def create_sample_jpeg_bytes() -> bytes:
    img = Image.new("RGB", (320, 240), color=(240, 240, 240))
    draw = ImageDraw.Draw(img)
    draw.text((10, 10), "TEST PACKAGE PANEL", fill=(0, 0, 0))
    draw.text((10, 50), "NET WT: 200 g", fill=(0, 0, 0))
    buf = io.BytesIO()
    img.save(buf, format="JPEG")
    return buf.getvalue()


class TestMilestone5API(unittest.TestCase):
    def setUp(self):
        self.client = TestClient(app)
        inspection_store.clear()

    def test_cors_configuration_allows_frontend_port_5173(self):
        # Verify CORS headers for localhost:5173
        headers = {
            "Origin": "http://localhost:5173",
            "Access-Control-Request-Method": "POST",
        }
        res = self.client.options("/api/v1/inspections", headers=headers)
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.headers.get("access-control-allow-origin"), "http://localhost:5173")

    def test_create_inspection_populates_image_urls_and_serves_images(self):
        img_bytes = create_sample_jpeg_bytes()
        files = [
            ("files", ("front_panel.jpg", io.BytesIO(img_bytes), "image/jpeg")),
        ]
        data = {
            "panels": ["FRONT"],
        }
        create_res = self.client.post("/api/v1/inspections", files=files, data=data)
        self.assertEqual(create_res.status_code, 200)
        session_data = create_res.json()

        insp_id = session_data["inspection_id"]
        images = session_data["images"]
        self.assertEqual(len(images), 1)

        # Check image_url is populated
        img_entry = images[0]
        self.assertIn("image_url", img_entry)
        self.assertTrue(img_entry["image_url"].startswith(f"/api/v1/inspections/{insp_id}/images/"))

        # Test fetching the stored image
        img_id = img_entry["image_id"]
        fetch_res = self.client.get(f"/api/v1/inspections/{insp_id}/images/{img_id}")
        self.assertEqual(fetch_res.status_code, 200)
        self.assertEqual(fetch_res.headers["content-type"], "image/jpeg")
        self.assertEqual(fetch_res.content, img_bytes)

    def test_get_nonexistent_image_returns_404(self):
        res = self.client.get("/api/v1/inspections/NON_EXISTENT_INSP/images/img-999")
        self.assertEqual(res.status_code, 404)


if __name__ == "__main__":
    unittest.main()
