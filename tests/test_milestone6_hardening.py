import io
import unittest
from PIL import Image, ImageDraw
from fastapi.testclient import TestClient

from backend.main import app
from backend.inspections.store import InMemoryInspectionStore


class TestMilestone6Hardening(unittest.TestCase):
    def setUp(self):
        self.client = TestClient(app)

    def test_oversized_file_rejected_in_analyze(self):
        from backend.config import settings
        orig = settings.MAX_UPLOAD_SIZE_BYTES
        try:
            settings.MAX_UPLOAD_SIZE_BYTES = 500
            oversized_bytes = b"0" * 1000
            res = self.client.post(
                "/api/v1/analyze/image",
                files={"file": ("huge.jpg", io.BytesIO(oversized_bytes), "image/jpeg")},
            )
            self.assertEqual(res.status_code, 400)
            self.assertIn("exceeds maximum size limit", res.json()["detail"])
        finally:
            settings.MAX_UPLOAD_SIZE_BYTES = orig

    def test_oversized_file_rejected_in_inspections(self):
        from backend.config import settings
        orig = settings.MAX_UPLOAD_SIZE_BYTES
        try:
            settings.MAX_UPLOAD_SIZE_BYTES = 500
            oversized_bytes = b"0" * 1000
            files = [
                ("files", ("huge_panel.jpg", io.BytesIO(oversized_bytes), "image/jpeg")),
            ]
            res = self.client.post("/api/v1/inspections", files=files)
            self.assertEqual(res.status_code, 400)
            self.assertIn("exceeds maximum size limit", res.json()["detail"])
        finally:
            settings.MAX_UPLOAD_SIZE_BYTES = orig

    def test_empty_files_rejected_in_inspections(self):
        files = [
            ("files", ("empty_panel.jpg", io.BytesIO(b""), "image/jpeg")),
        ]
        res = self.client.post("/api/v1/inspections", files=files)
        self.assertEqual(res.status_code, 400)
        self.assertIn("is empty", res.json()["detail"])

    def test_inspection_store_image_contract_and_clear(self):
        store = InMemoryInspectionStore()
        # Save image
        store.save_image("INSP-T1", "img-001", b"fake_jpeg_data", "image/jpeg")
        retrieved = store.get_image("INSP-T1", "img-001")
        self.assertIsNotNone(retrieved)
        data, mime = retrieved
        self.assertEqual(data, b"fake_jpeg_data")
        self.assertEqual(mime, "image/jpeg")

        # Missing image
        self.assertIsNone(store.get_image("INSP-T1", "img-999"))
        self.assertIsNone(store.get_image("NON-EXISTENT", "img-001"))

        # Clear store
        store.clear()
        self.assertIsNone(store.get_image("INSP-T1", "img-001"))


if __name__ == "__main__":
    unittest.main()
