import unittest
from PIL import Image

from backend.app.cv.ocr.mock_engine import MockOCREngine
from backend.app.cv.ocr.factory import get_ocr_engine
from backend.app.schemas.ocr import OCRResult


class TestOCREngines(unittest.TestCase):
    def setUp(self):
        self.mock_engine = MockOCREngine()
        self.dummy_image = Image.new("RGB", (500, 500), color="white")

    def test_mock_engine_extraction(self):
        result = self.mock_engine.extract(self.dummy_image)
        self.assertIsInstance(result, OCRResult)
        self.assertGreater(result.line_count, 0)
        self.assertTrue(len(result.raw_text) > 0)
        self.assertTrue(result.engine_used.startswith("NiyamCheck-MockOCR"))

    def test_bounding_boxes_are_normalized(self):
        result = self.mock_engine.extract(self.dummy_image)
        for box in result.boxes:
            b = box.bounding_box
            self.assertGreaterEqual(b.ymin, 0.0)
            self.assertLessEqual(b.ymin, 1.0)
            self.assertGreaterEqual(b.xmin, 0.0)
            self.assertLessEqual(b.xmin, 1.0)
            self.assertGreaterEqual(b.ymax, b.ymin)
            self.assertGreaterEqual(b.xmax, b.xmin)
            self.assertGreater(len(box.text), 0)

    def test_ocr_factory_fallback(self):
        # Requesting mock engine returns MockOCREngine
        engine = get_ocr_engine("MOCK")
        self.assertIsInstance(engine, MockOCREngine)

        # Requesting invalid or uninstalled engine safely defaults to MockOCREngine
        fallback_engine = get_ocr_engine("UNKNOWN_ENGINE")
        self.assertIsInstance(fallback_engine, MockOCREngine)


if __name__ == "__main__":
    unittest.main()
