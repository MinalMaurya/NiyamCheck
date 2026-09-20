import re
from typing import Any, List, Optional

from backend.schemas.analysis import (
    OCRResult,
    ImageQualityResult,
    ImageQualityStatus,
    ExtractedFields,
    FieldResult,
    ExtractionStatus,
)
from backend.extraction.patterns import (
    MRP_PATTERN,
    STANDALONE_PRICE_PATTERN,
    TAX_INCLUSIVE_PATTERN,
    NET_QTY_PATTERN,
    MULTI_PACK_PATTERN,
    STANDALONE_QTY_PATTERN,
    DATE_PREFIX_PATTERN,
    EXPIRY_PATTERN,
    STANDALONE_DATE_PATTERN,
    EMAIL_PATTERN,
    PHONE_PATTERN,
    WEBSITE_PATTERN,
    CARE_KEYWORD_PATTERN,
    PIN_CODE_PATTERN,
    US_ZIP_PATTERN,
    MFG_NAME_PATTERN,
    PACKED_BY_PATTERN,
    IMPORTED_BY_PATTERN,
    COUNTRY_OF_ORIGIN_PATTERN,
    INDIAN_STATES,
    ADDRESS_KEYWORDS,
    NUTRITION_EXCLUSIONS,
    PRODUCT_NAME_EXCLUSIONS,
)


from backend.cv.layout_analyzer import layout_analyzer
from backend.extraction.semantic_extractor import semantic_extractor
from backend.schemas.analysis import (
    MultimodalAssessment,
    CompletenessAssessment,
    ReadabilityAssessment,
    PlacementAssessment,
    InterpretationAssessment,
)


