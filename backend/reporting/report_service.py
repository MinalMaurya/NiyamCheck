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

        # Compile submitted panels and panel details
        standard_panels_list = ["FRONT", "BACK", "LEFT", "RIGHT", "TOP", "BOTTOM"]
        submitted_panels = []
        panel_details = []
        panels_map = {}

        for img in getattr(session, "images", []):
            p_val = getattr(img.panel, "value", str(img.panel)) if hasattr(img, "panel") else "UNKNOWN"
            p_upper = (p_val or "UNKNOWN").upper()
            submitted_panels.append(p_upper)
            wc = img.ocr.word_count if (hasattr(img, "ocr") and img.ocr and hasattr(img.ocr, "word_count")) else 0
            qs = img.quality.score if (hasattr(img, "quality") and img.quality and hasattr(img.quality, "score")) else 1.0
            panel_details.append({
                "panel": p_upper,
                "image_id": getattr(img, "image_id", "img-unknown"),
                "word_count": wc,
                "quality_score": qs,
            })
            panels_map[p_upper] = panels_map.get(p_upper, 0) + wc

        # Unique submitted panels
        unique_submitted = list(dict.fromkeys(submitted_panels))
        is_single_panel = len(unique_submitted) <= 1

        coverage_standard = {}
        for sp in standard_panels_list:
            is_sub = sp in unique_submitted
            coverage_standard[sp] = {
                "status": "Submitted" if is_sub else "Not submitted",
                "is_submitted": is_sub,
                "word_count": panels_map.get(sp, 0),
            }

        package_coverage = {
            "total_submitted": len(unique_submitted),
            "submitted_panels": unique_submitted,
            "standard_panels": coverage_standard,
            "is_single_panel": is_single_panel,
            "advisory": (
                "Only 1 package panel was submitted. Some declarations may be located on another panel."
                if is_single_panel else
                f"Declarations and evidence were aggregated across all {len(unique_submitted)} submitted package surfaces."
            ),
        }

        # Deterministic summary counts from compliance evaluations (no duplicates)
        from backend.compliance.models import RuleStatus
        evals = session.compliance.evaluations if (session.compliance and session.compliance.evaluations) else []
        satisfied_count = sum(1 for e in evals if e.status == RuleStatus.PASS)
        review_count = sum(1 for e in evals if e.status in (RuleStatus.REVIEW, RuleStatus.UNCLEAR))
        issues_count = sum(1 for e in evals if e.status in (RuleStatus.FAIL, RuleStatus.POTENTIAL_ISSUE))
        unverified_count = sum(1 for e in evals if e.status == RuleStatus.NOT_VERIFIABLE)

        summary_counts = {
            "satisfied": satisfied_count,
            "review": review_count,
            "potential_issues": issues_count,
            "not_verifiable": unverified_count,
            "total": len(evals),
        }

        what_you_can_do_next = [
            "1. Review the finding against the complete physical product packaging.",
            "2. Keep your purchase invoice, store bill, or digital receipt.",
            "3. Save photographs of the product, packaging panels, and batch codes.",
            "4. Contact the responsible company or customer care cell for clarification if appropriate.",
            "5. If the issue remains unresolved, you may consult the relevant official consumer/government grievance procedure (National Consumer Helpline Toll-Free 1915 or consumerhelpline.gov.in).",
        ]
        if unverified_count > 0 or (is_single_panel and review_count > 0):
            what_you_can_do_next.append(
                "For unobserved declarations: Check whether another packaging panel contains the information, capture a clearer image, and re-run the inspection."
            )

        disclaimer_text = (
            "This is an AI-assisted informational analysis based on the submitted evidence and referenced sources. "
            "It is not a final legal determination. NiyamCheck does not determine that a company has legally violated "
            "a requirement solely from this inspection."
        )

        return InspectionReport(
            inspection_id=session.inspection_id,
            generated_at=datetime.utcnow(),
            overall_status=session.status,
            summary=session.summary,
            image_count=len(session.images),
            product_category=getattr(session, "product_category", "Packaged Food"),
            product_information=prod_info,
            compliance=session.compliance,
            findings=session.compliance.findings,
            structured_findings=getattr(session, "findings", []),
            submitted_panels=unique_submitted,
            panel_details=panel_details,
            package_coverage=package_coverage,
            summary_counts=summary_counts,
            what_you_can_do_next=what_you_can_do_next,
            disclaimer=disclaimer_text,
            evidence=session.evidence,
            limitations=self.DEFAULT_LIMITATIONS,
            integrity_hash=integrity_hash,
        )

    def generate_pdf(self, session: InspectionSession) -> bytes:
        """Directly generates PDF inspection report bytes from an InspectionSession."""
        report = self.build_report(session)
        return pdf_report_generator.generate_pdf(report)


report_service = ReportService()
