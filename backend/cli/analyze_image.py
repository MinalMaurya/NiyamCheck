import sys
import os
import argparse
from pathlib import Path
from PIL import Image, ImageDraw
import io

# Add project root to sys.path
root_dir = str(Path(__file__).resolve().parent.parent.parent)
if root_dir not in sys.path:
    sys.path.insert(0, root_dir)

from backend.services.analysis_service import analysis_service
from backend.inspections.models import PanelType, InspectionImage
from backend.inspections.aggregator import session_aggregator
from backend.reporting.report_service import report_service


def generate_sample_image_bytes() -> bytes:
    """Generates a synthetic package label image for CLI demo/testing when no image path is passed."""
    img = Image.new("RGB", (600, 600), color=(180, 180, 180))
    draw = ImageDraw.Draw(img)
    # Draw border
    draw.rectangle([10, 10, 590, 590], outline=(30, 30, 30), width=3)
    # High-contrast declarations
    draw.text((40, 40), "BRITANNIA GOOD DAY BISCUITS", fill=(10, 10, 10))
    draw.text((40, 100), "NET QUANTITY: 200 g", fill=(10, 10, 10))
    draw.text((40, 160), "M.R.P. Rs. 40.00 (INCL. OF ALL TAXES)", fill=(10, 10, 10))
    draw.text((40, 220), "MFD. DATE: 08/2026", fill=(10, 10, 10))
    draw.text((40, 280), "MANUFACTURED BY: BRITANNIA INDUSTRIES LTD., KOLKATA - 700017", fill=(10, 10, 10))
    draw.text((40, 340), "CONSUMER CARE: 1800-425-4449 / CARE@BRITANNIA.CO.IN", fill=(10, 10, 10))
    draw.text((40, 400), "COUNTRY OF ORIGIN: INDIA", fill=(10, 10, 10))
    buf = io.BytesIO()
    img.save(buf, format="JPEG")
    return buf.getvalue()


def print_single_result(result, image_name: str = "img-001"):
    print("Image Quality")
    print("-------------")
    print(f"Status: {result.image_quality.status.value}")
    print(f"Score: {result.image_quality.score:.2f}")
    if result.image_quality.issues:
        print("Issues:")
        for issue in result.image_quality.issues:
            print(f"  - {issue}")

    print("\nOCR")
    print("---")
    print(result.ocr.text if result.ocr.text else "(No text detected)")

    print("\nExtracted Fields")
    print("----------------")
    fields = result.fields

    def format_val(f):
        return f.value if f.value else "null"

    print(f"Product Name: {format_val(fields.product_name)}")
    print(f"Manufacturer: {format_val(fields.manufacturer)}")
    print(f"Address: {format_val(fields.address)}")
    print(f"Net Quantity: {format_val(fields.net_quantity)}")
    print(f"MRP: {format_val(fields.mrp)}")
    print(f"Date Information: {format_val(fields.date_information)}")
    print(f"Consumer Care: {format_val(fields.consumer_care)}")
    print(f"Country of Origin: {format_val(fields.country_of_origin)}")

    # Compliance Findings (Milestone 2)
    if result.compliance:
        comp = result.compliance
        print("\nCompliance")
        print("----------")
        print(f"Status: {comp.status.value}\n")
        print(f"Rules Checked: {comp.rules_checked}")
        print(f"Passed: {comp.rules_passed}")
        print(f"Failed: {comp.rules_failed}")
        print(f"Unclear: {comp.rules_unclear}")
        print(f"Not Verifiable: {comp.rules_not_verifiable}")
        print(f"Not Applicable: {comp.rules_not_applicable}")

        if comp.findings:
            print("\nFindings")
            print("--------")
            for finding in comp.findings:
                print(f"- {finding}")

        print(f"\nSummary: {comp.summary}")

    # Visual Evidence Mapping (Milestone 3)
    if getattr(result, "evidence", None):
        print("\nEvidence")
        print("--------")
        for ev in result.evidence:
            print(f"Rule: {ev.rule_id}")
            print(f"Text: \"{ev.text}\"")
            print(f"Image: {ev.image_id}")
            bbox_str = f"[{ev.bounding_box.ymin:.3f}, {ev.bounding_box.xmin:.3f}, {ev.bounding_box.ymax:.3f}, {ev.bounding_box.xmax:.3f}]"
            print(f"Bounding Box: {bbox_str}")
            print(f"Confidence: {ev.confidence:.2f}")
            print()

    # Legal Basis (Milestone 4)
    if result.compliance and any(ev.legal_basis for ev in result.compliance.evaluations):
        print("\nLegal Basis")
        print("-----------")
        for ev in result.compliance.evaluations:
            if ev.legal_basis:
                print(f"Rule: {ev.rule_id}")
                print(f"Status: {ev.status.value}")
                ev_str = str(ev.evidence) if ev.evidence else "(None)"
                print(f"Evidence: {ev_str}")
                primary = ev.legal_basis[0]
                print(f"Legal Source: {primary.source}")
                print(f"Provision: {primary.rule_number} ({primary.section})")
                print(f"Retrieval Score: {primary.retrieval_score:.2f}")
                print(f"Official Source: {primary.official_url}")
                print()