class FieldExtractor:
    """
    Open-world structured declaration extractor.
    Extracts product declarations without assuming a closed-set catalog of products.
    Assigns extraction states (PRESENT, MISSING, UNCLEAR, NOT_APPLICABLE, NOT_VERIFIABLE).
    Enriches declarations with multimodal assessments (completeness, readability, placement, interpretation).
    """

    def extract(
        self,
        ocr_result: OCRResult,
        quality_result: Optional[ImageQualityResult] = None,
        image: Optional[Any] = None,
        panel: str = "UNKNOWN",
    ) -> ExtractedFields:
        raw_text = ocr_result.text or ""
        regions = ocr_result.regions or []
        region_texts = [r.text.strip() for r in regions if r.text.strip()]

        # Heuristic: Check if the scanned view has sufficient textual coverage.
        # If image quality is POOR or text is very sparse (< 3 lines),
        # unobserved fields must be NOT_VERIFIABLE (cannot falsely claim MISSING).
        is_poor_quality = quality_result is not None and quality_result.status == ImageQualityStatus.POOR
        is_sparse = len(region_texts) < 3 or len(raw_text.strip()) < 30
        insufficient_context = is_poor_quality or is_sparse

        # Detect if this panel represents the Principal Display Panel (PDP)
        is_pdp = layout_analyzer.detect_pdp(image, ocr_result, panel)

        # 1. Product Name (open-world extraction)
        product_name_res = self._extract_product_name(region_texts, raw_text, insufficient_context)

        # 2. Manufacturer
        mfg_res = self._extract_manufacturer(region_texts, raw_text, insufficient_context)

        # 3. Packer
        packer_res = self._extract_packer(region_texts, raw_text)

        # 4. Importer
        importer_res = self._extract_importer(region_texts, raw_text)

        # 5. Address
        address_res = self._extract_address(region_texts, raw_text, insufficient_context)

        # 6. Net Quantity
        net_qty_res = self._extract_net_quantity(region_texts, raw_text, insufficient_context)

        # 7. Maximum Retail Price (MRP)
        mrp_res = self._extract_mrp(region_texts, raw_text, insufficient_context)

        # 8. Date Information
        date_res = self._extract_date_information(region_texts, raw_text, insufficient_context)

        # 9. Consumer Care
        care_res = self._extract_consumer_care(region_texts, raw_text, insufficient_context)

        # 10. Country of Origin
        origin_res = self._extract_country_of_origin(region_texts, raw_text)

        # Attach multimodal assessments across all 5 verification pillars
        fields_map = {
            "product_name": product_name_res,
            "manufacturer": mfg_res,
            "packer": packer_res,
            "importer": importer_res,
            "address": address_res,
            "net_quantity": net_qty_res,
            "mrp": mrp_res,
            "date_information": date_res,
            "consumer_care": care_res,
            "country_of_origin": origin_res,
        }

        for field_name, f_res in fields_map.items():
            self._attach_multimodal_assessment(
                field_name=field_name,
                field_res=f_res,
                ocr_result=ocr_result,
                image=image,
                panel=panel,
                is_pdp=is_pdp,
            )

        return ExtractedFields(
            product_name=product_name_res,
            manufacturer=mfg_res,
            packer=packer_res,
            importer=importer_res,
            address=address_res,
            net_quantity=net_qty_res,
            mrp=mrp_res,
            date_information=date_res,
            consumer_care=care_res,
            country_of_origin=origin_res,
        )

    def _find_matching_box(
        self, field_res: FieldResult[str], ocr_result: OCRResult
    ) -> Optional[List[float]]:
        """Finds the bounding box most closely corresponding to the extracted field value."""
        if not ocr_result.regions:
            return None

        val = (field_res.value or "").strip().lower()
        raw = (field_res.raw_text or "").strip().lower()

        # Exact or substring match in region text
        for r in ocr_result.regions:
            if not r.box:
                continue
            r_text = r.text.strip().lower()
            if val and (val in r_text or r_text in val):
                return r.box
            if raw and (raw in r_text or r_text in raw):
                return r.box

        # Keyword match
        for r in ocr_result.regions:
            if not r.box:
                continue
            r_text = r.text.strip().lower()
            words = [w for w in val.split() if len(w) >= 3]
            if words and any(w in r_text for w in words):
                return r.box

        return None

    def _attach_multimodal_assessment(
        self,
        field_name: str,
        field_res: FieldResult[str],
        ocr_result: OCRResult,
        image: Optional[Any],
        panel: str,
        is_pdp: bool,
    ):
        """Attaches 5-pillar multimodal assessment to an extracted field."""
        box = self._find_matching_box(field_res, ocr_result)

        # 1. Completeness Assessment
        completeness = semantic_extractor.assess_completeness(
            field_name=field_name,
            value=field_res.value,
            raw_text=field_res.raw_text,
        )

        # 2. Semantic Interpretation & Disambiguation
        interpretation = semantic_extractor.disambiguate_interpretation(
            field_name=field_name,
            value=field_res.value,
            raw_text=field_res.raw_text,
        )

        # 3. Readability Assessment
        readability = layout_analyzer.assess_crop_readability(
            image=image,
            box=box,
            raw_text=field_res.raw_text or "",
            ocr_confidence=field_res.confidence,
        )

        # 4. Placement Assessment
        mandated_pdp = field_name in ["product_name", "net_quantity"]
        placement = layout_analyzer.assess_placement(
            box=box,
            panel=panel,
            is_pdp=is_pdp,
            mandated_on_pdp=mandated_pdp,
        )

        # Composite overall multimodal score
        multimodal_score = round(
            0.35 * completeness.completeness_score
            + 0.35 * readability.readability_score
            + 0.30 * interpretation.confidence,
            2,
        )

        field_res.multimodal = MultimodalAssessment(
            completeness=completeness,
            readability=readability,
            placement=placement,
            interpretation=interpretation,
            overall_multimodal_score=multimodal_score,
        )

    def _extract_product_name(
        self, lines: List[str], raw_text: str, insufficient_context: bool
    ) -> FieldResult[str]:
        # Identify topmost non-declaration line as candidate product name
        for line in lines:
            t = line.strip()
            if len(t) < 3:
                continue
            t_upper = t.upper()
            # Exclude explicit price, quantity, and date code lines
            if MRP_PATTERN.search(t) or STANDALONE_PRICE_PATTERN.search(t) or NET_QTY_PATTERN.search(t) or DATE_PREFIX_PATTERN.search(t):
                continue
            # Ignore standard declaration boilerplate, marketing/freshness slogans, nutrition facts, and handling instructions
            if any(k in t_upper for k in PRODUCT_NAME_EXCLUSIONS):
                continue
            # Skip address lines (contains PIN/ZIP, state, or address indicators)
            if PIN_CODE_PATTERN.search(t) or US_ZIP_PATTERN.search(t):
                continue
            if any(s.upper() in t_upper for s in INDIAN_STATES) and any(re.search(r"\b" + re.escape(kw) + r"\b", t_upper) for kw in ["MUMBAI", "DELHI", "ROAD", "STREET", "MARG", "CROSSING", "NAGAR", "AREA", "DISTRICT", "EAST", "WEST", "SECTOR", "PLOT"]):
                continue
            if any(re.search(r"\b" + re.escape(kw) + r"\b", t_upper) for kw in ["CROSSING", "LEVEL CROSSING", "PO BOX", "P.O. BOX", "INDUSTRIAL AREA", "SECTOR", "PLOT NO"]):
                continue
            if EMAIL_PATTERN.search(t) or PHONE_PATTERN.search(t):
                continue
            # Skip purely numeric or punctuation lines
            if re.match(r"^[\d\s\.,;:!?'\"/\\#\-\(\)]+$", t):
                continue
            # Skip lines that are just barcodes or alphanumeric serial codes
            if re.match(r"^[A-Z0-9]{8,}$", t):
                continue

            return FieldResult[str](
                value=t,
                status=ExtractionStatus.PRESENT,
                confidence=0.90,
                raw_text=t,
            )

        if lines:
            # Fallback only if candidate lines exist but didn't pass strict filter
            for line in lines:
                t = line.strip()
                t_up = t.upper()
                if len(t) < 3:
                    continue
                if any(k in t_up for k in PRODUCT_NAME_EXCLUSIONS):
                    continue
                if PIN_CODE_PATTERN.search(t) or US_ZIP_PATTERN.search(t):
                    continue
                if EMAIL_PATTERN.search(t) or PHONE_PATTERN.search(t):
                    continue
                if MRP_PATTERN.search(t) or STANDALONE_PRICE_PATTERN.search(t) or NET_QTY_PATTERN.search(t) or DATE_PREFIX_PATTERN.search(t):
                    continue
                if any(s.upper() in t_up for s in INDIAN_STATES) and any(re.search(r"\b" + re.escape(kw) + r"\b", t_up) for kw in ["MUMBAI", "DELHI", "ROAD", "STREET", "MARG", "CROSSING", "NAGAR", "AREA", "DISTRICT", "EAST", "WEST", "SECTOR", "PLOT"]):
                    continue
                if any(re.search(r"\b" + re.escape(kw) + r"\b", t_up) for kw in ["CROSSING", "LEVEL CROSSING", "PO BOX", "P.O. BOX", "INDUSTRIAL AREA", "SECTOR", "PLOT NO"]):
                    continue
                return FieldResult[str](
                    value=t,
                    status=ExtractionStatus.UNCLEAR,
                    confidence=0.60,
                    raw_text=t,
                )

        return FieldResult[str](
            value=None,
            status=ExtractionStatus.NOT_VERIFIABLE if insufficient_context else ExtractionStatus.MISSING,
            confidence=0.0,
        )

    def _extract_manufacturer(
        self, lines: List[str], raw_text: str, insufficient_context: bool
    ) -> FieldResult[str]:
        for line in lines:
            m = MFG_NAME_PATTERN.search(line)
            if m:
                raw_val = m.group(1).strip()
                suffix_match = re.search(
                    r"^(.*?)\b(PVT\.?\s*LTD\.?|LTD\.?|LIMITED|INC\.?|CORP\.?|LLC\.?)(?:\.|\b)[:\s,-]*(.*)$",
                    raw_val,
                    re.IGNORECASE,
                )
                if suffix_match:
                    co_suffix = suffix_match.group(2).strip()
                    if raw_val[len(suffix_match.group(1)):].strip().startswith(f"{co_suffix}."):
                        co_suffix += "."
                    name = f"{suffix_match.group(1).strip()} {co_suffix}".strip()
                else:
                    name = raw_val.split(",")[0].strip() if "," in raw_val else raw_val
                name = re.sub(r"^[.:\s-]+", "", name).strip()
                return FieldResult[str](
                    value=name,
                    status=ExtractionStatus.PRESENT,
                    confidence=0.92,
                    raw_text=line,
                )

        m = MFG_NAME_PATTERN.search(raw_text)
        if m:
            raw_val = m.group(1).strip()
            suffix_match = re.search(
                r"^(.*?)\b(PVT\.?\s*LTD\.?|LTD\.?|LIMITED|INC\.?|CORP\.?|LLC\.?)(?:\.|\b)[:\s,-]*(.*)$",
                raw_val,
                re.IGNORECASE,
            )
            if suffix_match:
                co_suffix = suffix_match.group(2).strip()
                name = f"{suffix_match.group(1).strip()} {co_suffix}".strip()
            else:
                name = raw_val.split(",")[0].strip() if "," in raw_val else raw_val
            name = re.sub(r"^[.:\s-]+", "", name).strip()
            return FieldResult[str](
                value=name,
                status=ExtractionStatus.PRESENT,
                confidence=0.88,
                raw_text=m.group(0),
            )

        # Open-world entity suffix fallback (e.g. "Frito-Lay, Inc." or "PepsiCo India Holdings")
        for line in lines:
            t = line.strip()
            if any(s in t.upper() for s in ["FRITO-LAY", "PEPSICO", "PVT. LTD.", "PVT LTD", "LTD.", "LIMITED", "INC.", "CORP.", "LLC"]):
                if not any(k in t.upper() for k in ["CALL", "EMAIL", "EXP", "MFD", "BEST BEFORE", "NUTRITION", "SERVING"]):
                    suffix_match = re.search(
                        r"^(.*?)\b(PVT\.?\s*LTD\.?|LTD\.?|LIMITED|INC\.?|CORP\.?|LLC\.?)(?:\.|\b)[:\s,-]*(.*)$",
                        t,
                        re.IGNORECASE,
                    )
                    if suffix_match:
                        co_suffix = suffix_match.group(2).strip()
                        if t[len(suffix_match.group(1)):].strip().startswith(f"{co_suffix}."):
                            co_suffix += "."
                        candidate = f"{suffix_match.group(1).strip()} {co_suffix}".strip()
                    else:
                        candidate = t.split(",")[0].strip() if "," in t else t.strip()
                    candidate = re.sub(r"^(?:MANUFACTURED\s*(?:BY|FOR)?|MFD\s*BY)[:\s.-]*", "", candidate, flags=re.IGNORECASE).strip()
                    return FieldResult[str](
                        value=candidate,
                        status=ExtractionStatus.PRESENT,
                        confidence=0.86,
                        raw_text=line,
                    )

        return FieldResult[str](
            value=None,
            status=ExtractionStatus.NOT_VERIFIABLE if insufficient_context else ExtractionStatus.MISSING,
            confidence=0.0,
        )

    def _extract_packer(self, lines: List[str], raw_text: str) -> FieldResult[str]:
        for line in lines:
            m = PACKED_BY_PATTERN.search(line)
            if m:
                packer = m.group(1).strip()
                return FieldResult[str](
                    value=packer,
                    status=ExtractionStatus.PRESENT,
                    confidence=0.90,
                    raw_text=line,
                )
        return FieldResult[str](
            value=None,
            status=ExtractionStatus.NOT_APPLICABLE,
            confidence=0.0,
        )

    def _extract_importer(self, lines: List[str], raw_text: str) -> FieldResult[str]:
        for line in lines:
            m = IMPORTED_BY_PATTERN.search(line)
            if m:
                importer = m.group(1).strip()
                return FieldResult[str](
                    value=importer,
                    status=ExtractionStatus.PRESENT,
                    confidence=0.90,
                    raw_text=line,
                )
        return FieldResult[str](
            value=None,
            status=ExtractionStatus.NOT_APPLICABLE,
            confidence=0.0,
        )

    def _extract_address(
        self, lines: List[str], raw_text: str, insufficient_context: bool
    ) -> FieldResult[str]:
        pin_match = PIN_CODE_PATTERN.search(raw_text)
        pin = pin_match.group(1).replace(" ", "") if pin_match else None
        zip_match = US_ZIP_PATTERN.search(raw_text)
        zip_code = zip_match.group(1) if zip_match else None

        state_found = None
        for state in INDIAN_STATES:
            if state.upper() in raw_text.upper():
                state_found = state
                break

        # Contextual Search 1: Check lines attached to or following manufacturer declarations
        mfg_idx = -1
        for idx, line in enumerate(lines):
            t_up = line.upper()
            if any(k in t_up for k in ["MANUFACTURED BY", "MFD BY", "MKTD BY", "PACKED BY", "FRITO-LAY", "PEPSICO", "PVT LTD", "INC."]):
                mfg_idx = idx
                # Check if address is on the SAME line after corporate entity suffix
                suffix_match = re.search(
                    r"^(.*?)\b(PVT\.?\s*LTD\.?|LTD\.?|LIMITED|INC\.?|CORP\.?|LLC\.?)(?:\.|\b)[:\s,-]*(.*)$",
                    line,
                    re.IGNORECASE,
                )
                if suffix_match:
                    addr_tail = suffix_match.group(3).strip().lstrip(",.- ").strip()
                    if len(addr_tail) >= 6 and any(c.isalpha() for c in addr_tail):
                        return FieldResult[str](
                            value=addr_tail,
                            status=ExtractionStatus.PRESENT,
                            confidence=0.92,
                            raw_text=addr_tail,
                        )
                break

        # Contextual Search 2: Line immediately following manufacturer (idx + 1)
        if mfg_idx >= 0 and mfg_idx + 1 < len(lines):
            next_line = lines[mfg_idx + 1].strip()
            next_up = next_line.upper()
            if not any(k in next_up for k in ["NUTRITION", "SERVING", "CALORIES", "FAT", "NET WT", "MRP", "EXP", "QUESTIONS", "COUNTRY OF ORIGIN"]):
                has_loc = (
                    bool(US_ZIP_PATTERN.search(next_line))
                    or bool(PIN_CODE_PATTERN.search(next_line))
                    or any(re.search(r"\b" + re.escape(kw) + r"\b", next_up) for kw in ADDRESS_KEYWORDS)
                    or any(s.upper() in next_up for s in INDIAN_STATES)
                    or bool(re.search(r"\b[A-Z]{2}\s+\d{5}\b", next_line))
                )
                if has_loc:
                    return FieldResult[str](
                        value=next_line,
                        status=ExtractionStatus.PRESENT,
                        confidence=0.92,
                        raw_text=next_line,
                    )

        # Contextual Search 3: Check all lines for postal code or address keywords
        for idx, line in enumerate(lines):
            t = line.strip()
            t_up = t.upper()
            if any(k in t_up for k in ["NUTRITION", "SERVING", "CALORIES", "FAT", "NET WT", "MRP", "EXP", "QUESTIONS"]):
                continue

            if pin and pin in t:
                address_line = t
                if idx > 0 and any(s in lines[idx - 1].upper() for s in ["LTD", "PVT", "ROAD", "STREET", "PLOT", "SECTOR", "AREA"]):
                    address_line = f"{lines[idx - 1].strip()}, {address_line}"
                return FieldResult[str](
                    value=address_line.strip(),
                    status=ExtractionStatus.PRESENT,
                    confidence=0.90,
                    raw_text=address_line.strip(),
                )

            if zip_code and zip_code in t:
                return FieldResult[str](
                    value=t,
                    status=ExtractionStatus.PRESENT,
                    confidence=0.90,
                    raw_text=t,
                )

            if any(s.upper() in t_up for s in INDIAN_STATES) and any(re.search(r"\b" + re.escape(kw) + r"\b", t_up) for kw in ADDRESS_KEYWORDS):
                return FieldResult[str](
                    value=t,
                    status=ExtractionStatus.PRESENT,
                    confidence=0.88,
                    raw_text=t,
                )

        if pin or state_found or zip_code:
            snippet_parts = []
            if pin:
                snippet_parts.append(f"PIN: {pin}")
            if zip_code:
                snippet_parts.append(f"ZIP: {zip_code}")
            if state_found:
                snippet_parts.append(f"State: {state_found}")
            snippet = ", ".join(snippet_parts)
            return FieldResult[str](
                value=snippet,
                status=ExtractionStatus.UNCLEAR,
                confidence=0.65,
                raw_text=snippet,
            )

        return FieldResult[str](
            value=None,
            status=ExtractionStatus.NOT_VERIFIABLE if insufficient_context else ExtractionStatus.MISSING,
            confidence=0.0,
        )

    def _extract_net_quantity(
        self, lines: List[str], raw_text: str, insufficient_context: bool
    ) -> FieldResult[str]:
        # Multi-pack check (e.g., 4 x 50 g)
        for line in lines:
            t = line.strip()
            if any(k in t.upper() for k in NUTRITION_EXCLUSIONS):
                continue
            m = MULTI_PACK_PATTERN.search(t)
            if m:
                val = f"{m.group(1)} x {m.group(2)} {m.group(3)}"
                return FieldResult[str](
                    value=val,
                    status=ExtractionStatus.PRESENT,
                    confidence=0.95,
                    raw_text=t,
                )

        # Standard Net Qty with prefix (e.g., "NET WEIGHT: 85 g")
        for line in lines:
            t = line.strip()
            # CRITICAL: Exclude any line containing nutrition facts (Total Fat, Dietary Fiber, Protein, etc.)
            if any(k in t.upper() for k in NUTRITION_EXCLUSIONS):
                continue
            m = NET_QTY_PATTERN.search(t)
            if m:
                val = f"{m.group(1)} {m.group(2)}"
                return FieldResult[str](
                    value=val,
                    status=ExtractionStatus.PRESENT,
                    confidence=0.96,
                    raw_text=t,
                )

        for line in raw_text.splitlines():
            t = line.strip()
            if any(k in t.upper() for k in NUTRITION_EXCLUSIONS):
                continue
            m = NET_QTY_PATTERN.search(t)
            if m:
                val = f"{m.group(1)} {m.group(2)}"
                return FieldResult[str](
                    value=val,
                    status=ExtractionStatus.PRESENT,
                    confidence=0.90,
                    raw_text=t,
                )

        # Standalone quantity check:
        # Strictly require that the line is NOT a nutrition table entry, date, price, or serving declaration
        for line in lines:
            t = line.strip()
            t_up = t.upper()
            if any(k in t_up for k in NUTRITION_EXCLUSIONS):
                continue
            if any(k in t_up for k in ["MRP", "RS", "₹", "INR", "EXP", "USE BY", "BEST BEFORE", "MFD", "PKD", "BATCH", "LOT", "BARCODE"]):
                continue
            if any(k in t_up for k in PRODUCT_NAME_EXCLUSIONS):
                continue

            m = STANDALONE_QTY_PATTERN.search(t)
            if m:
                is_pure_qty = len(t) <= 15 or any(w in t_up for w in ["WEIGHT", "QTY", "NET", "CONTENT", "MASS", "VOL"])
                if is_pure_qty:
                    val = f"{m.group(1)} {m.group(2)}"
                    return FieldResult[str](
                        value=val,
                        status=ExtractionStatus.UNCLEAR,
                        confidence=0.70,
                        raw_text=t,
                    )

        return FieldResult[str](
            value=None,
            status=ExtractionStatus.NOT_VERIFIABLE if insufficient_context else ExtractionStatus.MISSING,
            confidence=0.0,
        )

    def _extract_mrp(
        self, lines: List[str], raw_text: str, insufficient_context: bool
    ) -> FieldResult[str]:
        for line in lines:
            t = line.strip()
            # CRITICAL: Exclude nutrition or serving lines
            if any(k in t.upper() for k in NUTRITION_EXCLUSIONS):
                continue
            m = MRP_PATTERN.search(t)
            if m:
                amount = m.group(1)
                incl = " (incl. of all taxes)" if TAX_INCLUSIVE_PATTERN.search(t) or TAX_INCLUSIVE_PATTERN.search(raw_text) else ""
                val = f"₹ {amount}{incl}"
                return FieldResult[str](
                    value=val,
                    status=ExtractionStatus.PRESENT,
                    confidence=0.96,
                    raw_text=t,
                )

        for line in raw_text.splitlines():
            t = line.strip()
            if any(k in t.upper() for k in NUTRITION_EXCLUSIONS):
                continue
            m = MRP_PATTERN.search(t)
            if m:
                amount = m.group(1)
                val = f"₹ {amount}"
                return FieldResult[str](
                    value=val,
                    status=ExtractionStatus.PRESENT,
                    confidence=0.90,
                    raw_text=t,
                )

        # Standalone currency/price (strictly requires ₹, Rs., Rs, INR, or $)
        for line in lines:
            t = line.strip()
            if any(k in t.upper() for k in NUTRITION_EXCLUSIONS):
                continue
            if any(k in t.upper() for k in ["SERVING", "CALORIE", "CALORIES", "ENERGY", "PERCENT", "DV", "%"]):
                continue
            m = STANDALONE_PRICE_PATTERN.search(t)
            if m:
                val = f"₹ {m.group(1)}"
                return FieldResult[str](
                    value=val,
                    status=ExtractionStatus.UNCLEAR,
                    confidence=0.70,
                    raw_text=t,
                )

        return FieldResult[str](
            value=None,
            status=ExtractionStatus.NOT_VERIFIABLE if insufficient_context else ExtractionStatus.MISSING,
            confidence=0.0,
        )

    def _extract_date_information(
        self, lines: List[str], raw_text: str, insufficient_context: bool
    ) -> FieldResult[str]:
        for line in lines:
            m = DATE_PREFIX_PATTERN.search(line)
            if m:
                val = line.strip()
                return FieldResult[str](
                    value=val,
                    status=ExtractionStatus.PRESENT,
                    confidence=0.95,
                    raw_text=val,
                )

        m = DATE_PREFIX_PATTERN.search(raw_text)
        if m:
            return FieldResult[str](
                value=m.group(0).strip(),
                status=ExtractionStatus.PRESENT,
                confidence=0.88,
                raw_text=m.group(0).strip(),
            )

        # Standalone date
        for line in lines:
            m = STANDALONE_DATE_PATTERN.search(line)
            if m:
                return FieldResult[str](
                    value=line.strip(),
                    status=ExtractionStatus.UNCLEAR,
                    confidence=0.65,
                    raw_text=line.strip(),
                )

        return FieldResult[str](
            value=None,
            status=ExtractionStatus.NOT_VERIFIABLE if insufficient_context else ExtractionStatus.MISSING,
            confidence=0.0,
        )

    def _extract_consumer_care(
        self, lines: List[str], raw_text: str, insufficient_context: bool
    ) -> FieldResult[str]:
        email_match = EMAIL_PATTERN.search(raw_text)
        phone_match = PHONE_PATTERN.search(raw_text)
        website_match = WEBSITE_PATTERN.search(raw_text)
        has_heading = bool(CARE_KEYWORD_PATTERN.search(raw_text))

        details: List[str] = []
        if phone_match:
            details.append(f"Phone: {phone_match.group(1).strip()}")
        if email_match:
            details.append(f"Email: {email_match.group(0).strip()}")
        if website_match and (has_heading or any(k in raw_text.upper() for k in ["CHAT", "VISIT", "FEEDBACK", "QUESTIONS", "CONTACT", "CARE", "SUPPORT"])):
            details.append(f"Website: {website_match.group(0).strip()}")

        if details:
            combined = ", ".join(details)
            return FieldResult[str](
                value=combined,
                status=ExtractionStatus.PRESENT,
                confidence=0.95 if len(details) >= 2 else 0.88,
                raw_text=combined,
            )

        if has_heading:
            return FieldResult[str](
                value="Consumer Cell heading detected",
                status=ExtractionStatus.UNCLEAR,
                confidence=0.60,
                raw_text="Consumer Care",
            )

        return FieldResult[str](
            value=None,
            status=ExtractionStatus.NOT_VERIFIABLE if insufficient_context else ExtractionStatus.MISSING,
            confidence=0.0,
        )

    def _extract_country_of_origin(self, lines: List[str], raw_text: str) -> FieldResult[str]:
        for line in lines:
            m = COUNTRY_OF_ORIGIN_PATTERN.search(line)
            if m:
                country = m.group(1).strip()
                country = re.sub(r"[\.,;:!-]+$", "", country).strip()
                return FieldResult[str](
                    value=country,
                    status=ExtractionStatus.PRESENT,
                    confidence=0.98,
                    raw_text=line.strip(),
                )

        m = COUNTRY_OF_ORIGIN_PATTERN.search(raw_text)
        if m:
            country = m.group(1).strip()
            country = re.sub(r"[\.,;:!-]+$", "", country).strip()
            return FieldResult[str](
                value=country,
                status=ExtractionStatus.PRESENT,
                confidence=0.90,
                raw_text=m.group(0).strip(),
            )

        return FieldResult[str](
            value=None,
            status=ExtractionStatus.NOT_VERIFIABLE,
            confidence=0.0,
        )


field_extractor = FieldExtractor()
