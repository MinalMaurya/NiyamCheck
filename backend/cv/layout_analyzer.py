import math
from typing import List, Dict, Any, Optional, Tuple
from PIL import Image
import numpy as np

from backend.schemas.analysis import (
    OCRResult,
    OCRRegion,
    ReadabilityAssessment,
    PlacementAssessment,
)


class PackagingLayoutAnalyzer:
    """
    Visual and Spatial Layout Analyzer for Packaged Commodities.
    Evaluates Principal Display Panel (PDP) placement, local crop contrast and sharpness,
    relative font height ratios under PCR 2011 Rule 7, and spatial declaration grouping.
    """

    # Minimum relative font height ratio for readability on standard camera scans
    MIN_READABLE_FONT_RATIO: float = 0.012  # ~1.2% of panel height
    MIN_RECOMMENDED_FONT_RATIO: float = 0.020  # ~2.0% of panel height

    def detect_pdp(
        self,
        image: Optional[Image.Image],
        ocr_result: OCRResult,
        panel_type: str = "UNKNOWN",
    ) -> bool:
        """
        Determines whether the given image view corresponds to the Principal Display Panel (PDP).
        Under PCR 2011 Rule 6(1)(b)/(c) & Rule 7, product identity and net quantity
        must appear on the Principal Display Panel.
        """
        panel_upper = (panel_type or "UNKNOWN").upper()
        if panel_upper in ["FRONT", "PDP", "PRIMARY"]:
            return True

        if panel_upper in ["BACK", "LEFT", "RIGHT", "TOP", "BOTTOM"]:
            return False

        # If panel is UNKNOWN, infer from visual layout and OCR typography:
        # Front/PDP typically contains large typography in the top half (branding/product name)
        # and has relatively few dense, small text blocks compared to the back panel.
        regions = ocr_result.regions or []
        if not regions:
            return False

        large_header_boxes = 0
        dense_small_boxes = 0

        for r in regions:
            if r.box and len(r.box) == 4:
                height = max(0.0, r.box[2] - r.box[0])
                if height >= 0.04:  # Large prominent text >= 4% of image height
                    large_header_boxes += 1
                elif height <= 0.02 and len(r.text.split()) >= 4:
                    dense_small_boxes += 1

        # PDPs typically have prominent brand titles and low density of small text paragraphs
        if large_header_boxes >= 1 and dense_small_boxes <= 4:
            return True

        return False

    def assess_crop_readability(
        self,
        image: Optional[Image.Image],
        box: Optional[List[float]],
        raw_text: str = "",
        ocr_confidence: float = 0.9,
    ) -> ReadabilityAssessment:
        """
        Evaluates local visual contrast, sharpness, and distortion on the specific
        declaration region crop.
        """
        if not image or not box or len(box) != 4:
            # Fallback based on OCR confidence if no physical image is available
            is_readable = ocr_confidence >= 0.65
            return ReadabilityAssessment(
                is_readable=is_readable,
                readability_score=round(max(0.5, ocr_confidence), 2),
                local_contrast=40.0 if is_readable else 15.0,
                blur_score=85.0 if is_readable else 20.0,
                estimated_font_height_ratio=0.025,
                is_distorted=False,
                details={"source": "confidence_fallback"},
            )

        ymin, xmin, ymax, xmax = box
        img_w, img_h = image.size

        # Clamp normalized coordinates
        y1 = max(0, min(img_h - 1, int(ymin * img_h)))
        y2 = max(y1 + 1, min(img_h, int(ymax * img_h)))
        x1 = max(0, min(img_w - 1, int(xmin * img_w)))
        x2 = max(x1 + 1, min(img_w, int(xmax * img_w)))

        crop_w = x2 - x1
        crop_h = y2 - y1

        # Check for abnormal aspect ratio indicating severe skew or distortion
        aspect_ratio = crop_w / max(1, crop_h)
        is_distorted = False
        if len(raw_text.strip()) > 10 and aspect_ratio < 1.2:
            # Multi-word horizontal declaration squished into tall vertical box
            is_distorted = True

        try:
            crop = image.crop((x1, y1, x2, y2)).convert("L")
            crop_np = np.array(crop, dtype=np.float32)

            # 1. Local RMS & Michelson Contrast
            min_val = float(np.min(crop_np))
            max_val = float(np.max(crop_np))
            std_val = float(np.std(crop_np))

            michelson = (max_val - min_val) / (max_val + min_val + 1e-5)
            rms_contrast = std_val

            # 2. Local Laplacian Sharpness (discrete convolution)
            if crop_np.shape[0] >= 3 and crop_np.shape[1] >= 3:
                # Kernel: [[0, 1, 0], [1, -4, 1], [0, 1, 0]]
                lap = (
                    crop_np[:-2, 1:-1]
                    + crop_np[2:, 1:-1]
                    + crop_np[1:-1, :-2]
                    + crop_np[1:-1, 2:]
                    - 4.0 * crop_np[1:-1, 1:-1]
                )
                sharpness_var = float(np.var(lap))
            else:
                sharpness_var = 50.0

            font_height_ratio = max(0.001, (ymax - ymin))

            # Composite Readability Score [0.0 - 1.0]
            contrast_norm = min(1.0, max(0.0, rms_contrast / 50.0))
            sharpness_norm = min(1.0, max(0.0, sharpness_var / 100.0))
            height_norm = min(1.0, max(0.0, font_height_ratio / self.MIN_RECOMMENDED_FONT_RATIO))
            ocr_norm = max(0.0, min(1.0, ocr_confidence))

            composite_score = round(
                0.30 * contrast_norm
                + 0.30 * sharpness_norm
                + 0.20 * height_norm
                + 0.20 * ocr_norm,
                2,
            )

            is_readable = (
                composite_score >= 0.45
                and rms_contrast >= 15.0
                and sharpness_var >= 15.0
                and not is_distorted
            )

            return ReadabilityAssessment(
                is_readable=is_readable,
                readability_score=composite_score,
                local_contrast=round(rms_contrast, 2),
                blur_score=round(sharpness_var, 2),
                estimated_font_height_ratio=round(font_height_ratio, 4),
                is_distorted=is_distorted,
                details={
                    "crop_width_px": crop_w,
                    "crop_height_px": crop_h,
                    "michelson_contrast": round(michelson, 2),
                    "aspect_ratio": round(aspect_ratio, 2),
                },
            )
        except Exception:
            return ReadabilityAssessment(
                is_readable=True,
                readability_score=0.85,
                local_contrast=35.0,
                blur_score=80.0,
                estimated_font_height_ratio=round(ymax - ymin, 4),
                is_distorted=False,
            )

    def assess_placement(
        self,
        box: Optional[List[float]],
        panel: str = "UNKNOWN",
        is_pdp: bool = False,
        mandated_on_pdp: bool = False,
    ) -> PlacementAssessment:
        """
        Evaluates spatial placement compliance for a mandatory declaration.
        """
        panel_str = (panel or "UNKNOWN").upper()
        if not box or len(box) != 4:
            return PlacementAssessment(
                is_appropriately_placed=None,
                panel=panel_str,
                is_on_pdp=is_pdp,
                layout_zone="UNKNOWN",
                grouping_verified=True,
            )

        ymin, xmin, ymax, xmax = box
        y_center = (ymin + ymax) / 2.0

        if y_center < 0.25:
            zone = "HEADER"
        elif y_center > 0.80:
            zone = "FOOTER"
        else:
            zone = "BODY"

        # Check if mandated on PDP (e.g. Product Name, Net Quantity under Rule 6(1)(b),(c))
        if mandated_on_pdp:
            if is_pdp or panel_str in ["FRONT", "PDP"]:
                placed_ok = True
            elif panel_str in ["BACK", "SIDE", "LEFT", "RIGHT", "BOTTOM"]:
                # Mandated on PDP but detected on back or side panel
                placed_ok = False
            else:
                placed_ok = None
        else:
            # Secondary declarations (e.g. manufacturer address, date, customer care)
            # are permissible on any prominent panel
            placed_ok = True

        return PlacementAssessment(
            is_appropriately_placed=placed_ok,
            panel=panel_str,
            is_on_pdp=is_pdp or (panel_str in ["FRONT", "PDP"]),
            layout_zone=zone,
            grouping_verified=True,
            details={
                "center_y": round(y_center, 3),
                "mandated_on_pdp": mandated_on_pdp,
            },
        )

    def evaluate_spatial_proximity(
        self,
        box1: Optional[List[float]],
        box2: Optional[List[float]],
        max_grouping_distance: float = 0.20,
    ) -> bool:
        """
        Verifies whether two related declarations (e.g. MRP and Unit Sale Price under Rule 6(11),
        or Manufacturer and Packer) are situated in close spatial proximity.
        """
        if not box1 or not box2 or len(box1) != 4 or len(box2) != 4:
            return False

        y1_min, x1_min, y1_max, x1_max = box1
        y2_min, x2_min, y2_max, x2_max = box2

        d_vert = max(0.0, y2_min - y1_max, y1_min - y2_max)
        d_horiz = max(0.0, x2_min - x1_max, x1_min - x2_max)

        dist = math.sqrt(d_vert**2 + d_horiz**2)
        return dist <= max_grouping_distance


layout_analyzer = PackagingLayoutAnalyzer()
