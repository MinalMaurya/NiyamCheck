import unittest
from backend.schemas.analysis import ExtractedFields, FieldResult, ExtractionStatus
from backend.compliance.models import ComplianceResult, ComplianceStatus
from backend.compliance.rule_engine import compliance_engine
from backend.inspections.models import InspectionSession, InspectionImage, PanelType
from backend.reporting.models import InspectionReport
from backend.reporting.hasher import compute_integrity_hash
from backend.reporting.report_service import report_service
from backend.reporting.pdf_generator import pdf_report_generator
from backend.evidence.models import EvidenceItem, BoundingBox


class TestMilestone3Reporting(unittest.TestCase):
    def test_compute_integrity_hash_deterministic(self):
        payload1 = {"b": 2, "a": 1, "sub": {"y": "val", "x": 10}}
        payload2 = {"a": 1, "b": 2, "sub": {"x": 10, "y": "val"}}
        hash1 = compute_integrity_hash(payload1)
        hash2 = compute_integrity_hash(payload2)
        self.assertEqual(hash1, hash2)
        self.assertEqual(len(hash1), 64)

        payload3 = {"a": 1, "b": 3}
        self.assertNotEqual(hash1, compute_integrity_hash(payload3))

    def test_build_report(self):
        fields = ExtractedFields(
            product_name=FieldResult[str](status=ExtractionStatus.PRESENT, value="TEST PRODUCT", confidence=0.9),
            net_quantity=FieldResult[str](status=ExtractionStatus.PRESENT, value="100 g", confidence=0.85),
        )
        comp = compliance_engine.evaluate(fields)
        session = InspectionSession(
            inspection_id="INSP-REPORT-001",
            images=[],
            combined_fields=fields,
            compliance=comp,
            evidence=[],
            status=comp.status,
            summary=comp.summary,
        )

        report = report_service.build_report(session)
        self.assertIsInstance(report, InspectionReport)
        self.assertEqual(report.inspection_id, "INSP-REPORT-001")
        self.assertEqual(report.overall_status, comp.status)
        self.assertEqual(report.product_information["product_name"], "TEST PRODUCT")
        self.assertEqual(report.product_information["net_quantity"], "100 g")
        self.assertIsNone(report.product_information.get("importer"))
        self.assertGreater(len(report.limitations), 0)
        self.assertEqual(len(report.integrity_hash), 64)

    def test_generate_pdf_structure(self):
        fields = ExtractedFields(
            product_name=FieldResult[str](status=ExtractionStatus.PRESENT, value="TEST BISCUITS", confidence=0.95),
            net_quantity=FieldResult[str](status=ExtractionStatus.PRESENT, value="200 g", confidence=0.92),
            mrp=FieldResult[str](status=ExtractionStatus.PRESENT, value="₹ 40.00", confidence=0.94),
            manufacturer=FieldResult[str](status=ExtractionStatus.PRESENT, value="ABC FOODS LTD", confidence=0.96),
            address=FieldResult[str](status=ExtractionStatus.PRESENT, value="MUMBAI - 400001", confidence=0.93),
            date_information=FieldResult[str](status=ExtractionStatus.PRESENT, value="08/2026", confidence=0.91),
            consumer_care=FieldResult[str](status=ExtractionStatus.PRESENT, value="care@abc.com", confidence=0.95),
            country_of_origin=FieldResult[str](status=ExtractionStatus.PRESENT, value="INDIA", confidence=0.99),
        )
        comp = compliance_engine.evaluate(fields)
        evidence_list = [
            EvidenceItem(
                evidence_id="ev-1",
                image_id="img-001",
                rule_id="LM-PN-001",
                field="product_name",
                text="TEST BISCUITS",
                confidence=0.95,
                bounding_box=BoundingBox(ymin=0.1, xmin=0.1, ymax=0.2, xmax=0.8),
                panel="FRONT",
            )
        ]
        session = InspectionSession(
            inspection_id="INSP-PDF-TEST",
            images=[],
            combined_fields=fields,
            compliance=comp,
            evidence=evidence_list,
            status=comp.status,
            summary=comp.summary,
        )

        pdf_bytes = report_service.generate_pdf(session)
        self.assertIsInstance(pdf_bytes, bytes)
        self.assertGreater(len(pdf_bytes), 1000)
        # PDF file standard header
        self.assertTrue(pdf_bytes.startswith(b"%PDF-1."))
        # Valid PDF EOF marker near the end
        self.assertIn(b"%%EOF", pdf_bytes[-1024:])


if __name__ == "__main__":
    unittest.main()
