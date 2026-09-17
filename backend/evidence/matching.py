import re
from typing import List, Optional, Tuple
from backend.schemas.analysis import OCRRegion
from backend.evidence.models import BoundingBox


def normalize_text(text: str) -> str:
    """Normalizes string for robust, deterministic matching without fuzzy hallucinations."""
    if not text:
        return ""
    # Lowercase
    t = text.lower()
    # Replace non-alphanumeric chars with single space (preserves digits and letters)
    t = re.sub(r"[^\w\d]+", " ", t)
    # Collapse multiple whitespaces
    return " ".join(t.split())


def find_matching_region(
    target_text: str,
    regions: List[OCRRegion],
) -> Optional[Tuple[OCRRegion, BoundingBox]]:
    """
    Deterministically matches a target extracted text to its corresponding OCR region.
    Returns (matched_region, BoundingBox) or None if not locatable.
    """
    if not target_text or not regions:
        return None

    norm_target = normalize_text(target_text)
    if not norm_target:
        return None

    target_tokens = set(norm_target.split())

    best_region: Optional[OCRRegion] = None
    best_score = 0.0

    for region in regions:
        if not region.text:
            continue
        norm_region = normalize_text(region.text)
        if not norm_region:
            continue

        # 1. Exact or direct substring match
        if norm_target in norm_region or norm_region in norm_target:
            score = 100.0 + min(len(norm_region), len(norm_target))
            if score > best_score:
                best_score = score
                best_region = region
                continue

        # 2. Token overlap match (e.g., matching "250 g" or "400057" or "1800 22 7799")
        region_tokens = set(norm_region.split())
        common = target_tokens.intersection(region_tokens)

        # Ignore trivial stop-word overlaps
        meaningful_common = {tok for tok in common if len(tok) > 1 and tok not in {"the", "and", "for", "by", "of", "in"}}
        if meaningful_common:
            # Overlap ratio relative to smaller token set
            overlap_score = len(meaningful_common) / max(1, min(len(target_tokens), len(region_tokens)))
            if overlap_score >= 0.5:
                score = overlap_score * 50.0 + len(meaningful_common)
                if score > best_score:
                    best_score = score
                    best_region = region

    if best_region is not None and best_region.box and len(best_region.box) == 4:
        ymin, xmin, ymax, xmax = best_region.box
        bbox = BoundingBox(
            ymin=round(float(ymin), 4),
            xmin=round(float(xmin), 4),
            ymax=round(float(ymax), 4),
            xmax=round(float(xmax), 4),
        )
        return best_region, bbox

    return None
