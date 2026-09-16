import io
import unittest
import numpy as np
from PIL import Image, ImageDraw

from backend.app.cv.iqa.quality_checker import ImageQualityChecker
from backend.app.schemas.iqa import QualityVerdict


class TestImageQualityChecker(unittest.TestCase):
    def setUp(self):
        self.checker = ImageQualityChecker(
            blur_threshold=100.0,
            glare_threshold=0.20,
            min_width=300,
            min_height=300,
        )

    def test_sharp_high_contrast_image(self):
        """Image with high-frequency edges and text patterns should pass sharpness."""
        img = Image.new("RGB", (400, 400), color="white")
        draw = ImageDraw.Draw(img)
        # Draw high-contrast grid / text lines
        for y in range(20, 380, 20):
            draw.line([(20, y), (380, y)], fill="black", width=2)
            draw.text((30, y - 10), f"SAMPLE LINE {y}", fill="black")

        report = self.checker.evaluate_image(img)
        self.assertTrue(report.is_acceptable_for_ocr)
        self.assertGreater(report.sharpness.score, 100.0)
        self.assertEqual(report.width, 400)
        self.assertEqual(report.height, 400)

    def test_blurry_flat_image(self):
        """Flat / completely blurry image should fail or warn on sharpness."""
        # A completely solid gray image has zero Laplacian variance
        img = Image.new("RGB", (400, 400), color=(128, 128, 128))
        report = self.checker.evaluate_image(img)
        self.assertEqual(report.sharpness.score, 0.0)
        self.assertTrue(any(issue.issue_type == "BLURRY" for issue in report.issues))

    def test_glare_detection(self):
        """Image with large overexposed white patch should trigger glare warning."""
        img = Image.new("RGB", (400, 400), color=(50, 50, 50))
        draw = ImageDraw.Draw(img)
        # Saturated glare over 40% of the area
        draw.rectangle([50, 50, 350, 350], fill=(255, 255, 255))

        report = self.checker.evaluate_image(img)
        self.assertTrue(any(issue.issue_type == "GLARE" for issue in report.issues))

    def test_low_resolution_rejection(self):
        """Image under minimum dimensions should report LOW_RESOLUTION."""
        img = Image.new("RGB", (150, 150), color="white")
        report = self.checker.evaluate_image(img)
        self.assertTrue(any(issue.issue_type == "LOW_RESOLUTION" for issue in report.issues))

    def test_evaluate_bytes(self):
        """Helper to test byte input."""
        img = Image.new("RGB", (350, 350), color=(200, 200, 200))
        buf = io.BytesIO()
        img.save(buf, format="JPEG")
        report = self.checker.evaluate_bytes(buf.getvalue())
        self.assertIsNotNone(report.verdict)


if __name__ == "__main__":
    unittest.main()
