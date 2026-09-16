import unittest
from PIL import Image

from backend.ocr.mock import MockOCREngine
from backend.ocr.engine import get_ocr_engine
from backend.schemas.analysis import OCRResult


class TestMilestone1OCR(unittest.TestCase):
    def setUp(self):
        self.mock_engine = MockOCREngine()
        self.test_image = Image.new("RGB", (400, 400), color="white")

    def test_ocr_extraction_structure(self):
        """Verify OCRResult contains text, confidence, and regions with boxes."""
        result = self.mock_engine.extract_text(self.test_image)
        self.assertIsInstance(result, OCRResult)
        self.assertTrue(len(result.text) > 0)
        self.assertGreater(result.confidence, 0.0)
        self.assertGreater(len(result.regions), 0)

        # Verify region structure
        for region in result.regions:
            self.assertTrue(len(region.text) > 0)
            self.assertGreaterEqual(region.confidence, 0.0)
            self.assertEqual(len(region.box), 4)
            ymin, xmin, ymax, xmax = region.box
            self.assertGreaterEqual(ymin, 0.0)
            self.assertLessEqual(ymax, 1.0)
            self.assertGreaterEqual(xmin, 0.0)
            self.assertLessEqual(xmax, 1.0)

    def test_custom_mock_lines(self):
        """Ensure mock engine can accept customized test strings."""
        custom_lines = [
            ("ACME CHOCOLATE COOKIES", 0.95, [0.1, 0.1, 0.2, 0.9]),
            ("NET WT: 100 g", 0.92, [0.2, 0.1, 0.3, 0.5]),
        ]
        engine = MockOCREngine(synthetic_lines=custom_lines)
        res = engine.extract_text(self.test_image)
        self.assertEqual(len(res.regions), 2)
        self.assertIn("ACME CHOCOLATE COOKIES", res.text)

    def test_ocr_factory_fallback(self):
        """Factory should return a working BaseOCREngine instance."""
        engine = get_ocr_engine("MOCK")
        self.assertIsNotNone(engine)
        self.assertEqual(engine.name, "NiyamCheck-MockOCR-v1.0")

        # Unknown engine gracefully falls back to mock
        fallback = get_ocr_engine("NON_EXISTENT_ENGINE")
        self.assertIsNotNone(fallback)
        self.assertEqual(fallback.name, "NiyamCheck-MockOCR-v1.0")


if __name__ == "__main__":
    unittest.main()
