import unittest
from backend.extraction.extractor import FieldExtractor
from backend.schemas.analysis import (
    OCRResult,
    OCRRegion,
    ImageQualityResult,
    ImageQualityStatus,
    ExtractionStatus,
)


class TestMilestone1Extraction(unittest.TestCase):
    def setUp(self):
        self.extractor = FieldExtractor()

    def test_open_world_product_extraction(self):
        """System parses a completely new product brand it has never seen before."""
        lines = [
            "ZEST-O CRUNCHY CHILLI CORN PUFFS",
            "NET WEIGHT: 85 g",
            "M.R.P. Rs. 20.00 (INCL. OF ALL TAXES)",
            "MFD. 09/2026",
            "MANUFACTURED BY: NEWGEN AGRO FOODS PVT LTD, AHMEDABAD - 380015, GUJARAT",
            "CUSTOMER SUPPORT: CALL 1800-11-2233 OR EMAIL: CARE@NEWGENAGRO.COM",
            "COUNTRY OF ORIGIN: INDIA",
        ]
        ocr_res = OCRResult(
            text="\n".join(lines),
            confidence=0.95,
            regions=[
                OCRRegion(text=line, confidence=0.95, box=[idx * 0.1, 0.1, (idx + 1) * 0.1, 0.9])
                for idx, line in enumerate(lines)
            ],
        )

        quality_good = ImageQualityResult(
            status=ImageQualityStatus.GOOD,
            score=0.92,
            issues=[],
        )

        fields = self.extractor.extract(ocr_res, quality_good)

        # Open-world brand identification
        self.assertEqual(fields.product_name.status, ExtractionStatus.PRESENT)
        self.assertEqual(fields.product_name.value, "ZEST-O CRUNCHY CHILLI CORN PUFFS")

        # Net quantity
        self.assertEqual(fields.net_quantity.status, ExtractionStatus.PRESENT)
        self.assertEqual(fields.net_quantity.value, "85 g")

        # MRP
        self.assertEqual(fields.mrp.status, ExtractionStatus.PRESENT)
        self.assertEqual(fields.mrp.value, "₹ 20.00 (incl. of all taxes)")

        # Date
        self.assertEqual(fields.date_information.status, ExtractionStatus.PRESENT)
        self.assertEqual(fields.date_information.value, "MFD. 09/2026")

        # Manufacturer & Address
        self.assertEqual(fields.manufacturer.status, ExtractionStatus.PRESENT)
        self.assertIn("NEWGEN AGRO FOODS", fields.manufacturer.value)
        self.assertEqual(fields.address.status, ExtractionStatus.PRESENT)
        self.assertIn("380015", fields.address.value)

        # Consumer Care
        self.assertEqual(fields.consumer_care.status, ExtractionStatus.PRESENT)
        self.assertIn("1800-11-2233", fields.consumer_care.value)
        self.assertIn("CARE@NEWGENAGRO.COM", fields.consumer_care.value)

        # Country of Origin
        self.assertEqual(fields.country_of_origin.status, ExtractionStatus.PRESENT)
        self.assertEqual(fields.country_of_origin.value, "INDIA")

    def test_poor_quality_yields_not_verifiable_not_missing(self):
        """When image quality is POOR, unobserved declarations MUST be NOT_VERIFIABLE, not MISSING."""
        # Only 1 blurry line detected
        ocr_res = OCRResult(
            text="CHIPS",
            confidence=0.45,
            regions=[OCRRegion(text="CHIPS", confidence=0.45, box=[0.1, 0.1, 0.2, 0.5])],
        )
        quality_poor = ImageQualityResult(
            status=ImageQualityStatus.POOR,
            score=0.30,
            issues=["Image appears blurry."],
        )

        fields = self.extractor.extract(ocr_res, quality_poor)

        # Consumer care must NOT be classified as MISSING
        self.assertEqual(fields.consumer_care.status, ExtractionStatus.NOT_VERIFIABLE)
        self.assertEqual(fields.mrp.status, ExtractionStatus.NOT_VERIFIABLE)
        self.assertEqual(fields.net_quantity.status, ExtractionStatus.NOT_VERIFIABLE)
        self.assertEqual(fields.manufacturer.status, ExtractionStatus.NOT_VERIFIABLE)

    def test_multipack_net_quantity(self):
        lines = [
            "SNACK PACK",
            "NET QTY: 4 x 50 g",
            "MRP Rs. 60.00",
        ]
        ocr_res = OCRResult(
            text="\n".join(lines),
            confidence=0.95,
            regions=[OCRRegion(text=l, confidence=0.95, box=[0.1, 0.1, 0.2, 0.8]) for l in lines],
        )
        fields = self.extractor.extract(ocr_res)
        self.assertEqual(fields.net_quantity.status, ExtractionStatus.PRESENT)
        self.assertEqual(fields.net_quantity.value, "4 x 50 g")


if __name__ == "__main__":
    unittest.main()
