import io
import unittest
from PIL import Image, ImageDraw

from backend.image_quality.checker import ImageQualityChecker
from backend.schemas.analysis import ImageQualityStatus


class TestMilestone1ImageQuality(unittest.TestCase):
    def setUp(self):
        self.checker = ImageQualityChecker()

    def test_good_quality_image(self):
        """Crisp image with clear contrast, borders, and resolution should be GOOD."""
        img = Image.new("RGB", (500, 500), color=(180, 180, 180))
        draw = ImageDraw.Draw(img)
        draw.rectangle([20, 20, 480, 480], outline=(20, 20, 20), width=3)
        for y in range(40, 460, 40):
            draw.text((40, y), f"DECLARATION LINE NUMBER {y // 40}", fill=(10, 10, 10))

        result = self.checker.check_image(img)
        self.assertEqual(result.status, ImageQualityStatus.GOOD)
        self.assertGreaterEqual(result.score, 0.80)
        self.assertEqual(len(result.issues), 0)

    def test_blurry_image_returns_poor(self):
        """Completely flat or blurry image should return POOR with blur feedback."""
        # Solid gray image has 0 variance
        img = Image.new("RGB", (400, 400), color=(128, 128, 128))
        result = self.checker.check_image(img)
        self.assertEqual(result.status, ImageQualityStatus.POOR)
        self.assertTrue(any("blurry" in issue.lower() for issue in result.issues))

    def test_low_resolution_image_returns_poor(self):
        """Image below 200px should return POOR with resolution feedback."""
        img = Image.new("RGB", (150, 150), color=(180, 180, 180))
        result = self.checker.check_image(img)
        self.assertEqual(result.status, ImageQualityStatus.POOR)
        self.assertTrue(any("resolution" in issue.lower() for issue in result.issues))

    def test_empty_bytes_handling(self):
        """Empty bytes should return POOR without crashing."""
        result = self.checker.check_bytes(b"")
        self.assertEqual(result.status, ImageQualityStatus.POOR)
        self.assertEqual(result.score, 0.0)

    def test_corrupt_bytes_handling(self):
        """Random invalid bytes should return POOR with error explanation."""
        result = self.checker.check_bytes(b"not_an_image_file_bytes_12345")
        self.assertEqual(result.status, ImageQualityStatus.POOR)
        self.assertTrue(any("corrupted" in issue.lower() or "invalid" in issue.lower() for issue in result.issues))


if __name__ == "__main__":
    unittest.main()
