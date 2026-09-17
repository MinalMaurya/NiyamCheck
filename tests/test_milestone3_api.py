import io
import unittest
from PIL import Image, ImageDraw
from fastapi.testclient import TestClient

from backend.main import app
from backend.inspections.store import inspection_store


def create_test_image_bytes(text: str = "BRITANNIA BISCUITS") -> bytes:
    img = Image.new("RGB", (400, 300), color=(200, 200, 200))
    draw = ImageDraw.Draw(img)
    draw.text((20, 20), text, fill=(0, 0, 0))
    draw.text((20, 60), "NET WT: 100 g", fill=(0, 0, 0))
    draw.text((20, 100), "MRP: Rs. 25.00", fill=(0, 0, 0))
    buf = io.BytesIO()
    img.save(buf, format="JPEG")
    return buf.getvalue()


class TestMilestone3API(unittest.TestCase):
    def setUp(self):
        self.client = TestClient(app)
        inspection_store.clear()

    def test_create_inspection_single_image(self):
        img_bytes = create_test_image_bytes()
        files = [
            ("files", ("front.jpg", io.BytesIO(img_bytes), "image/jpeg")),
        ]
        data = {
            "panels": "FRONT",
        }
        response = self.client.post("/api/v1/inspections", files=files, data=data)
        self.assertEqual(response.status_code, 200)
        res_json = response.json()
        self.assertIn("inspection_id", res_json)
        self.assertEqual(len(res_json["images"]), 1)
        self.assertIn("combined_fields", res_json)
        self.assertIn("compliance", res_json)
        self.assertIn("status", res_json)

    def test_create_inspection_multi_image(self):
        img1 = create_test_image_bytes("PARLE-G GOLD")
        img2 = create_test_image_bytes("MANUFACTURED BY PARLE LTD")
        files = [
            ("files", ("front.jpg", io.BytesIO(img1), "image/jpeg")),
            ("files", ("back.jpg", io.BytesIO(img2), "image/jpeg")),
        ]
        data = {
            "panels": ["FRONT", "BACK"],
        }
        response = self.client.post("/api/v1/inspections", files=files, data=data)
        self.assertEqual(response.status_code, 200)
        res_json = response.json()
        self.assertEqual(len(res_json["images"]), 2)
        self.assertEqual(res_json["images"][0]["panel"], "FRONT")
        self.assertEqual(res_json["images"][1]["panel"], "BACK")

    def test_get_inspection_by_id_and_not_found(self):
        # 404 test
        res_404 = self.client.get("/api/v1/inspections/NON_EXISTENT_ID")
        self.assertEqual(res_404.status_code, 404)

        # Create session first
        img_bytes = create_test_image_bytes()
        files = [("files", ("test.jpg", io.BytesIO(img_bytes), "image/jpeg"))]
        create_res = self.client.post("/api/v1/inspections", files=files)
        insp_id = create_res.json()["inspection_id"]

        # Fetch session
        get_res = self.client.get(f"/api/v1/inspections/{insp_id}")
        self.assertEqual(get_res.status_code, 200)
        self.assertEqual(get_res.json()["inspection_id"], insp_id)

    def test_get_inspection_report_json(self):
        img_bytes = create_test_image_bytes()
        files = [("files", ("test.jpg", io.BytesIO(img_bytes), "image/jpeg"))]
        create_res = self.client.post("/api/v1/inspections", files=files)
        insp_id = create_res.json()["inspection_id"]

        # Fetch JSON report
        rep_res = self.client.get(f"/api/v1/inspections/{insp_id}/report.json")
        self.assertEqual(rep_res.status_code, 200)
        rep_data = rep_res.json()
        self.assertEqual(rep_data["inspection_id"], insp_id)
        self.assertIn("integrity_hash", rep_data)
        self.assertEqual(len(rep_data["integrity_hash"]), 64)
        self.assertIn("product_information", rep_data)
        self.assertIn("limitations", rep_data)

    def test_get_inspection_report_pdf(self):
        img_bytes = create_test_image_bytes()
        files = [("files", ("test.jpg", io.BytesIO(img_bytes), "image/jpeg"))]
        create_res = self.client.post("/api/v1/inspections", files=files)
        insp_id = create_res.json()["inspection_id"]

        # Fetch PDF report
        pdf_res = self.client.get(f"/api/v1/inspections/{insp_id}/report")
        self.assertEqual(pdf_res.status_code, 200)
        self.assertEqual(pdf_res.headers["content-type"], "application/pdf")
        self.assertIn(f"inspection_{insp_id}.pdf", pdf_res.headers["content-disposition"])
        self.assertTrue(pdf_res.content.startswith(b"%PDF-1."))

    def test_analyze_image_single_endpoint_includes_evidence(self):
        # Verify backward compatibility with POST /api/v1/analyze/image
        img_bytes = create_test_image_bytes()
        files = {"file": ("test.jpg", io.BytesIO(img_bytes), "image/jpeg")}
        response = self.client.post("/api/v1/analyze/image", files=files)
        self.assertEqual(response.status_code, 200)
        res_json = response.json()
        self.assertTrue(res_json["success"])
        self.assertIn("evidence", res_json)
        self.assertIsInstance(res_json["evidence"], list)


if __name__ == "__main__":
    unittest.main()
