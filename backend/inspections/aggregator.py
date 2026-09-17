import uuid
from datetime import datetime
from typing import List, Optional
from backend.schemas.analysis import ExtractedFields, FieldResult, ExtractionStatus
from backend.compliance.models import ComplianceResult, ComplianceStatus, RuleStatus
from backend.compliance.rule_engine import compliance_engine
from backend.compliance.category_detector import product_category_detector
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

        # 2. Generic Multi-Signal Product Category Detection
        combined_ocr_text = " ".join([img.ocr.text for img in images if img.ocr and img.ocr.text])
        category_res = product_category_detector.detect(combined_fields, combined_ocr_text)
        product_cat = category_res.category

        # 3. Evaluate unified compliance across the combined package declarations with category context
        combined_compliance = compliance_engine.evaluate(combined_fields, category=product_cat)

        # 4. Aggregate all evidence items across all images
        all_evidence: List[EvidenceItem] = []
        for img in images:
            all_evidence.extend(img.evidence)

        is_single_panel = len(images) == 1
        single_panel_name = images[0].panel.value if images and hasattr(images[0].panel, "value") else (str(images[0].panel) if images else "UNKNOWN")

        # 5. Link rule evaluations in combined_compliance to their respective evidence item & enrich
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

            # Check if this field had conflicting declarations across panels
            if f_obj and f_obj.conflicts:
                ev.status = RuleStatus.REVIEW
                conflict_desc = ", ".join([f"{c['panel']}: {c['value']}" for c in f_obj.conflicts])
                ev.detected_value = f"Conflicting declarations: {conflict_desc}"
                ev.reason = f"Different {ev.name} values were detected on submitted package panels: {conflict_desc}."
                ev.why_flagged = "The submitted package images contain conflicting values for the same declaration."
                ev.what_can_i_do = "Check the printed declaration on all package panels and compare with your purchase bill. Keep your receipt and clear photographs of the package. You may consult the relevant official grievance mechanism if the issue remains unresolved."
                ev.package_panel = "/".join(sorted(set(c['panel'] for c in f_obj.conflicts)))
                from backend.evidence.models import RuleEvidence
                ev.evidence = RuleEvidence(
                    text=f"Conflicting values: {conflict_desc}",
                    image_id=f_obj.conflicts[0].get("image_id", "img-001"),
                    confidence=f_obj.confidence,
                    panel=ev.package_panel,
                )
                continue

            # Evaluation Status refinement: "Not Detected ≠ Violation"
            # When a declaration was NOT detected in the submitted images:
            if not ev.detected_value:
                if is_single_panel:
                    # Single package panel: declaration may reside on another unphotographed panel
                    ev.status = RuleStatus.REVIEW
                    ev.reason = (
                        f"The required declaration was not detected in the submitted image. "
                        f"Only one package panel was submitted ({single_panel_name}). "
                        f"Declarations may be located on other packaging panels."
                    )
                    ev.why_flagged = f"Declaration could not be verified with certainty. Only one package panel was submitted ({single_panel_name})."
                else:
                    # Multi-panel: declaration could not be established from the submitted views
                    ev.status = RuleStatus.NOT_VERIFIABLE
                    ev.reason = (
                        f"The required declaration was not detected in the submitted package panel(s). "
                        f"This declaration cannot be verified without physical inspection of all package panels."
                    )
                    ev.why_flagged = "The applicable requirement expects this information, but NiyamCheck could not find sufficient evidence in the submitted images."

                # Field-specific consumer actionable next steps
                if ev.field == "mrp" or ev.rule_id == "LM-MRP-001":
                    ev.what_can_i_do = "Check the MRP printed on all package panels. Compare it with the value detected by NiyamCheck. Keep your purchase bill and packaging photo. You may consult the relevant official grievance mechanism if the issue remains unresolved."
                elif ev.field == "consumer_care" or ev.rule_id == "LM-CARE-001":
                    ev.what_can_i_do = "Check the remaining package panels. Upload a clearer image if necessary. Look for customer-care phone/email/address information. Re-run the inspection with the missing panel."
                elif ev.field == "net_quantity" or ev.rule_id == "LM-NQ-001":
                    ev.what_can_i_do = "Check the principal display panel or lower right corner of the packaging for net quantity in metric units (g, kg, ml, l) or count. Re-run the inspection with any missing panels."
                elif ev.field == "product_name" or ev.rule_id == "LM-PN-001":
                    ev.what_can_i_do = "Check the front panel or main packaging face to locate the generic commodity name. Re-run the inspection with the front panel captured."
                elif ev.field in ("manufacturer", "address") or ev.rule_id in ("LM-MFG-001", "LM-ADDR-001"):
                    ev.what_can_i_do = "Inspect the back, side, or bottom panels for responsible manufacturer or packer name, complete postal address, and PIN code."
                elif ev.field == "date_information" or ev.rule_id == "LM-DATE-001":
                    ev.what_can_i_do = "Check near the packaging crimp, seal, or bottom face for dot-matrix stamped month and year of manufacture or packaging."
                elif ev.field == "country_of_origin" or ev.rule_id == "LM-COO-001":
                    ev.what_can_i_do = "Look for 'Made in [Country]', 'Product of [Country]', or explicit country declaration printed on the physical packaging."
                else:
                    ev.what_can_i_do = "Check the remaining sides of the package or upload clearer images under direct lighting."
            elif ev.status in (RuleStatus.FAIL, RuleStatus.POTENTIAL_ISSUE):
                # Positive contradiction detected (e.g., bare number without unit, price above MRP)
                ev.status = RuleStatus.POTENTIAL_ISSUE
                ev.why_flagged = "Potential issue identified; the submitted declaration appears inconsistent with codified Legal Metrology requirements."
                if ev.field == "mrp" or ev.rule_id == "LM-MRP-001":
                    ev.what_can_i_do = "Verify that Maximum Retail Price states 'inclusive of all taxes' in Indian Rupees (₹ / Rs.). Keep your purchase bill and package photo. You may consult the relevant official grievance mechanism if the issue remains unresolved."
                elif ev.field == "net_quantity" or ev.rule_id == "LM-NQ-001":
                    ev.what_can_i_do = "Verify that net weight or volume includes standard metric units (g, kg, ml, l) rather than bare numbers or invalid units. You may consult the relevant official grievance mechanism if the issue remains unresolved."
                elif ev.field == "consumer_care" or ev.rule_id == "LM-CARE-001":
                    ev.what_can_i_do = "Ensure at least one clear contact channel (telephone number, email address, or redressal cell) is printed for consumer grievances."
                else:
                    ev.what_can_i_do = "Review the finding against the physical packaging. Keep your purchase bill and photographs. You may consult the relevant official grievance mechanism if the issue remains unresolved."
            elif ev.status == RuleStatus.PASS:
                if f_obj and f_obj.additional_sources:
                    also_panels = ", ".join(sorted(set(s['panel'] for s in f_obj.additional_sources if s.get('panel'))))
                    ev.why_flagged = f"Statutory declaration verified. Also detected on: {also_panels}."
                else:
                    ev.why_flagged = "Statutory declaration verified and conforms to Legal Metrology requirements."
                ev.what_can_i_do = "No action needed. Required declaration is clearly visible and satisfies codified requirements."
            else:
                # Ambiguous or unclear declaration text
                ev.status = RuleStatus.REVIEW
                ev.why_flagged = "Declaration was ambiguous or below confidence threshold."
                ev.what_can_i_do = "Upload a sharper photo or verify declaration manually on physical package."

        # 6. Attach Authoritative Legal Basis (Milestone 4)
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
        rules_review = sum(1 for e in combined_compliance.evaluations if e.status in (RuleStatus.REVIEW, RuleStatus.UNCLEAR))
        rules_not_verifiable = sum(1 for e in combined_compliance.evaluations if e.status == RuleStatus.NOT_VERIFIABLE)
        rules_na = sum(1 for e in combined_compliance.evaluations if e.status == RuleStatus.NOT_APPLICABLE)

        combined_compliance.rules_passed = rules_passed
        combined_compliance.rules_failed = rules_failed
        combined_compliance.rules_unclear = rules_review
        combined_compliance.rules_not_verifiable = rules_not_verifiable
        combined_compliance.rules_not_applicable = rules_na

        # Determine overall status and conservative summary
        if rules_failed > 0:
            overall_status = ComplianceStatus.NON_COMPLIANT
        elif rules_passed > 0 and rules_review == 0 and rules_not_verifiable == 0:
            overall_status = ComplianceStatus.COMPLIANT
        elif is_single_panel and rules_passed > 0:
            overall_status = ComplianceStatus.PARTIALLY_VERIFIABLE
            combined_compliance.summary = (
                f"Single packaging panel ({single_panel_name}) inspected. "
                f"{rules_passed} declarations verified. {rules_review + rules_not_verifiable} require additional panel scans for full statutory verification."
            )
        elif rules_passed > 0 and (rules_review > 0 or rules_not_verifiable > 0):
            overall_status = ComplianceStatus.PARTIALLY_VERIFIABLE
            combined_compliance.summary = (
                f"{rules_passed} statutory declarations verified. "
                f"{rules_review + rules_not_verifiable} require additional panel views or manual verification."
            )
        else:
            overall_status = ComplianceStatus.NOT_VERIFIABLE
            combined_compliance.summary = "Insufficient readable declaration information could be verified from the submitted packaging images."

        combined_compliance.status = overall_status

        # 7. Build structured findings array for UI & reporting
        structured_findings = []
        for ev in combined_compliance.evaluations:
            f_obj = getattr(combined_fields, ev.field, None)
            conflicts_data = f_obj.conflicts if f_obj and hasattr(f_obj, "conflicts") else []
            additional_sources_data = f_obj.additional_sources if f_obj and hasattr(f_obj, "additional_sources") else []

            finding_status = (
                "PASS" if ev.status == RuleStatus.PASS
                else "POTENTIAL_ISSUE" if ev.status in (RuleStatus.FAIL, RuleStatus.POTENTIAL_ISSUE)
                else "NOT_VERIFIABLE" if ev.status == RuleStatus.NOT_VERIFIABLE
                else "REVIEW"
            )

            primary_basis = ev.legal_basis[0] if (ev.legal_basis and len(ev.legal_basis) > 0) else None
            legal_url = primary_basis.official_url if primary_basis else None
            legal_cit = primary_basis.citation.format_citation() if (primary_basis and hasattr(primary_basis, "citation") and primary_basis.citation) else ev.legal_source
            legal_excerpt = primary_basis.excerpt if primary_basis else None
            legal_auth = primary_basis.citation.authority if (primary_basis and hasattr(primary_basis, "citation") and primary_basis.citation) else "Department of Consumer Affairs, Government of India"

            bbox_dict = None
            if ev.evidence and hasattr(ev.evidence, "bounding_box") and ev.evidence.bounding_box:
                bb = ev.evidence.bounding_box
                bbox_dict = {
                    "ymin": bb.ymin,
                    "xmin": bb.xmin,
                    "ymax": bb.ymax,
                    "xmax": bb.xmax,
                }

            structured_findings.append({
                "rule_id": ev.rule_id,
                "name": ev.name,
                "category": ev.category,
                "requirement": ev.requirement,
                "status": finding_status,
                "detected_value": ev.detected_value,
                "evidence": str(ev.evidence) if ev.evidence else None,
                "evidence_text": ev.evidence.text if (ev.evidence and hasattr(ev.evidence, "text")) else None,
                "bounding_box": bbox_dict,
                "source_image_id": ev.evidence.image_id if (ev.evidence and hasattr(ev.evidence, "image_id")) else None,
                "package_panel": ev.package_panel,
                "explanation": ev.reason,
                "legal_source": ev.legal_source,
                "legal_source_url": legal_url,
                "legal_source_citation": legal_cit,
                "legal_basis_excerpt": legal_excerpt,
                "legal_authority": legal_auth,
                "confidence": ev.confidence,
                "why_flagged": ev.why_flagged,
                "what_can_i_do": ev.what_can_i_do,
                "applicability": ev.applicability or "MANDATORY",
                "expected_declaration": ev.expected_declaration,
                "evidence_required": ev.evidence_required,
                "conflicts": conflicts_data,
                "additional_sources": additional_sources_data,
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
        """Determines product classification using multi-signal generic detection."""
        combined_text = " ".join([img.ocr.text for img in images if img.ocr and img.ocr.text])
        return product_category_detector.detect(fields, combined_text).category

    def _are_values_conflicting(self, field_name: str, val1: str, val2: str) -> bool:
        """Determines whether two non-empty declaration candidates express conflicting facts."""
        import re
        if not val1 or not val2:
            return False
        s1 = val1.strip().lower()
        s2 = val2.strip().lower()
        if s1 == s2:
            return False

        if field_name == "mrp":
            nums1 = re.findall(r"\d+(?:\.\d+)?", s1)
            nums2 = re.findall(r"\d+(?:\.\d+)?", s2)
            if nums1 and nums2:
                try:
                    return abs(float(nums1[0]) - float(nums2[0])) > 0.01
                except ValueError:
                    return nums1[0] != nums2[0]
            return s1 != s2

        elif field_name == "net_quantity":
            m1 = re.search(r"(\d+(?:\.\d+)?)\s*([a-z]+)", s1)
            m2 = re.search(r"(\d+(?:\.\d+)?)\s*([a-z]+)", s2)
            if m1 and m2:
                num1, unit1 = m1.groups()
                num2, unit2 = m2.groups()
                if num1 != num2 or unit1 != unit2:
                    return True
                return False
            return s1 != s2

        elif field_name == "date_information":
            d1 = re.findall(r"\d{1,2}[/-]\d{2,4}", s1)
            d2 = re.findall(r"\d{1,2}[/-]\d{2,4}", s2)
            if d1 and d2:
                return d1[0] != d2[0]
            return s1 != s2

        elif field_name in ("product_name", "manufacturer", "address"):
            clean1 = re.sub(r"[^\w\s]", "", s1)
            clean2 = re.sub(r"[^\w\s]", "", s2)
            words1 = set(clean1.split())
            words2 = set(clean2.split())
            if words1.issubset(words2) or words2.issubset(words1):
                return False
            overlap = len(words1 & words2)
            union = len(words1 | words2)
            if union > 0 and (overlap / union) >= 0.4:
                return False
            return True

        elif field_name == "consumer_care":
            phones1 = re.findall(r"\b\d{3,5}[-\s]?\d{3,4}[-\s]?\d{3,4}\b", s1)
            phones2 = re.findall(r"\b\d{3,5}[-\s]?\d{3,4}[-\s]?\d{3,4}\b", s2)
            if phones1 and phones2:
                clean_p1 = re.sub(r"\D", "", phones1[0])
                clean_p2 = re.sub(r"\D", "", phones2[0])
                if clean_p1 and clean_p2 and clean_p1 != clean_p2:
                    return True
            return False

        elif field_name == "country_of_origin":
            clean1 = re.sub(r"[^\w]", "", s1)
            clean2 = re.sub(r"[^\w]", "", s2)
            return clean1 != clean2

        return s1 != s2

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

        # Priority 1: Candidates with verified status PRESENT
        present_candidates = [
            c for c in candidates
            if c.status == ExtractionStatus.PRESENT and c.value and c.value.strip()
        ]
        if present_candidates:
            if len(present_candidates) == 1:
                return present_candidates[0]

            # Multiple PRESENT candidates: Check for conflicts vs duplicates
            has_conflict = False
            first_val = present_candidates[0].value or ""
            for other in present_candidates[1:]:
                if self._are_values_conflicting(field_name, first_val, other.value or ""):
                    has_conflict = True
                    break

            if has_conflict:
                conflicts_list = [
                    {
                        "panel": c.source_panel or "UNKNOWN",
                        "value": c.value,
                        "image_id": c.source_image_id or "UNKNOWN",
                        "confidence": c.confidence,
                    }
                    for c in present_candidates
                ]
                conflict_summary = " vs ".join([f"{c['panel']}: {c['value']}" for c in conflicts_list])
                return FieldResult[str](
                    value=f"Conflicting values: {conflict_summary}",
                    status=ExtractionStatus.UNCLEAR,
                    confidence=max(c.confidence for c in present_candidates),
                    raw_text=present_candidates[0].raw_text,
                    source_panel=present_candidates[0].source_panel,
                    source_image_id=present_candidates[0].source_image_id,
                    conflicts=conflicts_list,
                )

            # Consistent / duplicate: Pick highest confidence as primary and record additional sources
            primary = max(
                present_candidates,
                key=lambda c: (c.confidence, len(c.value or ""))
            )
            additional = [c for c in present_candidates if c != primary]
            additional_sources = [
                {
                    "panel": c.source_panel or "UNKNOWN",
                    "value": c.value,
                    "image_id": c.source_image_id or "UNKNOWN",
                    "confidence": c.confidence,
                }
                for c in additional
            ]
            primary.additional_sources = additional_sources
            return primary

        # Priority 2: Candidates with status UNCLEAR
        unclear_candidates = [
            c for c in candidates
            if c.status == ExtractionStatus.UNCLEAR and c.value and c.value.strip()
        ]
        if unclear_candidates:
            if len(unclear_candidates) == 1:
                return unclear_candidates[0]

            has_conflict = False
            first_val = unclear_candidates[0].value or ""
            for other in unclear_candidates[1:]:
                if self._are_values_conflicting(field_name, first_val, other.value or ""):
                    has_conflict = True
                    break

            if has_conflict:
                conflicts_list = [
                    {
                        "panel": c.source_panel or "UNKNOWN",
                        "value": c.value,
                        "image_id": c.source_image_id or "UNKNOWN",
                        "confidence": c.confidence,
                    }
                    for c in unclear_candidates
                ]
                conflict_summary = " vs ".join([f"{c['panel']}: {c['value']}" for c in conflicts_list])
                return FieldResult[str](
                    value=f"Conflicting values: {conflict_summary}",
                    status=ExtractionStatus.UNCLEAR,
                    confidence=max(c.confidence for c in unclear_candidates),
                    raw_text=unclear_candidates[0].raw_text,
                    source_panel=unclear_candidates[0].source_panel,
                    source_image_id=unclear_candidates[0].source_image_id,
                    conflicts=conflicts_list,
                )

            primary = max(unclear_candidates, key=lambda c: (c.confidence, len(c.value or "")))
            additional = [c for c in unclear_candidates if c != primary]
            primary.additional_sources = [
                {
                    "panel": c.source_panel or "UNKNOWN",
                    "value": c.value,
                    "image_id": c.source_image_id or "UNKNOWN",
                    "confidence": c.confidence,
                }
                for c in additional
            ]
            return primary

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
