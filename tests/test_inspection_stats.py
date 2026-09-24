from datetime import datetime, timezone, timedelta
import unittest
from fastapi.testclient import TestClient

from backend.main import app
from backend.schemas.analysis import ExtractedFields
from backend.compliance.models import ComplianceStatus, RuleStatus
from backend.compliance.rule_engine import compliance_engine
from backend.inspections.models import InspectionSession
from backend.inspections.store import InMemoryInspectionStore, inspection_store


def _build_test_session(
    inspection_id: str,
    status: ComplianceStatus = ComplianceStatus.COMPLIANT,
    category: str = "Packaged Food",
    summary: str = "Standard check",
    findings: list = None,
    is_finalized: bool = False,
    created_at: datetime = None,
) -> InspectionSession:
    if created_at is None:
        created_at = datetime.now(timezone.utc)
    return InspectionSession(
        inspection_id=inspection_id,
        created_at=created_at,
        product_category=category,
        images=[],
        combined_fields=ExtractedFields(),
        compliance=compliance_engine.evaluate(ExtractedFields()),
        evidence=[],
        status=status,
        summary=summary,
        findings=findings or [],
        is_finalized=is_finalized,
    )


class TestInspectionStats(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.client = TestClient(app)

    def test_01_empty_dataset_in_memory(self):
        """1. Empty dataset returns all zeroes and empty dictionaries."""
        empty_store = InMemoryInspectionStore()
        stats = empty_store.get_stats()
        self.assertEqual(stats["total"], 0)
        self.assertEqual(stats["compliant"], 0)
        self.assertEqual(stats["non_compliant"], 0)
        self.assertEqual(stats["needs_review"], 0)
        self.assertEqual(stats["compliance_rate_pct"], 0.0)
        self.assertEqual(stats["top_violations"], {})
        self.assertEqual(stats["category_breakdown"], {})
        self.assertEqual(stats["finalized_count"], 0)

    def test_02_total_count(self):
        """2. Total count accurately reflects the count of non-deleted sessions."""
        store = InMemoryInspectionStore()
        store.save(_build_test_session("S1", ComplianceStatus.COMPLIANT))
        store.save(_build_test_session("S2", ComplianceStatus.NON_COMPLIANT))
        store.save(_build_test_session("S3", ComplianceStatus.NEEDS_REVIEW))
        stats = store.get_stats()
        self.assertEqual(stats["total"], 3)

    def test_03_compliant_count(self):
        """3. Compliant count matches sessions with COMPLIANT status."""
        store = InMemoryInspectionStore()
        store.save(_build_test_session("C1", ComplianceStatus.COMPLIANT))
        store.save(_build_test_session("C2", ComplianceStatus.COMPLIANT))
        store.save(_build_test_session("C3", ComplianceStatus.NON_COMPLIANT))
        stats = store.get_stats()
        self.assertEqual(stats["compliant"], 2)

    def test_04_non_compliant_count(self):
        """4. Non-compliant count matches sessions with NON_COMPLIANT status."""
        store = InMemoryInspectionStore()
        store.save(_build_test_session("NC1", ComplianceStatus.NON_COMPLIANT))
        store.save(_build_test_session("NC2", ComplianceStatus.POTENTIAL_ISSUES))
        store.save(_build_test_session("NC3", ComplianceStatus.COMPLIANT))
        stats = store.get_stats()
        self.assertEqual(stats["non_compliant"], 2)

    def test_05_needs_review_count(self):
        """5. Needs-review count aggregates ambiguous / review / partially verifiable statuses."""
        store = InMemoryInspectionStore()
        store.save(_build_test_session("R1", ComplianceStatus.NEEDS_REVIEW))
        store.save(_build_test_session("R2", ComplianceStatus.PARTIALLY_VERIFIABLE))
        store.save(_build_test_session("R3", ComplianceStatus.NOT_VERIFIABLE))
        store.save(_build_test_session("R4", ComplianceStatus.COMPLIANT))
        stats = store.get_stats()
        self.assertEqual(stats["needs_review"], 3)

    def test_06_compliance_rate_and_precision(self):
        """6. Compliance rate percentage is calculated as (compliant/total)*100 rounded to 2 decimals."""
        store = InMemoryInspectionStore()
        # 1 compliant out of 3 = 33.33%
        store.save(_build_test_session("CR1", ComplianceStatus.COMPLIANT))
        store.save(_build_test_session("CR2", ComplianceStatus.NON_COMPLIANT))
        store.save(_build_test_session("CR3", ComplianceStatus.NEEDS_REVIEW))
        stats = store.get_stats()
        self.assertEqual(stats["compliance_rate_pct"], 33.33)

        # Add 1 more compliant -> 2 out of 4 = 50.0%
        store.save(_build_test_session("CR4", ComplianceStatus.COMPLIANT))
        stats2 = store.get_stats()
        self.assertEqual(stats2["compliance_rate_pct"], 50.0)

    def test_07_zero_division_behavior(self):
        """7. Zero-division returns 0.0 without throwing errors."""
        store = InMemoryInspectionStore()
        stats = store.get_stats()
        self.assertEqual(stats["total"], 0)
        self.assertEqual(stats["compliance_rate_pct"], 0.0)

    def test_08_category_breakdown(self):
        """8. Grouping by product_category with 'Unknown' fallback for missing category."""
        store = InMemoryInspectionStore()
        store.save(_build_test_session("CAT1", category="Packaged Food"))
        store.save(_build_test_session("CAT2", category="Packaged Food"))
        store.save(_build_test_session("CAT3", category="Beverages"))
        store.save(_build_test_session("CAT4", category=""))
        store.save(_build_test_session("CAT5", category=None))
        stats = store.get_stats()
        self.assertEqual(stats["category_breakdown"].get("Packaged Food"), 2)
        self.assertEqual(stats["category_breakdown"].get("Beverages"), 1)
        self.assertEqual(stats["category_breakdown"].get("Unknown"), 2)

    def test_09_top_violations_counting_and_ordering(self):
        """9. Top violations counts only non-compliant/failed findings and orders descending."""
        store = InMemoryInspectionStore()
        findings_1 = [
            {"rule_id": "LM-MRP-001", "name": "Maximum Retail Price", "status": "POTENTIAL_ISSUE"},
            {"rule_id": "LM-NQ-001", "name": "Net Quantity", "status": "FAIL"},
            {"rule_id": "LM-PN-001", "name": "Product Name", "status": "PASS"},
            {"rule_id": "LM-COO-001", "name": "Country of Origin", "status": "REVIEW"},
        ]
        findings_2 = [
            {"rule_id": "LM-MRP-001", "name": "Maximum Retail Price", "status": "FAIL"},
            {"rule_id": "LM-DATE-001", "name": "Date of Mfg", "status": "POTENTIAL_ISSUE"},
            {"rule_id": "LM-CC-001", "name": "Consumer Care", "status": "NOT_VERIFIABLE"},
        ]
        store.save(_build_test_session("V1", findings=findings_1))
        store.save(_build_test_session("V2", findings=findings_2))

        stats = store.get_stats()
        top_v = stats["top_violations"]

        # LM-MRP-001 has 2 violations (both sessions)
        self.assertEqual(top_v.get("LM-MRP-001"), 2)
        # LM-NQ-001 has 1 violation
        self.assertEqual(top_v.get("LM-NQ-001"), 1)
        # LM-DATE-001 has 1 violation
        self.assertEqual(top_v.get("LM-DATE-001"), 1)
        # PASS, REVIEW, NOT_VERIFIABLE must NOT be counted as violations
        self.assertNotIn("LM-PN-001", top_v)
        self.assertNotIn("LM-COO-001", top_v)
        self.assertNotIn("LM-CC-001", top_v)

        # Ordering check: highest frequency rule appears first
        keys = list(top_v.keys())
        self.assertEqual(keys[0], "LM-MRP-001")

    def test_10_deleted_inspections_excluded_from_stats(self):
        """10. Soft-deleted inspections are excluded from all aggregated stats."""
        test_id = "STATS-DEL-001"
        findings = [{"rule_id": "LM-TEMP-001", "status": "FAIL"}]
        sess = _build_test_session(test_id, status=ComplianceStatus.NON_COMPLIANT, category="Temp Category", findings=findings)
        inspection_store.save(sess)

        stats_before = inspection_store.get_stats()
        self.assertIn("Temp Category", stats_before["category_breakdown"])
        self.assertIn("LM-TEMP-001", stats_before["top_violations"])

        # Delete session
        deleted = inspection_store.delete(test_id)
        self.assertTrue(deleted)

        stats_after = inspection_store.get_stats()
        self.assertNotIn("Temp Category", stats_after["category_breakdown"])
        self.assertNotIn("LM-TEMP-001", stats_after["top_violations"])

    def test_11_finalized_count_using_existing_workflow(self):
        """11. Finalized count tracks sessions signed/finalized via is_finalized attribute."""
        store = InMemoryInspectionStore()
        store.save(_build_test_session("FIN1", is_finalized=True))
        store.save(_build_test_session("FIN2", is_finalized=False))
        store.save(_build_test_session("FIN3", is_finalized=True))
        stats = store.get_stats()
        self.assertEqual(stats["finalized_count"], 2)

    def test_12_api_endpoint_response_structure_and_types(self):
        """12. GET /api/v1/inspections/stats returns the expected JSON structure and types."""
        res = self.client.get("/api/v1/inspections/stats")
        self.assertEqual(res.status_code, 200)
        data = res.json()

        # Validate presence and types of all required fields
        self.assertIn("total", data)
        self.assertIsInstance(data["total"], int)

        self.assertIn("compliant", data)
        self.assertIsInstance(data["compliant"], int)

        self.assertIn("non_compliant", data)
        self.assertIsInstance(data["non_compliant"], int)

        self.assertIn("needs_review", data)
        self.assertIsInstance(data["needs_review"], int)

        self.assertIn("compliance_rate_pct", data)
        self.assertIsInstance(data["compliance_rate_pct"], (int, float))

        self.assertIn("top_violations", data)
        self.assertIsInstance(data["top_violations"], dict)

        self.assertIn("category_breakdown", data)
        self.assertIsInstance(data["category_breakdown"], dict)

        self.assertIn("finalized_count", data)
        self.assertIsInstance(data["finalized_count"], int)

        # Sum of status buckets should equal total
        self.assertEqual(data["compliant"] + data["non_compliant"] + data["needs_review"], data["total"])

    def test_13_stats_route_not_intercepted_by_inspection_id(self):
        """13. Ensure /stats is routed to get_inspection_stats and not get_inspection (404/500)."""
        res = self.client.get("/api/v1/inspections/stats")
        self.assertEqual(res.status_code, 200)
        # If it were interpreted as an inspection_id, it would return error or InspectionSession schema
        data = res.json()
        self.assertIn("compliance_rate_pct", data)
        self.assertNotIn("images", data)

    def test_14_database_store_stats_parity(self):
        """14. Database store aggregates real database records identically."""
        now = datetime.now(timezone.utc)
        unique_cat = f"ParityCategory-{int(now.timestamp())}"
        s = _build_test_session(
            f"PARITY-TEST-{int(now.timestamp())}",
            status=ComplianceStatus.COMPLIANT,
            category=unique_cat,
            is_finalized=True,
        )
        inspection_store.save(s)

        stats = inspection_store.get_stats()
        self.assertGreaterEqual(stats["total"], 1)
        self.assertEqual(stats["category_breakdown"].get(unique_cat), 1)
        self.assertGreaterEqual(stats["finalized_count"], 1)


if __name__ == "__main__":
    unittest.main()
