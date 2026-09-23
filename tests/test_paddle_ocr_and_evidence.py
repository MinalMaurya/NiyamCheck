import io
import unittest
from unittest.mock import MagicMock, patch
from PIL import Image
from fastapi.testclient import TestClient

from backend.main import app
from backend.ocr.engine import (
    get_ocr_engine,
    PaddleEngine,
    EmptyOCREngine,
    MockOCREngine,
)
from backend.schemas.analysis import OCRResult, OCRRegion, ExtractedFields, FieldResult
from backend.compliance.models import ComplianceResult, ComplianceStatus, RuleEvaluation, RuleStatus
from backend.evidence.mapper import evidence_mapper
from backend.inspections.store import inspection_store


class TestPaddleOCRAndEvidence(unittest.TestCase):
    """
    Validates PaddleOCR production readiness, coordinate normalization,
    evidence mapping guarantees, and image binary retrieval.
    """

    @classmethod
    def setUpClass(cls):
        cls.client = TestClient(app)

    def test_01_real_ocr_engine_selection_and_no_silent_mock_in_production(self):
        """
        Requesting PADDLE engine selects PaddleEngine or falls back to EmptyOCREngine.
        It must NEVER silently substitute MockOCREngine (Parle-G) in production.
        """
        # When Paddle is not available, get_ocr_engine("PADDLE") returns EmptyOCREngine
        with patch.object(PaddleEngine, "_ocr_instance", None):
            with patch.object(PaddleEngine, "_init_attempted", True):
                engine = get_ocr_engine("PADDLE")
                self.assertIsInstance(engine, EmptyOCREngine)
                self.assertNotIsInstance(engine, MockOCREngine)
                self.assertEqual(engine.name, "Empty-OCR-Fallback")
                res = engine.extract_text(Image.new("RGB", (200, 200), "white"))
                self.assertEqual(res.text, "")
                self.assertEqual(len(res.regions), 0)

        # Mock engine remains explicitly accessible when configured
        mock_eng = get_ocr_engine("MOCK")
        self.assertIsInstance(mock_eng, MockOCREngine)
        self.assertEqual(mock_eng.name, "NiyamCheck-MockOCR-v1.0")

    def test_02_paddle_ocr_coordinate_normalization_to_ymin_xmin_ymax_xmax(self):
        """
        PaddleEngine converts pixel coordinates from PaddleOCR into strictly normalized
        [ymin, xmin, ymax, xmax] within [0.0, 1.0].
        """
        engine = PaddleEngine()

        # Mock PaddleOCR raw output:
        # Image dimensions: height=500, width=1000
        # Box 1: x in [100, 300], y in [50, 100] -> ymin=0.1, xmin=0.1, ymax=0.2, xmax=0.3
        # Box 2: coordinates slightly outside boundary [-10, 1050] -> clamped to [0.0, 1.0]
        fake_paddle_output = [
            [
                (
                    [[100.0, 50.0], [300.0, 50.0], [300.0, 100.0], [100.0, 100.0]],
                    ("NET WEIGHT: 500 g", 0.985),
                ),
                (
                    [[-10.0, 400.0], [1050.0, 400.0], [1050.0, 520.0], [-10.0, 520.0]],
                    ("M.R.P. Rs. 99.00", 0.94),
                ),
            ]
        ]

        mock_instance = MagicMock()
        mock_instance.ocr.return_value = fake_paddle_output

        with patch.object(engine, "_ocr_instance", mock_instance):
            test_img = Image.new("RGB", (1000, 500), color="white")
            result = engine.extract_text(test_img)

            self.assertIsInstance(result, OCRResult)
            self.assertEqual(len(result.regions), 2)
            self.assertIn("NET WEIGHT: 500 g", result.text)
            self.assertIn("M.R.P. Rs. 99.00", result.text)

            # Check Box 1
            b1 = result.regions[0].box
            self.assertEqual(b1, [0.1, 0.1, 0.2, 0.3])
            self.assertEqual(result.regions[0].confidence, 0.98)

            # Check Box 2 - Clamped
            b2 = result.regions[1].box
            self.assertGreaterEqual(b2[0], 0.0)
            self.assertLessEqual(b2[0], 1.0)
            self.assertGreaterEqual(b2[1], 0.0)
            self.assertLessEqual(b2[1], 1.0)
            self.assertGreaterEqual(b2[2], b2[0])
            self.assertLessEqual(b2[2], 1.0)
            self.assertGreaterEqual(b2[3], b2[1])
            self.assertLessEqual(b2[3], 1.0)

    def test_03_paddle_engine_handles_empty_or_textless_image_safely(self):
        """PaddleEngine handles None, empty list, or textless results without raising exceptions."""
        engine = PaddleEngine()

        # Empty result cases
        for empty_res in [None, [], [None], [[]]]:
            mock_inst = MagicMock()
            mock_inst.ocr.return_value = empty_res
            with patch.object(engine, "_ocr_instance", mock_inst):
                res = engine.extract_text(Image.new("RGB", (300, 300), "gray"))
                self.assertEqual(res.text, "")
                self.assertEqual(len(res.regions), 0)
                self.assertEqual(res.confidence, 0.0)

    def test_04_evidence_mapper_preserves_image_id_panel_and_non_fake_coordinates(self):
        """
        Evidence items must reference the exact image_id and panel.
        When OCR cannot localize a field, bounding_box must be None (non-fake guarantee).
        """
        ocr_res = OCRResult(
            text="PARLE-G ORIGINAL\nNET WEIGHT: 100 g",
            confidence=0.95,
            regions=[
                OCRRegion(text="PARLE-G ORIGINAL", confidence=0.98, box=[0.05, 0.1, 0.15, 0.8]),
                OCRRegion(text="NET WEIGHT: 100 g", confidence=0.92, box=[0.2, 0.1, 0.3, 0.5]),
            ],
        )

        fields = ExtractedFields(
            product_name=FieldResult(value="PARLE-G ORIGINAL", confidence=0.98),
            net_quantity=FieldResult(value="100 g", confidence=0.92),
            mrp=FieldResult(value="Rs. 20.00", confidence=0.85),  # Extracted from context, but NOT in OCR regions
        )

        compliance = ComplianceResult(
            status=ComplianceStatus.COMPLIANT,
            rules_checked=3,
            summary="Test evaluation",
            evaluations=[
                RuleEvaluation(
                    rule_id="LM-PN-001",
                    name="Product Identity",
                    category="Product Identification",
                    requirement="Name of the commodity",
                    reason="Verified on pack",
                    field="product_name",
                    status=RuleStatus.PASS,
                    evidence="PARLE-G ORIGINAL",
                ),
                RuleEvaluation(
                    rule_id="LM-NQ-001",
                    name="Net Quantity",
                    category="Quantity Declaration",
                    requirement="Net quantity declaration",
                    reason="Verified on pack",
                    field="net_quantity",
                    status=RuleStatus.PASS,
                    evidence="100 g",
                ),
                RuleEvaluation(
                    rule_id="LM-MRP-001",
                    name="Maximum Retail Price",
                    category="Pricing Declaration",
                    requirement="MRP declaration",
                    reason="Verified on pack",
                    field="mrp",
                    status=RuleStatus.PASS,
                    evidence="Rs. 20.00",
                ),
            ],
        )

        items = evidence_mapper.map_evidence(
            ocr_result=ocr_res,
            fields=fields,
            compliance_result=compliance,
            image_id="img-panel-back-42",
            panel="BACK",
        )

        self.assertEqual(len(items), 3)

        # 1. Product Name has localized bounding box
        pn_item = next(it for it in items if it.field == "product_name")
        self.assertEqual(pn_item.image_id, "img-panel-back-42")
        self.assertEqual(pn_item.panel, "BACK")
        self.assertIsNotNone(pn_item.bounding_box)
        self.assertEqual(pn_item.bounding_box.ymin, 0.05)

        # 2. Net Quantity has localized bounding box
        nq_item = next(it for it in items if it.field == "net_quantity")
        self.assertEqual(nq_item.image_id, "img-panel-back-42")
        self.assertEqual(nq_item.panel, "BACK")
        self.assertIsNotNone(nq_item.bounding_box)
        self.assertEqual(nq_item.bounding_box.ymin, 0.2)

        # 3. MRP has NO localized bounding box (not in OCR regions) -> must be None!
        mrp_item = next(it for it in items if it.field == "mrp")
        self.assertEqual(mrp_item.image_id, "img-panel-back-42")
        self.assertEqual(mrp_item.panel, "BACK")
        self.assertIsNone(mrp_item.bounding_box, "Never invent synthetic bounding box coordinates!")

    def test_05_inspection_image_endpoint_retrieval(self):
        """
        Uploading a package image stores raw bytes and allows subsequent retrieval
        via GET /api/v1/inspections/{inspection_id}/images/{image_id}.
        """
        # Create small test image
        img = Image.new("RGB", (200, 200), color=(20, 120, 220))
        buf = io.BytesIO()
        img.save(buf, format="PNG")
        png_bytes = buf.getvalue()

        # Create inspection session with this image
        res = self.client.post(
            "/api/v1/inspections",
            files=[("files", ("front_panel.png", io.BytesIO(png_bytes), "image/png"))],
            data={"panels": ["FRONT"]},
        )
        self.assertEqual(res.status_code, 200)
        session = res.json()
        inspection_id = session["inspection_id"]
        image_id = session["images"][0]["image_id"]

        # Retrieve stored image binary
        img_res = self.client.get(f"/api/v1/inspections/{inspection_id}/images/{image_id}")
        self.assertEqual(img_res.status_code, 200)
        self.assertEqual(img_res.headers["content-type"], "image/png")
        self.assertEqual(img_res.content, png_bytes)

        # Non-existent image returns 404
        bad_img_res = self.client.get(f"/api/v1/inspections/{inspection_id}/images/non-existent-img")
        self.assertEqual(bad_img_res.status_code, 404)
        self.assertEqual(bad_img_res.json()["error_code"], "IMAGE_NOT_FOUND")


if __name__ == "__main__":
    unittest.main()
