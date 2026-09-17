import unittest
import io
from PIL import Image
from backend.schemas.analysis import (
    OCRResult,
    OCRRegion,
    ImageQualityResult,
    ImageQualityStatus,
    ExtractedFields,
    FieldResult,
    ExtractionStatus,
)
from backend.compliance.models import (
    ComplianceStatus,
    RuleStatus,
    RuleSeverity,
)
from backend.compliance.category_detector import (
    ProductCategoryDetector,
    ProductCategory,
    product_category_detector,
)
from backend.compliance.rules import (
    DEFAULT_RULES,
    get_applicable_rules,
)
from backend.compliance.rule_engine import ComplianceRuleEngine, compliance_engine
from backend.inspections.models import (
    InspectionImage,
    InspectionSession,
    PanelType,
)
from backend.inspections.aggregator import session_aggregator
from backend.extraction.extractor import FieldExtractor
from backend.evidence.mapper import evidence_mapper


class TestComplianceEngineRequirements(unittest.TestCase):
    """
    Comprehensive verification of the 17 core requirements for the
    Packaged Product Compliance Inspection Engine.
    """

    def setUp(self):
        self.extractor = FieldExtractor()
        self.category_detector = ProductCategoryDetector()
        self.engine = ComplianceRuleEngine()

    # -------------------------------------------------------------------------
    # Requirement 1: Packaged food with clearly detected MRP -> PASS
    # -------------------------------------------------------------------------
    def test_01_packaged_food_mrp_pass(self):
        fields = ExtractedFields(
            product_name=FieldResult[str](status=ExtractionStatus.PRESENT, value="Classic Potato Chips", confidence=0.95),
            mrp=FieldResult[str](status=ExtractionStatus.PRESENT, value="₹ 50.00 (incl. of all taxes)", raw_text="MRP Rs. 50.00 INCL. ALL TAXES", confidence=0.96),
        )
        res = self.engine.evaluate(fields, category=ProductCategory.PACKAGED_FOOD.value)
        mrp_eval = next(e for e in res.evaluations if e.rule_id == "LM-MRP-001")
        self.assertEqual(mrp_eval.status, RuleStatus.PASS)
        self.assertIn("50.00", mrp_eval.reason)
        self.assertEqual(mrp_eval.evidence, "MRP Rs. 50.00 INCL. ALL TAXES")

    # -------------------------------------------------------------------------
    # Requirement 2: Packaged food with clearly detected Net Quantity -> PASS
    # -------------------------------------------------------------------------
    def test_02_packaged_food_net_quantity_pass(self):
        fields = ExtractedFields(
            product_name=FieldResult[str](status=ExtractionStatus.PRESENT, value="Classic Potato Chips", confidence=0.95),
            net_quantity=FieldResult[str](status=ExtractionStatus.PRESENT, value="115 g", raw_text="Net Wt. 115 g", confidence=0.96),
        )
        res = self.engine.evaluate(fields, category=ProductCategory.PACKAGED_FOOD.value)
        nq_eval = next(e for e in res.evaluations if e.rule_id == "LM-NQ-001")
        self.assertEqual(nq_eval.status, RuleStatus.PASS)
        self.assertIn("115 g", nq_eval.reason)
        self.assertEqual(nq_eval.evidence, "Net Wt. 115 g")

    # -------------------------------------------------------------------------
    # Requirement 3: "Total Fat 15g" -> must NOT become Net Quantity
    # -------------------------------------------------------------------------
    def test_03_total_fat_not_net_quantity(self):
        lines = [
            "Nutrition Facts",
            "Serving size 1 package",
            "Calories 240",
            "Total Fat 15g",
            "Saturated Fat 2g",
            "Sodium 250mg",
            "Net Wt. 52 g",
        ]
        ocr = OCRResult(
            text="\n".join(lines),
            confidence=0.95,
            regions=[OCRRegion(text=l, confidence=0.95, box=[0.1, 0.1, 0.2, 0.9]) for l in lines],
        )
        extracted = self.extractor.extract(ocr)
        self.assertNotEqual(extracted.net_quantity.value, "15g")
        self.assertNotEqual(extracted.net_quantity.value, "15 g")
        self.assertEqual(extracted.net_quantity.value, "52 g")

    # -------------------------------------------------------------------------
    # Requirement 4: "Total Sugars 3g" -> must NOT become MRP
    # -------------------------------------------------------------------------
    def test_04_nutrition_sugars_not_mrp(self):
        lines = [
            "Total Carbohydrate 23g",
            "Dietary Fiber 2g",
            "Total Sugars 3g",
            "Protein 3g",
            "M.R.P. Rs. 25.00 (Incl. of all taxes)",
        ]
        ocr = OCRResult(
            text="\n".join(lines),
            confidence=0.95,
            regions=[OCRRegion(text=l, confidence=0.95, box=[0.1, 0.1, 0.2, 0.9]) for l in lines],
        )
        extracted = self.extractor.extract(ocr)
        self.assertNotIn("3", extracted.mrp.value or "")
        self.assertIn("25", extracted.mrp.value or "")

    # -------------------------------------------------------------------------
    # Requirement 5: "GUARANTEED FRESH" -> must NOT become Product Name
    # -------------------------------------------------------------------------
    def test_05_guaranteed_fresh_not_product_name(self):
        lines = [
            "GUARANTEED FRESH",
            "UNTIL PRINTED DATE",
            "CRUNCHY POTATO CRISPS",
            "Net Wt. 50 g",
        ]
        ocr = OCRResult(
            text="\n".join(lines),
            confidence=0.95,
            regions=[OCRRegion(text=l, confidence=0.95, box=[0.1, 0.1, 0.2, 0.9]) for l in lines],
        )
        extracted = self.extractor.extract(ocr)
        self.assertNotEqual(extracted.product_name.value, "GUARANTEED FRESH")
        self.assertNotEqual(extracted.product_name.value, "UNTIL PRINTED DATE")
        self.assertEqual(extracted.product_name.value, "CRUNCHY POTATO CRISPS")

    # -------------------------------------------------------------------------
    # Requirement 6: Manufacturer + address extraction -> correct evidence
    # -------------------------------------------------------------------------
    def test_06_manufacturer_and_address_evidence(self):
        lines = [
            "CRUNCHY POTATO CRISPS",
            "Manufactured by: Frito-Lay, Inc.",
            "Plano, TX 75024-4099, USA",
        ]
        ocr = OCRResult(
            text="\n".join(lines),
            confidence=0.94,
            regions=[
                OCRRegion(text=lines[0], confidence=0.95, box=[0.1, 0.1, 0.2, 0.9]),
                OCRRegion(text=lines[1], confidence=0.94, box=[0.3, 0.1, 0.4, 0.9]),
                OCRRegion(text=lines[2], confidence=0.93, box=[0.4, 0.1, 0.5, 0.9]),
            ],
        )
        extracted = self.extractor.extract(ocr)
        self.assertEqual(extracted.manufacturer.status, ExtractionStatus.PRESENT)
        self.assertIn("Frito-Lay", extracted.manufacturer.value)
        self.assertEqual(extracted.address.status, ExtractionStatus.PRESENT)
        self.assertIn("75024", extracted.address.value)

    # -------------------------------------------------------------------------
    # Requirement 7: Consumer-care phone/website detection -> correct evidence
    # -------------------------------------------------------------------------
    def test_07_consumer_care_evidence(self):
        lines = [
            "QUESTIONS OR COMMENTS?",
            "1-800-352-4477",
            "WEEKDAYS 9:00AM TO 4:30PM CT",
            "EMAIL OR CHAT AT FRITOLAY.COM",
        ]
        ocr = OCRResult(
            text="\n".join(lines),
            confidence=0.95,
            regions=[OCRRegion(text=l, confidence=0.95, box=[0.1, 0.1, 0.2, 0.9]) for l in lines],
        )
        extracted = self.extractor.extract(ocr)
        self.assertEqual(extracted.consumer_care.status, ExtractionStatus.PRESENT)
        self.assertIn("1-800-352-4477", extracted.consumer_care.value)
        self.assertIn("FRITOLAY.COM", extracted.consumer_care.value)

    # -------------------------------------------------------------------------
    # Requirement 8: Country of Origin -> correct evidence
    # -------------------------------------------------------------------------
    def test_08_country_of_origin_evidence(self):
        lines = [
            "POTATO CHIPS",
            "Country of Origin: India",
            "Net Qty: 100 g",
        ]
        ocr = OCRResult(
            text="\n".join(lines),
            confidence=0.96,
            regions=[OCRRegion(text=l, confidence=0.96, box=[0.1, 0.1, 0.2, 0.9]) for l in lines],
        )
        extracted = self.extractor.extract(ocr)
        self.assertEqual(extracted.country_of_origin.status, ExtractionStatus.PRESENT)
        self.assertEqual(extracted.country_of_origin.value, "India")

    # -------------------------------------------------------------------------
    # Requirement 9: Missing MRP -> NOT_VERIFIABLE, not POTENTIAL_ISSUE automatically
    # -------------------------------------------------------------------------
    def test_09_missing_mrp_not_verifiable_multi_panel(self):
        # When 2 panels are submitted but neither shows MRP
        fields = ExtractedFields(
            product_name=FieldResult[str](status=ExtractionStatus.PRESENT, value="Snack Mix", confidence=0.92),
            net_quantity=FieldResult[str](status=ExtractionStatus.PRESENT, value="200 g", confidence=0.95),
            manufacturer=FieldResult[str](status=ExtractionStatus.PRESENT, value="Food Corp Ltd", confidence=0.90),
        )
        img1 = InspectionImage(
            image_id="img-front",
            panel=PanelType.FRONT,
            quality=ImageQualityResult(status=ImageQualityStatus.GOOD, score=0.9),
            ocr=OCRResult(text="Snack Mix\n200 g", confidence=0.92, regions=[]),
            fields=fields,
            compliance=compliance_engine.evaluate(fields),
        )
        img2 = InspectionImage(
            image_id="img-back",
            panel=PanelType.BACK,
            quality=ImageQualityResult(status=ImageQualityStatus.GOOD, score=0.9),
            ocr=OCRResult(text="Food Corp Ltd\nIngredients: wheat, salt", confidence=0.90, regions=[]),
            fields=fields,
            compliance=compliance_engine.evaluate(fields),
        )
        session = session_aggregator.aggregate_session([img1, img2])
        mrp_ev = next(e for e in session.compliance.evaluations if e.rule_id == "LM-MRP-001")
        self.assertEqual(mrp_ev.status, RuleStatus.NOT_VERIFIABLE)
        self.assertNotIn("violation", mrp_ev.reason.lower())
        self.assertIn("cannot be verified", mrp_ev.reason.lower())

    # -------------------------------------------------------------------------
    # Requirement 10: Missing Consumer Care -> REVIEW/NOT_VERIFIABLE, not automatic violation
    # -------------------------------------------------------------------------
    def test_10_missing_consumer_care_non_accusatory(self):
        # Single-panel scan: must be REVIEW with guidance
        fields = ExtractedFields(
            product_name=FieldResult[str](status=ExtractionStatus.PRESENT, value="Snack Mix", confidence=0.92),
            net_quantity=FieldResult[str](status=ExtractionStatus.PRESENT, value="200 g", confidence=0.95),
        )
        img_single = InspectionImage(
            image_id="img-front",
            panel=PanelType.FRONT,
            quality=ImageQualityResult(status=ImageQualityStatus.GOOD, score=0.9),
            ocr=OCRResult(text="Snack Mix\n200 g", confidence=0.92, regions=[]),
            fields=fields,
            compliance=compliance_engine.evaluate(fields),
        )
        session = session_aggregator.aggregate_session([img_single])
        care_ev = next(e for e in session.compliance.evaluations if e.rule_id == "LM-CARE-001")
        self.assertEqual(care_ev.status, RuleStatus.REVIEW)
        self.assertIn("Only one package panel was submitted", care_ev.reason)

    # -------------------------------------------------------------------------
    # Requirement 11: Ambiguous OCR -> REVIEW
    # -------------------------------------------------------------------------
    def test_11_ambiguous_ocr_yields_review(self):
        fields = ExtractedFields(
            product_name=FieldResult[str](status=ExtractionStatus.UNCLEAR, value="Candidate Name", confidence=0.55),
            mrp=FieldResult[str](status=ExtractionStatus.UNCLEAR, value="₹ 45", confidence=0.60),
        )
        img = InspectionImage(
            image_id="img-front",
            panel=PanelType.FRONT,
            quality=ImageQualityResult(status=ImageQualityStatus.GOOD, score=0.85),
            ocr=OCRResult(text="Candidate Name\n₹ 45", confidence=0.55, regions=[]),
            fields=fields,
            compliance=compliance_engine.evaluate(fields),
        )
        session = session_aggregator.aggregate_session([img])
        mrp_ev = next(e for e in session.compliance.evaluations if e.rule_id == "LM-MRP-001")
        self.assertEqual(mrp_ev.status, RuleStatus.REVIEW)
        self.assertIn("ambiguous", mrp_ev.why_flagged.lower())

    # -------------------------------------------------------------------------
    # Requirement 12: Evidence must point to the correct image/panel
    # -------------------------------------------------------------------------
    def test_12_evidence_points_to_correct_image_and_panel(self):
        fields_front = ExtractedFields(
            product_name=FieldResult[str](status=ExtractionStatus.PRESENT, value="CRUNCHY CHIPS", confidence=0.95),
        )
        fields_back = ExtractedFields(
            mrp=FieldResult[str](status=ExtractionStatus.PRESENT, value="₹ 30.00", confidence=0.96),
        )
        ocr_front = OCRResult(text="CRUNCHY CHIPS", confidence=0.95, regions=[
            OCRRegion(text="CRUNCHY CHIPS", confidence=0.95, box=[0.1, 0.1, 0.3, 0.8])
        ])
        ocr_back = OCRResult(text="MRP Rs. 30.00", confidence=0.96, regions=[
            OCRRegion(text="MRP Rs. 30.00", confidence=0.96, box=[0.7, 0.2, 0.8, 0.7])
        ])

        ev_front = evidence_mapper.map_evidence(
            ocr_front, fields_front, compliance_engine.evaluate(fields_front), image_id="img-001", panel="FRONT"
        )
        ev_back = evidence_mapper.map_evidence(
            ocr_back, fields_back, compliance_engine.evaluate(fields_back), image_id="img-002", panel="BACK"
        )

        img1 = InspectionImage(
            image_id="img-001", panel=PanelType.FRONT,
            quality=ImageQualityResult(status=ImageQualityStatus.GOOD, score=0.9),
            ocr=ocr_front, fields=fields_front,
            compliance=compliance_engine.evaluate(fields_front), evidence=ev_front,
        )
        img2 = InspectionImage(
            image_id="img-002", panel=PanelType.BACK,
            quality=ImageQualityResult(status=ImageQualityStatus.GOOD, score=0.9),
            ocr=ocr_back, fields=fields_back,
            compliance=compliance_engine.evaluate(fields_back), evidence=ev_back,
        )
        session = session_aggregator.aggregate_session([img1, img2])
        mrp_ev = next(e for e in session.compliance.evaluations if e.rule_id == "LM-MRP-001")
        self.assertEqual(mrp_ev.package_panel, "BACK")
        self.assertEqual(mrp_ev.evidence.image_id, "img-002")

    # -------------------------------------------------------------------------
    # Requirement 13: Multiple images -> evidence can be aggregated across panels
    # -------------------------------------------------------------------------
    def test_13_multi_panel_evidence_aggregation(self):
        fields_front = ExtractedFields(
            product_name=FieldResult[str](status=ExtractionStatus.PRESENT, value="ALOO BHUJIA", confidence=0.95),
            net_quantity=FieldResult[str](status=ExtractionStatus.PRESENT, value="400 g", confidence=0.95),
        )
        fields_back = ExtractedFields(
            mrp=FieldResult[str](status=ExtractionStatus.PRESENT, value="₹ 95.00 (incl. of all taxes)", confidence=0.97),
            manufacturer=FieldResult[str](status=ExtractionStatus.PRESENT, value="DESI SNACKS PVT LTD", confidence=0.93),
        )
        img1 = InspectionImage(
            image_id="img-f", panel=PanelType.FRONT,
            quality=ImageQualityResult(status=ImageQualityStatus.GOOD, score=0.9),
            ocr=OCRResult(text="ALOO BHUJIA\n400 g", confidence=0.95, regions=[]),
            fields=fields_front, compliance=compliance_engine.evaluate(fields_front),
        )
        img2 = InspectionImage(
            image_id="img-b", panel=PanelType.BACK,
            quality=ImageQualityResult(status=ImageQualityStatus.GOOD, score=0.9),
            ocr=OCRResult(text="MRP Rs. 95.00\nDESI SNACKS PVT LTD", confidence=0.95, regions=[]),
            fields=fields_back, compliance=compliance_engine.evaluate(fields_back),
        )
        session = session_aggregator.aggregate_session([img1, img2])
        self.assertEqual(session.combined_fields.product_name.value, "ALOO BHUJIA")
        self.assertEqual(session.combined_fields.net_quantity.value, "400 g")
        self.assertEqual(session.combined_fields.mrp.value, "₹ 95.00 (incl. of all taxes)")
        self.assertEqual(session.combined_fields.manufacturer.value, "DESI SNACKS PVT LTD")

    # -------------------------------------------------------------------------
    # Requirement 14: Unseen package panel -> must not be treated as evidence
    # -------------------------------------------------------------------------
    def test_14_unseen_panel_not_treated_as_evidence(self):
        fields = ExtractedFields(
            product_name=FieldResult[str](status=ExtractionStatus.PRESENT, value="WHEAT FLOUR", confidence=0.95),
        )
        img = InspectionImage(
            image_id="img-001", panel=PanelType.FRONT,
            quality=ImageQualityResult(status=ImageQualityStatus.GOOD, score=0.9),
            ocr=OCRResult(text="WHEAT FLOUR", confidence=0.95, regions=[]),
            fields=fields, compliance=compliance_engine.evaluate(fields),
        )
        session = session_aggregator.aggregate_session([img])
        mfg_ev = next(e for e in session.compliance.evaluations if e.rule_id == "LM-MFG-001")
        self.assertIsNone(mfg_ev.evidence)
        self.assertIsNone(mfg_ev.detected_value)
        self.assertNotEqual(mfg_ev.status, RuleStatus.PASS)

    # -------------------------------------------------------------------------
    # Requirement 15: Different product categories -> requirements selected via Legal KB
    # -------------------------------------------------------------------------
    def test_15_different_product_categories_generic(self):
        # 1. Food product category
        food_text = "Nutrition Facts\nCalories 150\nTotal Fat 8g\nIngredients: wheat flour, sugar, salt, palm oil\nCrispy Wafers"
        cat_food = self.category_detector.detect(combined_text=food_text)
        self.assertEqual(cat_food.category, ProductCategory.PACKAGED_FOOD.value)
        self.assertTrue(cat_food.confidence >= 0.70)

        # 2. Personal Care category
        cosmetic_text = "Herbal Shampoo\nFor external use only\nDermatologically tested\nSmooth and shiny hair"
        cat_cosm = self.category_detector.detect(combined_text=cosmetic_text)
        self.assertEqual(cat_cosm.category, ProductCategory.PERSONAL_CARE.value)

        # 3. Household & Cleaning category
        clean_text = "Disinfectant Surface Cleaner\nBleach formula\nFloor and bathroom cleaner"
        cat_clean = self.category_detector.detect(combined_text=clean_text)
        self.assertEqual(cat_clean.category, ProductCategory.HOUSEHOLD_CLEANING.value)

        # 4. General Commodity category (no food/cosmetic/cleaning signals)
        commodity_text = "USB Type-C Fast Charging Cable\nLength 1.5m\nBraided Nylon"
        cat_comm = self.category_detector.detect(combined_text=commodity_text)
        self.assertEqual(cat_comm.category, ProductCategory.OTHER_COMMODITY.value)

        # 5. Applicable rules from Legal KB
        rules_food = get_applicable_rules(ProductCategory.PACKAGED_FOOD.value)
        rules_comm = get_applicable_rules(ProductCategory.OTHER_COMMODITY.value)
        self.assertTrue(len(rules_food) >= 8)
        self.assertTrue(len(rules_comm) >= 8)

    # -------------------------------------------------------------------------
    # Requirement 16: No Parle-G/demo values enter real inspection unless on package
    # -------------------------------------------------------------------------
    def test_16_no_demo_parle_g_leakage_in_real_inspection(self):
        real_lines = [
            "CHIPS DELIGHT",
            "NET WEIGHT: 60 g",
            "M.R.P. Rs. 35.00 (INCL. ALL TAXES)",
            "MANUFACTURED BY: SUNNY FOODS PVT LTD",
            "GURGAON - 122001, HARYANA",
            "CUSTOMER SUPPORT: 1800-88-9900",
            "COUNTRY OF ORIGIN: INDIA",
        ]
        ocr = OCRResult(
            text="\n".join(real_lines),
            confidence=0.95,
            regions=[OCRRegion(text=l, confidence=0.95, box=[0.1, 0.1, 0.2, 0.9]) for l in real_lines],
        )
        fields = self.extractor.extract(ocr)
        img = InspectionImage(
            image_id="img-real", panel=PanelType.BACK,
            quality=ImageQualityResult(status=ImageQualityStatus.GOOD, score=0.9),
            ocr=ocr, fields=fields, compliance=compliance_engine.evaluate(fields),
        )
        session = session_aggregator.aggregate_session([img])

        # Parle-G data must NEVER leak
        session_dump = str(session.model_dump() if hasattr(session, "model_dump") else session.dict())
        self.assertNotIn("PARLE-G", session_dump.upper())
        self.assertNotIn("PARLE PRODUCTS", session_dump.upper())
        self.assertNotIn("250 G", session_dump.upper())

    # -------------------------------------------------------------------------
    # Requirement 17: Existing regression tests continue passing
    # (Verified by running complete test suite)
    # -------------------------------------------------------------------------
    def test_17_pipeline_deterministic_structure(self):
        fields = ExtractedFields(
            product_name=FieldResult[str](status=ExtractionStatus.PRESENT, value="TEST PRODUCT", confidence=0.9),
            net_quantity=FieldResult[str](status=ExtractionStatus.PRESENT, value="100 g", confidence=0.9),
        )
        img = InspectionImage(
            image_id="img-test", panel=PanelType.FRONT,
            quality=ImageQualityResult(status=ImageQualityStatus.GOOD, score=0.9),
            ocr=OCRResult(text="TEST PRODUCT\n100 g", confidence=0.9, regions=[]),
            fields=fields, compliance=compliance_engine.evaluate(fields),
        )
        session = session_aggregator.aggregate_session([img])
        self.assertIsInstance(session.findings, list)
        self.assertGreaterEqual(len(session.findings), 8)
        first = session.findings[0]
        for expected_key in ["rule_id", "requirement", "status", "package_panel", "explanation", "legal_source"]:
            self.assertIn(expected_key, first)


if __name__ == "__main__":
    unittest.main()
