import io
import unittest
from PIL import Image, ImageDraw
from fastapi.testclient import TestClient

from backend.main import app
from backend.config import settings
from backend.inspections.store import inspection_store, InMemoryInspectionStore
from backend.compliance.models import ComplianceStatus, RuleStatus
from backend.schemas.analysis import ExtractedFields, FieldResult, ExtractionStatus
from backend.compliance.rule_engine import compliance_engine
from backend.inspections.aggregator import session_aggregator
from backend.inspections.models import InspectionImage, PanelType
from backend.legal_knowledge.service import legal_knowledge_service


def create_minimal_jpeg(size=(320, 240), text="MINIMAL PANEL") -> bytes:
    img = Image.new("RGB", size, color=(240, 240, 240))
    draw = ImageDraw.Draw(img)
    draw.text((10, 10), text, fill=(0, 0, 0))
    buf = io.BytesIO()
    img.save(buf, format="JPEG")
    return buf.getvalue()


class TestMilestone7FailureCases(unittest.TestCase):
    """
    Milestone 7 Real-World Failure Mode and Edge-Case Test Suite.
    Verifies that NiyamCheck fails safely, conservatively, and gracefully across:
    - Image anomalies (empty, corrupted, oversized, low quality)
    - Inspection ambiguities (missing panels, conflicting declarations, zero images)
    - API edge cases (non-existent IDs, invalid parameters, premature report requests)
    - Legal retrieval corner cases (no matches, unmapped rules)
    - Storage isolation and safe resets
    """

    def setUp(self):
        self.client = TestClient(app)
        inspection_store.clear()

    # -------------------------------------------------------------------------
    # 1. Image Anomalies
    # -------------------------------------------------------------------------
    def test_empty_image_upload_rejected_in_analyze(self):
        """Zero-byte image upload must be rejected with HTTP 400 Bad Request."""
        res = self.client.post(
            "/api/v1/analyze/image",
            files={"file": ("empty.jpg", io.BytesIO(b""), "image/jpeg")},
        )
        self.assertEqual(res.status_code, 400)
        self.assertIn("empty", res.json()["detail"].lower())

    def test_corrupted_image_upload_rejected_in_analyze(self):
        """Corrupt non-image byte stream must return HTTP 422 Unprocessable Entity."""
        corrupt_bytes = b"NOT_A_VALID_JPEG_HEADER_RANDOM_GARBAGE_BYTES_12345"
        res = self.client.post(
            "/api/v1/analyze/image",
            files={"file": ("corrupt.jpg", io.BytesIO(corrupt_bytes), "image/jpeg")},
        )
        self.assertEqual(res.status_code, 422)
        self.assertIn("corrupted", res.json()["detail"].lower())

    def test_oversized_image_rejected_in_analyze(self):
        """Images exceeding MAX_UPLOAD_SIZE_BYTES must be rejected with HTTP 400."""
        orig_limit = settings.MAX_UPLOAD_SIZE_BYTES
        try:
            settings.MAX_UPLOAD_SIZE_BYTES = 500
            res = self.client.post(
                "/api/v1/analyze/image",
                files={"file": ("large.jpg", io.BytesIO(b"X" * 1000), "image/jpeg")},
            )
            self.assertEqual(res.status_code, 400)
            self.assertIn("exceeds maximum size limit", res.json()["detail"])
        finally:
            settings.MAX_UPLOAD_SIZE_BYTES = orig_limit

    def test_corrupted_image_in_multi_image_inspection_fails_safely(self):
        """Corrupt image in multi-image upload must be handled gracefully without crashing the session."""
        valid_bytes = create_minimal_jpeg(text="VALID PANEL")
        corrupt_bytes = b"CORRUPTED_BINARY_DATA_NON_JPEG"

        files = [
            ("files", ("panel1.jpg", io.BytesIO(valid_bytes), "image/jpeg")),
            ("files", ("panel2.jpg", io.BytesIO(corrupt_bytes), "image/jpeg")),
        ]
        res = self.client.post("/api/v1/inspections", files=files)
        self.assertEqual(res.status_code, 200)
        session = res.json()
        self.assertEqual(len(session["images"]), 2)
        # Corrupt image quality must be flagged as POOR
        corrupt_img = session["images"][1]
        self.assertEqual(corrupt_img["quality"]["status"], "POOR")
        self.assertTrue(any("corrupt" in issue.lower() for issue in corrupt_img["quality"]["issues"]))

    def test_sparse_or_unclear_fields_fail_conservatively_to_not_verifiable(self):
        """
        Critical Rule: When an image has insufficient context or unobserved fields,
        the system MUST NOT falsely declare them MISSING (which causes NON_COMPLIANT).
        It must conservatively emit NOT_VERIFIABLE.
        """
        # Create fields with only product_name present, others NOT_VERIFIABLE
        fields = ExtractedFields(
            product_name=FieldResult[str](status=ExtractionStatus.PRESENT, value="Sample Biscuit", confidence=0.9),
            net_quantity=FieldResult[str](status=ExtractionStatus.NOT_VERIFIABLE, confidence=0.0),
            mrp=FieldResult[str](status=ExtractionStatus.NOT_VERIFIABLE, confidence=0.0),
            manufacturer=FieldResult[str](status=ExtractionStatus.NOT_VERIFIABLE, confidence=0.0),
            address=FieldResult[str](status=ExtractionStatus.NOT_VERIFIABLE, confidence=0.0),
            date_information=FieldResult[str](status=ExtractionStatus.NOT_VERIFIABLE, confidence=0.0),
            consumer_care=FieldResult[str](status=ExtractionStatus.NOT_VERIFIABLE, confidence=0.0),
        )
        result = compliance_engine.evaluate(fields)
        # Because mandatory fields cannot be verified from the image, status must be PARTIALLY_VERIFIABLE, NOT NON_COMPLIANT!
        self.assertEqual(result.status, ComplianceStatus.PARTIALLY_VERIFIABLE)
        self.assertEqual(result.rules_failed, 0)
        self.assertTrue(result.rules_not_verifiable > 0)

    # -------------------------------------------------------------------------
    # 2. Inspection Ambiguities & Edge Cases
    # -------------------------------------------------------------------------
    def test_zero_images_in_create_inspection_rejected(self):
        """Submitting an inspection with no files must return HTTP 400 Bad Request."""
        res = self.client.post("/api/v1/inspections", files=[])
        # FastAPI returns 422 for missing required form fields, or 400 for empty list
        self.assertIn(res.status_code, (400, 422))

    def test_conflicting_extracted_declarations_resolved_by_highest_confidence(self):
        """
        When two images contain conflicting candidate declarations,
        the session aggregator must deterministically select the one with highest confidence.
        """
        cand1 = FieldResult[str](status=ExtractionStatus.PRESENT, value="Low Conf Name", confidence=0.65)
        cand2 = FieldResult[str](status=ExtractionStatus.PRESENT, value="High Conf Name", confidence=0.95)

        resolved = session_aggregator._resolve_best_field("product_name", [cand1, cand2])
        self.assertEqual(resolved.value, "High Conf Name")
        self.assertEqual(resolved.confidence, 0.95)

    def test_unclear_declaration_prevents_false_full_compliance(self):
        """An unclear declaration must trigger PARTIALLY_VERIFIABLE, never false COMPLIANT."""
        fields = ExtractedFields(
            product_name=FieldResult[str](status=ExtractionStatus.PRESENT, value="Test Brand", confidence=0.9),
            net_quantity=FieldResult[str](status=ExtractionStatus.PRESENT, value="500 g", confidence=0.95),
            mrp=FieldResult[str](status=ExtractionStatus.UNCLEAR, value="Candidate Rs 25", confidence=0.5),
            manufacturer=FieldResult[str](status=ExtractionStatus.PRESENT, value="Acme Ltd", confidence=0.9),
            address=FieldResult[str](status=ExtractionStatus.PRESENT, value="Mumbai 400001", confidence=0.9),
            date_information=FieldResult[str](status=ExtractionStatus.PRESENT, value="01/2026", confidence=0.9),
            consumer_care=FieldResult[str](status=ExtractionStatus.PRESENT, value="1800-00-0000", confidence=0.9),
            country_of_origin=FieldResult[str](status=ExtractionStatus.PRESENT, value="India", confidence=0.9),
        )
        comp = compliance_engine.evaluate(fields)
        self.assertEqual(comp.status, ComplianceStatus.PARTIALLY_VERIFIABLE)
        self.assertTrue(comp.rules_unclear > 0)

    # -------------------------------------------------------------------------
    # 3. API Edge Cases
    # -------------------------------------------------------------------------
    def test_nonexistent_inspection_id_returns_404(self):
        """Requesting a session that doesn't exist returns HTTP 404."""
        res = self.client.get("/api/v1/inspections/NON_EXISTENT_ID_999")
        self.assertEqual(res.status_code, 404)
        self.assertIn("not found", res.json()["detail"].lower())

    def test_report_json_for_nonexistent_session_returns_404(self):
        """Requesting a JSON report for a non-existent inspection returns HTTP 404."""
        res = self.client.get("/api/v1/inspections/INSP-DOES-NOT-EXIST/report.json")
        self.assertEqual(res.status_code, 404)

    def test_report_pdf_for_nonexistent_session_returns_404(self):
        """Requesting a PDF report for a non-existent inspection returns HTTP 404."""
        res = self.client.get("/api/v1/inspections/INSP-DOES-NOT-EXIST/report")
        self.assertEqual(res.status_code, 404)

    def test_nonexistent_image_in_session_returns_404(self):
        """Requesting a non-existent image ID from a valid or invalid session returns HTTP 404."""
        res = self.client.get("/api/v1/inspections/INSP-TEST/images/img-999")
        self.assertEqual(res.status_code, 404)

    # -------------------------------------------------------------------------
    # 4. Legal Knowledge Retrieval Corner Cases
    # -------------------------------------------------------------------------
    def test_legal_search_with_short_query_returns_422(self):
        """Search queries shorter than 2 characters must return HTTP 422 validation error."""
        res = self.client.get("/api/v1/legal/search?q=x")
        self.assertEqual(res.status_code, 422)

    def test_legal_search_with_no_matches_returns_empty_results_safely(self):
        """Search query matching no statutory provisions must return HTTP 200 with count 0 and empty list."""
        res = self.client.get("/api/v1/legal/search?q=totallyrandomnonexistentlegalquery9999")
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertEqual(data["count"], 0)
        self.assertEqual(data["results"], [])

    def test_legal_basis_retrieval_for_unknown_rule_fails_safely(self):
        """Retrieving legal basis for an unknown rule must return an empty list without raising exceptions."""
        bases = legal_knowledge_service.retrieve_legal_basis(
            rule_id="RULE-NON-EXISTENT",
            field_name="unknown_field",
        )
        self.assertIsInstance(bases, list)
        self.assertEqual(len(bases), 0)

    # -------------------------------------------------------------------------
    # 5. Storage Isolation & Reset
    # -------------------------------------------------------------------------
    def test_store_clear_wipes_all_sessions_and_images(self):
        """InspectionStore.clear() must completely wipe all persisted sessions and image binaries."""
        store = InMemoryInspectionStore()
        store.save_image("INSP-A", "img-1", b"data1", "image/jpeg")
        store.save_image("INSP-B", "img-2", b"data2", "image/jpeg")

        self.assertIsNotNone(store.get_image("INSP-A", "img-1"))
        self.assertIsNotNone(store.get_image("INSP-B", "img-2"))

        store.clear()
        self.assertIsNone(store.get_image("INSP-A", "img-1"))
        self.assertIsNone(store.get_image("INSP-B", "img-2"))
        self.assertEqual(len(store.list_all()), 0)


if __name__ == "__main__":
    unittest.main()
