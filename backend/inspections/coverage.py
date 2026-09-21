from typing import List, Dict, Set, Optional, Tuple
from backend.inspections.models import PanelType, PanelCoverageItem, InspectionCoverage, InspectionImage

# Standard 6-panel packaging angles under Legal Metrology inspection guidelines
STANDARD_6_PANELS: List[Tuple[PanelType, str]] = [
    (PanelType.FRONT, "Front"),
    (PanelType.BACK, "Back"),
    (PanelType.LEFT, "Left"),
    (PanelType.RIGHT, "Right"),
    (PanelType.TOP, "Top"),
    (PanelType.BOTTOM, "Bottom"),
]

# Statutory and customary panel location expectations under Legal Metrology Rules, 2011
# Rule 6 & 7 mandate PDP for generic name and net quantity; information panel for manufacturer/packer/contact.
RULE_EXPECTED_PANELS: Dict[str, List[PanelType]] = {
    "LM-PN-001": [PanelType.FRONT, PanelType.TOP],  # Generic name on Principal Display Panel (Front, or Top lid)
    "LM-NQ-001": [PanelType.FRONT, PanelType.TOP],  # Net quantity on Principal Display Panel
    "LM-MRP-001": [
        PanelType.FRONT,
        PanelType.BACK,
        PanelType.LEFT,
        PanelType.RIGHT,
        PanelType.TOP,
        PanelType.BOTTOM,
    ],  # MRP may be placed on PDP or secondary panel
    "LM-MFG-001": [
        PanelType.BACK,
        PanelType.LEFT,
        PanelType.RIGHT,
        PanelType.BOTTOM,
    ],  # Information panel
    "LM-ADDR-001": [
        PanelType.BACK,
        PanelType.LEFT,
        PanelType.RIGHT,
        PanelType.BOTTOM,
    ],  # Information panel alongside manufacturer
    "LM-DATE-001": [
        PanelType.BACK,
        PanelType.TOP,
        PanelType.BOTTOM,
        PanelType.LEFT,
        PanelType.RIGHT,
    ],  # Crimp, seal, bottom, top or back
    "LM-CARE-001": [
        PanelType.BACK,
        PanelType.LEFT,
        PanelType.RIGHT,
    ],  # Grievance / consumer care panel
    "LM-COO-001": [
        PanelType.BACK,
        PanelType.LEFT,
        PanelType.RIGHT,
        PanelType.FRONT,
    ],  # Country of origin
}

# Plain-language description of expected panels for consumer / inspector feedback
RULE_EXPECTED_PANEL_DESCRIPTIONS: Dict[str, str] = {
    "LM-PN-001": "Front (Principal Display Panel)",
    "LM-NQ-001": "Front (Principal Display Panel)",
    "LM-MRP-001": "Front or Back panel",
    "LM-MFG-001": "Back, Left, or Right panel",
    "LM-ADDR-001": "Back, Left, or Right panel",
    "LM-DATE-001": "Back, Top, or Bottom panel",
    "LM-CARE-001": "Back or Side panel",
    "LM-COO-001": "Back, Side, or Front panel",
}


def get_expected_panels_for_rule(rule_id: str) -> List[PanelType]:
    """Returns the package panels where a declaration is normally expected."""
    return RULE_EXPECTED_PANELS.get(
        rule_id,
        [PanelType.FRONT, PanelType.BACK],
    )


def get_expected_panel_description(rule_id: str) -> str:
    """Returns human-readable description of expected panel location for this rule."""
    return RULE_EXPECTED_PANEL_DESCRIPTIONS.get(
        rule_id,
        "Front or Back panel",
    )


def is_rule_panel_captured(rule_id: str, captured_panels: Set[PanelType]) -> bool:
    """
    Checks if at least one panel where the declaration is normally expected
    has been captured in the current inspection session.
    """
    expected = get_expected_panels_for_rule(rule_id)
    return any(p in captured_panels for p in expected)


def compute_inspection_coverage(images: List[InspectionImage]) -> InspectionCoverage:
    """
    Calculates empirical packaging panel coverage across the standard 6 angles
    (Front, Back, Left, Right, Top, Bottom) based on submitted images.
    """
    panel_items: List[PanelCoverageItem] = []
    captured_names: List[str] = []
    missing_names: List[str] = []

    # Map images by panel type
    images_by_panel: Dict[PanelType, List[InspectionImage]] = {}
    for img in images:
        p = img.panel
        if p not in images_by_panel:
            images_by_panel[p] = []
        images_by_panel[p].append(img)

    for panel_type, panel_name in STANDARD_6_PANELS:
        matched = images_by_panel.get(panel_type, [])
        is_captured = len(matched) > 0

        # Find rules normally expecting this panel
        expected_rules = [
            r_id for r_id, p_list in RULE_EXPECTED_PANELS.items()
            if panel_type in p_list
        ]

        if is_captured:
            primary_img = matched[0]
            total_words = sum(
                (getattr(img.ocr, "word_count", None) or len(img.ocr.text.split()))
                for img in matched
                if img.ocr and img.ocr.text
            )
            avg_conf = (
                sum(img.ocr.confidence for img in matched if img.ocr and img.ocr.confidence) / len(matched)
                if matched
                else 0.0
            )

            panel_items.append(
                PanelCoverageItem(
                    panel=panel_type,
                    panel_name=panel_name,
                    is_captured=True,
                    image_id=primary_img.image_id,
                    upload_status="captured",
                    ocr_status="completed" if total_words > 0 else "empty",
                    word_count=total_words,
                    confidence=round(avg_conf, 2),
                    expected_declarations=expected_rules,
                )
            )
            captured_names.append(panel_name)
        else:
            panel_items.append(
                PanelCoverageItem(
                    panel=panel_type,
                    panel_name=panel_name,
                    is_captured=False,
                    image_id=None,
                    upload_status="not_captured",
                    ocr_status="not_available",
                    word_count=0,
                    confidence=0.0,
                    expected_declarations=expected_rules,
                )
            )
            missing_names.append(panel_name)

    panels_captured_count = len(captured_names)
    coverage_pct = round((panels_captured_count / 6.0) * 100.0, 1)
    is_complete = panels_captured_count == 6

    return InspectionCoverage(
        total_panels_expected=6,
        panels_captured=panels_captured_count,
        coverage_percentage=coverage_pct,
        is_complete=is_complete,
        panels=panel_items,
        captured_panels=captured_names,
        missing_panels=missing_names,
        summary=f"{panels_captured_count} / 6 panels captured",
    )
