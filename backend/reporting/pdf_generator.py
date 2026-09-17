import io
from typing import List, Tuple
from PIL import Image, ImageDraw

from backend.reporting.models import InspectionReport
from backend.compliance.models import ComplianceStatus, RuleStatus


class PDFReportGenerator:
    """
    Renders high-resolution, professional Legal Metrology Inspection Reports in PDF format.
    Uses PIL's native PDF generation engine with zero external C-dependencies.
    """

    A4_WIDTH = 1240
    A4_HEIGHT = 1754

    STATUS_COLORS = {
        ComplianceStatus.COMPLIANT: ((24, 134, 75), (255, 255, 255)),            # Green
        ComplianceStatus.PARTIALLY_VERIFIABLE: ((217, 119, 6), (255, 255, 255)), # Amber
        ComplianceStatus.NON_COMPLIANT: ((220, 38, 38), (255, 255, 255)),       # Red
        ComplianceStatus.NOT_VERIFIABLE: ((107, 114, 128), (255, 255, 255)),    # Gray
    }

    RULE_STATUS_COLORS = {
        RuleStatus.PASS: (24, 134, 75),
        RuleStatus.FAIL: (220, 38, 38),
        RuleStatus.UNCLEAR: (217, 119, 6),
        RuleStatus.NOT_VERIFIABLE: (107, 114, 128),
        RuleStatus.NOT_APPLICABLE: (75, 85, 99),
    }

    def generate_pdf(self, report: InspectionReport) -> bytes:
        """Generates PDF bytes for the given InspectionReport."""
        pages: List[Image.Image] = []

        # --- PAGE 1: Executive Summary, Product Info & Rule Findings ---
        p1 = Image.new("RGB", (self.A4_WIDTH, self.A4_HEIGHT), color=(255, 255, 255))
        d1 = ImageDraw.Draw(p1)

        # Header Banner
        d1.rectangle([0, 0, self.A4_WIDTH, 140], fill=(24, 43, 73))
        d1.text((50, 35), "NIYAMCHECK", fill=(255, 255, 255))
        d1.text((50, 60), "LEGAL METROLOGY PACKAGING COMPLIANCE INSPECTION REPORT", fill=(220, 230, 245))
        d1.text((50, 85), "Statutory Reference: Legal Metrology (Packaged Commodities) Rules, 2011", fill=(180, 200, 225))

        # Metadata Bar
        d1.rectangle([50, 160, self.A4_WIDTH - 50, 230], fill=(245, 247, 250), outline=(210, 215, 225), width=1)
        d1.text((70, 175), f"Inspection ID: {report.inspection_id}", fill=(20, 20, 20))
        d1.text((70, 200), f"Generated: {report.generated_at.strftime('%Y-%m-%d %H:%M:%S UTC')}", fill=(60, 60, 60))
        d1.text((650, 175), f"Images Analyzed: {report.image_count}", fill=(20, 20, 20))
        d1.text((650, 200), f"Integrity Hash (SHA-256): {report.integrity_hash[:20]}...", fill=(80, 80, 80))

        # Overall Status Badge
        badge_bg, badge_fg = self.STATUS_COLORS.get(report.overall_status, ((100, 100, 100), (255, 255, 255)))
        d1.rectangle([50, 250, self.A4_WIDTH - 50, 310], fill=badge_bg)
        d1.text((70, 270), f"OVERALL COMPLIANCE VERDICT: {report.overall_status.value}", fill=badge_fg)

        # Summary paragraph
        d1.text((50, 330), "Summary Assessment:", fill=(24, 43, 73))
        # Wrap summary lines
        self._draw_wrapped_text(d1, report.summary, 50, 355, 1100, fill=(50, 50, 50))

        # Product Information Table
        y_cursor = 420
        d1.text((50, y_cursor), "1. VERIFIED PRODUCT DECLARATIONS", fill=(24, 43, 73))
        y_cursor += 30
        d1.rectangle([50, y_cursor, self.A4_WIDTH - 50, y_cursor + 240], fill=(250, 251, 253), outline=(210, 215, 225))

        prod_info = report.product_information
        info_items = [
            ("Product Name", prod_info.get("product_name") or "(Not verified)"),
            ("Net Quantity", prod_info.get("net_quantity") or "(Not verified)"),
            ("Maximum Retail Price (MRP)", prod_info.get("mrp") or "(Not verified)"),
            ("Manufacturer", prod_info.get("manufacturer") or "(Not verified)"),
            ("Address & PIN", prod_info.get("address") or "(Not verified)"),
            ("Date (Mfg/Pack)", prod_info.get("date_information") or "(Not verified)"),
            ("Consumer Care", prod_info.get("consumer_care") or "(Not verified)"),
            ("Country of Origin", prod_info.get("country_of_origin") or "(Not verified)"),
        ]

        row_y = y_cursor + 15
        for label, val in info_items:
            d1.text((70, row_y), f"• {label}:", fill=(40, 40, 40))
            d1.text((320, row_y), str(val)[:90], fill=(20, 20, 20))
            row_y += 26

        # Rule Evaluations Table
        y_cursor += 270
        d1.text((50, y_cursor), "2. STATUTORY RULE-BY-RULE FINDINGS", fill=(24, 43, 73))
        y_cursor += 30

        # Table Header
        d1.rectangle([50, y_cursor, self.A4_WIDTH - 50, y_cursor + 35], fill=(235, 240, 248))
        d1.text((65, y_cursor + 10), "Rule ID", fill=(20, 20, 20))
        d1.text((180, y_cursor + 10), "Rule Name", fill=(20, 20, 20))
        d1.text((520, y_cursor + 10), "Status", fill=(20, 20, 20))
        d1.text((680, y_cursor + 10), "Finding Rationale", fill=(20, 20, 20))
        y_cursor += 35

        for ev in report.compliance.evaluations[:8]:
            d1.rectangle([50, y_cursor, self.A4_WIDTH - 50, y_cursor + 45], outline=(225, 230, 235), width=1)
            d1.text((65, y_cursor + 12), ev.rule_id, fill=(30, 30, 30))
            d1.text((180, y_cursor + 12), ev.name[:36], fill=(30, 30, 30))

            # Status pill text
            st_color = self.RULE_STATUS_COLORS.get(ev.status, (50, 50, 50))
            d1.text((520, y_cursor + 12), ev.status.value, fill=st_color)
            d1.text((680, y_cursor + 12), ev.reason[:60], fill=(50, 50, 50))
            y_cursor += 45

        # Footer Page 1
        d1.text((50, self.A4_HEIGHT - 60), "NiyamCheck Compliance Platform • Team CodeHexa (SIH 2026) • Page 1 of 2", fill=(120, 120, 120))
        pages.append(p1)

        # --- PAGE 2: Evidence Audit Trail & Limitations ---
        p2 = Image.new("RGB", (self.A4_WIDTH, self.A4_HEIGHT), color=(255, 255, 255))
        d2 = ImageDraw.Draw(p2)

        # Header Banner Page 2
        d2.rectangle([0, 0, self.A4_WIDTH, 90], fill=(24, 43, 73))
        d2.text((50, 35), "NIYAMCHECK — VISUAL EVIDENCE AUDIT TRAIL", fill=(255, 255, 255))

        y2 = 120
        d2.text((50, y2), "3. LOCALIZED OCR EVIDENCE REGISTRY", fill=(24, 43, 73))
        y2 += 30

        # Table Header Evidence
        d2.rectangle([50, y2, self.A4_WIDTH - 50, y2 + 35], fill=(235, 240, 248))
        d2.text((65, y2 + 10), "Evidence ID", fill=(20, 20, 20))
        d2.text((200, y2 + 10), "Image / Panel", fill=(20, 20, 20))
        d2.text((360, y2 + 10), "Conf", fill=(20, 20, 20))
        d2.text((450, y2 + 10), "Normalized Bounding Box [ymin, xmin, ymax, xmax]", fill=(20, 20, 20))
        d2.text((860, y2 + 10), "Detected Raw Text Snippet", fill=(20, 20, 20))
        y2 += 35

        if report.evidence:
            for item in report.evidence[:14]:
                d2.rectangle([50, y2, self.A4_WIDTH - 50, y2 + 45], outline=(225, 230, 235), width=1)
                d2.text((65, y2 + 12), item.evidence_id, fill=(30, 30, 30))
                d2.text((200, y2 + 12), f"{item.image_id} ({item.panel})", fill=(40, 40, 40))
                d2.text((360, y2 + 12), f"{item.confidence:.2f}", fill=(40, 40, 40))

                bbox_str = f"[{item.bounding_box.ymin}, {item.bounding_box.xmin}, {item.bounding_box.ymax}, {item.bounding_box.xmax}]" if item.bounding_box else "(Unlocalized)"
                d2.text((450, y2 + 12), bbox_str, fill=(50, 50, 50))
                d2.text((860, y2 + 12), item.text[:35], fill=(20, 20, 20))
                y2 += 45
        else:
            d2.text((70, y2 + 20), "(No visual bounding box evidence locatable from scanned images)", fill=(100, 100, 100))
            y2 += 60

        y2 += 40
        d2.text((50, y2), "4. STATUTORY SCOPE & LIMITATIONS NOTICE", fill=(24, 43, 73))
        y2 += 30
        d2.rectangle([50, y2, self.A4_WIDTH - 50, y2 + 220], fill=(253, 248, 240), outline=(240, 220, 190), width=1)

        limitations = report.limitations or [
            "This inspection report covers baseline observable text declarations under Rule 6 of Legal Metrology Rules, 2011.",
            "Declarations not captured in submitted image angles are classified as NOT_VERIFIABLE rather than legally absent.",
            "This report does not measure physical package surface area or font-height-to-PDP ratios.",
            "Audit integrity is secured via the SHA-256 hash printed on this document.",
        ]

        lim_y = y2 + 20
        for lim in limitations:
            d2.text((70, lim_y), "•", fill=(180, 80, 20))
            self._draw_wrapped_text(d2, lim, 90, lim_y, 1050, fill=(70, 50, 30))
            lim_y += 40

        # Integrity Hash Box
        y2 += 260
        d2.rectangle([50, y2, self.A4_WIDTH - 50, y2 + 70], fill=(245, 247, 250), outline=(210, 215, 225))
        d2.text((70, y2 + 15), "Audit Integrity Hash (SHA-256 Canonical Inspection Digest):", fill=(24, 43, 73))
        d2.text((70, y2 + 40), report.integrity_hash, fill=(20, 20, 20))

        # Footer Page 2
        d2.text((50, self.A4_HEIGHT - 60), "NiyamCheck Compliance Platform • Team CodeHexa (SIH 2026) • Page 2 of 2", fill=(120, 120, 120))
        pages.append(p2)

        # Save pages to PDF bytes using PIL's native PDF writer
        buf = io.BytesIO()
        pages[0].save(buf, format="PDF", save_all=True, append_images=pages[1:])
        return buf.getvalue()

    def _draw_wrapped_text(self, draw: ImageDraw.ImageDraw, text: str, x: int, y: int, max_width: int, fill=(0, 0, 0)):
        """Simple text line wrapping helper."""
        words = text.split()
        lines = []
        cur_line = []
        for word in words:
            test_line = " ".join(cur_line + [word])
            # approx 7 pixels per character at default bitmap font size
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
