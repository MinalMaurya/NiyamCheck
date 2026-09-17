import unittest
from typing import Optional, List
from backend.schemas.analysis import (
    ExtractedFields,
    FieldResult,
    ExtractionStatus,
    ImageQualityResult,
    ImageQualityStatus,
    OCRResult,
)
from backend.compliance.models import ComplianceResult, ComplianceStatus, RuleEvaluation, RuleStatus
from backend.compliance.rule_engine import compliance_engine
from backend.inspections.models import InspectionSession, InspectionImage, PanelType
from backend.reporting.models import InspectionReport
from backend.reporting.report_service import report_service
from backend.evidence.models import EvidenceItem, BoundingBox
from backend.inspections.aggregator import session_aggregator


def make_inspection_image(
    image_id: str,
    panel: PanelType,
    fields: Optional[ExtractedFields] = None,
    evidence: Optional[List[EvidenceItem]] = None,
) -> InspectionImage:
    f = fields or ExtractedFields()
    c = compliance_engine.evaluate(f)
    return InspectionImage(
        image_id=image_id,
        filename=f"{image_id}.jpg",
        panel=panel,
        quality=ImageQualityResult(status=ImageQualityStatus.GOOD, score=0.95, issues=[]),
        ocr=OCRResult(text="SAMPLE PACKAGING OCR TEXT", confidence=0.95, regions=[]),
        fields=f,
        compliance=c,
        evidence=evidence or [],
    )


