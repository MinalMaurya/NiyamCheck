import io
import unittest
from PIL import Image, ImageDraw
from fastapi.testclient import TestClient

from backend.main import app
from backend.inspections.store import inspection_store


def create_sample_jpeg_bytes() -> bytes:
    img = Image.new("RGB", (320, 240), color=(240, 240, 240))
    draw = ImageDraw.Draw(img)
    draw.text((10, 10), "TEST PACKAGE FOR OFFICER REVIEW", fill=(0, 0, 0))
    draw.text((10, 50), "NET WT: 200 g", fill=(0, 0, 0))
    buf = io.BytesIO()
    img.save(buf, format="JPEG")
    return buf.getvalue()


class TestOfficerWorkflowAPI(unittest.TestCase):
    def setUp(self):
        self.client = TestClient(app)
        inspection_store.clear()

    def test_officer_review_and_finalization_flow(self):
        # 1. Create inspection session
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

        # Initial state: not finalized
        self.assertFalse(session_data.get("is_finalized", False))

        # 2. Patch officer review
        review_payload = {
            "officer_name": "Inspector R. Sharma",
            "officer_id": "LM-OFF-MH-4001",
            "officer_notes": "All statutory declarations verified against Physical Sample Box #44.",
            "finding_reviews": {
                "LM-MRP-001": {
                    "decision": "CONFIRM_AI_VERDICT",
                    "note": "Verified inclusive of all taxes declaration.",
                },
                "LM-NET-001": {
                    "decision": "ACCEPT_AS_COMPLIANT",
                    "note": "Net quantity is legible and metric.",
                },
            },
            "final_verdict": "APPROVED_COMPLIANT",
            "is_finalized": True,
        }

        patch_res = self.client.patch(f"/api/v1/inspections/{insp_id}/review", json=review_payload)
        self.assertEqual(patch_res.status_code, 200)
        updated = patch_res.json()

        self.assertEqual(updated["officer_name"], "Inspector R. Sharma")
        self.assertEqual(updated["officer_id"], "LM-OFF-MH-4001")
        self.assertEqual(updated["officer_notes"], "All statutory declarations verified against Physical Sample Box #44.")
        self.assertTrue(updated["is_finalized"])
        self.assertIsNotNone(updated.get("finalized_at"))
        self.assertEqual(updated["final_verdict"], "APPROVED_COMPLIANT")
        self.assertIn("LM-MRP-001", updated["finding_reviews"])

        # 3. GET inspection to verify persistence
        get_res = self.client.get(f"/api/v1/inspections/{insp_id}")
        self.assertEqual(get_res.status_code, 200)
        persisted = get_res.json()
        self.assertEqual(persisted["officer_name"], "Inspector R. Sharma")
        self.assertTrue(persisted["is_finalized"])
        self.assertIsNotNone(persisted["finalized_at"])

        # 4. Generate PDF report
        report_res = self.client.get(f"/api/v1/inspections/{insp_id}/report")
        self.assertEqual(report_res.status_code, 200)
        self.assertEqual(report_res.headers.get("content-type"), "application/pdf")
        self.assertTrue(report_res.content.startswith(b"%PDF"))

    def test_create_inspection_with_officer_and_premise_context(self):
        img_bytes = create_sample_jpeg_bytes()
        files = [
            ("files", ("front_panel.jpg", io.BytesIO(img_bytes), "image/jpeg")),
        ]
        data = {
            "panels": ["FRONT"],
            "establishment_name": "MegaMart Retail Ltd #42",
            "sampling_location": "Andheri West, Mumbai, MH",
            "batch_sample_id": "SMPL-2026-MH-991",
            "officer_name": "Inspector R. Sharma",
            "officer_id": "LM-OFF-MH-4001",
        }
        create_res = self.client.post("/api/v1/inspections", files=files, data=data)
        self.assertEqual(create_res.status_code, 200)
        session_data = create_res.json()
        insp_id = session_data["inspection_id"]

        self.assertEqual(session_data["establishment_name"], "MegaMart Retail Ltd #42")
        self.assertEqual(session_data["sampling_location"], "Andheri West, Mumbai, MH")
        self.assertEqual(session_data["batch_sample_id"], "SMPL-2026-MH-991")
        self.assertEqual(session_data["officer_name"], "Inspector R. Sharma")
        self.assertEqual(session_data["officer_id"], "LM-OFF-MH-4001")

        # Verify PDF report generation with officer and premise details
        report_res = self.client.get(f"/api/v1/inspections/{insp_id}/report")
        self.assertEqual(report_res.status_code, 200)
        self.assertEqual(report_res.headers.get("content-type"), "application/pdf")
        self.assertTrue(report_res.content.startswith(b"%PDF"))

    def test_officer_review_404_for_unknown_session(self):
        res = self.client.patch("/api/v1/inspections/NON_EXISTENT_ID/review", json={"officer_name": "Test"})
        self.assertEqual(res.status_code, 404)

    def test_full_officer_lifecycle_and_report_json_and_list(self):
        """Verifies complete real workflow: create -> review -> finalize -> reload -> report.json -> list."""
        img_bytes = create_sample_jpeg_bytes()
        files = [
            ("files", ("front_panel.jpg", io.BytesIO(img_bytes), "image/jpeg")),
        ]
        data = {
            "panels": ["FRONT"],
            "establishment_name": "SuperStore HyperMarket Mumbai",
            "sampling_location": "Bandra Kurla Complex, Mumbai, MH",
            "batch_sample_id": "MEMO-2026/09-BKC",
            "officer_name": "Inspector R. Sharma",
            "officer_id": "LM-OFF-MH-4001",
        }
        create_res = self.client.post("/api/v1/inspections", files=files, data=data)
        self.assertEqual(create_res.status_code, 200)
        session_data = create_res.json()
        insp_id = session_data["inspection_id"]

        # 1. Update review determinations and observations
        review_payload = {
            "officer_name": "Inspector R. Sharma",
            "officer_id": "LM-OFF-MH-4001",
            "officer_notes": "Tested in field. Country of origin verified on outer packaging.",
            "finding_reviews": {
                "LM-COO-001": {
                    "decision": "ACCEPT_AS_COMPLIANT",
                    "note": "Verified Country of Origin is India.",
                },
            },
            "final_verdict": "COMPLIANT",
            "is_finalized": True,
        }
        patch_res = self.client.patch(f"/api/v1/inspections/{insp_id}/review", json=review_payload)
        self.assertEqual(patch_res.status_code, 200)
        updated = patch_res.json()
        self.assertTrue(updated["is_finalized"])
        self.assertEqual(updated["final_verdict"], "COMPLIANT")
        self.assertEqual(updated["establishment_name"], "SuperStore HyperMarket Mumbai")

        # 2. Simulate browser reload via GET
        reload_res = self.client.get(f"/api/v1/inspections/{insp_id}")
        self.assertEqual(reload_res.status_code, 200)
        reloaded = reload_res.json()
        self.assertTrue(reloaded["is_finalized"])
        self.assertEqual(reloaded["final_verdict"], "COMPLIANT")
        self.assertEqual(reloaded["establishment_name"], "SuperStore HyperMarket Mumbai")
        self.assertEqual(reloaded["sampling_location"], "Bandra Kurla Complex, Mumbai, MH")
        self.assertEqual(reloaded["batch_sample_id"], "MEMO-2026/09-BKC")

        # 3. Verify report.json contains actual officer and premise data
        report_json_res = self.client.get(f"/api/v1/inspections/{insp_id}/report.json")
        self.assertEqual(report_json_res.status_code, 200)
        report_data = report_json_res.json()
        self.assertEqual(report_data["inspection_id"], insp_id)
        self.assertEqual(report_data["officer_name"], "Inspector R. Sharma")
        self.assertEqual(report_data["officer_id"], "LM-OFF-MH-4001")
        self.assertEqual(report_data["establishment_name"], "SuperStore HyperMarket Mumbai")
        self.assertEqual(report_data["sampling_location"], "Bandra Kurla Complex, Mumbai, MH")
        self.assertEqual(report_data["batch_sample_id"], "MEMO-2026/09-BKC")
        self.assertTrue(report_data["is_finalized"])
        self.assertEqual(report_data["final_verdict"], "COMPLIANT")
        self.assertIn("LM-COO-001", report_data["finding_reviews"])

        # 4. Verify listing (Officer Dashboard & History) includes the session with all fields
        list_res = self.client.get("/api/v1/inspections")
        self.assertEqual(list_res.status_code, 200)
        items = list_res.json()
        found = next((item for item in items if item["inspection_id"] == insp_id), None)
        self.assertIsNotNone(found)
        self.assertTrue(found["is_finalized"])
        self.assertEqual(found["establishment_name"], "SuperStore HyperMarket Mumbai")
        self.assertEqual(found["batch_sample_id"], "MEMO-2026/09-BKC")

