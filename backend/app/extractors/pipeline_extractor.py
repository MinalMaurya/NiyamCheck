from typing import List
from backend.app.schemas.ocr import OCRResult, OCRTextBox
from backend.app.schemas.declarations import ExtractedDeclarations
from backend.app.extractors.mrp_extractor import MRPExtractor
from backend.app.extractors.net_quantity_extractor import NetQuantityExtractor
from backend.app.extractors.date_extractor import DateExtractor
from backend.app.extractors.consumer_care_extractor import ConsumerCareExtractor
from backend.app.extractors.entity_extractor import EntityExtractor


class DeclarationPipelineExtractor:
    """
    Orchestrates all individual Legal Metrology declaration extractors
    to produce the canonical ExtractedDeclarations schema.
    """

    def __init__(self):
        self.mrp_extractor = MRPExtractor()
        self.net_quantity_extractor = NetQuantityExtractor()
        self.date_extractor = DateExtractor()
        self.consumer_care_extractor = ConsumerCareExtractor()
        self.entity_extractor = EntityExtractor()

    def extract_from_ocr(self, ocr_result: OCRResult) -> ExtractedDeclarations:
        """Extract structured declarations from OCR result."""
        raw_text = ocr_result.raw_text
        boxes = ocr_result.boxes

        # Run extractors
        mrp_field, usp_field = self.mrp_extractor.extract(raw_text, boxes)
        net_qty_field = self.net_quantity_extractor.extract(raw_text, boxes)
        date_field = self.date_extractor.extract(raw_text, boxes)
        consumer_care_field = self.consumer_care_extractor.extract(raw_text, boxes)
        mfg_field, generic_field, origin_field = self.entity_extractor.extract(raw_text, boxes)

        return ExtractedDeclarations(
            generic_name=generic_field,
            net_quantity=net_qty_field,
            mrp=mrp_field,
            unit_sale_price=usp_field,
            dates=date_field,
            manufacturer=mfg_field,
            consumer_care=consumer_care_field,
            country_of_origin=origin_field,
        )


pipeline_extractor = DeclarationPipelineExtractor()
