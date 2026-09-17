import uuid
from datetime import datetime
from typing import List, Optional
from backend.schemas.analysis import ExtractedFields, FieldResult, ExtractionStatus
from backend.compliance.models import ComplianceResult, ComplianceStatus
from backend.compliance.rule_engine import compliance_engine
from backend.evidence.models import EvidenceItem
from backend.inspections.models import InspectionImage, InspectionSession, PanelType


class SessionAggregator:
    """
    Combines individual packaging image inspections into a unified InspectionSession.
    Deterministic resolution rules prioritize verified presence and highest OCR confidence.
    """

    FIELD_KEYS = [
        "product_name",
        "manufacturer",
        "packer",
        "importer",
        "address",
        "net_quantity",
        "mrp",
        "date_information",
        "consumer_care",
        "country_of_origin",
    ]

    def aggregate_session(
        self,
        images: List[InspectionImage],
        inspection_id: Optional[str] = None,
    ) -> InspectionSession:
        session_id = inspection_id or f"INSP-{uuid.uuid4().hex[:8].upper()}"

        if not images:
            empty_fields = ExtractedFields()
            empty_comp = compliance_engine.evaluate(empty_fields)
            return InspectionSession(
                inspection_id=session_id,
                created_at=datetime.utcnow(),
                images=[],
                combined_fields=empty_fields,
                compliance=empty_comp,
                evidence=[],
                status=ComplianceStatus.NOT_VERIFIABLE,
                summary="No images submitted for inspection.",
            )

        # 1. Aggregate fields deterministically
        combined_fields_dict = {}
        for key in self.FIELD_KEYS:
            candidates: List[FieldResult[str]] = []
            for img in images:
                f = getattr(img.fields, key, None)
                if f is not None:
                    candidates.append(f)

            combined_fields_dict[key] = self._resolve_best_field(key, candidates)

        combined_fields = ExtractedFields(**combined_fields_dict)

        # 2. Evaluate unified compliance across the combined package declarations
        combined_compliance = compliance_engine.evaluate(combined_fields)

        # 3. Aggregate all evidence items across all images
        all_evidence: List[EvidenceItem] = []
        for img in images:
            all_evidence.extend(img.evidence)

        is_single_panel = len(images) == 1
        single_panel_name = images[0].panel.value if images and hasattr(images[0].panel, "value") else (str(images[0].panel) if images else "UNKNOWN")

        # 4. Link rule evaluations in combined_compliance to their respective evidence item & enrich
        from backend.compliance.models import RuleStatus
        for ev in combined_compliance.evaluations:
            f_obj = getattr(combined_fields, ev.field, None)
            if f_obj and f_obj.value:
                ev.detected_value = f_obj.value

            matching_items = [item for item in all_evidence if item.rule_id == ev.rule_id or item.field == ev.field]
            if matching_items:
                best_item = max(matching_items, key=lambda x: x.confidence)
                from backend.evidence.models import RuleEvidence
                ev.evidence = RuleEvidence(
                    text=best_item.text,
                    image_id=best_item.image_id,
                    bounding_box=best_item.bounding_box,
                    confidence=best_item.confidence,
                    panel=best_item.panel,
                )
                ev.package_panel = best_item.panel or single_panel_name
            else:
                ev.package_panel = single_panel_name

            # Step 8: Single package panel logic — unobserved fields are REVIEW, not violations
            if is_single_panel and ev.status in (RuleStatus.FAIL, RuleStatus.NOT_VERIFIABLE):
                ev.status = RuleStatus.REVIEW
                ev.reason = (
                    f"The required information was not detected in the submitted image. "
                    f"Only one package panel was submitted ({single_panel_name}). "
                    f"Some information may be located on other packaging panels."
                )

            # Plain-English advisory guidance
            if ev.status == RuleStatus.PASS:
                ev.why_flagged = "Statutory declaration verified and conforms to Legal Metrology requirements."
                ev.what_can_i_do = "No action needed. Required declaration is present."
            elif ev.status in (RuleStatus.REVIEW, RuleStatus.UNCLEAR, RuleStatus.NOT_VERIFIABLE):
                ev.why_flagged = (
                    "Declaration could not be verified with certainty. "
                    + ("Only one package panel was submitted." if is_single_panel else "Declaration was ambiguous or below confidence threshold.")
                )
                ev.what_can_i_do = "Upload additional packaging panels (Front, Back, Sides) or capture a sharper photo under direct lighting."
            else:
                ev.why_flagged = "Mandatory declaration was absent across all submitted packaging panels or violates statutory units."
                ev.what_can_i_do = "Ensure the package prominently displays standard metric units, MRP inclusive of taxes, and complete manufacturer details."

        # 5. Attach Authoritative Legal Basis (Milestone 4)
        from backend.legal_knowledge.service import legal_knowledge_service
        legal_knowledge_service.attach_legal_basis(combined_compliance)

        for ev in combined_compliance.evaluations:
            if ev.legal_basis:
                primary = ev.legal_basis[0]
                ev.legal_source = f"{primary.source}, {primary.rule_number} ({primary.section})"
            else:
                ev.legal_source = "Legal Metrology (Packaged Commodities) Rules, 2011"

        # Re-tally counters deterministically
        rules_passed = sum(1 for e in combined_compliance.evaluations if e.status == RuleStatus.PASS)
        rules_failed = sum(1 for e in combined_compliance.evaluations if e.status in (RuleStatus.FAIL, RuleStatus.POTENTIAL_ISSUE))
        rules_review = sum(1 for e in combined_compliance.evaluations if e.status in (RuleStatus.REVIEW, RuleStatus.UNCLEAR, RuleStatus.NOT_VERIFIABLE))
        rules_na = sum(1 for e in combined_compliance.evaluations if e.status == RuleStatus.NOT_APPLICABLE)

        combined_compliance.rules_passed = rules_passed
        combined_compliance.rules_failed = rules_failed
        combined_compliance.rules_unclear = rules_review
        combined_compliance.rules_not_verifiable = 0
        combined_compliance.rules_not_applicable = rules_na

        # Determine overall status and conservative summary
        if rules_failed > 0:
            overall_status = ComplianceStatus.NON_COMPLIANT
        elif rules_passed > 0 and rules_review == 0:
            overall_status = ComplianceStatus.COMPLIANT
        elif is_single_panel and rules_passed > 0:
            overall_status = ComplianceStatus.PARTIALLY_VERIFIABLE
            combined_compliance.summary = (
                f"Single packaging panel ({single_panel_name}) inspected. "
                f"{rules_passed} declarations verified. {rules_review} require additional panel scans for full statutory verification."
            )
        elif rules_passed > 0 and rules_review > 0:
            overall_status = ComplianceStatus.PARTIALLY_VERIFIABLE
        else:
            overall_status = ComplianceStatus.NOT_VERIFIABLE

        combined_compliance.status = overall_status


        # 6. Detect Product Category
        product_cat = self._detect_product_category(combined_fields, images)

        # 7. Build structured findings array for UI & reporting
        structured_findings = []
        for ev in combined_compliance.evaluations:
            finding_status = (
                "PASS" if ev.status == RuleStatus.PASS
                else "POTENTIAL_ISSUE" if ev.status in (RuleStatus.FAIL, RuleStatus.POTENTIAL_ISSUE)
                else "NOT_VERIFIABLE" if ev.status == RuleStatus.NOT_VERIFIABLE
                else "REVIEW"
            )
            structured_findings.append({
                "requirement": ev.requirement,
                "status": finding_status,
                "detected_value": ev.detected_value,
                "evidence": str(ev.evidence) if ev.evidence else None,
                "package_panel": ev.package_panel,
                "explanation": ev.reason,
                "legal_source": ev.legal_source,
                "confidence": ev.confidence,
                "why_flagged": ev.why_flagged,
                "what_can_i_do": ev.what_can_i_do,
            })

        return InspectionSession(
            inspection_id=session_id,
            created_at=datetime.utcnow(),
            product_category=product_cat,
            images=images,
            combined_fields=combined_fields,
            compliance=combined_compliance,
            evidence=all_evidence,
            status=overall_status,
            summary=combined_compliance.summary,
            requirements_checked=len(combined_compliance.evaluations),
            passed=rules_passed,
            review=rules_review,
            potential_issues=rules_failed,
            findings=structured_findings,
        )

    def _detect_product_category(
        self, fields: ExtractedFields, images: List[InspectionImage]
    ) -> str:
        """Determines product classification from extracted declarations and OCR text."""
        combined_text = " ".join([img.ocr.text for img in images if img.ocr and img.ocr.text]).lower()
        if fields.product_name and fields.product_name.value:
            combined_text += " " + fields.product_name.value.lower()

        food_keywords = [
            "biscuit", "cookie", "food", "atta", "wheat", "flour", "rice", "oil",
            "noodle", "snack", "sweet", "chocolate", "masala", "spice", "tea",
            "coffee", "milk", "dairy", "juice", "beverage", "drink", "sugar",
            "salt", "pulse", "cereal", "glucose", "wafer", "confectionery",
            "chips", "potato", "crisps", "lays", "frito", "namkeen", "bhujia",
        ]
        personal_care_keywords = [
            "shampoo", "soap", "cream", "lotion", "serum", "gel", "wash",
            "cosmetic", "toothpaste", "conditioner", "perfume", "deodorant",
            "skincare", "sunscreen",
        ]
        cleaning_keywords = [
            "detergent", "cleaner", "dishwash", "disinfectant", "bleach",
            "soap powder", "surface cleaner",
        ]

        for kw in food_keywords:
            if kw in combined_text:
                return "Packaged Food"
        for kw in personal_care_keywords:
            if kw in combined_text:
                return "Personal Care & Cosmetics"
        for kw in cleaning_keywords:
            if kw in combined_text:
                return "Household & Cleaning"

        return "Packaged Food"  # Default regulated commodity category under PCR 2011


    def _resolve_best_field(
        self, field_name: str, candidates: List[FieldResult[str]]
    ) -> FieldResult[str]:
        if not candidates:
            default_status = (
                ExtractionStatus.NOT_APPLICABLE
                if field_name in ("packer", "importer")
                else ExtractionStatus.NOT_VERIFIABLE
            )
            return FieldResult[str](status=default_status, confidence=0.0)

        # Priority 1: Pick any candidate with status PRESENT having highest confidence
        present_candidates = [c for c in candidates if c.status == ExtractionStatus.PRESENT and c.value]
        if present_candidates:
            return max(present_candidates, key=lambda c: (c.confidence, len(c.value or "")))

        # Priority 2: Pick candidate with status UNCLEAR having highest confidence
        unclear_candidates = [c for c in candidates if c.status == ExtractionStatus.UNCLEAR]
        if unclear_candidates:
            return max(unclear_candidates, key=lambda c: c.confidence)

        # Priority 3: Confirmed MISSING (only if at least one view had full text coverage and marked it MISSING)
        missing_candidates = [c for c in candidates if c.status == ExtractionStatus.MISSING]
        if missing_candidates:
            return max(missing_candidates, key=lambda c: c.confidence)

        # Priority 4: NOT_APPLICABLE (for optional fields like packer, importer, origin)
        na_candidates = [c for c in candidates if c.status == ExtractionStatus.NOT_APPLICABLE]
        if na_candidates:
            return na_candidates[0]

        # Default: NOT_VERIFIABLE
        return FieldResult[str](status=ExtractionStatus.NOT_VERIFIABLE, confidence=0.0)


session_aggregator = SessionAggregator()
