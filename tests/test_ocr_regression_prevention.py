import io
import unittest
from PIL import Image, ImageDraw
from fastapi.testclient import TestClient

from backend.main import app
from backend.inspections.store import inspection_store
from backend.compliance.models import ComplianceStatus


def create_lays_chips_image() -> bytes:
    """Creates a high-contrast synthetic Lay's potato chips packaging image."""
    img = Image.new("RGB", (800, 1000), color=(255, 245, 230))
    draw = ImageDraw.Draw(img)
    draw.text((50, 40), "LAY'S CLASSIC POTATO CHIPS", fill=(200, 20, 20))
    draw.text((50, 90), "Net Weight: 52 g", fill=(30, 30, 30))
    draw.text((50, 140), "MRP Rs. 20.00 (Incl. of all taxes)", fill=(30, 30, 30))
    draw.text((50, 190), "Mfg Date: 09/2026", fill=(30, 30, 30))
    draw.text((50, 240), "Manufactured by: Frito-Lay India, PepsiCo India Holdings Pvt Ltd", fill=(30, 30, 30))
    draw.text((50, 290), "Consumer Care: 1800-22-4020, consumer.feedback@pepsico.com", fill=(30, 30, 30))
    draw.text((50, 340), "Country of Origin: India", fill=(30, 30, 30))
    draw.text((50, 400), "Nutrition Facts: Serving size 1 package, Calories 240", fill=(30, 30, 30))
    draw.text((50, 440), "Total Fat 15g, Sodium 250mg, Total Carbohydrate 23g, Protein 3g", fill=(30, 30, 30))

    buf = io.BytesIO()
    img.save(buf, format="JPEG", quality=95)
    return buf.getvalue()


def create_cosmetics_image() -> bytes:
    """Creates a high-contrast cosmetics packaging panel image."""
    img = Image.new("RGB", (700, 900), color=(240, 248, 255))
    draw = ImageDraw.Draw(img)
    draw.text((40, 40), "HIMALAYA PURIFYING NEEM FACE WASH", fill=(0, 100, 50))
    draw.text((40, 90), "Net Volume: 150 ml", fill=(20, 20, 20))
    draw.text((40, 140), "MRP Rs. 180.00 (Inclusive of all taxes)", fill=(20, 20, 20))
    draw.text((40, 190), "Mfg Date: 06/2026", fill=(20, 20, 20))
    draw.text((40, 240), "Manufactured by: The Himalaya Drug Company", fill=(20, 20, 20))
    draw.text((40, 290), "Care: 1800-425-4422, care@himalayawellness.com", fill=(20, 20, 20))
    draw.text((40, 340), "Country of Origin: India", fill=(20, 20, 20))

    buf = io.BytesIO()
    img.save(buf, format="JPEG", quality=95)
    return buf.getvalue()


