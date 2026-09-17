import io
import unittest
from PIL import Image, ImageDraw
from fastapi.testclient import TestClient

from backend.main import app
from backend.inspections.store import inspection_store
from backend.compliance.models import ComplianceStatus, RuleStatus


def create_synthetic_panel_image(lines: list, size=(400, 300)) -> bytes:
    """Creates a high-contrast synthetic packaging panel image with explicit text lines."""
    img = Image.new("RGB", size, color=(248, 250, 252))
    draw = ImageDraw.Draw(img)
    y = 20
    for line in lines:
        draw.text((20, y), line, fill=(15, 23, 42))
        y += 35
    buf = io.BytesIO()
    img.save(buf, format="JPEG", quality=95)
    return buf.getvalue()


class TestMilestone7E2EIntegration(unittest.TestCase):
    """
    Milestone 7 Dedicated End-to-End Integration Test Suite.
    Verifies the complete, unified inspection lifecycle from raw image upload through
    IQA, OCR, open-world field extraction, multi-panel aggregation, deterministic rule
    compliance evaluation, visual evidence mapping, authoritative legal citation linking,
    inspection persistence, and both JSON and PDF report generation.
    """

    def setUp(self):
        self.client = TestClient(app)
        inspection_store.clear()

    def test_complete_multi_panel_inspection_pipeline(self):
        # 1. Prepare complementary synthetic packaging panels
        front_lines = [
            "PARLE-G ORIGINAL GLUCOSE BISCUITS",
            "Net Qty: 250 g",
        ]
        back_lines = [
            "MRP Rs. 30.00 (incl. of all taxes)",
            "Mfg Date: 08/2026",
            "Manufactured by: Parle Products Pvt Ltd",
            "North Level Crossing, Vile Parle East, Mumbai, Maharashtra 400057",
            "Customer Care: 1800-22-7777, care@parle.biz",
            "Country of Origin: India",
        ]

        front_bytes = create_synthetic_panel_image(front_lines, size=(450, 320))
        back_bytes = create_synthetic_panel_image(back_lines, size=(500, 350))

        # 2. Upload both panels via POST /api/v1/inspections
        files = [
            ("files", ("front_panel.jpg", io.BytesIO(front_bytes), "image/jpeg")),
            ("files", ("back_panel.jpg", io.BytesIO(back_bytes), "image/jpeg")),
        ]
        data = {
            "panels": ["FRONT", "BACK"],
        }

        create_res = self.client.post("/api/v1/inspections", files=files, data=data)
        self.assertEqual(create_res.status_code, 200)
        session = create_res.json()

        # 3. Verify Inspection Session Identity & Metadata
        inspection_id = session.get("inspection_id")
        self.assertTrue(inspection_id.startswith("INSP-"))
        self.assertEqual(len(session["images"]), 2)
        self.assertEqual(session["images"][0]["panel"], "FRONT")
        self.assertEqual(session["images"][1]["panel"], "BACK")

        # 4. Verify Image URLs and Image Serving
        for img in session["images"]:
            self.assertTrue(img["image_url"].startswith(f"/api/v1/inspections/{inspection_id}/images/"))
            img_res = self.client.get(img["image_url"])
            self.assertEqual(img_res.status_code, 200)
            self.assertEqual(img_res.headers["content-type"], "image/jpeg")
            self.assertTrue(len(img_res.content) > 0)

        # 5. Verify Multi-Panel Aggregation of Canonical Declarations
        fields = session["combined_fields"]
        self.assertEqual(fields["product_name"]["status"], "PRESENT")
        self.assertIn("PARLE-G", fields["product_name"]["value"].upper())

        self.assertEqual(fields["net_quantity"]["status"], "PRESENT")
        self.assertIn("250", fields["net_quantity"]["value"])

        self.assertEqual(fields["mrp"]["status"], "PRESENT")
        self.assertIn("30", fields["mrp"]["value"])

        self.assertEqual(fields["manufacturer"]["status"], "PRESENT")
        self.assertIn("PARLE PRODUCTS", fields["manufacturer"]["value"].upper())

        self.assertEqual(fields["address"]["status"], "PRESENT")
        self.assertIn("400057", fields["address"]["value"])

        self.assertEqual(fields["date_information"]["status"], "PRESENT")
        self.assertIn("2026", fields["date_information"]["value"])

        self.assertEqual(fields["consumer_care"]["status"], "PRESENT")
        self.assertIn("1800", fields["consumer_care"]["value"])

        self.assertEqual(fields["country_of_origin"]["status"], "PRESENT")
        self.assertEqual(fields["country_of_origin"]["value"].upper(), "INDIA")

        # 6. Verify Deterministic Legal Metrology Compliance Rule Evaluations
        compliance = session["compliance"]
        evaluations = compliance["evaluations"]
        self.assertTrue(len(evaluations) >= 8)

        # Confirm specific mandatory rules passed
        rule_ids = {ev["rule_id"]: ev for ev in evaluations}
        self.assertIn("LM-PN-001", rule_ids)
        self.assertEqual(rule_ids["LM-PN-001"]["status"], RuleStatus.PASS.value)

        self.assertIn("LM-NQ-001", rule_ids)
        self.assertEqual(rule_ids["LM-NQ-001"]["status"], RuleStatus.PASS.value)

        self.assertIn("LM-MRP-001", rule_ids)
        self.assertEqual(rule_ids["LM-MRP-001"]["status"], RuleStatus.PASS.value)

        self.assertIn("LM-MFG-001", rule_ids)
        self.assertEqual(rule_ids["LM-MFG-001"]["status"], RuleStatus.PASS.value)

        self.assertIn("LM-ADDR-001", rule_ids)
        self.assertEqual(rule_ids["LM-ADDR-001"]["status"], RuleStatus.PASS.value)

        self.assertIn("LM-DATE-001", rule_ids)
        self.assertEqual(rule_ids["LM-DATE-001"]["status"], RuleStatus.PASS.value)

        self.assertIn("LM-CARE-001", rule_ids)
        self.assertEqual(rule_ids["LM-CARE-001"]["status"], RuleStatus.PASS.value)

        self.assertIn("LM-COO-001", rule_ids)
        self.assertEqual(rule_ids["LM-COO-001"]["status"], RuleStatus.PASS.value)

        # Overall session status should be COMPLIANT for this complete package
        self.assertEqual(session["status"], ComplianceStatus.COMPLIANT.value)

        # 7. Verify Visual Evidence Mapping & Normalized Coordinates
        evidence_list = session["evidence"]
        self.assertTrue(len(evidence_list) > 0)
        for ev_item in evidence_list:
            self.assertIn("image_id", ev_item)
            self.assertIn("text", ev_item)
            self.assertTrue(ev_item["confidence"] > 0)
            if ev_item.get("bounding_box"):
                bbox = ev_item["bounding_box"]
                if isinstance(bbox, list):
                    ymin, xmin, ymax, xmax = bbox
                else:
                    ymin, xmin, ymax, xmax = bbox["ymin"], bbox["xmin"], bbox["ymax"], bbox["xmax"]
                self.assertTrue(0.0 <= ymin <= ymax <= 1.0)
                self.assertTrue(0.0 <= xmin <= xmax <= 1.0)

        # 8. Verify Authoritative Legal Knowledge Retrieval & Citations Attached
        for ev in evaluations:
            legal_bases = ev.get("legal_basis", [])
            self.assertTrue(len(legal_bases) > 0, f"Rule {ev['rule_id']} should have retrieved legal basis")
            primary_basis = legal_bases[0]
            self.assertIn("Legal Metrology", primary_basis["source"])
            self.assertTrue(primary_basis["official_url"].startswith("https://consumeraffairs.nic.in/"))
            self.assertIn("Department of Consumer Affairs", primary_basis["citation"]["authority"])

        # 9. Verify Session Persistence & Retrieval via GET /api/v1/inspections/{id}
        fetch_res = self.client.get(f"/api/v1/inspections/{inspection_id}")
        self.assertEqual(fetch_res.status_code, 200)
        fetched_session = fetch_res.json()
        self.assertEqual(fetched_session["inspection_id"], inspection_id)
        self.assertEqual(fetched_session["status"], ComplianceStatus.COMPLIANT.value)

        # 10. Verify Structured JSON Report Generation
        json_report_res = self.client.get(f"/api/v1/inspections/{inspection_id}/report.json")
        self.assertEqual(json_report_res.status_code, 200)
        report_json = json_report_res.json()
        self.assertEqual(report_json["inspection_id"], inspection_id)
        self.assertEqual(report_json["overall_status"], ComplianceStatus.COMPLIANT.value)
        self.assertEqual(report_json["image_count"], 2)
        # Verify SHA-256 integrity hash is present
        self.assertTrue(len(report_json["integrity_hash"]) == 64)
        # Verify statutory disclaimer is preserved
        self.assertTrue(any("not a substitute for official legal" in lim for lim in report_json["limitations"]))

        # 11. Verify PDF Report Generation
        pdf_report_res = self.client.get(f"/api/v1/inspections/{inspection_id}/report")
        self.assertEqual(pdf_report_res.status_code, 200)
        self.assertEqual(pdf_report_res.headers["content-type"], "application/pdf")
        pdf_bytes = pdf_report_res.content
        self.assertTrue(len(pdf_bytes) > 1000)
        self.assertTrue(pdf_bytes.startswith(b"%PDF-"), "Generated report must be a valid PDF binary")

        # 12. Verify Session Appears in Inspection History
        list_res = self.client.get("/api/v1/inspections")
        self.assertEqual(list_res.status_code, 200)
        history = list_res.json()
        self.assertTrue(any(item["inspection_id"] == inspection_id for item in history))


if __name__ == "__main__":
    unittest.main()
