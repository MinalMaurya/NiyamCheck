from datetime import datetime, timezone, timedelta
import unittest
from fastapi.testclient import TestClient

from backend.main import app
from backend.schemas.analysis import ExtractedFields
from backend.compliance.models import ComplianceStatus
from backend.compliance.rule_engine import compliance_engine
from backend.inspections.models import InspectionSession
from backend.inspections.store import InMemoryInspectionStore, inspection_store


def _build_session(
    inspection_id: str,
    status: ComplianceStatus = ComplianceStatus.COMPLIANT,
    category: str = "Packaged Food",
    summary: str = "Standard packaging check passed.",
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
    )


class TestInspectionsFilteringAndPagination(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.client = TestClient(app)
        now = datetime.now(timezone.utc)

        cls.session_ids = [
            "FILTER-TEST-001",
            "FILTER-TEST-002",
            "FILTER-TEST-003",
            "FILTER-TEST-004",
            "FILTER-TEST-005",
        ]

        # Seed 5 distinct sessions with descending timestamps
        cls.s1 = _build_session(
            inspection_id=cls.session_ids[0],
            status=ComplianceStatus.COMPLIANT,
            category="Packaged Food",
            summary="Biscuits batch compliant with Legal Metrology PCR 2011",
            created_at=now - timedelta(minutes=10),
        )
        cls.s2 = _build_session(
            inspection_id=cls.session_ids[1],
            status=ComplianceStatus.NON_COMPLIANT,
            category="Beverages",
            summary="Soft drink missing net quantity metric unit declaration",
            created_at=now - timedelta(minutes=8),
        )
        cls.s3 = _build_session(
            inspection_id=cls.session_ids[2],
            status=ComplianceStatus.NEEDS_REVIEW,
            category="Personal Care & Cosmetics",
            summary="Face cream with partially obscured manufacturer postal address",
            created_at=now - timedelta(minutes=6),
        )
        cls.s4 = _build_session(
            inspection_id=cls.session_ids[3],
            status=ComplianceStatus.COMPLIANT,
            category="Packaged Food",
            summary="Edible oil package with complete mandatory declarations",
            created_at=now - timedelta(minutes=4),
        )
        cls.s5 = _build_session(
            inspection_id=cls.session_ids[4],
            status=ComplianceStatus.NON_COMPLIANT,
            category="Household & Cleaning",
            summary="Detergent powder missing consumer care email details",
            created_at=now - timedelta(minutes=2),
        )

        for s in [cls.s1, cls.s2, cls.s3, cls.s4, cls.s5]:
            inspection_store.save(s)

    def test_01_no_filters(self):
        """1. Request without query parameters returns sessions ordered newest first."""
        res = self.client.get("/api/v1/inspections")
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertIsInstance(data, list)
        self.assertGreaterEqual(len(data), 5)

        # Verify ordering: newest sessions appear first
        returned_ids = [s["inspection_id"] for s in data if s["inspection_id"] in self.session_ids]
        # s5 is newest (-2 min), s4 (-4 min), s3 (-6 min), s2 (-8 min), s1 (-10 min)
        expected_order = [
            self.session_ids[4],
            self.session_ids[3],
            self.session_ids[2],
            self.session_ids[1],
            self.session_ids[0],
        ]
        self.assertEqual(returned_ids, expected_order)

    def test_02_status_filter(self):
        """2. Status filter correctly filters sessions by status."""
        res_comp = self.client.get("/api/v1/inspections?status=COMPLIANT")
        self.assertEqual(res_comp.status_code, 200)
        data_comp = res_comp.json()
        filter_ids = [s["inspection_id"] for s in data_comp if s["inspection_id"] in self.session_ids]
        self.assertIn(self.session_ids[0], filter_ids)
        self.assertIn(self.session_ids[3], filter_ids)
        self.assertNotIn(self.session_ids[1], filter_ids)
        for s in data_comp:
            self.assertEqual(s["status"], "COMPLIANT")

        res_non_comp = self.client.get("/api/v1/inspections?status=NON_COMPLIANT")
        self.assertEqual(res_non_comp.status_code, 200)
        data_non_comp = res_non_comp.json()
        filter_non_comp = [s["inspection_id"] for s in data_non_comp if s["inspection_id"] in self.session_ids]
        self.assertIn(self.session_ids[1], filter_non_comp)
        self.assertIn(self.session_ids[4], filter_non_comp)
        self.assertNotIn(self.session_ids[0], filter_non_comp)

    def test_03_category_filter(self):
        """3. Category filter selects sessions belonging to the requested category."""
        res_bev = self.client.get("/api/v1/inspections?category=Beverages")
        self.assertEqual(res_bev.status_code, 200)
        data_bev = res_bev.json()
        bev_ids = [s["inspection_id"] for s in data_bev if s["inspection_id"] in self.session_ids]
        self.assertEqual(bev_ids, [self.session_ids[1]])

        res_food = self.client.get("/api/v1/inspections?category=Packaged%20Food")
        self.assertEqual(res_food.status_code, 200)
        data_food = res_food.json()
        food_ids = [s["inspection_id"] for s in data_food if s["inspection_id"] in self.session_ids]
        self.assertIn(self.session_ids[0], food_ids)
        self.assertIn(self.session_ids[3], food_ids)

    def test_04_search_by_inspection_id(self):
        """4. Search parameter locates a session by its inspection_id."""
        res = self.client.get(f"/api/v1/inspections?search={self.session_ids[2]}")
        self.assertEqual(res.status_code, 200)
        data = res.json()
        ids = [s["inspection_id"] for s in data]
        self.assertIn(self.session_ids[2], ids)
        self.assertEqual(len([i for i in ids if i in self.session_ids]), 1)

    def test_05_search_by_summary_and_category(self):
        """5. Search parameter searches summary text and product category."""
        # Search for a word in summary: "Edible oil"
        res_summary = self.client.get("/api/v1/inspections?search=Edible%20oil")
        self.assertEqual(res_summary.status_code, 200)
        data_summary = res_summary.json()
        matched_ids = [s["inspection_id"] for s in data_summary if s["inspection_id"] in self.session_ids]
        self.assertEqual(matched_ids, [self.session_ids[3]])

        # Search for category keyword: "Cosmetics"
        res_cat = self.client.get("/api/v1/inspections?search=Cosmetics")
        self.assertEqual(res_cat.status_code, 200)
        data_cat = res_cat.json()
        matched_cat_ids = [s["inspection_id"] for s in data_cat if s["inspection_id"] in self.session_ids]
        self.assertEqual(matched_cat_ids, [self.session_ids[2]])

    def test_06_limit(self):
        """6. Limit parameter restricts the number of returned sessions."""
        res = self.client.get("/api/v1/inspections?limit=2")
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertEqual(len(data), 2)

    def test_07_offset(self):
        """7. Offset parameter skips the designated number of items."""
        res_all = self.client.get("/api/v1/inspections?limit=5")
        self.assertEqual(res_all.status_code, 200)
        data_all = res_all.json()

        res_offset = self.client.get("/api/v1/inspections?limit=2&offset=2")
        self.assertEqual(res_offset.status_code, 200)
        data_offset = res_offset.json()

        # Items at offset 2 should match items[2:4] of the un-offset query
        expected_ids = [s["inspection_id"] for s in data_all[2:4]]
        actual_ids = [s["inspection_id"] for s in data_offset]
        self.assertEqual(actual_ids, expected_ids)

    def test_08_combined_filters(self):
        """8. Combined filters (status, category, search, limit, offset) work together."""
        res = self.client.get(
            f"/api/v1/inspections?status=COMPLIANT&category=Food&search={self.session_ids[0]}&limit=5&offset=0"
        )
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertEqual(len(data), 1)
        self.assertEqual(data[0]["inspection_id"], self.session_ids[0])
        self.assertEqual(data[0]["status"], "COMPLIANT")

    def test_09_deleted_inspections_remain_excluded(self):
        """9. Soft-deleted sessions are excluded from listing."""
        del_id = "FILTER-TEST-DELETED-999"
        deleted_session = _build_session(inspection_id=del_id)
        inspection_store.save(deleted_session)

        # Confirm it is visible initially
        res_before = self.client.get(f"/api/v1/inspections?search={del_id}")
        self.assertEqual(res_before.status_code, 200)
        self.assertTrue(any(s["inspection_id"] == del_id for s in res_before.json()))

        # Soft delete the session
        delete_success = inspection_store.delete(del_id)
        self.assertTrue(delete_success)

        # Confirm it is no longer returned in list
        res_after = self.client.get(f"/api/v1/inspections?search={del_id}")
        self.assertEqual(res_after.status_code, 200)
        self.assertFalse(any(s["inspection_id"] == del_id for s in res_after.json()))

    def test_10_invalid_limit_validation(self):
        """10. Limit validation rejects values outside 1-100."""
        # limit < 1
        res_zero = self.client.get("/api/v1/inspections?limit=0")
        self.assertEqual(res_zero.status_code, 422)

        res_negative = self.client.get("/api/v1/inspections?limit=-5")
        self.assertEqual(res_negative.status_code, 422)

        # limit > 100
        res_large = self.client.get("/api/v1/inspections?limit=101")
        self.assertEqual(res_large.status_code, 422)

    def test_11_invalid_offset_validation(self):
        """11. Offset validation rejects negative values."""
        res_neg_offset = self.client.get("/api/v1/inspections?offset=-1")
        self.assertEqual(res_neg_offset.status_code, 422)

    def test_12_in_memory_store_parity(self):
        """Verify parity of InMemoryInspectionStore with the exact same filtering and pagination logic."""
        mem_store = InMemoryInspectionStore()
        now = datetime.now(timezone.utc)

        m1 = _build_session("MEM-1", status=ComplianceStatus.COMPLIANT, category="Packaged Food", summary="Crisps", created_at=now - timedelta(minutes=5))
        m2 = _build_session("MEM-2", status=ComplianceStatus.NON_COMPLIANT, category="Beverages", summary="Soda", created_at=now - timedelta(minutes=3))
        m3 = _build_session("MEM-3", status=ComplianceStatus.COMPLIANT, category="Packaged Food", summary="Rice", created_at=now - timedelta(minutes=1))

        mem_store.save(m1)
        mem_store.save(m2)
        mem_store.save(m3)

        # No filters - ordered newest first (m3, m2, m1)
        all_mem = mem_store.list_all()
        self.assertEqual([s.inspection_id for s in all_mem], ["MEM-3", "MEM-2", "MEM-1"])

        # Status filter
        comp_mem = mem_store.list_all(status="COMPLIANT")
        self.assertEqual([s.inspection_id for s in comp_mem], ["MEM-3", "MEM-1"])

        # Category filter
        bev_mem = mem_store.list_all(category="Beverages")
        self.assertEqual([s.inspection_id for s in bev_mem], ["MEM-2"])

        # Search filter
        search_mem = mem_store.list_all(search="Rice")
        self.assertEqual([s.inspection_id for s in search_mem], ["MEM-3"])

        # Limit and offset
        page_mem = mem_store.list_all(limit=1, offset=1)
        self.assertEqual(len(page_mem), 1)
        self.assertEqual(page_mem[0].inspection_id, "MEM-2")

        # Deleted exclusion
        mem_store.delete("MEM-2")
        after_del = mem_store.list_all()
        self.assertEqual([s.inspection_id for s in after_del], ["MEM-3", "MEM-1"])


if __name__ == "__main__":
    unittest.main()
