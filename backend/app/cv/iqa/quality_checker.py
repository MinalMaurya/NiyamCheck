import io
from typing import Tuple, List
import numpy as np
from PIL import Image

from backend.app.core.config import settings
from backend.app.schemas.iqa import (
    ImageQualityReport,
    QualityVerdict,
    MetricScore,
    QualityIssue,
)


class ImageQualityChecker:
    """
    Evaluates suitability of packaging images for OCR and Legal Metrology verification.
    Provides instant feedback to both Web and mobile camera users.
    """

    def __init__(
        self,
        blur_threshold: float = settings.IQA_BLUR_THRESHOLD,
        glare_threshold: float = settings.IQA_GLARE_THRESHOLD,
        min_width: int = settings.IQA_MIN_WIDTH,
        min_height: int = settings.IQA_MIN_HEIGHT,
    ):
        self.blur_threshold = blur_threshold
        self.glare_threshold = glare_threshold
        self.min_width = min_width
        self.min_height = min_height

    def evaluate_image(self, pil_image: Image.Image) -> ImageQualityReport:
        """Analyze a PIL Image and return an ImageQualityReport."""
        # Convert to RGB if palette/RGBA
        if pil_image.mode != "RGB":
            rgb_image = pil_image.convert("RGB")
        else:
            rgb_image = pil_image

        width, height = rgb_image.size
        np_img = np.array(rgb_image)

        # Grayscale calculation (standard ITU-R 601-2 luma)
        gray = 0.299 * np_img[:, :, 0] + 0.587 * np_img[:, :, 1] + 0.114 * np_img[:, :, 2]

        # 1. Compute Sharpness (Laplacian variance)
        sharpness_score = self._calculate_sharpness(gray)

        # 2. Compute Glare (proportion of saturated highlight pixels)
        glare_score = float(np.mean(gray >= 250))

        # 3. Compute Mean Brightness (0 - 255)
        mean_brightness = float(np.mean(gray))

        issues: List[QualityIssue] = []

        # Check resolution
        resolution_passed = width >= self.min_width and height >= self.min_height
        if not resolution_passed:
            issues.append(
                QualityIssue(
                    issue_type="LOW_RESOLUTION",
                    severity="critical" if width < 200 or height < 200 else "warning",
                    message=f"Image resolution ({width}x{height}) is below recommended {self.min_width}x{self.min_height}px.",
                    recommendation="Capture image closer to the packaging or at higher camera resolution.",
                )
            )

        # Check sharpness
        sharpness_passed = sharpness_score >= self.blur_threshold
        if not sharpness_passed:
            is_critical = sharpness_score < (self.blur_threshold * 0.3)
            issues.append(
                QualityIssue(
                    issue_type="BLURRY",
                    severity="critical" if is_critical else "warning",
                    message=f"Image is out of focus or motion-blurred (sharpness: {sharpness_score:.1f}, min: {self.blur_threshold:.1f}).",
                    recommendation="Hold the camera steady and tap to focus on the printed declarations.",
                )
            )

        # Check glare
        glare_passed = glare_score <= self.glare_threshold
        if not glare_passed:
            issues.append(
                QualityIssue(
                    issue_type="GLARE",
                    severity="warning",
                    message=f"Excessive surface glare/reflections detected ({glare_score * 100:.1f}% of image saturated).",
                    recommendation="Angle camera slightly to avoid direct light reflection on plastic/foil wrapping.",
                )
            )

        # Check brightness
        brightness_passed = 40.0 <= mean_brightness <= 230.0
        if mean_brightness < 40.0:
            issues.append(
                QualityIssue(
                    issue_type="UNDEREXPOSED",
                    severity="warning",
                    message=f"Image is poorly lit (mean brightness: {mean_brightness:.1f}/255).",
                    recommendation="Turn on camera flash or move to a better-lit inspection environment.",
                )
            )
        elif mean_brightness > 230.0:
            issues.append(
                QualityIssue(
                    issue_type="OVEREXPOSED",
                    severity="warning",
                    message=f"Image is overexposed (mean brightness: {mean_brightness:.1f}/255).",
                    recommendation="Reduce lighting intensity or move away from direct spotlight.",
                )
            )

        # Determine overall verdict
        has_critical = any(issue.severity == "critical" for issue in issues)
        if has_critical:
            verdict = QualityVerdict.FAILED
            is_acceptable = False
            summary = "Image quality is too low for reliable OCR inspection. Please retake the photo."
        elif len(issues) > 0:
            verdict = QualityVerdict.WARNING
            is_acceptable = True
            summary = "Image quality has minor warnings, but OCR processing will proceed."
        else:
            verdict = QualityVerdict.PASSED
            is_acceptable = True
            summary = "Image quality is optimal for Legal Metrology inspection."

        return ImageQualityReport(
            verdict=verdict,
            is_acceptable_for_ocr=is_acceptable,
            width=width,
            height=height,
            sharpness=MetricScore(
                name="Laplacian Sharpness Variance",
                score=round(sharpness_score, 2),
                threshold=self.blur_threshold,
                passed=sharpness_passed,
                description="Higher values indicate sharper focus on printed text.",
            ),
            glare=MetricScore(
                name="Specular Glare Fraction",
                score=round(glare_score, 4),
                threshold=self.glare_threshold,
                passed=glare_passed,
                description="Lower values indicate minimal light reflections.",
            ),
            brightness=MetricScore(
                name="Average Luminance",
                score=round(mean_brightness, 2),
                threshold=128.0,
                passed=brightness_passed,
                description="Target 40-230 for balanced contrast.",
            ),
            issues=issues,
            summary=summary,
        )

    def evaluate_bytes(self, image_bytes: bytes) -> ImageQualityReport:
        """Convenience method to evaluate raw bytes."""
        pil_image = Image.open(io.BytesIO(image_bytes))
        return self.evaluate_image(pil_image)

    def _calculate_sharpness(self, gray: np.ndarray) -> float:
        """
        Computes the variance of the Laplacian filter using pure NumPy convolution.
        4-neighbor discrete Laplacian:
        [ 0,  1,  0]
        [ 1, -4,  1]
        [ 0,  1,  0]
        """
        if gray.shape[0] < 3 or gray.shape[1] < 3:
            return 0.0

        lap = (
            gray[1:-1, :-2]
            + gray[1:-1, 2:]
            + gray[:-2, 1:-1]
            + gray[2:, 1:-1]
            - 4.0 * gray[1:-1, 1:-1]
        )
        return float(np.var(lap))


quality_checker = ImageQualityChecker()
