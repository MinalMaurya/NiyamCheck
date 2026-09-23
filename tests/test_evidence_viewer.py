"""
Unit tests for Evidence Viewer data models, non-fake coordinates,
multi-declaration evidence mapping, and 4-pillar finding representations.
"""

import unittest
from backend.evidence.models import BoundingBox, EvidenceItem, RuleEvidence
from backend.evidence.mapper import evidence_mapper
from backend.schemas.analysis import (
    OCRResult,
    OCRRegion,
    ExtractedFields,
    FieldResult,
    ExtractionStatus,
    ImageQualityResult,
    ImageQualityStatus,
)
from backend.compliance.models import RuleEvaluation, RuleStatus, ComplianceResult, ComplianceStatus
from backend.compliance.rule_engine import compliance_engine
from backend.inspections.aggregator import session_aggregator
from backend.inspections.models import PanelType, InspectionImage


class TestEvidenceViewer(unittest.TestCase):
    def setUp(self):
        self.quality_ok = ImageQualityResult(status=ImageQualityStatus.GOOD, score=0.9)
        self.ocr_empty = OCRResult(text="", confidence=1.0, regions=[])

    def test_non_fake_bounding_boxes(self):
        """Verify that when OCR does not provide bounding box coordinates, None is preserved and never fabricated."""
        regions_without_boxes = [
            OCRRegion(text="MRP Rs 50.00 INCL OF ALL TAXES", confidence=0.92, box=None),
            OCRRegion(text="NET WEIGHT: 250 g", confidence=0.88, box=None),
        ]
        ocr = OCRResult(text="MRP Rs 50.00\nNET WEIGHT: 250 g", confidence=0.90, regions=regions_without_boxes)
        fields = ExtractedFields(
            mrp=FieldResult[str](status=ExtractionStatus.PRESENT, value="50.00", raw_text="MRP Rs 50.00 INCL OF ALL TAXES", confidence=0.92),
            net_quantity=FieldResult[str](status=ExtractionStatus.PRESENT, value="250 g", raw_text="NET WEIGHT: 250 g", confidence=0.88),
        )
        evals = [
            RuleEvaluation(
                rule_id="LM-MRP-001",
                name="Maximum Retail Price",
                category="Pricing",
                requirement="MRP declaration required",
                status=RuleStatus.PASS,
                reason="MRP declared",
                evidence="50.00",
                confidence=0.92,
                field="mrp",
            )
        ]
        comp = ComplianceResult(
            status=ComplianceStatus.COMPLIANT,
            summary="Pass",
            rules_checked=1,
            rules_passed=1,
            evaluations=evals,
        )
        evidence_list = evidence_mapper.map_evidence(
            ocr,
            fields,
            comp,
            image_id="img-no-box-1",
            panel=PanelType.BACK,
        )

        self.assertTrue(len(evidence_list) > 0)
        for ev in evidence_list:
            # Coordinates must be None - never invented or fake coordinates like [0,0,1,1]
            self.assertIsNone(ev.bounding_box)

    def test_valid_bounding_box_mapping(self):
        """Verify that when OCR provides bounding box coordinates, they are accurately captured in normalized coordinates."""
        regions = [
            OCRRegion(text="MRP Rs 50.00 INCL OF ALL TAXES", confidence=0.92, box=[0.25, 0.15, 0.32, 0.85]),
            OCRRegion(text="NET WT: 200g", confidence=0.95, box=[0.40, 0.20, 0.48, 0.60]),
        ]
        ocr = OCRResult(text="MRP Rs 50.00\nNET WT: 200g", confidence=0.93, regions=regions)
        fields = ExtractedFields(
            mrp=FieldResult[str](status=ExtractionStatus.PRESENT, value="50.00", raw_text="MRP Rs 50.00 INCL OF ALL TAXES", confidence=0.92),
            net_quantity=FieldResult[str](status=ExtractionStatus.PRESENT, value="200 g", raw_text="NET WT: 200g", confidence=0.95),
        )
        evals = [
            RuleEvaluation(
                rule_id="LM-MRP-001",
                name="Maximum Retail Price",
                category="Pricing",
                requirement="MRP declaration required",
                status=RuleStatus.PASS,
                reason="MRP declared",
                evidence="50.00",
                confidence=0.92,
                field="mrp",
            )
        ]
        comp = ComplianceResult(
            status=ComplianceStatus.COMPLIANT,
            summary="Pass",
            rules_checked=1,
            rules_passed=1,
            evaluations=evals,
        )
        evidence_list = evidence_mapper.map_evidence(
            ocr,
            fields,
            comp,
            image_id="img-with-box-1",
            panel=PanelType.FRONT,
        )

        mrp_ev = next((ev for ev in evidence_list if ev.rule_id == "LM-MRP-001"), None)
        self.assertIsNotNone(mrp_ev)
        self.assertIsNotNone(mrp_ev.bounding_box)
        self.assertAlmostEqual(mrp_ev.bounding_box.ymin, 0.25)
        self.assertAlmostEqual(mrp_ev.bounding_box.xmin, 0.15)
        self.assertAlmostEqual(mrp_ev.bounding_box.ymax, 0.32)
        self.assertAlmostEqual(mrp_ev.bounding_box.xmax, 0.85)
        self.assertEqual(mrp_ev.panel, PanelType.FRONT)
        self.assertEqual(mrp_ev.image_id, "img-with-box-1")

    def test_multi_declaration_evidence_resolution(self):
        """Verify evidence resolution across all major declaration types in an aggregate session."""
        front_fields = ExtractedFields(
            product_name=FieldResult[str](status=ExtractionStatus.PRESENT, value="CRUNCHY BISCUITS", confidence=0.98),
            net_quantity=FieldResult[str](status=ExtractionStatus.PRESENT, value="100 g", confidence=0.95),
        )
        front_ocr = OCRResult(
            text="CRUNCHY BISCUITS\nNET WEIGHT: 100 g",
            confidence=0.96,
            regions=[
                OCRRegion(text="CRUNCHY BISCUITS", confidence=0.98, box=[0.1, 0.1, 0.25, 0.8]),
                OCRRegion(text="NET WEIGHT: 100 g", confidence=0.95, box=[0.3, 0.1, 0.4, 0.5]),
            ],
        )
        front_comp = compliance_engine.evaluate(front_fields)
        front_ev = evidence_mapper.map_evidence(front_ocr, front_fields, front_comp, image_id="img-f", panel=PanelType.FRONT)
        img_front = InspectionImage(
            image_id="img-f",
            panel=PanelType.FRONT,
            quality=self.quality_ok,
            ocr=front_ocr,
            fields=front_fields,
            compliance=front_comp,
            evidence=front_ev,
        )

        back_fields = ExtractedFields(
            mrp=FieldResult[str](status=ExtractionStatus.PRESENT, value="25.00", confidence=0.94),
            date_information=FieldResult[str](status=ExtractionStatus.PRESENT, value="01/2026", confidence=0.90),
            manufacturer=FieldResult[str](status=ExtractionStatus.PRESENT, value="Parle Products Pvt Ltd", confidence=0.92),
            address=FieldResult[str](status=ExtractionStatus.PRESENT, value="Mumbai 400057", confidence=0.91),
            consumer_care=FieldResult[str](status=ExtractionStatus.PRESENT, value="1800-22-1234", confidence=0.93),
            country_of_origin=FieldResult[str](status=ExtractionStatus.PRESENT, value="India", confidence=0.95),
        )
        back_ocr = OCRResult(
            text="MRP Rs 25.00\nMFD 01/2026\nParle Products Pvt Ltd\nMumbai 400057\nCare: 1800-22-1234\nMade in India",
            confidence=0.93,
            regions=[
                OCRRegion(text="MRP Rs 25.00", confidence=0.94, box=[0.15, 0.1, 0.25, 0.6]),
                OCRRegion(text="MFD 01/2026", confidence=0.90, box=[0.28, 0.1, 0.35, 0.5]),
                OCRRegion(text="Parle Products Pvt Ltd", confidence=0.92, box=[0.38, 0.1, 0.48, 0.8]),
                OCRRegion(text="Mumbai 400057", confidence=0.91, box=[0.50, 0.1, 0.58, 0.8]),
                OCRRegion(text="Care: 1800-22-1234", confidence=0.93, box=[0.60, 0.1, 0.68, 0.8]),
                OCRRegion(text="Made in India", confidence=0.95, box=[0.70, 0.1, 0.78, 0.6]),
            ],
        )
        back_comp = compliance_engine.evaluate(back_fields)
        back_ev = evidence_mapper.map_evidence(back_ocr, back_fields, back_comp, image_id="img-b", panel=PanelType.BACK)
        img_back = InspectionImage(
            image_id="img-b",
            panel=PanelType.BACK,
            quality=self.quality_ok,
            ocr=back_ocr,
            fields=back_fields,
            compliance=back_comp,
            evidence=back_ev,
        )

        session = session_aggregator.aggregate_session([img_front, img_back], inspection_id="TEST-EV-001")
        findings = session.findings

        self.assertTrue(len(findings) > 0)
        # Verify MRP finding
        mrp_finding = next((f for f in findings if f["rule_id"] == "LM-MRP-001"), None)
        self.assertIsNotNone(mrp_finding)
        self.assertEqual(mrp_finding["package_panel"], "BACK")
        self.assertEqual(mrp_finding["source_image_id"], "img-b")
        self.assertIsNotNone(mrp_finding["bounding_box"])
        self.assertAlmostEqual(mrp_finding["bounding_box"]["ymin"], 0.15)

        # Verify Product Name finding
        pn_finding = next((f for f in findings if f["rule_id"] == "LM-PN-001"), None)
        self.assertIsNotNone(pn_finding)
        self.assertEqual(pn_finding["package_panel"], "FRONT")
        self.assertEqual(pn_finding["source_image_id"], "img-f")
        self.assertIsNotNone(pn_finding["bounding_box"])

    def test_non_pass_finding_four_pillars(self):
        """Verify that every non-pass finding includes the 4 essential pillars:
        Rule / Legal Basis, What We Found, Evidence & Analysis, Recommended Next Action.
        """
        # Create an image missing consumer care and net quantity
        fields = ExtractedFields(
            product_name=FieldResult[str](status=ExtractionStatus.PRESENT, value="TEST PRODUCT", confidence=0.9),
            # consumer_care missing
        )
        ocr = OCRResult(text="TEST PRODUCT", confidence=0.9, regions=[])
        comp = compliance_engine.evaluate(fields)
        img = InspectionImage(
            image_id="img-partial-1",
            panel=PanelType.FRONT,
            quality=self.quality_ok,
            ocr=ocr,
            fields=fields,
            compliance=comp,
            evidence=[],
        )

        session = session_aggregator.aggregate_session([img], inspection_id="TEST-PILLARS-001")
        findings = session.findings
        non_pass = [f for f in findings if f["status"] != "PASS"]

        self.assertTrue(len(non_pass) > 0)
        for finding in non_pass:
            # Pillar 1: Rule / Legal Basis
            self.assertTrue(finding.get("rule_id"), f"Missing rule_id in {finding}")
            self.assertTrue(finding.get("requirement"), f"Missing requirement in {finding}")

            # Pillar 2: What We Found
            self.assertIn("detected_value", finding)

            # Pillar 3: Evidence & Analysis
            self.assertTrue(
                finding.get("why_flagged") or finding.get("explanation"),
                f"Missing explanation/why_flagged in {finding}",
            )

            # Pillar 4: Recommended Next Action
            self.assertTrue(finding.get("what_can_i_do"), f"Missing what_can_i_do in {finding}")

            # Must NEVER be simply a bare status without explanation
            self.assertNotEqual(finding.get("why_flagged"), "FAIL")
            self.assertNotEqual(finding.get("what_can_i_do"), "FAIL")


if __name__ == "__main__":
    unittest.main()
