import io
from typing import Tuple, List, Optional
import numpy as np
from PIL import Image, ImageOps

from backend.config import settings
from backend.schemas.analysis import (
    ImageQualityResult,
    ImageQualityStatus,
    QualityDetails,
)


class ImageQualityChecker:
    """
    Performs multi-metric image quality assessment on package images
    before OCR processing.
    """

    def __init__(
        self,
        blur_good: float = settings.IQA_BLUR_THRESHOLD_GOOD,
        blur_acceptable: float = settings.IQA_BLUR_THRESHOLD_ACCEPTABLE,
        min_width: int = settings.IQA_MIN_WIDTH,
        min_height: int = settings.IQA_MIN_HEIGHT,
        brightness_min: float = settings.IQA_BRIGHTNESS_MIN_ACCEPTABLE,
        brightness_max: float = settings.IQA_BRIGHTNESS_MAX_ACCEPTABLE,
        contrast_min: float = settings.IQA_CONTRAST_MIN_ACCEPTABLE,
    ):
        self.blur_good = blur_good
        self.blur_acceptable = blur_acceptable
        self.min_width = min_width
        self.min_height = min_height
        self.brightness_min = brightness_min
        self.brightness_max = brightness_max
        self.contrast_min = contrast_min

    def check_image(self, pil_image: Image.Image) -> ImageQualityResult:
        """
        Assesses image quality across resolution, blur, brightness, and contrast.
        Returns GOOD, ACCEPTABLE, or POOR with score and actionable issues.
        """
        # 1. Normalize EXIF orientation if present (common in smartphone package photos)
        try:
            pil_image = ImageOps.exif_transpose(pil_image) or pil_image
        except Exception:
            pass

        # 2. Ensure RGB mode with safe alpha compositing (prevents transparent screenshots from turning black)
        if pil_image.mode in ("RGBA", "LA") or (pil_image.mode == "P" and "transparency" in pil_image.info):
            bg = Image.new("RGB", pil_image.size, (255, 255, 255))
            rgba = pil_image.convert("RGBA")
            bg.paste(rgba, mask=rgba.split()[3])
            rgb_img = bg
        elif pil_image.mode != "RGB":
            rgb_img = pil_image.convert("RGB")
        else:
            rgb_img = pil_image

        width, height = rgb_img.size
        img_array = np.array(rgb_img)


        # Grayscale luma (ITU-R 601-2)
        gray = 0.299 * img_array[:, :, 0] + 0.587 * img_array[:, :, 1] + 0.114 * img_array[:, :, 2]

        # 1. Blur calculation (Laplacian variance)
        sharpness_var = self._compute_laplacian_variance(gray)

        # 2. Brightness calculation (Mean luminance)
        brightness_mean = float(np.mean(gray))

        # 3. Contrast calculation (RMS contrast: standard deviation of luminance)
        contrast_std = float(np.std(gray))

        issues: List[str] = []
        scores: List[float] = []

        # Metric 1: Resolution
        if width < 200 or height < 200:
            issues.append(f"Image resolution ({width}x{height}) is critically low. Please capture closer to the package.")
            res_score = 0.2
        elif width < self.min_width or height < self.min_height:
            issues.append(f"Image resolution ({width}x{height}) is below recommended {self.min_width}x{self.min_height}px.")
            res_score = 0.6
        else:
            res_score = 1.0
        scores.append(res_score)

        # Metric 2: Sharpness / Blur
        if sharpness_var < self.blur_acceptable:
            issues.append("Image appears blurry. Please capture the package again with steady hands.")
            blur_score = max(0.1, sharpness_var / self.blur_acceptable * 0.4)
        elif sharpness_var < self.blur_good:
            issues.append("Image sharpness is marginal. Fine print declarations may be difficult to read.")
            blur_score = 0.6 + 0.3 * ((sharpness_var - self.blur_acceptable) / (self.blur_good - self.blur_acceptable))
        else:
            blur_score = 1.0
        scores.append(blur_score)

        # Metric 3: Brightness
        if brightness_mean < 35.0:
            issues.append("Image is too dark. Turn on camera flash or improve lighting.")
            bright_score = 0.3
        elif brightness_mean < self.brightness_min:
            issues.append("Image is dimly lit; text contrast may be reduced.")
            bright_score = 0.7
        elif brightness_mean > 245.0:
            issues.append("Image is overexposed or has severe glare. Move away from direct spotlight reflections.")
            bright_score = 0.3
        elif brightness_mean > self.brightness_max:
            issues.append("Image is very bright; glare may wash out packaging text.")
            bright_score = 0.7
        else:
            bright_score = 1.0
        scores.append(bright_score)

        # Metric 4: Contrast
        if contrast_std < 15.0:
            issues.append("Image contrast is critically low. Text does not stand out from the package background.")
            contrast_score = 0.3
        elif contrast_std < self.contrast_min:
            issues.append("Image contrast is low.")
            contrast_score = 0.6
        else:
            contrast_score = 1.0
        scores.append(contrast_score)

        # Text readability heuristic (composite weighted score)
        # Weights: Blur (0.40), Resolution (0.25), Contrast (0.20), Brightness (0.15)
        overall_score = round(
            0.40 * blur_score + 0.25 * res_score + 0.20 * contrast_score + 0.15 * bright_score,
            2,
        )

        # Status determination:
        # If any critical issue exists (resolution < 200, blur < acceptable, contrast < 15, brightness < 35 or > 245)
        if blur_score <= 0.4 or res_score <= 0.2 or contrast_score <= 0.3 or bright_score <= 0.3 or overall_score < 0.45:
            status = ImageQualityStatus.POOR
        elif len(issues) > 0 or overall_score < 0.80:
            status = ImageQualityStatus.ACCEPTABLE
        else:
            status = ImageQualityStatus.GOOD

        details = QualityDetails(
            width=width,
            height=height,
            sharpness_variance=round(sharpness_var, 2),
            brightness_mean=round(brightness_mean, 2),
            contrast_std=round(contrast_std, 2),
        )

        return ImageQualityResult(
            status=status,
            score=overall_score,
            issues=issues,
            details=details,
        )

    def check_bytes(self, image_bytes: bytes) -> ImageQualityResult:
        if not image_bytes:
            return ImageQualityResult(
                status=ImageQualityStatus.POOR,
                score=0.0,
                issues=["No image data received or file is empty."],
                details=None,
            )
        try:
            pil_image = Image.open(io.BytesIO(image_bytes))
            return self.check_image(pil_image)
        except Exception as exc:
            return ImageQualityResult(
                status=ImageQualityStatus.POOR,
                score=0.0,
                issues=[f"Invalid or corrupted image format: {str(exc)}"],
                details=None,
            )

    def _compute_laplacian_variance(self, gray: np.ndarray) -> float:
        """Computes variance of discrete Laplacian using 4-neighbor convolution."""
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
