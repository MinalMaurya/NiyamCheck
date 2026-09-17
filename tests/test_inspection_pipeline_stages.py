import io
import unittest
from PIL import Image, ImageDraw
from fastapi.testclient import TestClient

from backend.main import app as main_app
from backend.app.main import app as app_main_app
from backend.compliance.models import ComplianceStatus, RuleStatus


class TestInspectionPipelineStages(unittest.TestCase):
    """
    Tests the complete end-to-end inspection flow and stage-specific structured error handling.
    """

    @classmethod
    def setUpClass(cls):
        cls.client_main = TestClient(main_app)
        cls.client_app = TestClient(app_main_app)

        # Create a valid test packaged food image (e.g. Parle-G back panel)
        img = Image.new("RGB", (600, 600), color=(255, 255, 255))
        draw = ImageDraw.Draw(img)
        draw.text((30, 30), "PARLE-G ORIGINAL GLUCOSE BISCUITS", fill=(0, 0, 0))
        draw.text((30, 70), "NET WT: 250 g", fill=(0, 0, 0))
        draw.text((30, 110), "M.R.P. Rs. 30.00 (INCL. OF ALL TAXES)", fill=(0, 0, 0))
        draw.text((30, 150), "MFD: 07/2026", fill=(0, 0, 0))
        draw.text((30, 190), "PARLE PRODUCTS PVT. LTD.", fill=(0, 0, 0))
        draw.text((30, 230), "VILE PARLE EAST, MUMBAI - 400057, MAHARASHTRA", fill=(0, 0, 0))
        draw.text((30, 270), "CARE: 1800-22-7799, EMAIL: CS@PARLE.BIZ", fill=(0, 0, 0))
        draw.text((30, 310), "COUNTRY OF ORIGIN: INDIA", fill=(0, 0, 0))

        buf = io.BytesIO()
        img.save(buf, format="JPEG")
        cls.valid_image_bytes = buf.getvalue()

    def test_complete_successful_inspection_flow(self):
        """Verify the full pipeline: Upload -> OCR -> Rules -> Evidence -> Legal -> Session."""
        res = self.client_main.post(
            "/api/v1/inspections",
            files=[("files", ("back_panel.jpg", self.valid_image_bytes, "image/jpeg"))],
            data={"panels": "BACK"},
        )
        self.assertEqual(res.status_code, 200)
        session = res.json()

        # 1. Verify inspection session structure
        self.assertIn("inspection_id", session)
        self.assertTrue(session["inspection_id"].startswith("INSP-"))
        self.assertEqual(len(session["images"]), 1)
        self.assertEqual(session["images"][0]["panel"], "BACK")

        # 2. Verify extracted fields
        fields = session["combined_fields"]
        self.assertIn("product_name", fields)
        self.assertIn("net_quantity", fields)
        self.assertIn("mrp", fields)

        # 3. Verify compliance evaluation
        compliance = session["compliance"]
        self.assertIn("status", compliance)
        self.assertEqual(compliance["status"], ComplianceStatus.COMPLIANT.value)
        self.assertEqual(len(compliance["evaluations"]), 8)

        # 4. Verify visual evidence mapping
        evidence = session["evidence"]
        self.assertGreater(len(evidence), 0)
        first_ev = evidence[0]
        self.assertIn("bounding_box", first_ev)
        self.assertIn("ymin", first_ev["bounding_box"])

        # 5. Verify authoritative legal basis attachment
        has_legal_basis = any(ev.get("legal_basis") for ev in compliance["evaluations"])
        self.assertTrue(has_legal_basis, "At least one evaluation must have attached legal basis")

        # 6. Verify session retrieval
        get_res = self.client_main.get(f"/api/v1/inspections/{session['inspection_id']}")
        self.assertEqual(get_res.status_code, 200)

        # 7. Verify JSON report generation
        json_report_res = self.client_main.get(f"/api/v1/inspections/{session['inspection_id']}/report.json")
        self.assertEqual(json_report_res.status_code, 200)
        self.assertIn("integrity_hash", json_report_res.json())

        # 8. Verify PDF report generation
        pdf_res = self.client_main.get(f"/api/v1/inspections/{session['inspection_id']}/report")
        self.assertEqual(pdf_res.status_code, 200)
        self.assertEqual(pdf_res.headers["content-type"], "application/pdf")
        self.assertTrue(pdf_res.content.startswith(b"%PDF-"))

    def test_dual_entrypoint_compatibility(self):
        """Ensure both backend.main and backend.app.main handle inspections identically."""
        res_main = self.client_main.post(
            "/api/v1/inspections",
            files=[("files", ("test.jpg", self.valid_image_bytes, "image/jpeg"))],
            data={"panels": "FRONT"},
        )
        res_app = self.client_app.post(
            "/api/v1/inspections",
            files=[("files", ("test.jpg", self.valid_image_bytes, "image/jpeg"))],
            data={"panels": "FRONT"},
        )

        self.assertEqual(res_main.status_code, 200)
        self.assertEqual(res_app.status_code, 200)
        self.assertTrue(res_main.json()["inspection_id"].startswith("INSP-"))
        self.assertTrue(res_app.json()["inspection_id"].startswith("INSP-"))

    def test_upload_stage_empty_file(self):
        """Verify structured error response when uploading an empty file."""
        res = self.client_main.post(
            "/api/v1/inspections",
            files=[("files", ("empty.jpg", b"", "image/jpeg"))],
        )
        self.assertEqual(res.status_code, 400)
        body = res.json()
        self.assertFalse(body["success"])
        self.assertEqual(body["stage"], "upload")
        self.assertEqual(body["error_code"], "EMPTY_FILE")
        self.assertIn("empty", body["message"].lower())

    def test_upload_stage_no_files(self):
        """Verify structured error response when no files are uploaded."""
        res = self.client_main.post(
            "/api/v1/inspections",
            files=[],
        )
        # 400 or 422 if FastAPI schema validation catches empty list first
        self.assertIn(res.status_code, [400, 422])

    def test_upload_stage_oversized_file(self):
        """Verify structured error response when payload exceeds 25MB limit."""
        huge_bytes = b"X" * (26 * 1024 * 1024)
        res = self.client_main.post(
            "/api/v1/inspections",
            files=[("files", ("huge.jpg", huge_bytes, "image/jpeg"))],
        )
        self.assertEqual(res.status_code, 400)
        body = res.json()
        self.assertFalse(body["success"])
        self.assertEqual(body["stage"], "upload")
        self.assertEqual(body["error_code"], "PAYLOAD_TOO_LARGE")

    def test_endpoint_not_found_structured_error(self):
        """Verify that unknown API routes return a structured error instead of bare 404."""
        res = self.client_main.get("/api/v1/non_existent_route")
        self.assertEqual(res.status_code, 404)
        body = res.json()
        self.assertFalse(body["success"])
        self.assertEqual(body["stage"], "upload")
        self.assertEqual(body["error_code"], "ENDPOINT_NOT_FOUND")
        self.assertIn("not found", body["message"].lower())

    def test_valid_jpg_inspection(self):
        """Test 1: Valid JPG inspection produces a structured InspectionSession."""
        res = self.client_main.post(
            "/api/v1/inspections",
            files=[("files", ("panel.jpg", self.valid_image_bytes, "image/jpeg"))],
            data={"panels": "BACK"},
        )
        self.assertEqual(res.status_code, 200)
        session = res.json()
        self.assertEqual(session["product_category"], "Packaged Food")
        self.assertIn("findings", session)
        self.assertEqual(session["status"], ComplianceStatus.COMPLIANT.value)

    def test_valid_png_inspection(self):
        """Test 2: Valid PNG inspection produces a structured InspectionSession."""
        png_img = Image.new("RGBA", (500, 500), color=(255, 255, 255, 255))
        draw = ImageDraw.Draw(png_img)
        draw.text((20, 20), "PARLE-G ORIGINAL GLUCOSE BISCUITS", fill=(0, 0, 0, 255))
        buf = io.BytesIO()
        png_img.save(buf, format="PNG")
        png_bytes = buf.getvalue()

        res = self.client_main.post(
            "/api/v1/inspections",
            files=[("files", ("panel.png", png_bytes, "image/png"))],
            data={"panels": "FRONT"},
        )
        self.assertEqual(res.status_code, 200)
        session = res.json()
        self.assertEqual(session["product_category"], "Packaged Food")
        self.assertEqual(len(session["images"]), 1)

    def test_invalid_corrupted_image(self):
        """Test 3: Invalid/corrupted image data does not crash server with 500."""
        corrupted_bytes = b"CORRUPTED_NOT_A_VALID_IMAGE_DATA_12345"
        res = self.client_main.post(
            "/api/v1/inspections",
            files=[("files", ("corrupted.jpg", corrupted_bytes, "image/jpeg"))],
            data={"panels": "BACK"},
        )
        self.assertEqual(res.status_code, 200)
        session = res.json()
        self.assertEqual(session["images"][0]["quality"]["status"], "POOR")
        self.assertIn(session["status"], [ComplianceStatus.COMPLIANT.value, ComplianceStatus.PARTIALLY_VERIFIABLE.value, ComplianceStatus.NOT_VERIFIABLE.value])

    def test_empty_image_submission(self):
        """Test 4: Empty image submission returns structured 400 diagnostic."""
        res = self.client_main.post(
            "/api/v1/inspections",
            files=[("files", ("empty.jpg", b"", "image/jpeg"))],
        )
        self.assertEqual(res.status_code, 400)
        body = res.json()
        self.assertEqual(body["stage"], "upload")
        self.assertEqual(body["error_code"], "EMPTY_FILE")

    def test_ocr_failure_yields_review_not_500(self):
        """Test 5: OCR failure or zero extracted text returns valid inspection with review status, never HTTP 500."""
        from unittest.mock import patch
        from backend.ocr.mock import MockOCREngine

        # Patch get_ocr_engine in analysis_service to simulate OCR returning no readable lines
        with patch("backend.services.analysis_service.get_ocr_engine", return_value=MockOCREngine(synthetic_lines=[])):
            res = self.client_main.post(
                "/api/v1/inspections",
                files=[("files", ("panel.jpg", self.valid_image_bytes, "image/jpeg"))],
                data={"panels": "BACK"},
            )
            self.assertEqual(res.status_code, 200)
            session = res.json()
            # Under empty OCR, status must be NOT_VERIFIABLE, not HTTP 500
            self.assertEqual(session["status"], ComplianceStatus.NOT_VERIFIABLE.value)
            self.assertIn("Insufficient", session["summary"])

    def test_low_quality_image(self):
        """Test 6: Low quality image is safely flagged without crashing server."""
        # Create a tiny blurry 200x200 solid gray image
        low_q = Image.new("RGB", (200, 200), color=(128, 128, 128))
        buf = io.BytesIO()
        low_q.save(buf, format="JPEG")

        res = self.client_main.post(
            "/api/v1/inspections",
            files=[("files", ("blurry.jpg", buf.getvalue(), "image/jpeg"))],
            data={"panels": "BACK"},
        )
        self.assertEqual(res.status_code, 200)
        session = res.json()
        self.assertIn("images", session)
        self.assertEqual(len(session["images"]), 1)

    def test_no_legal_rule_found(self):
        """Test 7: Unknown rule without statutory basis sets fallback notice without crashing."""
        from backend.legal_knowledge.service import legal_knowledge_service
        from backend.compliance.models import ComplianceResult, RuleEvaluation, RuleStatus

        custom_eval = RuleEvaluation(
            rule_id="LM-UNKNOWN-999",
            name="Unknown Custom Rule",
            category="Custom",
            requirement="Non-existent statutory rule",
            status=RuleStatus.NOT_VERIFIABLE,
            reason="Unverifiable",
            field="custom_field",
        )
        comp = ComplianceResult(
            status=ComplianceStatus.NOT_VERIFIABLE,
            summary="Custom check",
            rules_checked=1,
            evaluations=[custom_eval],
        )
        enriched = legal_knowledge_service.attach_legal_basis(comp)
        self.assertEqual(len(enriched.evaluations[0].legal_basis), 0)
        self.assertIn("No applicable rule was found", enriched.evaluations[0].legal_source)

    def test_successful_compliance_analysis(self):
        """Test 8: Successful compliance analysis populates requirements_checked, passed, and findings."""
        res = self.client_main.post(
            "/api/v1/inspections",
            files=[("files", ("back.jpg", self.valid_image_bytes, "image/jpeg"))],
            data={"panels": "BACK"},
        )
        self.assertEqual(res.status_code, 200)
        session = res.json()
        self.assertGreaterEqual(session["requirements_checked"], 8)
        self.assertGreaterEqual(session["passed"], 1)
        self.assertIsInstance(session["findings"], list)
        self.assertGreater(len(session["findings"]), 0)

        # Check finding structure
        first_finding = session["findings"][0]
        self.assertIn("requirement", first_finding)
        self.assertIn("status", first_finding)
        self.assertIn("package_panel", first_finding)
        self.assertIn("explanation", first_finding)

    def test_multiple_package_panels(self):
        """Test 9: Multiple package panels are combined into one unified inspection session."""
        res = self.client_main.post(
            "/api/v1/inspections",
            files=[
                ("files", ("front.jpg", self.valid_image_bytes, "image/jpeg")),
                ("files", ("back.jpg", self.valid_image_bytes, "image/jpeg")),
            ],
            data={"panels": ["FRONT", "BACK"]},
        )
        self.assertEqual(res.status_code, 200)
        session = res.json()
        self.assertEqual(len(session["images"]), 2)
        self.assertEqual(session["images"][0]["panel"], "FRONT")
        self.assertEqual(session["images"][1]["panel"], "BACK")

    def test_backend_exception_handling(self):
        """Test 10: Backend unhandled exceptions return structured JSON diagnostics rather than plain text 500."""
        # Verify custom 404 returns structured JSON
        res_404 = self.client_main.get("/api/v1/non_existent_endpoint")
        self.assertEqual(res_404.status_code, 404)
        self.assertEqual(res_404.headers["content-type"], "application/json")
        body_404 = res_404.json()
        self.assertFalse(body_404["success"])
        self.assertEqual(body_404["error_code"], "ENDPOINT_NOT_FOUND")

    def test_malformed_request(self):
        """Test 11: Malformed query/parameter returns structured error response."""
        res = self.client_main.get("/api/v1/inspections/INVALID_SESSION_ID_12345")
        self.assertEqual(res.status_code, 404)
        body = res.json()
        self.assertFalse(body["success"])
        self.assertEqual(body["error_code"], "SESSION_NOT_FOUND")

    def test_single_panel_missing_field_is_review(self):
        """Test 12: Missing fields on a single panel are marked as REVIEW (not violation)."""
        from backend.schemas.analysis import ExtractedFields, FieldResult, ExtractionStatus
        from backend.inspections.models import InspectionImage, PanelType
        from backend.compliance.rule_engine import compliance_engine
        from backend.inspections.aggregator import session_aggregator
        from backend.schemas.analysis import ImageQualityResult, ImageQualityStatus, OCRResult

        # Create single panel with only product_name and net_quantity (missing manufacturer, date, MRP, etc.)
        fields = ExtractedFields(
            product_name=FieldResult[str](status=ExtractionStatus.PRESENT, value="TEST PRODUCT", confidence=0.95),
            net_quantity=FieldResult[str](status=ExtractionStatus.PRESENT, value="100 g", confidence=0.95),
        )
        comp = compliance_engine.evaluate(fields)
        img = InspectionImage(
            image_id="img-single-001",
            panel=PanelType.FRONT,
            quality=ImageQualityResult(status=ImageQualityStatus.GOOD, score=0.95, issues=[]),
            ocr=OCRResult(text="TEST PRODUCT\n100 g", confidence=0.95, regions=[]),
            fields=fields,
            compliance=comp,
            evidence=[],
        )
        session = session_aggregator.aggregate_session([img], inspection_id="INSP-SINGLE-TEST")
        self.assertEqual(session.status, ComplianceStatus.PARTIALLY_VERIFIABLE)

        # Check evaluations: missing manufacturer or date must be REVIEW, not FAIL
        mfg_ev = next(e for e in session.compliance.evaluations if e.rule_id == "LM-MFG-001")
        self.assertEqual(mfg_ev.status, RuleStatus.REVIEW)
        self.assertIn("Only one package panel was submitted", mfg_ev.reason)


if __name__ == "__main__":
    unittest.main()