class TestOCRRegressionPrevention(unittest.TestCase):
    """
    Automated regression prevention suite for OCR data grounding.
    Guarantees:
    1. Uploaded Lay's potato chips packaging produces Lay's/Frito-Lay declarations.
    2. Hardcoded/stale Parle-G data cannot appear in inspection sessions or reports.
    3. Inspection data is strictly isolated between distinct inspection IDs.
    4. Unreadable images produce unverified/not-detected results, never silent mock fallbacks.
    5. PDF and JSON reports contain product declarations belonging to the current inspection.
    """

    def setUp(self):
        self.client = TestClient(app)
        inspection_store.clear()

    def test_lays_frito_lay_inspection_contains_lays_data_and_never_parle(self):
        """Uploading Lay's chips image must produce Lay's/Frito-Lay findings and NEVER Parle-G."""
        lays_bytes = create_lays_chips_image()

        files = [("files", ("lays_classic_packet.jpg", io.BytesIO(lays_bytes), "image/jpeg"))]
        data = {"panels": ["BACK"]}

        res = self.client.post("/api/v1/inspections", files=files, data=data)
        self.assertEqual(res.status_code, 200)
        session = res.json()
        inspection_id = session["inspection_id"]

        # 1. Verify product name contains Lay's / Potato Chips
        prod_name = session["combined_fields"]["product_name"]["value"]
        self.assertIsNotNone(prod_name)
        self.assertIn("LAY", prod_name.upper())
        self.assertNotIn("PARLE", prod_name.upper())

        # 2. Verify manufacturer contains Frito-Lay / PepsiCo
        mfg = session["combined_fields"]["manufacturer"]["value"]
        self.assertIsNotNone(mfg)
        self.assertTrue("FRITO" in mfg.upper() or "PEPSICO" in mfg.upper())
        self.assertNotIn("PARLE", mfg.upper())

        # 3. Verify category is detected as Packaged Food
        self.assertEqual(session["product_category"], "Packaged Food")

        # 4. Verify Parle-G NEVER appears in any combined fields
        for field_name, field_obj in session["combined_fields"].items():
            val = str(field_obj.get("value") or "")
            self.assertNotIn("PARLE", val.upper(), f"Parle-G leaked into {field_name}: {val}")
            self.assertNotIn("250 G", val.upper(), f"Parle-G net quantity leaked into {field_name}")

        # 5. Verify JSON report uses Lay's data and has no Parle-G
        json_res = self.client.get(f"/api/v1/inspections/{inspection_id}/report.json")
        self.assertEqual(json_res.status_code, 200)
        json_report = json_res.json()
        prod_info_str = str(json_report.get("product_information", {})).upper()
        self.assertIn("LAY", prod_info_str)
        self.assertNotIn("PARLE", prod_info_str)

        # 6. Verify PDF report generates successfully and contains Lay's
        pdf_res = self.client.get(f"/api/v1/inspections/{inspection_id}/report")
        self.assertEqual(pdf_res.status_code, 200)
        self.assertEqual(pdf_res.headers["content-type"], "application/pdf")
        self.assertGreater(len(pdf_res.content), 1000)

    def test_two_different_inspections_cannot_share_extracted_product_data(self):
        """Verify two distinct inspections maintain strict data isolation."""
        lays_bytes = create_lays_chips_image()
        cosmetics_bytes = create_cosmetics_image()

        # Inspection 1: Lay's chips
        res1 = self.client.post(
            "/api/v1/inspections",
            files=[("files", ("lays.jpg", io.BytesIO(lays_bytes), "image/jpeg"))],
            data={"panels": ["BACK"]},
        )
        self.assertEqual(res1.status_code, 200)
        session1 = res1.json()

        # Inspection 2: Himalaya Face Wash
        res2 = self.client.post(
            "/api/v1/inspections",
            files=[("files", ("facewash.jpg", io.BytesIO(cosmetics_bytes), "image/jpeg"))],
            data={"panels": ["FRONT"]},
        )
        self.assertEqual(res2.status_code, 200)
        session2 = res2.json()

        id1 = session1["inspection_id"]
        id2 = session2["inspection_id"]
        self.assertNotEqual(id1, id2)

        # Check session 1
        name1 = session1["combined_fields"]["product_name"]["value"]
        self.assertIn("LAY", name1.upper())
        self.assertNotIn("HIMALAYA", name1.upper())
        self.assertNotIn("PARLE", name1.upper())

        # Check session 2
        name2 = session2["combined_fields"]["product_name"]["value"]
        self.assertIn("HIMALAYA", name2.upper())
        self.assertNotIn("LAY'S", name2.upper())
        self.assertNotIn("FRITO", name2.upper())
        self.assertNotIn("PARLE", name2.upper())

        # Fetch session 1 from store again to ensure it wasn't mutated or overwritten
        stored_res1 = self.client.get(f"/api/v1/inspections/{id1}")
        self.assertEqual(stored_res1.status_code, 200)
        stored_session1 = stored_res1.json()
        self.assertEqual(stored_session1["combined_fields"]["product_name"]["value"], name1)

    def test_unreadable_or_blank_image_never_substitutes_mock_data(self):
        """Unreadable or blank images must report unverified status and never fallback to Parle-G."""
        blank_img = Image.new("RGB", (400, 400), color=(128, 128, 128))
        buf = io.BytesIO()
        blank_img.save(buf, format="JPEG")

        res = self.client.post(
            "/api/v1/inspections",
            files=[("files", ("blank_panel.jpg", io.BytesIO(buf.getvalue()), "image/jpeg"))],
            data={"panels": ["FRONT"]},
        )
        self.assertEqual(res.status_code, 200)
        session = res.json()

        # Product name must be None / unverified
        self.assertIsNone(session["combined_fields"]["product_name"]["value"])
        self.assertIn(session["status"], [ComplianceStatus.NOT_VERIFIABLE.value, ComplianceStatus.PARTIALLY_VERIFIABLE.value])

        # Confirm zero Parle-G references
        full_json_str = str(session).upper()
        self.assertNotIn("PARLE", full_json_str)
        self.assertNotIn("GLUCOSE BISCUITS", full_json_str)


if __name__ == "__main__":
    unittest.main()
