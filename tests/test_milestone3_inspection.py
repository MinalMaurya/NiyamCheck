import unittest
from backend.schemas.analysis import ExtractedFields, FieldResult, ExtractionStatus, ImageQualityResult, ImageQualityStatus, OCRResult, OCRRegion
from backend.compliance.models import ComplianceResult, ComplianceStatus, RuleStatus
from backend.compliance.rule_engine import compliance_engine
from backend.evidence.models import EvidenceItem, BoundingBox
from backend.inspections.models import PanelType, InspectionImage, InspectionSession
from backend.inspections.aggregator import session_aggregator
from backend.inspections.store import InMemoryInspectionStore


class TestMilestone3Inspection(unittest.TestCase):
    def setUp(self):
        self.quality_ok = ImageQualityResult(status=ImageQualityStatus.GOOD, score=0.9)
        self.ocr_empty = OCRResult(text="", confidence=0.0, regions=[])

    def test_single_image_session(self):
        fields = ExtractedFields(
            product_name=FieldResult[str](status=ExtractionStatus.PRESENT, value="TEST BISCUITS", confidence=0.9),
        )
        comp = compliance_engine.evaluate(fields)
        img = InspectionImage(
            image_id="img-001",
            panel=PanelType.FRONT,
            quality=self.quality_ok,
            ocr=self.ocr_empty,
            fields=fields,
            compliance=comp,
            evidence=[],
        )
        session = session_aggregator.aggregate_session([img], inspection_id="TEST-001")
        self.assertEqual(session.inspection_id, "TEST-001")
        self.assertEqual(len(session.images), 1)
        self.assertEqual(session.combined_fields.product_name.value, "TEST BISCUITS")
        self.assertEqual(session.status, comp.status)

    def test_multi_image_complementary_panels(self):
        # Panel 1 (FRONT): product_name, net_quantity, mrp
        fields_front = ExtractedFields(
            product_name=FieldResult[str](status=ExtractionStatus.PRESENT, value="CHIPS GOLD", confidence=0.95),
            net_quantity=FieldResult[str](status=ExtractionStatus.PRESENT, value="50 g", confidence=0.92),
            mrp=FieldResult[str](status=ExtractionStatus.PRESENT, value="₹ 20.00", confidence=0.94),
        )
        comp_front = compliance_engine.evaluate(fields_front)
        # On front alone, missing manufacturer, address, date, etc. -> PARTIALLY_VERIFIABLE
        self.assertEqual(comp_front.status, ComplianceStatus.PARTIALLY_VERIFIABLE)

        img_front = InspectionImage(
            image_id="img-front",
            panel=PanelType.FRONT,
            quality=self.quality_ok,
            ocr=self.ocr_empty,
            fields=fields_front,
            compliance=comp_front,
            evidence=[
                EvidenceItem(
                    evidence_id="ev-1",
                    image_id="img-front",
                    rule_id="LM-PN-001",
                    field="product_name",
                    text="CHIPS GOLD",
                    confidence=0.95,
                    bounding_box=BoundingBox(ymin=0.1, xmin=0.1, ymax=0.2, xmax=0.5),
                    panel="FRONT",
                )
            ],
        )

        # Panel 2 (BACK): manufacturer, address, date_information, consumer_care, country_of_origin
        fields_back = ExtractedFields(
            manufacturer=FieldResult[str](status=ExtractionStatus.PRESENT, value="SNACK FOODS LTD", confidence=0.96),
            address=FieldResult[str](status=ExtractionStatus.PRESENT, value="PLOT 12, INDUSTRIAL AREA, MUMBAI - 400001", confidence=0.93),
            date_information=FieldResult[str](status=ExtractionStatus.PRESENT, value="MFD: 06/2026", confidence=0.91),
            consumer_care=FieldResult[str](status=ExtractionStatus.PRESENT, value="feedback@snackfoods.com", confidence=0.95),
            country_of_origin=FieldResult[str](status=ExtractionStatus.PRESENT, value="INDIA", confidence=0.99),
        )
        comp_back = compliance_engine.evaluate(fields_back)
        self.assertEqual(comp_back.status, ComplianceStatus.PARTIALLY_VERIFIABLE)

        img_back = InspectionImage(
            image_id="img-back",
            panel=PanelType.BACK,
            quality=self.quality_ok,
            ocr=self.ocr_empty,
            fields=fields_back,
            compliance=comp_back,
            evidence=[],
        )

        # Aggregated session should combine all declarations and yield COMPLIANT!
        session = session_aggregator.aggregate_session([img_front, img_back])
        self.assertEqual(len(session.images), 2)
        self.assertEqual(session.combined_fields.product_name.value, "CHIPS GOLD")
        self.assertEqual(session.combined_fields.manufacturer.value, "SNACK FOODS LTD")
        self.assertEqual(session.combined_fields.net_quantity.value, "50 g")
        self.assertEqual(session.combined_fields.mrp.value, "₹ 20.00")
        self.assertEqual(session.status, ComplianceStatus.COMPLIANT)
        self.assertEqual(session.compliance.rules_passed, 8)
        self.assertEqual(session.compliance.rules_failed, 0)

    def test_conflict_resolution_highest_confidence_wins(self):
        f1 = ExtractedFields(
            product_name=FieldResult[str](status=ExtractionStatus.PRESENT, value="LOW CONF NAME", confidence=0.60),
        )
        f2 = ExtractedFields(
            product_name=FieldResult[str](status=ExtractionStatus.PRESENT, value="HIGH CONF NAME", confidence=0.95),
        )
        img1 = InspectionImage(
            image_id="img-1",
            panel=PanelType.FRONT,
            quality=self.quality_ok,
            ocr=self.ocr_empty,
            fields=f1,
            compliance=compliance_engine.evaluate(f1),
        )
        img2 = InspectionImage(
            image_id="img-2",
            panel=PanelType.TOP,
            quality=self.quality_ok,
            ocr=self.ocr_empty,
            fields=f2,
            compliance=compliance_engine.evaluate(f2),
        )

        session = session_aggregator.aggregate_session([img1, img2])
        self.assertEqual(session.combined_fields.product_name.value, "HIGH CONF NAME")
        self.assertEqual(session.combined_fields.product_name.confidence, 0.95)

    def test_in_memory_inspection_store(self):
        store = InMemoryInspectionStore()
        empty_session = InspectionSession(
            inspection_id="INSP-STORE-TEST",
            images=[],
            combined_fields=ExtractedFields(),
            compliance=compliance_engine.evaluate(ExtractedFields()),
            evidence=[],
            status=ComplianceStatus.NOT_VERIFIABLE,
            summary="Empty",
        )
        # Test save & get
        store.save(empty_session)
        retrieved = store.get("INSP-STORE-TEST")
        self.assertIsNotNone(retrieved)
        self.assertEqual(retrieved.inspection_id, "INSP-STORE-TEST")

        # Test list_all
        all_sessions = store.list_all()
        self.assertEqual(len(all_sessions), 1)

        # Test delete
        deleted = store.delete("INSP-STORE-TEST")
        self.assertTrue(deleted)
        self.assertIsNone(store.get("INSP-STORE-TEST"))
        self.assertFalse(store.delete("NON_EXISTENT"))


if __name__ == "__main__":
    unittest.main()
