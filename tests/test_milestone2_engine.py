import unittest
from backend.schemas.analysis import ExtractedFields, FieldResult, ExtractionStatus
from backend.compliance.models import ComplianceStatus, RuleStatus
from backend.compliance.rule_engine import ComplianceRuleEngine


def build_fully_compliant_fields() -> ExtractedFields:
    return ExtractedFields(
        product_name=FieldResult[str](value="BRITANNIA BISCUITS", status=ExtractionStatus.PRESENT, confidence=0.95, raw_text="BRITANNIA BISCUITS"),
        manufacturer=FieldResult[str](value="BRITANNIA INDUSTRIES LTD", status=ExtractionStatus.PRESENT, confidence=0.92, raw_text="MFD BY: BRITANNIA"),
        address=FieldResult[str](value="KOLKATA - 700017", status=ExtractionStatus.PRESENT, confidence=0.90, raw_text="KOLKATA - 700017"),
        net_quantity=FieldResult[str](value="200 g", status=ExtractionStatus.PRESENT, confidence=0.96, raw_text="NET WEIGHT: 200 g"),
        mrp=FieldResult[str](value="₹ 40.00 (incl. of all taxes)", status=ExtractionStatus.PRESENT, confidence=0.96, raw_text="MRP Rs. 40.00"),
        date_information=FieldResult[str](value="MFD. 08/2026", status=ExtractionStatus.PRESENT, confidence=0.95, raw_text="MFD. 08/2026"),
        consumer_care=FieldResult[str](value="Phone: 1800-425-4449", status=ExtractionStatus.PRESENT, confidence=0.95, raw_text="CALL 1800-425-4449"),
        country_of_origin=FieldResult[str](value="INDIA", status=ExtractionStatus.PRESENT, confidence=0.98, raw_text="MADE IN INDIA"),
    )


class TestMilestone2Engine(unittest.TestCase):
    def setUp(self):
        self.engine = ComplianceRuleEngine()

    def test_all_rules_pass_yields_compliant(self):
        fields = build_fully_compliant_fields()
        result = self.engine.evaluate(fields)

        self.assertEqual(result.status, ComplianceStatus.COMPLIANT)
        self.assertEqual(result.rules_checked, 8)
        self.assertEqual(result.rules_passed, 8)
        self.assertEqual(result.rules_failed, 0)
        self.assertEqual(result.rules_unclear, 0)
        self.assertEqual(result.rules_not_verifiable, 0)
        self.assertIn("all 8 checked baseline requirements were satisfied", result.summary)

    def test_one_confirmed_failure_yields_non_compliant(self):
        fields = build_fully_compliant_fields()
        # Mark MRP as MISSING
        fields.mrp = FieldResult[str](value=None, status=ExtractionStatus.MISSING, confidence=0.90)

        result = self.engine.evaluate(fields)
        self.assertEqual(result.status, ComplianceStatus.NON_COMPLIANT)
        self.assertGreater(result.rules_failed, 0)
        self.assertEqual(result.rules_passed, 7)
        self.assertIn("1 confirmed issue", result.summary)

    def test_quantity_missing_unit_yields_non_compliant(self):
        fields = build_fully_compliant_fields()
        # Quantity without standard unit: e.g. "250"
        fields.net_quantity = FieldResult[str](value="250", status=ExtractionStatus.PRESENT, confidence=0.90, raw_text="250")

        result = self.engine.evaluate(fields)
        self.assertEqual(result.status, ComplianceStatus.NON_COMPLIANT)
        self.assertEqual(result.rules_failed, 1)

    def test_unclear_field_yields_partially_verifiable(self):
        fields = build_fully_compliant_fields()
        # Consumer care unclear
        fields.consumer_care = FieldResult[str](value="Customer Care", status=ExtractionStatus.UNCLEAR, confidence=0.60)

        result = self.engine.evaluate(fields)
        self.assertEqual(result.status, ComplianceStatus.PARTIALLY_VERIFIABLE)
        self.assertEqual(result.rules_passed, 7)
        self.assertEqual(result.rules_unclear, 1)
        self.assertEqual(result.rules_failed, 0)

    def test_not_verifiable_field_yields_partially_verifiable(self):
        fields = build_fully_compliant_fields()
        # Address not verifiable (e.g. back panel not photographed)
        fields.address = FieldResult[str](value=None, status=ExtractionStatus.NOT_VERIFIABLE, confidence=0.0)

        result = self.engine.evaluate(fields)
        self.assertEqual(result.status, ComplianceStatus.PARTIALLY_VERIFIABLE)
        self.assertEqual(result.rules_not_verifiable, 1)
        self.assertEqual(result.rules_passed, 7)

    def test_mixed_pass_unclear_not_verifiable(self):
        fields = build_fully_compliant_fields()
        fields.mrp = FieldResult[str](value="₹ 50.00", status=ExtractionStatus.UNCLEAR, confidence=0.65)
        fields.consumer_care = FieldResult[str](value=None, status=ExtractionStatus.NOT_VERIFIABLE, confidence=0.0)

        result = self.engine.evaluate(fields)
        self.assertEqual(result.status, ComplianceStatus.PARTIALLY_VERIFIABLE)
        self.assertEqual(result.rules_passed, 6)
        self.assertEqual(result.rules_unclear, 1)
        self.assertEqual(result.rules_not_verifiable, 1)
        self.assertEqual(result.rules_failed, 0)

    def test_empty_extraction_yields_not_verifiable(self):
        # Default ExtractedFields has all fields as NOT_VERIFIABLE or NOT_APPLICABLE
        empty_fields = ExtractedFields()
        result = self.engine.evaluate(empty_fields)

        self.assertEqual(result.status, ComplianceStatus.NOT_VERIFIABLE)
        self.assertEqual(result.rules_passed, 0)
        self.assertGreater(result.rules_not_verifiable, 0)

    def test_evidence_and_confidence_preservation(self):
        fields = build_fully_compliant_fields()
        result = self.engine.evaluate(fields)

        pn_eval = next(e for e in result.evaluations if e.rule_id == "LM-PN-001")
        self.assertEqual(pn_eval.status, RuleStatus.PASS)
        self.assertEqual(pn_eval.evidence, "BRITANNIA BISCUITS")
        self.assertEqual(pn_eval.confidence, 0.95)

    def test_findings_generation(self):
        fields = build_fully_compliant_fields()
        result = self.engine.evaluate(fields)

        self.assertEqual(len(result.findings), 8)
        for finding in result.findings:
            self.assertTrue(len(finding) > 0)


if __name__ == "__main__":
    unittest.main()
