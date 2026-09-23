import io
import unittest
from PIL import Image, ImageDraw, ImageFont
from fastapi.testclient import TestClient

from backend.main import app
from backend.inspections.store import inspection_store
from backend.compliance.models import ComplianceStatus, RuleStatus
from backend.inspections.models import PanelType, InspectionImage
from backend.inspections.coverage import compute_inspection_coverage, is_rule_panel_captured
from backend.inspections.aggregator import session_aggregator
from backend.schemas.analysis import (
    ExtractedFields,
    FieldResult,
    ExtractionStatus,
    ImageQualityResult,
    ImageQualityStatus,
    OCRResult,
)


def create_panel_image(lines: list, size=(600, 400)) -> bytes:
    """Helper to synthesize high-contrast packaging panel images with legible text."""
    img = Image.new("RGB", size, color=(250, 250, 252))
    draw = ImageDraw.Draw(img)
    try:
        font = ImageFont.load_default(size=22)
    except TypeError:
        font = ImageFont.load_default()
    y = 25
    for line in lines:
        draw.text((25, y), line, fill=(15, 23, 42), font=font)
        y += 45
    buf = io.BytesIO()
    img.save(buf, format="JPEG", quality=95)
    return buf.getvalue()


class TestInspectionCoverageSuite(unittest.TestCase):
    """
    Verification suite for the Inspection Coverage feature:
    - no images
    - one panel
    - multiple panels
    - all six panels
    - missing panel required for a finding
    - complete evidence coverage
    """

    def setUp(self):
        self.client = TestClient(app)
        inspection_store.clear()

    # 1. Test: No images
    def test_no_images_coverage(self):
        """Zero images handled safely with empty coverage and NOT_VERIFIABLE status."""
        session = session_aggregator.aggregate_session(images=[], inspection_id="TEST-EMPTY")
        self.assertIsNotNone(session.coverage)
        self.assertEqual(session.coverage.panels_captured, 0)
        self.assertEqual(session.coverage.total_panels_expected, 6)
        self.assertEqual(session.coverage.coverage_percentage, 0.0)
        self.assertFalse(session.coverage.is_complete)
        self.assertEqual(len(session.coverage.missing_panels), 6)
        self.assertEqual(session.coverage.summary, "0 / 6 panels captured")
        self.assertEqual(session.status, ComplianceStatus.NOT_VERIFIABLE)

    # 2. Test: One panel
    def test_one_panel_coverage(self):
        """Single panel submission correctly calculates 1 / 6 coverage."""
        front_bytes = create_panel_image([
            "PREMIUM ALMONDS",
            "Net Weight: 200 g",
        ])
        files = [("files", ("front.jpg", io.BytesIO(front_bytes), "image/jpeg"))]
        data = {"panels": ["FRONT"]}

        res = self.client.post("/api/v1/inspections", files=files, data=data)
        self.assertEqual(res.status_code, 200)
        session = res.json()

        cov = session.get("coverage")
        self.assertIsNotNone(cov)
        self.assertEqual(cov["panels_captured"], 1)
        self.assertEqual(cov["coverage_percentage"], 16.7)
        self.assertFalse(cov["is_complete"])
        self.assertIn("Front", cov["captured_panels"])
        self.assertNotIn("Front", cov["missing_panels"])
        self.assertIn("Back", cov["missing_panels"])
        self.assertEqual(cov["summary"], "1 / 6 panels captured")

        # Each image should have panel_type, image_id, upload_status, ocr_status
        img0 = session["images"][0]
        self.assertEqual(img0["panel"], "FRONT")
        self.assertEqual(img0["panel_type"], "FRONT")
        self.assertEqual(img0["upload_status"], "captured")
        self.assertIn(img0["ocr_status"], ["completed", "empty"])

    # 3. Test: Multiple panels
    def test_multiple_panels_coverage(self):
        """Multiple panels (Front, Back, Left) calculate 3 / 6 coverage."""
        front_bytes = create_panel_image(["HERBAL GREEN TEA", "Net Qty: 100 g"])
        back_bytes = create_panel_image(["MRP Rs. 150.00 incl. of all taxes", "Mfg: 01/2026"])
        left_bytes = create_panel_image(["Care: 1800-11-9988, care@tea.in"])

        files = [
            ("files", ("front.jpg", io.BytesIO(front_bytes), "image/jpeg")),
            ("files", ("back.jpg", io.BytesIO(back_bytes), "image/jpeg")),
            ("files", ("left.jpg", io.BytesIO(left_bytes), "image/jpeg")),
        ]
        data = {"panels": ["FRONT", "BACK", "LEFT"]}

        res = self.client.post("/api/v1/inspections", files=files, data=data)
        self.assertEqual(res.status_code, 200)
        session = res.json()

        cov = session["coverage"]
        self.assertEqual(cov["panels_captured"], 3)
        self.assertEqual(cov["coverage_percentage"], 50.0)
        self.assertFalse(cov["is_complete"])
        self.assertEqual(cov["summary"], "3 / 6 panels captured")
        self.assertEqual(set(cov["captured_panels"]), {"Front", "Back", "Left"})
        self.assertEqual(set(cov["missing_panels"]), {"Right", "Top", "Bottom"})

    # 4. Test: All six panels
    def test_all_six_panels_coverage(self):
        """All six panels result in 100% coverage and is_complete=True."""
        panels_data = [
            ("FRONT", ["AMRIT BASMATI RICE", "Net Qty: 5 kg"]),
            ("BACK", ["MRP Rs. 499 (incl. of all taxes)", "Pkd: 03/2026"]),
            ("LEFT", ["Manufactured by: Amrit Mills Ltd", "G.T. Road, Karnal 132001"]),
            ("RIGHT", ["Consumer Care: care@amrit.com", "Helpline: 1800-00-1122"]),
            ("TOP", ["PREMIUM GRAIN"]),
            ("BOTTOM", ["Country of Origin: India", "Batch: B-2026"]),
        ]

        files = []
        for panel, lines in panels_data:
            img_b = create_panel_image(lines)
            files.append(("files", (f"{panel.lower()}.jpg", io.BytesIO(img_b), "image/jpeg")))
        data = {"panels": [p for p, _ in panels_data]}

        res = self.client.post("/api/v1/inspections", files=files, data=data)
        self.assertEqual(res.status_code, 200)
        session = res.json()

        cov = session["coverage"]
        self.assertEqual(cov["panels_captured"], 6)
        self.assertEqual(cov["coverage_percentage"], 100.0)
        self.assertTrue(cov["is_complete"])
        self.assertEqual(len(cov["missing_panels"]), 0)
        self.assertEqual(cov["summary"], "6 / 6 panels captured")

    # 5. Test: Missing panel required for a finding
    def test_missing_panel_required_for_finding(self):
        """
        When a requirement depends on a panel that was not captured (e.g. Back missing for Manufacturer),
        the result says: 'Unable to verify from captured evidence because the relevant package panel was not captured.'
        and is NOT marked as a violation.
        """
        # Upload Front + Top/Side panels with MRP (missing Back/Sides for manufacturer & address)
        front_bytes = create_panel_image([
            "AMRIT ROASTED MAKHANA",
            "Net Quantity: 500 g",
        ])
        mrp_bytes = create_panel_image([
            "MRP Rs. 199.00 (incl. of all taxes)",
        ])
        files = [
            ("files", ("front.jpg", io.BytesIO(front_bytes), "image/jpeg")),
            ("files", ("mrp.jpg", io.BytesIO(mrp_bytes), "image/jpeg")),
        ]
        data = {"panels": ["FRONT", "TOP"]}

        res = self.client.post("/api/v1/inspections", files=files, data=data)
        self.assertEqual(res.status_code, 200)
        session = res.json()

        findings = session["findings"]

        # 1. Product Name (expected on Front) was captured & found -> PASS
        pn_finding = next((f for f in findings if f["rule_id"] == "LM-PN-001"), None)
        self.assertIsNotNone(pn_finding)
        self.assertEqual(pn_finding["status"], "PASS")

        # 2. Manufacturer & Address (expected on Back/Sides) -> Back was NOT captured
        mfg_finding = next((f for f in findings if f["rule_id"] == "LM-MFG-001"), None)
        self.assertIsNotNone(mfg_finding)
        self.assertEqual(mfg_finding["status"], "NOT_VERIFIABLE")
        self.assertTrue(
            mfg_finding["explanation"].startswith(
                "Unable to verify from captured evidence because the relevant package panel was not captured."
            )
        )
        self.assertEqual(
            mfg_finding["why_flagged"],
            "Unable to verify from captured evidence because the relevant package panel was not captured."
        )
        # Verify it is NOT marked as a violation / POTENTIAL_ISSUE
        self.assertNotEqual(mfg_finding["status"], "POTENTIAL_ISSUE")
        self.assertNotEqual(mfg_finding["status"], "FAIL")

        addr_finding = next((f for f in findings if f["rule_id"] == "LM-ADDR-001"), None)
        self.assertIsNotNone(addr_finding)
        self.assertEqual(addr_finding["status"], "NOT_VERIFIABLE")
        self.assertTrue(
            addr_finding["explanation"].startswith(
                "Unable to verify from captured evidence because the relevant package panel was not captured."
            )
        )
        self.assertEqual(
            addr_finding["why_flagged"],
            "Unable to verify from captured evidence because the relevant package panel was not captured."
        )

        # 3. Conversely, if Back + Bottom panels were captured (missing Front):
        back_bytes = create_panel_image([
            "MRP Rs. 150.00 (incl. of all taxes)",
            "Pkg Date: 02/2026",
            "Net Qty: 200 g",
            "Email: care@honeybee.com",
        ])
        bottom_bytes = create_panel_image([
            "Best Before: 12/2026",
        ])
        files_back = [
            ("files", ("back.jpg", io.BytesIO(back_bytes), "image/jpeg")),
            ("files", ("bottom.jpg", io.BytesIO(bottom_bytes), "image/jpeg")),
        ]
        res_back = self.client.post("/api/v1/inspections", files=files_back, data={"panels": ["BACK", "BOTTOM"]})
        self.assertEqual(res_back.status_code, 200)
        session_back = res_back.json()
        findings_back = session_back["findings"]

        # Product Name is expected on Front, but Front was NOT captured
        pn_back = next((f for f in findings_back if f["rule_id"] == "LM-PN-001"), None)
        self.assertIsNotNone(pn_back)
        self.assertEqual(pn_back["status"], "NOT_VERIFIABLE")
        self.assertTrue(
            pn_back["explanation"].startswith(
                "Unable to verify from captured evidence because the relevant package panel was not captured."
            )
        )
        self.assertEqual(
            pn_back["why_flagged"],
            "Unable to verify from captured evidence because the relevant package panel was not captured."
        )
        # Must not be marked as a violation
        self.assertNotEqual(pn_back["status"], "POTENTIAL_ISSUE")
        self.assertNotEqual(pn_back["status"], "FAIL")

    # 6. Test: Complete evidence coverage
    def test_complete_evidence_coverage(self):
        """
        With complete 6-panel coverage:
        - Declarations that are verified pass.
        - Declarations completely missing from all 6 panels are flagged as potential issues.
        """
        # 6 panels with all mandatory declarations provided
        panels_data = [
            ("FRONT", ["AMRIT GOLD MUSTARD OIL", "Net Quantity: 1 L"]),
            ("BACK", ["MRP Rs. 210.00 (inclusive of all taxes)", "Pkd: 02/2026"]),
            ("LEFT", ["Manufactured by: Amrit Oil Mills Ltd", "Sector 18, Gurugram, Haryana 122015"]),
            ("RIGHT", ["Consumer Care: care@amritoil.in", "Helpline: 1800-44-5566"]),
            ("TOP", ["COLD PRESSED"]),
            ("BOTTOM", ["Country of Origin: India"]),
        ]

        files = []
        for panel, lines in panels_data:
            img_b = create_panel_image(lines)
            files.append(("files", (f"{panel.lower()}.jpg", io.BytesIO(img_b), "image/jpeg")))
        data = {"panels": [p for p, _ in panels_data]}

        res = self.client.post("/api/v1/inspections", files=files, data=data)
        self.assertEqual(res.status_code, 200)
        session = res.json()

        cov = session["coverage"]
        self.assertTrue(cov["is_complete"])
        self.assertEqual(cov["panels_captured"], 6)

        # Every panel item has its expected declarations, upload_status, ocr_status
        for p_item in cov["panels"]:
            self.assertTrue(p_item["is_captured"])
            self.assertEqual(p_item["upload_status"], "captured")
            self.assertIn(p_item["ocr_status"], ["completed", "empty"])

        # Check that compliant declarations passed
        self.assertGreater(session["passed"], 0)


if __name__ == "__main__":
    unittest.main()