class TestInspectionResultsAndReports(unittest.TestCase):
    def setUp(self):
        self.fields = ExtractedFields(
            product_name=FieldResult[str](status=ExtractionStatus.PRESENT, value="CRUNCHY CHIPS", confidence=0.96),
            net_quantity=FieldResult[str](status=ExtractionStatus.PRESENT, value="50 g", confidence=0.93),
            mrp=FieldResult[str](status=ExtractionStatus.PRESENT, value="₹ 20.00", confidence=0.95),
            manufacturer=FieldResult[str](status=ExtractionStatus.PRESENT, value="SNACKS BHARAT PVT LTD", confidence=0.94),
            address=FieldResult[str](status=ExtractionStatus.PRESENT, value="PLOT 12, SECTOR 4, GURUGRAM - 122001", confidence=0.91),
            date_information=FieldResult[str](status=ExtractionStatus.PRESENT, value="10/2026", confidence=0.92),
            consumer_care=FieldResult[str](status=ExtractionStatus.PRESENT, value="care@snacksbharat.com", confidence=0.95),
            country_of_origin=FieldResult[str](status=ExtractionStatus.PRESENT, value="INDIA", confidence=0.98),
        )
        self.evidence = [
            EvidenceItem(
                evidence_id="ev-front-1",
                image_id="img-front",
                rule_id="LM-PN-001",
                field="product_name",
                text="CRUNCHY CHIPS",
                confidence=0.96,
                bounding_box=BoundingBox(ymin=0.1, xmin=0.1, ymax=0.2, xmax=0.9),
                panel="FRONT",
            ),
            EvidenceItem(
                evidence_id="ev-back-1",
                image_id="img-back",
                rule_id="LM-MRP-001",
                field="mrp",
                text="₹ 20.00",
                confidence=0.95,
                bounding_box=BoundingBox(ymin=0.3, xmin=0.2, ymax=0.35, xmax=0.5),
                panel="BACK",
            ),
        ]

    def test_report_service_package_coverage_multi_panel(self):
        comp = compliance_engine.evaluate(self.fields)
        images = [
            make_inspection_image("img-front", PanelType.FRONT, self.fields, [self.evidence[0]]),
            make_inspection_image("img-back", PanelType.BACK, self.fields, [self.evidence[1]]),
        ]
        session = InspectionSession(
            inspection_id="INSP-MULTI-001",
            images=images,
            combined_fields=self.fields,
            compliance=comp,
            evidence=self.evidence,
            status=comp.status,
            summary=comp.summary,
        )

        report = report_service.build_report(session)
        self.assertIsInstance(report, InspectionReport)
        self.assertEqual(len(report.submitted_panels), 2)
        self.assertIn("FRONT", report.submitted_panels)
        self.assertIn("BACK", report.submitted_panels)

        # 6 standard panels in package_coverage["standard_panels"]
        self.assertEqual(len(report.package_coverage["standard_panels"]), 6)
        self.assertTrue(report.package_coverage["standard_panels"]["FRONT"]["is_submitted"])
        self.assertEqual(report.package_coverage["standard_panels"]["FRONT"]["status"], "Submitted")
        self.assertFalse(report.package_coverage["standard_panels"]["TOP"]["is_submitted"])
        self.assertEqual(report.package_coverage["standard_panels"]["TOP"]["status"], "Not submitted")
        self.assertFalse(report.package_coverage["is_single_panel"])

    def test_report_service_package_coverage_single_panel_advisory(self):
        comp = compliance_engine.evaluate(self.fields)
        images = [
            make_inspection_image("img-back", PanelType.BACK, self.fields, [self.evidence[1]]),
        ]
        session = InspectionSession(
            inspection_id="INSP-SINGLE-001",
            images=images,
            combined_fields=self.fields,
            compliance=comp,
            evidence=[self.evidence[1]],
            status=comp.status,
            summary=comp.summary,
        )

        report = report_service.build_report(session)
        self.assertEqual(len(report.submitted_panels), 1)
        self.assertEqual(report.submitted_panels[0], "BACK")
        self.assertTrue(report.package_coverage["is_single_panel"])
        self.assertIn("Only 1 package panel was submitted", report.package_coverage["advisory"])

    def test_report_summary_counts_consistency(self):
        comp = compliance_engine.evaluate(self.fields)
        session = InspectionSession(
            inspection_id="INSP-SUM-001",
            images=[],
            combined_fields=self.fields,
            compliance=comp,
            evidence=[],
            status=comp.status,
            summary=comp.summary,
        )

        report = report_service.build_report(session)
        counts = report.summary_counts
        self.assertIn("satisfied", counts)
        self.assertIn("review", counts)
        self.assertIn("potential_issues", counts)
        self.assertIn("not_verifiable", counts)
        self.assertIn("total", counts)

        calculated_sum = (
            counts["satisfied"]
            + counts["review"]
            + counts["potential_issues"]
            + counts["not_verifiable"]
        )
        self.assertEqual(calculated_sum, counts["total"])
        self.assertEqual(counts["total"], len(report.findings))

    def test_what_you_can_do_next_consumer_guidance(self):
        comp = compliance_engine.evaluate(self.fields)
        session = InspectionSession(
            inspection_id="INSP-NEXT-001",
            images=[],
            combined_fields=self.fields,
            compliance=comp,
            evidence=[],
            status=comp.status,
            summary=comp.summary,
        )

        report = report_service.build_report(session)
        next_steps = report.what_you_can_do_next
        self.assertGreaterEqual(len(next_steps), 5)
        # Verify practical consumer steps exist
        self.assertTrue(any("physical product packaging" in s for s in next_steps))
        self.assertTrue(any("purchase invoice" in s for s in next_steps))
        self.assertTrue(any("photographs" in s for s in next_steps))
        self.assertTrue(any("Contact the responsible company" in s for s in next_steps))
        self.assertTrue(any("National Consumer Helpline" in s for s in next_steps))

        # Check National Consumer Helpline 1915 is referenced
        grievance_step = next(s for s in next_steps if "National Consumer Helpline" in s)
        self.assertIn("1915", grievance_step)
        self.assertIn("consumerhelpline.gov.in", grievance_step)

    def test_non_accusatory_disclaimer(self):
        comp = compliance_engine.evaluate(self.fields)
        session = InspectionSession(
            inspection_id="INSP-DISC-001",
            images=[],
            combined_fields=self.fields,
            compliance=comp,
            evidence=[],
            status=comp.status,
            summary=comp.summary,
        )

        report = report_service.build_report(session)
        disclaimer = report.disclaimer
        self.assertIn("AI-assisted informational analysis", disclaimer)
        self.assertIn("not a final legal determination", disclaimer)
        self.assertIn("does not determine that a company has legally violated", disclaimer)
        self.assertNotIn("company violated the law", disclaimer.lower())
        self.assertNotIn("product is illegal", disclaimer.lower())

    def test_pdf_generation_multi_page_and_structure(self):
        comp = compliance_engine.evaluate(self.fields)
        images = [
            make_inspection_image("img-front", PanelType.FRONT, self.fields, [self.evidence[0]]),
            make_inspection_image("img-back", PanelType.BACK, self.fields, [self.evidence[1]]),
        ]
        session = InspectionSession(
            inspection_id="INSP-PDF-MULTI",
            images=images,
            combined_fields=self.fields,
            compliance=comp,
            evidence=self.evidence,
            status=comp.status,
            summary=comp.summary,
        )

        pdf_bytes = report_service.generate_pdf(session)
        self.assertTrue(pdf_bytes.startswith(b"%PDF-1."))
        self.assertIn(b"%%EOF", pdf_bytes[-1024:])
        # Multi-page PDF should have non-trivial size
        self.assertGreater(len(pdf_bytes), 5000)

    def test_aggregator_consumer_what_can_i_do_enrichment(self):
        fields_with_review = ExtractedFields(
            mrp=FieldResult[str](status=ExtractionStatus.UNCLEAR, value=None, confidence=0.4),
        )
        img = make_inspection_image("img-1", PanelType.BACK, fields_with_review, [])
        session = session_aggregator.aggregate_session([img], inspection_id="INSP-AGGR-001")
        findings = session.findings
        mrp_finding = next((f for f in findings if f.get("rule_id") == "LM-MRP-001"), None)
        self.assertIsNotNone(mrp_finding)
        self.assertIn("what_can_i_do", mrp_finding)
        self.assertIn("MRP", mrp_finding["what_can_i_do"])
        self.assertIn(mrp_finding["status"], ["REVIEW", "NOT_VERIFIABLE"])


if __name__ == "__main__":
    unittest.main()
