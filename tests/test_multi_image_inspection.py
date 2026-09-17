import io
import unittest
from PIL import Image, ImageDraw
from fastapi.testclient import TestClient

from backend.main import app
from backend.inspections.store import inspection_store
from backend.compliance.models import ComplianceStatus, RuleStatus
from backend.schemas.analysis import ExtractionStatus


def create_panel_image(lines: list, size=(450, 320)) -> bytes:
    """Helper to synthesize high-contrast packaging panel images with legible text."""
    img = Image.new("RGB", size, color=(250, 250, 252))
    draw = ImageDraw.Draw(img)
    y = 20
    for line in lines:
        draw.text((20, y), line, fill=(15, 23, 42))
        y += 35
    buf = io.BytesIO()
    img.save(buf, format="JPEG", quality=95)
    return buf.getvalue()


class TestMultiImageInspectionSuite(unittest.TestCase):
    """
    Comprehensive verification suite for NiyamCheck Multi-Image Package Inspections.
    Ensures multi-panel packages are synthesized into one unified inspection session
    with resilient cross-panel aggregation, conflict detection, panel addition/removal,
    and strict absence of stale or hardcoded data.
    """

    def setUp(self):
        self.client = TestClient(app)
        inspection_store.clear()

    def test_multi_panel_unified_identity_and_aggregation(self):
        """Verify Front + Back are analyzed as ONE unified product inspection."""
        front_bytes = create_panel_image([
            "AMRIT ROASTED MAKHANA HIMALAYAN SALT",
            "Net Weight: 100 g",
        ])
        back_bytes = create_panel_image([
            "MRP Rs. 99.00 (incl. of all taxes)",
            "Pkg Date: 05/2026",
            "Manufactured by: Amrit Organics Pvt Ltd",
            "Plot 12, Industrial Area, Noida, Uttar Pradesh 201301",
            "Consumer Care: 1800-11-2233, care@amritorganics.in",
            "Country of Origin: India",
        ])

        files = [
            ("files", ("front.jpg", io.BytesIO(front_bytes), "image/jpeg")),
            ("files", ("back.jpg", io.BytesIO(back_bytes), "image/jpeg")),
        ]
        data = {"panels": ["FRONT", "BACK"]}

        res = self.client.post("/api/v1/inspections", files=files, data=data)
        self.assertEqual(res.status_code, 200)
        session = res.json()

        # 1. Product inspection level identity
        inspection_id = session["inspection_id"]
        self.assertTrue(inspection_id.startswith("INSP-"))
        self.assertEqual(len(session["images"]), 2)
        self.assertEqual(session["images"][0]["panel"], "FRONT")
        self.assertEqual(session["images"][1]["panel"], "BACK")

        # 2. Combined fields cross-panel synthesis
        fields = session["combined_fields"]
        self.assertEqual(fields["product_name"]["status"], "PRESENT")
        self.assertIn("AMRIT", fields["product_name"]["value"].upper())
        self.assertEqual(fields["product_name"]["source_panel"], "FRONT")

        self.assertEqual(fields["net_quantity"]["status"], "PRESENT")
        self.assertIn("100", fields["net_quantity"]["value"])

        self.assertEqual(fields["mrp"]["status"], "PRESENT")
        self.assertIn("99", fields["mrp"]["value"])
        self.assertEqual(fields["mrp"]["source_panel"], "BACK")

        self.assertEqual(fields["manufacturer"]["status"], "PRESENT")
        self.assertIn("AMRIT ORGANICS", fields["manufacturer"]["value"].upper())

        # 3. Product category determined at session level
        self.assertIsNotNone(session.get("product_category"))

        # 4. Single set of requirements (no duplication)
        evals = session["compliance"]["evaluations"]
        rule_ids = [e["rule_id"] for e in evals]
        self.assertEqual(len(rule_ids), len(set(rule_ids)), "Rule evaluations must not be duplicated")

    def test_cross_panel_field_combination_without_overwriting(self):
        """Verify field on Panel A (Back) + field on Panel B (Left) combine without overwriting."""
        back_bytes = create_panel_image([
            "Manufactured by: Shivalik Herbals Pvt Ltd",
            "Dehradun, Uttarakhand 248001",
        ])
        side_bytes = create_panel_image([
            "Customer Care: 1800-44-5566, support@shivalik.in",
            "Country of Origin: India",
        ])

        files = [
            ("files", ("back.jpg", io.BytesIO(back_bytes), "image/jpeg")),
            ("files", ("left.jpg", io.BytesIO(side_bytes), "image/jpeg")),
        ]
        data = {"panels": ["BACK", "LEFT"]}

        res = self.client.post("/api/v1/inspections", files=files, data=data)
        self.assertEqual(res.status_code, 200)
        fields = res.json()["combined_fields"]

        self.assertEqual(fields["manufacturer"]["status"], "PRESENT")
        self.assertIn("SHIVALIK", fields["manufacturer"]["value"].upper())

        self.assertEqual(fields["consumer_care"]["status"], "PRESENT")
        self.assertIn("1800", fields["consumer_care"]["value"])

    def test_duplicate_declarations_across_panels_evaluated_once(self):
        """When the same declaration appears on multiple panels, it is evaluated as 1 requirement."""
        panel1_bytes = create_panel_image([
            "M.R.P. Rs. 120.00 (incl. of all taxes)",
            "Net Qty: 200 g",
        ])
        panel2_bytes = create_panel_image([
            "MRP Rs. 120.00 (incl. of all taxes)",
            "Customer Care: 1800-99-8877",
        ])

        files = [
            ("files", ("panel1.jpg", io.BytesIO(panel1_bytes), "image/jpeg")),
            ("files", ("panel2.jpg", io.BytesIO(panel2_bytes), "image/jpeg")),
        ]
        data = {"panels": ["BACK", "RIGHT"]}

        res = self.client.post("/api/v1/inspections", files=files, data=data)
        self.assertEqual(res.status_code, 200)
        session = res.json()

        mrp_evals = [e for e in session["compliance"]["evaluations"] if e["rule_id"] == "LM-MRP-001"]
        self.assertEqual(len(mrp_evals), 1, "Duplicate MRP on multiple panels must result in exactly 1 rule evaluation")
        self.assertEqual(mrp_evals[0]["status"], RuleStatus.PASS.value)

        # Primary source + additional source
        mrp_field = session["combined_fields"]["mrp"]
        self.assertEqual(mrp_field["status"], "PRESENT")
        self.assertIn("120", mrp_field["value"])
        self.assertTrue(len(mrp_field.get("additional_sources", [])) >= 1)

    def test_conflicting_declarations_across_panels_flagged_for_review(self):
        """When conflicting values are detected across panels (e.g. MRP 120 vs MRP 150), flag for REVIEW."""
        back_bytes = create_panel_image([
            "MRP Rs. 120.00 (incl. of all taxes)",
            "Net Weight: 250 g",
        ])
        side_bytes = create_panel_image([
            "MRP Rs. 150.00 (incl. of all taxes)",
            "Net Weight: 250 g",
        ])

        files = [
            ("files", ("back.jpg", io.BytesIO(back_bytes), "image/jpeg")),
            ("files", ("side.jpg", io.BytesIO(side_bytes), "image/jpeg")),
        ]
        data = {"panels": ["BACK", "RIGHT"]}

        res = self.client.post("/api/v1/inspections", files=files, data=data)
        self.assertEqual(res.status_code, 200)
        session = res.json()

        # MRP should be marked UNCLEAR in combined fields with conflicts recorded
        mrp_field = session["combined_fields"]["mrp"]
        self.assertEqual(mrp_field["status"], ExtractionStatus.UNCLEAR.value)
        self.assertTrue(len(mrp_field.get("conflicts", [])) >= 2)

        # In compliance evaluations, LM-MRP-001 must be REVIEW (not PASS and not automatically FAIL)
        mrp_eval = next(e for e in session["compliance"]["evaluations"] if e["rule_id"] == "LM-MRP-001")
        self.assertTrue("Different" in mrp_eval["reason"] or "Conflicting" in mrp_eval["reason"])
        self.assertIn("conflicting", mrp_eval["why_flagged"].lower())
        self.assertIsNotNone(mrp_eval.get("what_can_i_do"))

    def test_unobserved_declarations_status_distinction(self):
        """Unobserved declarations are REVIEW for 1 panel, NOT_VERIFIABLE for multiple panels, never automatic violations."""
        # 1. Single panel: missing fields should be REVIEW
        front_only_bytes = create_panel_image(["SUPER CRISP CHIPS", "Net Qty: 50 g"])
        res1 = self.client.post(
            "/api/v1/inspections",
            files=[("files", ("front.jpg", io.BytesIO(front_only_bytes), "image/jpeg"))],
            data={"panels": ["FRONT"]},
        )
        self.assertEqual(res1.status_code, 200)
        evals1 = res1.json()["compliance"]["evaluations"]
        mrp_eval1 = next(e for e in evals1 if e["rule_id"] == "LM-MRP-001")
        self.assertEqual(mrp_eval1["status"], RuleStatus.REVIEW.value)
        self.assertIn("Only one package panel was submitted", mrp_eval1["reason"])

        # 2. Multi panel: unobserved fields should be NOT_VERIFIABLE
        front_bytes = create_panel_image(["SUPER CRISP CHIPS"])
        back_bytes = create_panel_image(["Net Qty: 50 g"])
        res2 = self.client.post(
            "/api/v1/inspections",
            files=[
                ("files", ("f.jpg", io.BytesIO(front_bytes), "image/jpeg")),
                ("files", ("b.jpg", io.BytesIO(back_bytes), "image/jpeg")),
            ],
            data={"panels": ["FRONT", "BACK"]},
        )
        self.assertEqual(res2.status_code, 200)
        evals2 = res2.json()["compliance"]["evaluations"]
        mrp_eval2 = next(e for e in evals2 if e["rule_id"] == "LM-MRP-001")
        self.assertEqual(mrp_eval2["status"], RuleStatus.NOT_VERIFIABLE.value)

    def test_dynamic_add_panel_to_existing_inspection(self):
        """Adding a panel via POST /inspections/{id}/images updates the SAME inspection session."""
        front_bytes = create_panel_image(["ORGANIC ALMOND BUTTER", "Net Qty: 200 g"])
        create_res = self.client.post(
            "/api/v1/inspections",
            files=[("files", ("front.jpg", io.BytesIO(front_bytes), "image/jpeg"))],
            data={"panels": ["FRONT"]},
        )
        self.assertEqual(create_res.status_code, 200)
        session1 = create_res.json()
        inspection_id = session1["inspection_id"]
        self.assertEqual(len(session1["images"]), 1)
        self.assertIsNone(session1["combined_fields"]["mrp"]["value"])

        # Add Back panel
        back_bytes = create_panel_image([
            "MRP Rs. 350.00 (incl. of all taxes)",
            "Manufactured by: Pure Nut Butters LLP",
            "Pune, Maharashtra 411001",
        ])
        add_res = self.client.post(
            f"/api/v1/inspections/{inspection_id}/images",
            files=[("files", ("back.jpg", io.BytesIO(back_bytes), "image/jpeg"))],
            data={"panels": ["BACK"]},
        )
        self.assertEqual(add_res.status_code, 200)
        session2 = add_res.json()

        # Same inspection ID, updated images count and combined fields
        self.assertEqual(session2["inspection_id"], inspection_id)
        self.assertEqual(len(session2["images"]), 2)
        self.assertEqual(session2["combined_fields"]["product_name"]["status"], "PRESENT")
        self.assertEqual(session2["combined_fields"]["mrp"]["status"], "PRESENT")
        self.assertIn("350", session2["combined_fields"]["mrp"]["value"])

    def test_dynamic_delete_panel_removes_stale_evidence(self):
        """Deleting a panel removes its declarations and evidence without leaving stale evidence."""
        front_bytes = create_panel_image(["COLD PRESSED SESAME OIL", "Net Qty: 500 ml"])
        back_bytes = create_panel_image([
            "MRP Rs. 240.00 (incl. of all taxes)",
            "Manufactured by: Heritage Oils Ltd",
            "Madurai, Tamil Nadu 625001",
        ])

        create_res = self.client.post(
            "/api/v1/inspections",
            files=[
                ("files", ("front.jpg", io.BytesIO(front_bytes), "image/jpeg")),
                ("files", ("back.jpg", io.BytesIO(back_bytes), "image/jpeg")),
            ],
            data={"panels": ["FRONT", "BACK"]},
        )
        self.assertEqual(create_res.status_code, 200)
        session = create_res.json()
        inspection_id = session["inspection_id"]
        back_img = next(img for img in session["images"] if img["panel"] == "BACK")

        # Delete back image
        del_res = self.client.delete(f"/api/v1/inspections/{inspection_id}/images/{back_img['image_id']}")
        self.assertEqual(del_res.status_code, 200)
        updated_session = del_res.json()

        self.assertEqual(len(updated_session["images"]), 1)
        self.assertEqual(updated_session["images"][0]["panel"], "FRONT")

        # Front fields preserved
        self.assertEqual(updated_session["combined_fields"]["product_name"]["status"], "PRESENT")
        self.assertEqual(updated_session["combined_fields"]["net_quantity"]["status"], "PRESENT")

        # Back fields completely removed (not stale)
        self.assertIsNone(updated_session["combined_fields"]["mrp"]["value"])
        self.assertNotEqual(updated_session["combined_fields"]["mrp"]["status"], "PRESENT")
        self.assertIsNone(updated_session["combined_fields"]["manufacturer"]["value"])

    def test_poor_quality_panel_resilience(self):
        """A blurry or poor-quality side panel does not crash inspection or abort other panels."""
        good_front = create_panel_image(["HERBAL GREEN TEA", "Net Weight: 100 g"])
        # Blank/empty panel
        blank_side = Image.new("RGB", (100, 100), color=(0, 0, 0))
        buf = io.BytesIO()
        blank_side.save(buf, format="JPEG")
        bad_side_bytes = buf.getvalue()

        files = [
            ("files", ("front.jpg", io.BytesIO(good_front), "image/jpeg")),
            ("files", ("side.jpg", io.BytesIO(bad_side_bytes), "image/jpeg")),
        ]
        data = {"panels": ["FRONT", "LEFT"]}

        res = self.client.post("/api/v1/inspections", files=files, data=data)
        self.assertEqual(res.status_code, 200)
        session = res.json()
        self.assertEqual(session["combined_fields"]["product_name"]["status"], "PRESENT")
        self.assertTrue(any(k in session["combined_fields"]["product_name"]["value"].upper() for k in ["HERBAL", "HERBA", "GREEN TEA"]))

    def test_no_hardcoded_or_sample_data_leakage(self):
        """Verify completely novel products do not leak Parle-G, Lay's, or sample data."""
        novel_front = create_panel_image([
            "NILGIRI ARTISANAL BLUE MOUNTAIN COFFEE",
            "Net Qty: 250 g",
        ])
        novel_back = create_panel_image([
            "MRP Rs. 499.00 (incl. of all taxes)",
            "Mfg Date: 09/2026",
            "Manufactured by: Blue Mountain Roasters Pvt Ltd",
            "Coonoor, Nilgiris, Tamil Nadu 643101",
        ])

        res = self.client.post(
            "/api/v1/inspections",
            files=[
                ("files", ("f.jpg", io.BytesIO(novel_front), "image/jpeg")),
                ("files", ("b.jpg", io.BytesIO(novel_back), "image/jpeg")),
            ],
            data={"panels": ["FRONT", "BACK"]},
        )
        self.assertEqual(res.status_code, 200)
        content_str = str(res.json()).upper()

        self.assertNotIn("PARLE", content_str)
        self.assertNotIn("LAY'S", content_str)
        self.assertNotIn("FRITO", content_str)


if __name__ == "__main__":
    unittest.main()