def main():
    parser = argparse.ArgumentParser(
        description="NiyamCheck CLI — Milestones 1-3: Inspect packaging, compliance, visual evidence, and reports."
    )
    parser.add_argument(
        "image_paths",
        nargs="*",
        help="Path(s) to product package image file(s). If omitted, a sample synthetic image is generated.",
    )
    parser.add_argument(
        "--panels",
        nargs="*",
        help="Optional packaging panel types corresponding to image_paths (e.g. FRONT BACK LEFT).",
    )
    parser.add_argument(
        "--report-pdf",
        dest="report_pdf",
        help="Optional path to output generated PDF inspection report.",
    )
    parser.add_argument(
        "--report-json",
        dest="report_json",
        help="Optional path to output generated JSON inspection report.",
    )
    args = parser.parse_args()

    # Determine execution mode: single image vs multi-image session
    if not args.image_paths:
        print("[Notice: No image path provided. Running CLI test with a generated synthetic package image...]\n")
        image_bytes = generate_sample_image_bytes()
        result = analysis_service.analyze_image_bytes(image_bytes)
        print_single_result(result, image_name="sample_image.jpg")

        if args.report_pdf or args.report_json:
            # Wrap into a session for report generation
            insp_img = analysis_service.analyze_inspection_image(
                image_bytes, "img-001", filename="sample_image.jpg", panel=PanelType.FRONT
            )
            session = session_aggregator.aggregate_session([insp_img])
            if args.report_pdf:
                pdf_bytes = report_service.generate_pdf(session)
                with open(args.report_pdf, "wb") as f:
                    f.write(pdf_bytes)
                print(f"[Report] Saved PDF report to: {args.report_pdf}")
            if args.report_json:
                rep = report_service.build_report(session)
                with open(args.report_json, "w", encoding="utf-8") as f:
                    f.write(rep.model_dump_json(indent=2))
                print(f"[Report] Saved JSON report to: {args.report_json}")
        return

    # If exactly 1 image path provided and no multi-image arguments
    if len(args.image_paths) == 1:
        img_path = args.image_paths[0]
        if not os.path.exists(img_path):
            print(f"Error: File not found at '{img_path}'", file=sys.stderr)
            sys.exit(1)
        with open(img_path, "rb") as f:
            image_bytes = f.read()

        result = analysis_service.analyze_image_bytes(image_bytes)
        print_single_result(result, image_name=os.path.basename(img_path))

        if args.report_pdf or args.report_json:
            panel_type = PanelType.UNKNOWN
            if args.panels and len(args.panels) > 0:
                try:
                    panel_type = PanelType(args.panels[0].strip().upper())
                except ValueError:
                    pass
            insp_img = analysis_service.analyze_inspection_image(
                image_bytes, "img-001", filename=os.path.basename(img_path), panel=panel_type
            )
            session = session_aggregator.aggregate_session([insp_img])
            if args.report_pdf:
                pdf_bytes = report_service.generate_pdf(session)
                with open(args.report_pdf, "wb") as f:
                    f.write(pdf_bytes)
                print(f"[Report] Saved PDF report to: {args.report_pdf}")
            if args.report_json:
                rep = report_service.build_report(session)
                with open(args.report_json, "w", encoding="utf-8") as f:
                    f.write(rep.model_dump_json(indent=2))
                print(f"[Report] Saved JSON report to: {args.report_json}")
        return

    # Multi-image package inspection session
    analyzed_images = []
    print(f"--- Multi-Image Inspection Session ({len(args.image_paths)} packaging panels) ---\n")
    for idx, path in enumerate(args.image_paths):
        if not os.path.exists(path):
            print(f"Error: File not found at '{path}'", file=sys.stderr)
            sys.exit(1)
        with open(path, "rb") as f:
            b = f.read()

        panel_type = PanelType.UNKNOWN
        if args.panels and idx < len(args.panels):
            try:
                panel_type = PanelType(args.panels[idx].strip().upper())
            except ValueError:
                pass

        img_id = f"img-{idx+1:03d}"
        insp_img = analysis_service.analyze_inspection_image(
            b, image_id=img_id, filename=os.path.basename(path), panel=panel_type
        )
        analyzed_images.append(insp_img)
        print(f"[{img_id}] {os.path.basename(path)} ({panel_type.value}): Quality={insp_img.quality.status.value}, Words={len(insp_img.ocr.regions)}")

    session = session_aggregator.aggregate_session(analyzed_images)
    print("\nCombined Extracted Declarations")
    print("-------------------------------")
    fields = session.combined_fields

    def format_val(f):
        return f.value if f.value else f"({f.status.value})"

    print(f"Product Name: {format_val(fields.product_name)}")
    print(f"Manufacturer: {format_val(fields.manufacturer)}")
    print(f"Address: {format_val(fields.address)}")
    print(f"Net Quantity: {format_val(fields.net_quantity)}")
    print(f"MRP: {format_val(fields.mrp)}")
    print(f"Date Information: {format_val(fields.date_information)}")
    print(f"Consumer Care: {format_val(fields.consumer_care)}")
    print(f"Country of Origin: {format_val(fields.country_of_origin)}")

    print("\nUnified Compliance")
    print("------------------")
    comp = session.compliance
    print(f"Status: {comp.status.value}\n")
    print(f"Rules Checked: {comp.rules_checked}")
    print(f"Passed: {comp.rules_passed}")
    print(f"Failed: {comp.rules_failed}")
    print(f"Unclear: {comp.rules_unclear}")
    print(f"Not Verifiable: {comp.rules_not_verifiable}")
    print(f"Not Applicable: {comp.rules_not_applicable}")

    if comp.findings:
        print("\nFindings")
        print("--------")
        for finding in comp.findings:
            print(f"- {finding}")

    print(f"\nSummary: {session.summary}")

    if session.evidence:
        print("\nEvidence Index across Panels")
        print("-----------------------------")
        for ev in session.evidence:
            print(f"Rule: {ev.rule_id} | Panel: {ev.panel} | Img: {ev.image_id}")
            print(f"Text: \"{ev.text}\" (Confidence: {ev.confidence:.2f})")
            print(f"Box: [{ev.bounding_box.ymin:.3f}, {ev.bounding_box.xmin:.3f}, {ev.bounding_box.ymax:.3f}, {ev.bounding_box.xmax:.3f}]\n")

    if session.compliance and any(ev.legal_basis for ev in session.compliance.evaluations):
        print("\nLegal Basis across Panels")
        print("-------------------------")
        for ev in session.compliance.evaluations:
            if ev.legal_basis:
                print(f"Rule: {ev.rule_id} ({ev.status.value})")
                primary = ev.legal_basis[0]
                print(f"Legal Source: {primary.source}")
                print(f"Provision: {primary.rule_number} ({primary.section})")
                print(f"Retrieval Score: {primary.retrieval_score:.2f}")
                print(f"Official Source: {primary.official_url}\n")

    if args.report_pdf:
        pdf_bytes = report_service.generate_pdf(session)
        with open(args.report_pdf, "wb") as f:
            f.write(pdf_bytes)
        print(f"[Report] Saved PDF report to: {args.report_pdf}")

    if args.report_json:
        rep = report_service.build_report(session)
        with open(args.report_json, "w", encoding="utf-8") as f:
            f.write(rep.model_dump_json(indent=2))
        print(f"[Report] Saved JSON report to: {args.report_json}")


if __name__ == "__main__":
    main()


