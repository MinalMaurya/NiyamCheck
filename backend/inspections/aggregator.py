import uuid
from datetime import datetime
from typing import List, Optional
from backend.schemas.analysis import ExtractedFields, FieldResult, ExtractionStatus
from backend.compliance.models import ComplianceResult, ComplianceStatus
from backend.compliance.rule_engine import compliance_engine
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

        # 2. Evaluate unified compliance across the combined package declarations
        combined_compliance = compliance_engine.evaluate(combined_fields)

        # 3. Aggregate all evidence items across all images
        all_evidence: List[EvidenceItem] = []
        for img in images:
            all_evidence.extend(img.evidence)

        # 4. Link rule evaluations in combined_compliance to their respective evidence item
        for ev in combined_compliance.evaluations:
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

        # 5. Attach Authoritative Legal Basis (Milestone 4)
        from backend.legal_knowledge.service import legal_knowledge_service
        legal_knowledge_service.attach_legal_basis(combined_compliance)

        return InspectionSession(
            inspection_id=session_id,
            created_at=datetime.utcnow(),
            images=images,
            combined_fields=combined_fields,
            compliance=combined_compliance,
            evidence=all_evidence,
            status=combined_compliance.status,
            summary=combined_compliance.summary,
        )

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

        # Priority 1: Pick any candidate with status PRESENT having highest confidence
        present_candidates = [c for c in candidates if c.status == ExtractionStatus.PRESENT and c.value]
        if present_candidates:
            return max(present_candidates, key=lambda c: (c.confidence, len(c.value or "")))

        # Priority 2: Pick candidate with status UNCLEAR having highest confidence
        unclear_candidates = [c for c in candidates if c.status == ExtractionStatus.UNCLEAR]
        if unclear_candidates:
            return max(unclear_candidates, key=lambda c: c.confidence)

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
