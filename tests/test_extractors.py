import unittest
from backend.app.schemas.declarations import DeclarationState, BoundingBox
from backend.app.schemas.ocr import OCRTextBox, OCRResult
from backend.app.extractors.mrp_extractor import MRPExtractor
from backend.app.extractors.net_quantity_extractor import NetQuantityExtractor
from backend.app.extractors.date_extractor import DateExtractor
from backend.app.extractors.consumer_care_extractor import ConsumerCareExtractor
from backend.app.extractors.entity_extractor import EntityExtractor
from backend.app.extractors.pipeline_extractor import pipeline_extractor


def make_box(text: str, line_no: int = 1) -> OCRTextBox:
    return OCRTextBox(
        text=text,
        confidence=0.96,
        bounding_box=BoundingBox(
            ymin=0.1 * line_no,
            xmin=0.1,
            ymax=0.1 * line_no + 0.08,
            xmax=0.9,
            confidence=0.96,
        ),
        line_number=line_no,
    )


class TestDeclarationsExtractors(unittest.TestCase):
    def test_mrp_extraction_standard(self):
        extractor = MRPExtractor()
        boxes = [make_box("M.R.P. Rs. 275.00 (INCL. OF ALL TAXES)")]
        mrp_field, usp_field = extractor.extract(boxes[0].text, boxes)

        self.assertEqual(mrp_field.state, DeclarationState.PRESENT)
        self.assertIsNotNone(mrp_field.value)
        self.assertEqual(mrp_field.value.amount, 275.0)
        self.assertTrue(mrp_field.value.inclusive_of_all_taxes)
        self.assertIsNotNone(mrp_field.bounding_box)

    def test_usp_extraction(self):
        extractor = MRPExtractor()
        boxes = [
            make_box("M.R.P. Rs. 50.00"),
            make_box("UNIT SALE PRICE: Rs. 0.25 / g", line_no=2),
        ]
        raw_text = "\n".join(b.text for b in boxes)
        mrp_field, usp_field = extractor.extract(raw_text, boxes)

        self.assertEqual(usp_field.state, DeclarationState.PRESENT)
        self.assertEqual(usp_field.value.price_per_unit, 0.25)
        self.assertEqual(usp_field.value.unit, "g")

    def test_net_quantity_metric_and_multipack(self):
        extractor = NetQuantityExtractor()

        # Single pack standard
        boxes1 = [make_box("NET QUANTITY: 750 ml")]
        field1 = extractor.extract(boxes1[0].text, boxes1)
        self.assertEqual(field1.state, DeclarationState.PRESENT)
        self.assertEqual(field1.value.magnitude, 750.0)
        self.assertEqual(field1.value.unit, "ml")
        self.assertEqual(field1.value.normalized_magnitude, 750.0)

        # Kilogram conversion
        boxes2 = [make_box("Net Weight: 2.5 kg")]
        field2 = extractor.extract(boxes2[0].text, boxes2)
        self.assertEqual(field2.value.normalized_magnitude, 2500.0)
        self.assertEqual(field2.value.normalized_unit, "g")

        # Multipack
        boxes3 = [make_box("NET QTY: 4 x 50 g")]
        field3 = extractor.extract(boxes3[0].text, boxes3)
        self.assertTrue(field3.value.is_multi_pack)
        self.assertEqual(field3.value.pack_count, 4)
        self.assertEqual(field3.value.normalized_magnitude, 200.0)

    def test_date_extractor(self):
        extractor = DateExtractor()

        # Manufacture date
        boxes = [
            make_box("MFD. DATE: 08/2026"),
            make_box("BEST BEFORE 12 MONTHS FROM PACKAGING", line_no=2),
        ]
        raw = "\n".join(b.text for b in boxes)
        field = extractor.extract(raw, boxes)

        self.assertEqual(field.state, DeclarationState.PRESENT)
        self.assertEqual(field.value.date_type, "manufacture")
        self.assertEqual(field.value.month, 8)
        self.assertEqual(field.value.year, 2026)
        self.assertIsNotNone(field.value.expiry_date)

    def test_consumer_care_extractor(self):
        extractor = ConsumerCareExtractor()
        boxes = [
            make_box("CONSUMER CARE CELL: CALL 1800-22-7799"),
            make_box("EMAIL: FEEDBACK@COMPANY.IN", line_no=2),
        ]
        raw = "\n".join(b.text for b in boxes)
        field = extractor.extract(raw, boxes)

        self.assertEqual(field.state, DeclarationState.PRESENT)
        self.assertEqual(field.value.helpline_number, "1800-22-7799")
        self.assertEqual(field.value.email, "FEEDBACK@COMPANY.IN")

    def test_entity_extractor(self):
        extractor = EntityExtractor()
        boxes = [
            make_box("PARLE-G GLUCOSE BISCUITS", line_no=1),
            make_box("MANUFACTURED BY: PARLE PRODUCTS PVT. LTD., MUMBAI - 400057, MAHARASHTRA", line_no=2),
            make_box("COUNTRY OF ORIGIN: INDIA", line_no=3),
        ]
        raw = "\n".join(b.text for b in boxes)
        mfg, generic, origin = extractor.extract(raw, boxes)

        self.assertEqual(mfg.state, DeclarationState.PRESENT)
        self.assertEqual(mfg.value.pin_code, "400057")
        self.assertEqual(mfg.value.state, "Maharashtra")
        self.assertEqual(origin.state, DeclarationState.PRESENT)
        self.assertEqual(origin.value.country, "INDIA")
        self.assertEqual(generic.state, DeclarationState.PRESENT)

    def test_full_pipeline_extractor(self):
        boxes = [
            make_box("BRITANNIA GOOD DAY BUTTER COOKIES", line_no=1),
            make_box("NET WEIGHT: 200 g", line_no=2),
            make_box("M.R.P. Rs. 40.00 (INCLUSIVE OF ALL TAXES)", line_no=3),
            make_box("MFD: 09/2026", line_no=4),
            make_box("MFD BY: BRITANNIA INDUSTRIES LTD, KOLKATA - 700017", line_no=5),
            make_box("FOR CONSUMER FEEDBACK: CARE@BRITANNIA.CO.IN / 1800-425-4449", line_no=6),
            make_box("COUNTRY OF ORIGIN: INDIA", line_no=7),
        ]
        ocr_res = OCRResult(
            raw_text="\n".join(b.text for b in boxes),
            boxes=boxes,
            line_count=len(boxes),
            engine_used="TestEngine",
            processing_time_ms=5.0,
        )
        decls = pipeline_extractor.extract_from_ocr(ocr_res)
        self.assertEqual(decls.generic_name.state, DeclarationState.PRESENT)
        self.assertEqual(decls.net_quantity.state, DeclarationState.PRESENT)
        self.assertEqual(decls.mrp.state, DeclarationState.PRESENT)
        self.assertEqual(decls.dates.state, DeclarationState.PRESENT)
        self.assertEqual(decls.manufacturer.state, DeclarationState.PRESENT)
        self.assertEqual(decls.consumer_care.state, DeclarationState.PRESENT)
        self.assertEqual(decls.country_of_origin.state, DeclarationState.PRESENT)


if __name__ == "__main__":
    unittest.main()
