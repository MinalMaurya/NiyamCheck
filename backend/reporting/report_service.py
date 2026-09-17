from typing import Dict, Optional, List
from datetime import datetime
from backend.inspections.models import InspectionSession
from backend.reporting.models import InspectionReport
from backend.reporting.hasher import compute_integrity_hash
from backend.reporting.pdf_generator import pdf_report_generator


class ReportService:
    """Coordinates compilation of structured JSON and PDF inspection reports."""

    DEFAULT_LIMITATIONS = [
        "This inspection evaluates observable packaging declarations under Rule 6 of the Legal Metrology (Packaged Commodities) Rules, 2011.",
        "Unphotographed packaging panels or obscured label areas are conservatively marked NOT_VERIFIABLE rather than legally absent.",
        "Physical dimensions and font-height-to-Principal-Display-Panel area ratios are not evaluated in this software milestone.",
        "Deterministic audit integrity is preserved via the SHA-256 canonical inspection digest.",
        "This system provides automated document/image analysis and source-linked regulatory information. It is not a substitute for official legal or enforcement determination. Results are limited by the submitted images, OCR accuracy, configured rules, and available authoritative sources.",
    ]

    def build_report(self, session: InspectionSession) -> InspectionReport:
        """Constructs an InspectionReport from an InspectionSession."""
        # Extract product information map
        prod_info: Dict[str, Optional[str]] = {}
        fields = session.combined_fields
        for k in [
            "product_name",
            "net_quantity",
            "mrp",
            "manufacturer",
            "packer",
            "importer",
            "address",
            "date_information",
            "consumer_care",
            "country_of_origin",
        ]:
            field_obj = getattr(fields, k, None)
            prod_info[k] = field_obj.value if (field_obj and field_obj.value) else None

        # Prepare payload for integrity hash
        hash_payload = {
            "inspection_id": session.inspection_id,
            "created_at": session.created_at.isoformat(),
            "overall_status": session.status.value,
            "rules_checked": session.compliance.rules_checked,
            "rules_passed": session.compliance.rules_passed,
            "rules_failed": session.compliance.rules_failed,
            "product_information": prod_info,
            "evaluations": [
                {
                    "rule_id": ev.rule_id,
                    "status": ev.status.value,
                    "evidence": str(ev.evidence) if ev.evidence else None,
                }
                for ev in session.compliance.evaluations
            ],
        }
        integrity_hash = compute_integrity_hash(hash_payload)

        return InspectionReport(
            inspection_id=session.inspection_id,
            generated_at=datetime.utcnow(),
            overall_status=session.status,
            summary=session.summary,
            image_count=len(session.images),
            product_information=prod_info,
            compliance=session.compliance,
            findings=session.compliance.findings,
            evidence=session.evidence,
            limitations=self.DEFAULT_LIMITATIONS,
            integrity_hash=integrity_hash,
        )

    def generate_pdf(self, session: InspectionSession) -> bytes:
        """Directly generates PDF inspection report bytes from an InspectionSession."""
        report = self.build_report(session)
        return pdf_report_generator.generate_pdf(report)


report_service = ReportService()
