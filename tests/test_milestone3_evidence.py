import unittest
from backend.evidence.models import BoundingBox, EvidenceItem, RuleEvidence
from backend.evidence.matching import normalize_text, find_matching_region
from backend.evidence.mapper import evidence_mapper
from backend.schemas.analysis import OCRResult, OCRRegion, ExtractedFields, FieldResult, ExtractionStatus
from backend.compliance.models import ComplianceResult, ComplianceStatus, RuleEvaluation, RuleStatus


class TestMilestone3Evidence(unittest.TestCase):
    def test_normalize_text(self):
        self.assertEqual(normalize_text("  M.R.P.  Rs. 100.00/-  "), "m r p rs 100 00")
        self.assertEqual(normalize_text("Net Qty: 500g!"), "net qty 500g")
        self.assertEqual(normalize_text(""), "")
        self.assertEqual(normalize_text(None), "")

    def test_bounding_box_properties(self):
        bbox = BoundingBox(ymin=0.1, xmin=0.2, ymax=0.4, xmax=0.7)
        self.assertAlmostEqual(bbox.x, 0.2)
        self.assertAlmostEqual(bbox.y, 0.1)
        self.assertAlmostEqual(bbox.width, 0.5)
        self.assertAlmostEqual(bbox.height, 0.3)

    def test_find_matching_region(self):
        regions = [
            OCRRegion(text="PARLE-G BISCUITS", confidence=0.98, box=[0.1, 0.1, 0.2, 0.8]),
            OCRRegion(text="NET WEIGHT 100 g", confidence=0.95, box=[0.3, 0.1, 0.4, 0.5]),
        ]
        # Exact match
        match = find_matching_region("PARLE-G BISCUITS", regions)
        self.assertIsNotNone(match)
        reg, box = match
        self.assertEqual(reg.text, "PARLE-G BISCUITS")
        self.assertAlmostEqual(reg.confidence, 0.98)
        self.assertAlmostEqual(box.ymin, 0.1)

        # Substring match
        match2 = find_matching_region("100 g", regions)
        self.assertIsNotNone(match2)
        reg2, box2 = match2
        self.assertEqual(reg2.text, "NET WEIGHT 100 g")

        # No match should not fabricate
        match3 = find_matching_region("XYZ UNKNOWN STRING", regions)
        self.assertIsNone(match3)

    def test_rule_evidence_string_backward_compatibility(self):
        rev = RuleEvidence(
            text="BRITANNIA BISCUITS",
            image_id="img-001",
            bounding_box=BoundingBox(ymin=0.1, xmin=0.1, ymax=0.2, xmax=0.8),
            confidence=0.95,
            panel="FRONT",
        )
        # Should compare equal to raw string
        self.assertEqual(rev, "BRITANNIA BISCUITS")
        self.assertEqual(str(rev), "BRITANNIA BISCUITS")
        self.assertNotEqual(rev, "OTHER TEXT")

    def test_evidence_mapper(self):
        regions = [
            OCRRegion(text="PARLE-G BISCUITS", confidence=0.98, box=[0.1, 0.1, 0.2, 0.8]),
            OCRRegion(text="NET WEIGHT 100 g", confidence=0.95, box=[0.3, 0.1, 0.4, 0.5]),
        ]
        ocr = OCRResult(text="PARLE-G BISCUITS\nNET WEIGHT 100 g", confidence=0.96, regions=regions)
        fields = ExtractedFields(
            product_name=FieldResult[str](status=ExtractionStatus.PRESENT, value="PARLE-G BISCUITS", raw_text="PARLE-G BISCUITS", confidence=0.98),
            net_quantity=FieldResult[str](status=ExtractionStatus.PRESENT, value="100 g", raw_text="NET WEIGHT 100 g", confidence=0.95),
            mrp=FieldResult[str](status=ExtractionStatus.NOT_VERIFIABLE, confidence=0.0),
        )
        evals = [
            RuleEvaluation(
                rule_id="LM-PN-001",
                name="Product Identity",
                category="Product Identification",
                requirement="Generic product name",
                status=RuleStatus.PASS,
                reason="Detected",
                evidence="PARLE-G BISCUITS",
                confidence=0.98,
                field="product_name",
            ),
            RuleEvaluation(
                rule_id="LM-MRP-001",
                name="MRP",
                category="Pricing",
                requirement="MRP declaration",
                status=RuleStatus.NOT_VERIFIABLE,
                reason="Not visible",
                evidence=None,
                confidence=0.0,
                field="mrp",
            ),
        ]
        comp = ComplianceResult(
            status=ComplianceStatus.PARTIALLY_VERIFIABLE,
            summary="Partial scan",
            rules_checked=2,
            rules_passed=1,
            rules_failed=0,
            rules_unclear=0,
            rules_not_verifiable=1,
            rules_not_applicable=0,
            evaluations=evals,
            findings=[],
        )

        items = evidence_mapper.map_evidence(ocr, fields, comp, image_id="img-001", panel="FRONT")
        # Should have mapped product_name with valid bounding box
        self.assertGreaterEqual(len(items), 1)
        pn_item = next((i for i in items if i.field == "product_name"), None)
        self.assertIsNotNone(pn_item)
        self.assertEqual(pn_item.image_id, "img-001")
        self.assertEqual(pn_item.panel, "FRONT")
        self.assertAlmostEqual(pn_item.bounding_box.ymin, 0.1)

        # In comp.evaluations, ev.evidence should now be a RuleEvidence
        pn_eval = next(e for e in comp.evaluations if e.rule_id == "LM-PN-001")
        self.assertIsInstance(pn_eval.evidence, RuleEvidence)
        self.assertEqual(pn_eval.evidence.text, "PARLE-G BISCUITS")
        # And backward compatible with string
        self.assertEqual(pn_eval.evidence, "PARLE-G BISCUITS")


if __name__ == "__main__":
    unittest.main()
