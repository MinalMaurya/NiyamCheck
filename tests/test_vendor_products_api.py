import unittest
from fastapi.testclient import TestClient

from backend.main import app
from backend.products.db_store import product_store
from backend.database import init_db


class TestVendorProductsAPI(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        init_db()
        cls.client = TestClient(app)

    def setUp(self):
        product_store.clear()

    def tearDown(self):
        product_store.clear()

    def test_create_and_get_product(self):
        payload = {
            "product_name": "Organic Honey 500g",
            "brand_name": "Apex Nature",
            "category": "Food & Beverages",
            "product_code": "8901234567890",
            "vendor_id": "VEND-001",
            "description": "Pure wild forest honey",
        }
        resp = self.client.post("/api/v1/products", json=payload)
        self.assertEqual(resp.status_code, 201)
        data = resp.json()
        self.assertEqual(data["product_name"], "Organic Honey 500g")
        self.assertEqual(data["brand_name"], "Apex Nature")
        self.assertEqual(data["vendor_id"], "VEND-001")
        self.assertEqual(data["status"], "NOT_CHECKED")
        self.assertTrue(data["product_id"].startswith("prod_"))

        # Fetch product by ID
        get_resp = self.client.get(f"/api/v1/products/{data['product_id']}")
        self.assertEqual(get_resp.status_code, 200)
        get_data = get_resp.json()
        self.assertEqual(get_data["product_id"], data["product_id"])
        self.assertEqual(get_data["product_code"], "8901234567890")

    def test_list_and_filter_products(self):
        # Create two products
        p1 = {
            "product_name": "Almond Milk 1L",
            "brand_name": "Apex Dairy",
            "category": "Food & Beverages",
            "product_code": "8901111111111",
            "vendor_id": "VEND-001",
        }
        p2 = {
            "product_name": "Herbal Shampoo 200ml",
            "brand_name": "Apex Care",
            "category": "Cosmetics & Personal Care",
            "product_code": "8902222222222",
            "vendor_id": "VEND-002",
        }
        self.client.post("/api/v1/products", json=p1)
        self.client.post("/api/v1/products", json=p2)

        # List all
        resp = self.client.get("/api/v1/products")
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.json()["total"], 2)

        # Filter by vendor
        resp_vend = self.client.get("/api/v1/products?vendor_id=VEND-001")
        self.assertEqual(resp_vend.status_code, 200)
        self.assertEqual(resp_vend.json()["total"], 1)
        self.assertEqual(resp_vend.json()["items"][0]["product_name"], "Almond Milk 1L")

        # Search query
        resp_search = self.client.get("/api/v1/products?search=Shampoo")
        self.assertEqual(resp_search.status_code, 200)
        self.assertEqual(resp_search.json()["total"], 1)
        self.assertEqual(resp_search.json()["items"][0]["brand_name"], "Apex Care")

    def test_update_product(self):
        p = {
            "product_name": "Green Tea 100g",
            "brand_name": "Apex Herbal",
            "category": "Food & Beverages",
            "product_code": "8903333333333",
            "vendor_id": "VEND-001",
        }
        create_resp = self.client.post("/api/v1/products", json=p)
        pid = create_resp.json()["product_id"]

        update_resp = self.client.put(
            f"/api/v1/products/{pid}",
            json={"product_name": "Organic Green Tea 100g", "status": "CHECKED"},
        )
        self.assertEqual(update_resp.status_code, 200)
        self.assertEqual(update_resp.json()["product_name"], "Organic Green Tea 100g")
        self.assertEqual(update_resp.json()["status"], "CHECKED")

    def test_delete_product(self):
        p = {
            "product_name": "Delete Me 50g",
            "brand_name": "Apex",
            "category": "Household",
            "product_code": "8904444444444",
            "vendor_id": "VEND-001",
        }
        create_resp = self.client.post("/api/v1/products", json=p)
        pid = create_resp.json()["product_id"]

        del_resp = self.client.delete(f"/api/v1/products/{pid}")
        self.assertEqual(del_resp.status_code, 200)

        get_resp = self.client.get(f"/api/v1/products/{pid}")
        self.assertEqual(get_resp.status_code, 404)

    def test_link_inspection_to_product(self):
        p = {
            "product_name": "Biscuits 250g",
            "brand_name": "Apex Foods",
            "category": "Food & Beverages",
            "product_code": "8905555555555",
            "vendor_id": "VEND-001",
        }
        create_resp = self.client.post("/api/v1/products", json=p)
        pid = create_resp.json()["product_id"]

        link_resp = self.client.post(
            f"/api/v1/products/{pid}/link_inspection/insp_demo_123?override_status=ISSUES_FOUND"
        )
        self.assertEqual(link_resp.status_code, 200)
        data = link_resp.json()
        self.assertEqual(data["latest_inspection_id"], "insp_demo_123")
        self.assertEqual(data["status"], "ISSUES_FOUND")
        self.assertIn("insp_demo_123", data["inspection_ids"])


if __name__ == "__main__":
    unittest.main()
