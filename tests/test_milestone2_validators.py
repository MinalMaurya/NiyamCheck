import unittest
from backend.schemas.analysis import FieldResult, ExtractionStatus
from backend.compliance.models import RuleStatus
import backend.compliance.validators as val


class TestMilestone2Validators(unittest.TestCase):
    def test_product_name_present(self):
        field = FieldResult[str](value="PARLE-G GLUCOSE BISCUITS", status=ExtractionStatus.PRESENT, confidence=0.95, raw_text="PARLE-G")
        status, reason, evidence, conf = val.validate_product_name(field)
        self.assertEqual(status, RuleStatus.PASS)
        self.assertIn("PARLE-G", reason)
        self.assertEqual(evidence, "PARLE-G")
        self.assertEqual(conf, 0.95)

    def test_product_name_missing(self):
        field = FieldResult[str](value=None, status=ExtractionStatus.MISSING, confidence=0.85)
        status, reason, evidence, conf = val.validate_product_name(field)
        self.assertEqual(status, RuleStatus.FAIL)
        self.assertIsNone(evidence)

    def test_product_name_unclear(self):
        field = FieldResult[str](value="SNACK", status=ExtractionStatus.UNCLEAR, confidence=0.60)
        status, reason, evidence, conf = val.validate_product_name(field)
        self.assertEqual(status, RuleStatus.UNCLEAR)

    def test_product_name_not_verifiable(self):
        field = FieldResult[str](value=None, status=ExtractionStatus.NOT_VERIFIABLE, confidence=0.0)
        status, reason, evidence, conf = val.validate_product_name(field)
        self.assertEqual(status, RuleStatus.NOT_VERIFIABLE)

    def test_net_quantity_valid_unit(self):
        # 250 g has number + unit
        field = FieldResult[str](value="250 g", status=ExtractionStatus.PRESENT, confidence=0.96, raw_text="NET WEIGHT: 250 g")
        status, reason, evidence, conf = val.validate_net_quantity(field)
        self.assertEqual(status, RuleStatus.PASS)
        self.assertEqual(evidence, "NET WEIGHT: 250 g")

    def test_net_quantity_bare_number_without_unit_fails(self):
        # Bare "250" has number but NO unit -> must FAIL
        field = FieldResult[str](value="250", status=ExtractionStatus.PRESENT, confidence=0.90, raw_text="250")
        status, reason, evidence, conf = val.validate_net_quantity(field)
        self.assertEqual(status, RuleStatus.FAIL)
        self.assertIn("lacks a mandatory standard unit", reason)

    def test_net_quantity_missing(self):
        field = FieldResult[str](value=None, status=ExtractionStatus.MISSING, confidence=0.85)
        status, reason, evidence, conf = val.validate_net_quantity(field)
        self.assertEqual(status, RuleStatus.FAIL)

    def test_mrp_present(self):
        field = FieldResult[str](value="₹ 30.00 (incl. of all taxes)", status=ExtractionStatus.PRESENT, confidence=0.97, raw_text="MRP Rs. 30.00")
        status, reason, evidence, conf = val.validate_mrp(field)
        self.assertEqual(status, RuleStatus.PASS)
        self.assertEqual(evidence, "MRP Rs. 30.00")

    def test_mrp_unclear(self):
        field = FieldResult[str](value="₹ 30.00", status=ExtractionStatus.UNCLEAR, confidence=0.70)
        status, reason, evidence, conf = val.validate_mrp(field)
        self.assertEqual(status, RuleStatus.UNCLEAR)

    def test_mrp_missing(self):
        field = FieldResult[str](value=None, status=ExtractionStatus.MISSING, confidence=0.85)
        status, reason, evidence, conf = val.validate_mrp(field)
        self.assertEqual(status, RuleStatus.FAIL)

    def test_manufacturer_present(self):
        field = FieldResult[str](value="BRITANNIA INDUSTRIES LTD", status=ExtractionStatus.PRESENT, confidence=0.92)
        status, reason, evidence, conf = val.validate_manufacturer(field)
        self.assertEqual(status, RuleStatus.PASS)

    def test_manufacturer_missing(self):
        field = FieldResult[str](value=None, status=ExtractionStatus.MISSING, confidence=0.85)
        status, reason, evidence, conf = val.validate_manufacturer(field)
        self.assertEqual(status, RuleStatus.FAIL)

    def test_address_present(self):
        field = FieldResult[str](value="KOLKATA - 700017, WEST BENGAL", status=ExtractionStatus.PRESENT, confidence=0.90)
        status, reason, evidence, conf = val.validate_address(field)
        self.assertEqual(status, RuleStatus.PASS)

    def test_address_unclear(self):
        field = FieldResult[str](value="PIN: 700017", status=ExtractionStatus.UNCLEAR, confidence=0.65)
        status, reason, evidence, conf = val.validate_address(field)
        self.assertEqual(status, RuleStatus.UNCLEAR)

    def test_dates_present(self):
        field = FieldResult[str](value="MFD. DATE: 08/2026", status=ExtractionStatus.PRESENT, confidence=0.95)
        status, reason, evidence, conf = val.validate_dates(field)
        self.assertEqual(status, RuleStatus.PASS)

    def test_consumer_care_present(self):
        field = FieldResult[str](value="Phone: 1800-22-7799, Email: CARE@BRAND.COM", status=ExtractionStatus.PRESENT, confidence=0.95)
        status, reason, evidence, conf = val.validate_consumer_care(field)
        self.assertEqual(status, RuleStatus.PASS)

    def test_country_of_origin_present(self):
        field = FieldResult[str](value="INDIA", status=ExtractionStatus.PRESENT, confidence=0.98)
        status, reason, evidence, conf = val.validate_country_of_origin(field)
        self.assertEqual(status, RuleStatus.PASS)

    def test_country_of_origin_not_applicable(self):
        field = FieldResult[str](value=None, status=ExtractionStatus.NOT_APPLICABLE, confidence=1.0)
        status, reason, evidence, conf = val.validate_country_of_origin(field)
        self.assertEqual(status, RuleStatus.NOT_APPLICABLE)


if __name__ == "__main__":
    unittest.main()
