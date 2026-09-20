import uuid
from typing import List, Optional
from backend.schemas.analysis import OCRResult, ExtractedFields, FieldResult
from backend.compliance.models import ComplianceResult, RuleStatus
from backend.evidence.models import EvidenceItem, RuleEvidence, BoundingBox
from backend.evidence.matching import find_matching_region


class EvidenceMapper:
    """
    Maps compliance rule evaluations to localized OCR text regions and bounding boxes.
    Enriches evaluations with structured RuleEvidence and generates audit EvidenceItems.
    """

    def map_evidence(
        self,
        ocr_result: OCRResult,
        fields: ExtractedFields,
        compliance_result: ComplianceResult,
        image_id: str = "img-001",
        panel: str = "UNKNOWN",
    ) -> List[EvidenceItem]:
        """
        Enriches compliance evaluations with bounding-box evidence and produces
        an audit-ready list of EvidenceItem instances.
        """
        evidence_items: List[EvidenceItem] = []
        regions = ocr_result.regions or []

        for idx, ev in enumerate(compliance_result.evaluations, start=1):
            field_obj: Optional[FieldResult[str]] = getattr(fields, ev.field, None)

            # Determine the candidate evidence text to localize
            candidate_text: Optional[str] = None
            if ev.evidence is not None:
                candidate_text = str(ev.evidence).strip()
            elif field_obj and field_obj.raw_text:
                candidate_text = field_obj.raw_text.strip()
            elif field_obj and field_obj.value:
                candidate_text = field_obj.value.strip()

            # If rule failed due to complete absence or is unverified without text, keep evidence null
            if not candidate_text or ev.status in (RuleStatus.NOT_VERIFIABLE, RuleStatus.NOT_APPLICABLE):
                if ev.status == RuleStatus.NOT_APPLICABLE:
                    ev.evidence = None
                elif ev.status == RuleStatus.NOT_VERIFIABLE:
                    ev.evidence = None
                elif ev.status == RuleStatus.FAIL and (not field_obj or not field_obj.value):
                    ev.evidence = None
                continue

            # Attempt deterministic OCR region matching
            match_res = find_matching_region(candidate_text, regions)

            if match_res is not None:
                matched_region, bbox = match_res
                evidence_text = matched_region.text.strip()
                evidence_conf = (
                    matched_region.confidence if matched_region.confidence is not None else ev.confidence
                )
            else:
                # Text was detected by extraction but bounding box is not locatable
                evidence_text = candidate_text
                bbox = None
                evidence_conf = ev.confidence

            layout_dict = None
            read_dict = None
            sem_role = None

            if field_obj and getattr(field_obj, "multimodal", None):
                mm = field_obj.multimodal
                layout_dict = mm.placement.model_dump() if hasattr(mm.placement, "model_dump") else mm.placement.dict()
                read_dict = mm.readability.model_dump() if hasattr(mm.readability, "model_dump") else mm.readability.dict()
                sem_role = mm.interpretation.disambiguation_type

            # Create structured RuleEvidence attached to the evaluation
            rule_ev = RuleEvidence(
                text=evidence_text,
                image_id=image_id,
                bounding_box=bbox,
                confidence=round(evidence_conf, 2),
                panel=panel,
                layout_analysis=layout_dict,
                readability=read_dict,
                semantic_role=sem_role,
            )
            ev.evidence = rule_ev

            # Create an audit EvidenceItem
            ev_id = f"ev-{image_id}-{idx:03d}"
            item = EvidenceItem(
                evidence_id=ev_id,
                image_id=image_id,
                rule_id=ev.rule_id,
                field=ev.field,
                text=evidence_text,
                confidence=round(evidence_conf, 2),
                bounding_box=bbox,
                source="ocr",
                panel=panel,
                layout_analysis=layout_dict,
                readability=read_dict,
                semantic_role=sem_role,
            )
            evidence_items.append(item)

        return evidence_items


evidence_mapper = EvidenceMapper()
