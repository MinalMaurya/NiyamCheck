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


def main():
    parser = argparse.ArgumentParser(
        description="NiyamCheck CLI — Milestone 1: Inspect package image quality, OCR, and extracted fields."
    )
    parser.add_argument(
        "image_path",
        nargs="?",
        help="Path to product package image file (JPEG, PNG, WebP). If omitted, a sample synthetic image is generated for testing.",
    )
    args = parser.parse_args()

    if args.image_path:
        if not os.path.exists(args.image_path):
            print(f"Error: File not found at '{args.image_path}'", file=sys.stderr)
            sys.exit(1)
        with open(args.image_path, "rb") as f:
            image_bytes = f.read()
    else:
        print("[Notice: No image path provided. Running CLI test with a generated synthetic package image...]\n")
        image_bytes = generate_sample_image_bytes()

    # Run analysis
    result = analysis_service.analyze_image_bytes(image_bytes)

    # Format output exactly as specified in Milestone 1
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


if __name__ == "__main__":
    main()
