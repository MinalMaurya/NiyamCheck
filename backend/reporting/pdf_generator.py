import io
from typing import List, Tuple, Dict, Any
from PIL import Image, ImageDraw

from backend.reporting.models import InspectionReport
from backend.compliance.models import ComplianceStatus, RuleStatus


class PDFReportGenerator:
    """
    Renders high-resolution, professional Legal Metrology Inspection Reports in PDF format.
    Uses PIL's native PDF generation engine with zero external C-dependencies.
    Generates a unified, consumer-friendly multi-panel product compliance inspection report.
    """

    A4_WIDTH = 1240
    A4_HEIGHT = 1754

    STATUS_COLORS = {
        ComplianceStatus.COMPLIANT: ((24, 134, 75), (255, 255, 255)),            # Green
        ComplianceStatus.PARTIALLY_VERIFIABLE: ((217, 119, 6), (255, 255, 255)), # Amber
        ComplianceStatus.NON_COMPLIANT: ((220, 38, 38), (255, 255, 255)),       # Red
        ComplianceStatus.POTENTIAL_ISSUES: ((220, 38, 38), (255, 255, 255)),    # Red
        ComplianceStatus.NEEDS_REVIEW: ((217, 119, 6), (255, 255, 255)),        # Amber
        ComplianceStatus.NOT_VERIFIABLE: ((107, 114, 128), (255, 255, 255)),    # Gray
    }

    RULE_STATUS_COLORS = {
        RuleStatus.PASS: (24, 134, 75),
        RuleStatus.FAIL: (220, 38, 38),
        RuleStatus.POTENTIAL_ISSUE: (220, 38, 38),
        RuleStatus.UNCLEAR: (217, 119, 6),
        RuleStatus.REVIEW: (217, 119, 6),
        RuleStatus.NOT_VERIFIABLE: (107, 114, 128),
        RuleStatus.NOT_APPLICABLE: (75, 85, 99),
    }

    def generate_pdf(self, report: InspectionReport) -> bytes:
        """Generates PDF bytes for the given InspectionReport across 3 structured pages."""
        pages: List[Image.Image] = []

        # =========================================================================
        # --- PAGE 1: Header, Product Info, Package Coverage & Executive Summary ---
        # =========================================================================
        p1 = Image.new("RGB", (self.A4_WIDTH, self.A4_HEIGHT), color=(255, 255, 255))
        d1 = ImageDraw.Draw(p1)

        # Header Banner
        d1.rectangle([0, 0, self.A4_WIDTH, 140], fill=(24, 43, 73))
        d1.text((50, 28), "NIYAMCHECK", fill=(255, 255, 255))
        d1.text((50, 58), "CONSUMER PRODUCT PACKAGING INSPECTION REPORT", fill=(220, 230, 245))
        d1.text((50, 88), "AI-Assisted Legal Metrology (Packaged Commodities) Rules, 2011 Compliance Analysis", fill=(180, 200, 225))

        # Metadata Bar
        d1.rectangle([50, 155, self.A4_WIDTH - 50, 245], fill=(245, 247, 250), outline=(210, 215, 225), width=1)
        prod_name = report.product_information.get("product_name") or "Unverified Product Identity"
        d1.text((70, 168), f"Inspection ID: {report.inspection_id}", fill=(20, 20, 20))
        d1.text((70, 192), f"Product Name: {prod_name[:48]}", fill=(20, 20, 20))
        d1.text((70, 216), f"Product Category: {report.product_category or 'Packaged Commodity'}", fill=(20, 20, 20))

        d1.text((650, 168), f"Inspection Date: {report.generated_at.strftime('%Y-%m-%d %H:%M:%S UTC')}", fill=(60, 60, 60))
        d1.text((650, 192), f"Package Panels Submitted: {report.image_count}", fill=(20, 20, 20))
        d1.text((650, 216), f"Audit Hash: {report.integrity_hash[:22]}...", fill=(80, 80, 80))

        # Overall Status Verdict Banner
        badge_bg, badge_fg = self.STATUS_COLORS.get(report.overall_status, ((100, 100, 100), (255, 255, 255)))
        d1.rectangle([50, 260, self.A4_WIDTH - 50, 315], fill=badge_bg)
        verdict_label = (
            "APPEARS COMPLIANT" if report.overall_status == ComplianceStatus.COMPLIANT else
            "PARTIALLY VERIFIABLE (ADDITIONAL PANELS NEEDED)" if report.overall_status == ComplianceStatus.PARTIALLY_VERIFIABLE else
            "POTENTIAL COMPLIANCE ISSUES IDENTIFIED" if report.overall_status in (ComplianceStatus.NON_COMPLIANT, ComplianceStatus.POTENTIAL_ISSUES) else
            "NEEDS REVIEW" if report.overall_status == ComplianceStatus.NEEDS_REVIEW else
            "COULD NOT BE FULLY VERIFIED"
        )
        d1.text((70, 278), f"OVERALL COMPLIANCE SCREENING VERDICT: {verdict_label}", fill=badge_fg)

        # Inspection Summary Metrics Box
        y_cursor = 330
        d1.text((50, y_cursor), "INSPECTION SUMMARY", fill=(24, 43, 73))
        y_cursor += 24
        d1.rectangle([50, y_cursor, self.A4_WIDTH - 50, y_cursor + 45], fill=(248, 250, 252), outline=(210, 215, 225))

        counts = report.summary_counts or {}
        sat_cnt = counts.get("satisfied", sum(1 for e in report.compliance.evaluations if e.status == RuleStatus.PASS))
        rev_cnt = counts.get("review", sum(1 for e in report.compliance.evaluations if e.status in (RuleStatus.REVIEW, RuleStatus.UNCLEAR)))
        iss_cnt = counts.get("potential_issues", sum(1 for e in report.compliance.evaluations if e.status in (RuleStatus.FAIL, RuleStatus.POTENTIAL_ISSUE)))
        unv_cnt = counts.get("not_verifiable", sum(1 for e in report.compliance.evaluations if e.status == RuleStatus.NOT_VERIFIABLE))

        d1.text((70, y_cursor + 14), f"[PASS] Satisfied: {sat_cnt}", fill=(24, 134, 75))
        d1.text((340, y_cursor + 14), f"[REVIEW] Needs Review: {rev_cnt}", fill=(217, 119, 6))
        d1.text((620, y_cursor + 14), f"[ISSUE] Potential Issues: {iss_cnt}", fill=(220, 38, 38))
        d1.text((910, y_cursor + 14), f"[UNVERIFIED] Could Not Verify: {unv_cnt}", fill=(107, 114, 128))
        y_cursor += 60

        # Package Coverage (Standard 6 Panels)
        d1.text((50, y_cursor), "PACKAGE COVERAGE ANALYSIS", fill=(24, 43, 73))
        y_cursor += 24

        submitted_set = set(p.upper() for p in (report.submitted_panels or []))
        if not submitted_set and report.image_count > 0:
            submitted_set = {"BACK"}  # fallback representation

        standard_panels = [
            ("Front Panel", "FRONT"),
            ("Back Panel", "BACK"),
            ("Left Side Panel", "LEFT"),
            ("Right Side Panel", "RIGHT"),
            ("Top Panel", "TOP"),
            ("Bottom Panel", "BOTTOM"),
        ]

        d1.rectangle([50, y_cursor, self.A4_WIDTH - 50, y_cursor + 95], fill=(252, 253, 255), outline=(210, 215, 225))
        col_x = [70, 440, 810]
        row_y = [y_cursor + 14, y_cursor + 44]

        for idx, (label, code) in enumerate(standard_panels):
            cx = col_x[idx % 3]
            cy = row_y[idx // 3]
            is_sub = code in submitted_set
            sym = "[x] Submitted" if is_sub else "[o] Not submitted"
            color = (24, 134, 75) if is_sub else (140, 140, 140)
            d1.text((cx, cy), f"• {label}:", fill=(40, 40, 40))
            d1.text((cx + 170, cy), sym, fill=color)

        # Single Panel Limited Coverage Advisory
        if len(submitted_set) <= 1:
            adv_text = "Notice: Only 1 package panel was submitted. Statutory declarations not observed on this panel are flagged for review rather than assumed missing."
            d1.text((70, y_cursor + 72), adv_text, fill=(180, 90, 10))

        y_cursor += 115

        # Product Information Table
        d1.text((50, y_cursor), "1. VERIFIED PRODUCT DECLARATIONS", fill=(24, 43, 73))
        y_cursor += 25
        d1.rectangle([50, y_cursor, self.A4_WIDTH - 50, y_cursor + 270], fill=(250, 251, 253), outline=(210, 215, 225))

        prod_info = report.product_information
        info_items = [
            ("Generic Commodity Name", prod_info.get("product_name") or "(Not verified from submitted images)"),
            ("Net Quantity Declaration", prod_info.get("net_quantity") or "(Not verified from submitted images)"),
            ("Maximum Retail Price (MRP)", prod_info.get("mrp") or "(Not verified from submitted images)"),
            ("Manufacturer / Packer", prod_info.get("manufacturer") or "(Not verified from submitted images)"),
            ("Postal Address & PIN", prod_info.get("address") or "(Not verified from submitted images)"),
            ("Date of Mfg / Packing", prod_info.get("date_information") or "(Not verified from submitted images)"),
            ("Consumer Care Redressal", prod_info.get("consumer_care") or "(Not verified from submitted images)"),
            ("Country of Origin", prod_info.get("country_of_origin") or "(Not verified from submitted images)"),
        ]

        row_y_cur = y_cursor + 14
        for label, val in info_items:
            d1.text((70, row_y_cur), f"• {label}:", fill=(40, 40, 40))
            val_str = str(val) if val else "(Not verified)"
            d1.text((340, row_y_cur), val_str[:95], fill=(20, 20, 20))
            row_y_cur += 30

        # Summary Assessment Text
        y_cursor += 295
        d1.text((50, y_cursor), "Executive Screening Assessment:", fill=(24, 43, 73))
        self._draw_wrapped_text(d1, report.summary, 50, y_cursor + 24, 1100, fill=(50, 50, 50))

        # Footer Page 1
        d1.text((50, self.A4_HEIGHT - 50), "NiyamCheck Compliance Platform • Consumer Product Inspection Report • Page 1 of 3", fill=(120, 120, 120))
        pages.append(p1)

        # =========================================================================
        # --- PAGE 2: Detailed Requirement-by-Requirement Findings ---
        # =========================================================================
        p2 = Image.new("RGB", (self.A4_WIDTH, self.A4_HEIGHT), color=(255, 255, 255))
        d2 = ImageDraw.Draw(p2)

        # Header Banner Page 2
        d2.rectangle([0, 0, self.A4_WIDTH, 90], fill=(24, 43, 73))
        d2.text((50, 25), "NIYAMCHECK — STATUTORY RULE-BY-RULE DETAILED FINDINGS", fill=(255, 255, 255))
        d2.text((50, 52), "Evaluated against codified Legal Metrology (Packaged Commodities) Rules, 2011 requirements", fill=(210, 225, 245))

        y2 = 110
        d2.text((50, y2), "2. STATUTORY REQUIREMENT EVALUATION BREAKDOWN", fill=(24, 43, 73))
        y2 += 25

        # Render structured findings cards
        findings = report.structured_findings or []
        if not findings and report.compliance.evaluations:
            # Fallback construct from evaluations
            for ev in report.compliance.evaluations:
                findings.append({
                    "rule_id": ev.rule_id,
                    "name": ev.name,
                    "requirement": ev.requirement or ev.name,
                    "status": ev.status.value,
                    "detected_value": ev.detected_value,
                    "package_panel": ev.package_panel or "Submitted Panels",
                    "explanation": ev.reason,
                    "why_flagged": ev.why_flagged or ev.reason,
                    "what_can_i_do": ev.what_can_i_do or "Verify on complete physical package.",
                    "legal_source": ev.legal_source or "Legal Metrology Rules, 2011",
                })

        for f in findings[:8]:
            card_height = 180
            d2.rectangle([50, y2, self.A4_WIDTH - 50, y2 + card_height], fill=(253, 254, 255), outline=(220, 225, 235), width=1)

            st_val = (f.get("status") or "REVIEW").upper()
            if st_val == "PASS":
                st_badge = "[v] Detected / Satisfied"
                st_color = (24, 134, 75)
            elif st_val in ("FAIL", "POTENTIAL_ISSUE"):
                st_badge = "[!] Potential Compliance Issue"
                st_color = (220, 38, 38)
            elif st_val == "NOT_VERIFIABLE":
                st_badge = "[?] Could Not Be Verified"
                st_color = (107, 114, 128)
            else:
                st_badge = "[?] Needs Review"
                st_color = (217, 119, 6)

            # Rule Name & Status
            rule_id = f.get("rule_id", "LM-REQ")
            name = f.get("name", "Statutory Requirement")
            d2.text((70, y2 + 12), f"{name} ({rule_id})", fill=(24, 43, 73))
            d2.text((750, y2 + 12), st_badge, fill=st_color)

            # Detected Value and Package Panel
            det_val = f.get("detected_value") or "Not clearly detected in submitted images"
            panel_name = f.get("package_panel") or "Submitted packaging surfaces"
            d2.text((70, y2 + 38), "• Detected Evidence:", fill=(60, 60, 60))
            d2.text((220, y2 + 38), str(det_val)[:85], fill=(20, 20, 20))
            d2.text((70, y2 + 62), "• Package Panel:", fill=(60, 60, 60))
            d2.text((220, y2 + 62), str(panel_name)[:85], fill=(20, 20, 20))

            # Cross-panel sources (duplicate / conflict)
            if f.get("conflicts"):
                conflict_summary = "; ".join(f"{c.get('panel')}: {c.get('value')}" for c in f["conflicts"])
                d2.text((70, y2 + 86), "• Conflict Detected:", fill=(180, 40, 20))
                d2.text((220, y2 + 86), conflict_summary[:85], fill=(180, 40, 20))
            elif f.get("additional_sources"):
                also = ", ".join(s.get("panel", "") for s in f["additional_sources"])
                d2.text((70, y2 + 86), "• Additional Panels:", fill=(24, 134, 75))
                d2.text((220, y2 + 86), f"Also detected on: {also}"[:85], fill=(24, 134, 75))
            else:
                comp_st = f.get("completeness_status") or "COMPLETE"
                read_st = f.get("readability_status") or "CLEAR"
                place_st = f.get("placement_status") or "COMPLIANT_PDP"
                d2.text((70, y2 + 86), "• Multimodal Audit:", fill=(60, 60, 60))
                d2.text((220, y2 + 86), f"Completeness: {comp_st} | Readability: {read_st} | Placement: {place_st}"[:85], fill=(30, 41, 59))

            # Action / What to verify
            action_text = f.get("what_can_i_do") or "Verify on physical package."
            d2.text((70, y2 + 112), "• What to Verify:", fill=(24, 43, 73))
            d2.text((220, y2 + 112), action_text[:90], fill=(50, 50, 50))

            # Legal source
            leg_src = f.get("legal_source") or "Legal Metrology (Packaged Commodities) Rules, 2011"
            d2.text((70, y2 + 138), "• Applicable Source:", fill=(100, 100, 100))
            d2.text((220, y2 + 138), leg_src[:90], fill=(80, 80, 80))

            y2 += card_height + 15

        # Footer Page 2
        d2.text((50, self.A4_HEIGHT - 50), "NiyamCheck Compliance Platform • Consumer Product Inspection Report • Page 2 of 3", fill=(120, 120, 120))
        pages.append(p2)

        # =========================================================================
        # --- PAGE 3: Visual Evidence Audit Trail, What You Can Do Next & Disclaimer ---
        # =========================================================================
        p3 = Image.new("RGB", (self.A4_WIDTH, self.A4_HEIGHT), color=(255, 255, 255))
        d3 = ImageDraw.Draw(p3)

        # Header Banner Page 3
        d3.rectangle([0, 0, self.A4_WIDTH, 90], fill=(24, 43, 73))
        d3.text((50, 25), "NIYAMCHECK — VISUAL EVIDENCE REGISTRY & CONSUMER GUIDANCE", fill=(255, 255, 255))
        d3.text((50, 52), "Traceable Bounding Box Evidence, Practical Next Steps, and Regulatory Disclaimers", fill=(210, 225, 245))

        y3 = 115
        d3.text((50, y3), "3. LOCALIZED OCR EVIDENCE REGISTRY", fill=(24, 43, 73))
        y3 += 25

        # Table Header Evidence
        d3.rectangle([50, y3, self.A4_WIDTH - 50, y3 + 32], fill=(235, 240, 248))
        d3.text((65, y3 + 8), "Evidence ID", fill=(20, 20, 20))
        d3.text((200, y3 + 8), "Image / Panel", fill=(20, 20, 20))
        d3.text((380, y3 + 8), "Confidence", fill=(20, 20, 20))
        d3.text((510, y3 + 8), "Normalized Bounding Box [ymin, xmin, ymax, xmax]", fill=(20, 20, 20))
        d3.text((910, y3 + 8), "Detected Text Snippet", fill=(20, 20, 20))
        y3 += 32

        if report.evidence:
            for item in report.evidence[:8]:
                d3.rectangle([50, y3, self.A4_WIDTH - 50, y3 + 36], outline=(225, 230, 235), width=1)
                d3.text((65, y3 + 10), item.evidence_id, fill=(30, 30, 30))
                d3.text((200, y3 + 10), f"{item.image_id} ({item.panel})", fill=(40, 40, 40))
                d3.text((380, y3 + 10), f"{item.confidence:.2f}", fill=(40, 40, 40))

                bbox_str = f"[{item.bounding_box.ymin}, {item.bounding_box.xmin}, {item.bounding_box.ymax}, {item.bounding_box.xmax}]" if item.bounding_box else "(Unlocalized)"
                d3.text((510, y3 + 10), bbox_str, fill=(50, 50, 50))
                d3.text((910, y3 + 10), item.text[:35], fill=(20, 20, 20))
                y3 += 36
        else:
            d3.text((70, y3 + 15), "(No visual bounding box evidence locatable from scanned images)", fill=(100, 100, 100))
            y3 += 45

        y3 += 35
        # Dedicated Section: WHAT YOU CAN DO NEXT
        d3.text((50, y3), "4. WHAT YOU CAN DO NEXT", fill=(24, 43, 73))
        y3 += 25
        d3.rectangle([50, y3, self.A4_WIDTH - 50, y3 + 265], fill=(252, 253, 255), outline=(210, 220, 235), width=1)

        d3.text((70, y3 + 16), "Practical recommendations for consumers based on this screening result:", fill=(24, 43, 73))

        steps = report.what_you_can_do_next or [
            "1. Review the finding against the complete physical product packaging.",
            "2. Keep your purchase invoice, store bill, or digital receipt.",
            "3. Save clear photographs of the product, packaging panels, and batch codes.",
            "4. Contact the responsible company or customer care cell for clarification if appropriate.",
            "5. If the issue remains unresolved, you may consult the relevant official consumer/government grievance procedure.",
        ]

        step_y = y3 + 45
        for s in steps[:6]:
            d3.text((70, step_y), "•", fill=(59, 130, 246))
            self._draw_wrapped_text(d3, s, 90, step_y, 1050, fill=(40, 40, 40))
            step_y += 34

        y3 += 295

        # Statutory Scope & Limitations Notice
        d3.text((50, y3), "5. STATUTORY SCOPE & LIMITATIONS NOTICE", fill=(24, 43, 73))
        y3 += 25
        d3.rectangle([50, y3, self.A4_WIDTH - 50, y3 + 200], fill=(253, 248, 240), outline=(240, 220, 190), width=1)

        limitations = report.limitations or [
            "This inspection evaluates observable packaging declarations under Rule 6 of the Legal Metrology (Packaged Commodities) Rules, 2011.",
            "Unphotographed packaging panels are conservatively marked NOT_VERIFIABLE rather than assumed missing.",
            "Physical dimensions and font-height-to-Principal-Display-Panel area ratios are not evaluated in this software milestone.",
            "Deterministic audit integrity is preserved via the SHA-256 canonical inspection digest.",
        ]

        lim_y = y3 + 15
        for lim in limitations[:4]:
            d3.text((70, lim_y), "•", fill=(180, 80, 20))
            self._draw_wrapped_text(d3, lim, 90, lim_y, 1050, fill=(70, 50, 30))
            lim_y += 38

        y3 += 225

        # AI-Assisted Informational Disclaimer Box
        d3.rectangle([50, y3, self.A4_WIDTH - 50, y3 + 105], fill=(245, 247, 252), outline=(200, 215, 235), width=1)
        d3.text((70, y3 + 14), "AI-Assisted Informational Analysis Disclaimer:", fill=(24, 43, 73))
        disc_text = (
            report.disclaimer or
            "This is an AI-assisted informational analysis based on the submitted evidence and referenced sources. "
            "It is not a final legal determination. NiyamCheck does not determine that a company has legally violated "
            "a requirement solely from this inspection."
        )
        self._draw_wrapped_text(d3, disc_text, 70, y3 + 38, 1080, fill=(60, 60, 60))

        y3 += 125

        # Integrity Hash Box
        d3.rectangle([50, y3, self.A4_WIDTH - 50, y3 + 60], fill=(245, 247, 250), outline=(210, 215, 225))
        d3.text((70, y3 + 12), "Audit Integrity Hash (SHA-256 Canonical Inspection Digest):", fill=(24, 43, 73))
        d3.text((70, y3 + 34), report.integrity_hash, fill=(20, 20, 20))

        # Footer Page 3
        d3.text((50, self.A4_HEIGHT - 50), "NiyamCheck Compliance Platform • Consumer Product Inspection Report • Page 3 of 3", fill=(120, 120, 120))
        pages.append(p3)

        # Save pages to PDF bytes using PIL's native PDF writer
        buf = io.BytesIO()
        pages[0].save(buf, format="PDF", save_all=True, append_images=pages[1:])
        return buf.getvalue()

    def _draw_wrapped_text(self, draw: ImageDraw.ImageDraw, text: str, x: int, y: int, max_width: int, fill=(0, 0, 0)):
        """Text line wrapping helper."""
        words = text.split()
        lines = []
        cur_line = []
        for word in words:
            test_line = " ".join(cur_line + [word])
            # approx 7.5 pixels per character at default bitmap font size
            if len(test_line) * 7.5 > max_width and cur_line:
                lines.append(" ".join(cur_line))
                cur_line = [word]
            else:
                cur_line.append(word)
        if cur_line:
            lines.append(" ".join(cur_line))

        cur_y = y
        for l in lines:
            draw.text((x, cur_y), l, fill=fill)
            cur_y += 18


pdf_report_generator = PDFReportGenerator()
