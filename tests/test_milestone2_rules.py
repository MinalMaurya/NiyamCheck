import unittest
from backend.compliance.rules import DEFAULT_RULES, RULE_VALIDATOR_MAP
from backend.compliance.models import RuleStatus
from backend.schemas.analysis import FieldResult, ExtractionStatus


class TestMilestone2Rules(unittest.TestCase):
    def test_default_rules_count_and_mapping(self):
        """Ensure all 8 rules exist and have registered validators."""
        self.assertEqual(len(DEFAULT_RULES), 8)
        rule_ids = [r.rule_id for r in DEFAULT_RULES]
        expected_ids = [
            "LM-PN-001", "LM-NQ-001", "LM-MRP-001", "LM-MFG-001",
            "LM-ADDR-001", "LM-DATE-001", "LM-CARE-001", "LM-COO-001"
        ]
        for eid in expected_ids:
            self.assertIn(eid, rule_ids)
            self.assertIn(eid, RULE_VALIDATOR_MAP)

    def test_rule_metadata_integrity(self):
        for rule in DEFAULT_RULES:
            self.assertTrue(rule.rule_id.startswith("LM-"))
            self.assertTrue(len(rule.name) > 0)
            self.assertTrue(len(rule.requirement) > 0)
            self.assertTrue(len(rule.field_name) > 0)

    def test_all_rules_with_present_fields(self):
        """When all fields are PRESENT with valid content, all rules should evaluate to PASS."""
        sample_inputs = {
            "LM-PN-001": FieldResult[str](value="BISCUITS", status=ExtractionStatus.PRESENT, confidence=0.9),
            "LM-NQ-001": FieldResult[str](value="200 g", status=ExtractionStatus.PRESENT, confidence=0.9),
            "LM-MRP-001": FieldResult[str](value="₹ 40.00", status=ExtractionStatus.PRESENT, confidence=0.9),
            "LM-MFG-001": FieldResult[str](value="PARLE", status=ExtractionStatus.PRESENT, confidence=0.9),
            "LM-ADDR-001": FieldResult[str](value="MUMBAI - 400057", status=ExtractionStatus.PRESENT, confidence=0.9),
            "LM-DATE-001": FieldResult[str](value="MFD: 08/2026", status=ExtractionStatus.PRESENT, confidence=0.9),
            "LM-CARE-001": FieldResult[str](value="CALL 1800-22-7799", status=ExtractionStatus.PRESENT, confidence=0.9),
            "LM-COO-001": FieldResult[str](value="INDIA", status=ExtractionStatus.PRESENT, confidence=0.9),
        }

        for rule in DEFAULT_RULES:
            validator = RULE_VALIDATOR_MAP[rule.rule_id]
            field_data = sample_inputs[rule.rule_id]
            status, reason, evidence, conf = validator(field_data)
            self.assertEqual(status, RuleStatus.PASS, f"Rule {rule.rule_id} did not pass.")
            self.assertIsNotNone(evidence)
            self.assertGreater(conf, 0.0)


if __name__ == "__main__":
    unittest.main()
