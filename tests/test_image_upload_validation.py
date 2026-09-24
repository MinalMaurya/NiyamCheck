import io
import unittest
from PIL import Image, ImageDraw
from fastapi.testclient import TestClient

from backend.main import app
from backend.config import settings
from backend.image_quality.validation import (
    validate_image_bytes,
    detect_image_format_from_magic_bytes,
    get_canonical_mime_type,
    SUPPORTED_IMAGE_FORMATS,
)


def _create_image_bytes(fmt: str = "JPEG", size=(350, 350), text="VALID TEST PANEL") -> bytes:
    img = Image.new("RGB", size, color=(240, 240, 240))
    draw = ImageDraw.Draw(img)
    draw.text((20, 20), text, fill=(10, 10, 10))
    draw.text((20, 60), "NET WT: 100 g", fill=(10, 10, 10))
    draw.text((20, 100), "MRP: Rs. 50.00", fill=(10, 10, 10))
    buf = io.BytesIO()
    img.save(buf, format=fmt)
    return buf.getvalue()


class TestImageUploadValidation(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.client = TestClient(app)
        cls.jpeg_bytes = _create_image_bytes("JPEG")
        cls.png_bytes = _create_image_bytes("PNG")
        cls.webp_bytes = _create_image_bytes("WEBP")

    def test_01_valid_supported_images_succeed(self):
        """1. Valid JPEG, PNG, and WebP uploads are accepted and processed successfully."""
        # 1a. JPEG
        res_jpeg = self.client.post(
            "/api/v1/analyze/image",
            files={"file": ("test.jpg", self.jpeg_bytes, "image/jpeg")},
        )
        self.assertEqual(res_jpeg.status_code, 200)
        self.assertTrue(res_jpeg.json()["success"])

        # 1b. PNG
        res_png = self.client.post(
            "/api/v1/analyze/image",
            files={"file": ("test.png", self.png_bytes, "image/png")},
        )
        self.assertEqual(res_png.status_code, 200)
        self.assertTrue(res_png.json()["success"])

        # 1c. WebP
        res_webp = self.client.post(
            "/api/v1/analyze/image",
            files={"file": ("test.webp", self.webp_bytes, "image/webp")},
        )
        self.assertEqual(res_webp.status_code, 200)
        self.assertTrue(res_webp.json()["success"])

    def test_02_empty_file_rejected(self):
        """2. Zero-byte image upload is rejected with HTTP 400 Bad Request."""
        res = self.client.post(
            "/api/v1/analyze/image",
            files={"file": ("empty.jpg", b"", "image/jpeg")},
        )
        self.assertEqual(res.status_code, 400)
        self.assertIn("empty", res.json()["detail"].lower())

        # Also in inspections
        res_insp = self.client.post(
            "/api/v1/inspections",
            files=[("files", ("empty.jpg", b"", "image/jpeg"))],
        )
        self.assertEqual(res_insp.status_code, 400)
        self.assertEqual(res_insp.json()["error_code"], "EMPTY_FILE")

    def test_03_oversized_file_rejected(self):
        """3. File exceeding MAX_UPLOAD_SIZE_BYTES is rejected with HTTP 400 Bad Request."""
        orig_limit = settings.MAX_UPLOAD_SIZE_BYTES
        try:
            settings.MAX_UPLOAD_SIZE_BYTES = 500
            oversized_bytes = b"0" * 1000

            res = self.client.post(
                "/api/v1/analyze/image",
                files={"file": ("huge.jpg", io.BytesIO(oversized_bytes), "image/jpeg")},
            )
            self.assertEqual(res.status_code, 400)
            self.assertIn("exceeds maximum size limit", res.json()["detail"])

            res_insp = self.client.post(
                "/api/v1/inspections",
                files=[("files", ("huge.jpg", io.BytesIO(oversized_bytes), "image/jpeg"))],
            )
            self.assertEqual(res_insp.status_code, 400)
            self.assertEqual(res_insp.json()["error_code"], "PAYLOAD_TOO_LARGE")
        finally:
            settings.MAX_UPLOAD_SIZE_BYTES = orig_limit

    def test_04_valid_image_with_incorrect_mime_type_succeeds(self):
        """4. Valid image bytes with wrong client MIME type are validated by actual content and succeed."""
        # Genuine JPEG sent with application/octet-stream and generic .bin filename
        res_bin = self.client.post(
            "/api/v1/analyze/image",
            files={"file": ("upload.bin", self.jpeg_bytes, "application/octet-stream")},
        )
        self.assertEqual(res_bin.status_code, 200)
        self.assertTrue(res_bin.json()["success"])

        # Genuine PNG sent with text/plain
        res_txt = self.client.post(
            "/api/v1/analyze/image",
            files={"file": ("photo.txt", self.png_bytes, "text/plain")},
        )
        self.assertEqual(res_txt.status_code, 200)
        self.assertTrue(res_txt.json()["success"])

        # Genuine WebP sent with image/jpeg
        res_webp_spoofed = self.client.post(
            "/api/v1/analyze/image",
            files={"file": ("photo.jpg", self.webp_bytes, "image/jpeg")},
        )
        self.assertEqual(res_webp_spoofed.status_code, 200)
        self.assertTrue(res_webp_spoofed.json()["success"])

    def test_05_non_image_bytes_pretending_to_be_image_rejected(self):
        """5. Non-image bytes disguised with image filename and MIME type are rejected cleanly."""
        fake_text_bytes = b"Hello, this is a plain text file pretending to be an image!"
        res_text = self.client.post(
            "/api/v1/analyze/image",
            files={"file": ("package.jpg", fake_text_bytes, "image/jpeg")},
        )
        self.assertEqual(res_text.status_code, 422)
        self.assertIn("corrupted", res_text.json()["detail"].lower())

        fake_pdf_bytes = b"%PDF-1.5 %fake pdf header contents..."
        res_pdf = self.client.post(
            "/api/v1/analyze/image",
            files={"file": ("package.png", fake_pdf_bytes, "image/png")},
        )
        self.assertEqual(res_pdf.status_code, 422)
        self.assertIn("corrupted", res_pdf.json()["detail"].lower())

    def test_06_corrupted_or_truncated_image_rejected_cleanly(self):
        """6. Corrupted or truncated image bytes are rejected cleanly without 500 or path exposure."""
        # Starts with valid JPEG SOI (\xFF\xD8\xFF) but cut abruptly
        truncated_jpeg = self.jpeg_bytes[:25]
        res_trunc = self.client.post(
            "/api/v1/analyze/image",
            files={"file": ("truncated.jpg", truncated_jpeg, "image/jpeg")},
        )
        self.assertEqual(res_trunc.status_code, 422)
        detail = res_trunc.json()["detail"]
        self.assertIn("corrupted", detail.lower())
        # Ensure no internal path or object addresses leaked
        self.assertNotIn("BytesIO", detail)
        self.assertNotIn("/Users/", detail)
        self.assertNotIn("0x", detail)

        # Starts with valid PNG signature but truncated
        truncated_png = self.png_bytes[:25]
        res_trunc_png = self.client.post(
            "/api/v1/analyze/image",
            files={"file": ("truncated.png", truncated_png, "image/png")},
        )
        self.assertEqual(res_trunc_png.status_code, 422)
        detail_png = res_trunc_png.json()["detail"]
        self.assertIn("corrupted", detail_png.lower())
        self.assertNotIn("/Users/", detail_png)

    def test_07_existing_valid_multi_image_upload_unchanged(self):
        """7. Existing multi-image packaging panel workflow remains completely functional."""
        files = [
            ("files", ("front.jpg", io.BytesIO(self.jpeg_bytes), "image/jpeg")),
            ("files", ("back.png", io.BytesIO(self.png_bytes), "image/png")),
        ]
        data = {"panels": "FRONT,BACK"}
        res = self.client.post("/api/v1/inspections", files=files, data=data)
        self.assertEqual(res.status_code, 200)
        session = res.json()
        self.assertEqual(len(session["images"]), 2)
        self.assertIn("inspection_id", session)

    def test_08_magic_byte_detector_unit_test(self):
        """8. Direct unit verification of detect_image_format_from_magic_bytes."""
        self.assertEqual(detect_image_format_from_magic_bytes(self.jpeg_bytes), "JPEG")
        self.assertEqual(detect_image_format_from_magic_bytes(self.png_bytes), "PNG")
        self.assertEqual(detect_image_format_from_magic_bytes(self.webp_bytes), "WEBP")
        self.assertIsNone(detect_image_format_from_magic_bytes(b"short"))
        self.assertIsNone(detect_image_format_from_magic_bytes(b"random_non_image_bytes_here"))

        # Verify MIME mapping
        self.assertEqual(get_canonical_mime_type("JPEG"), "image/jpeg")
        self.assertEqual(get_canonical_mime_type("PNG"), "image/png")
        self.assertEqual(get_canonical_mime_type("WEBP"), "image/webp")
        self.assertEqual(get_canonical_mime_type(None), "application/octet-stream")

    def test_09_unsupported_format_rejected(self):
        """9. Valid images of unsupported formats (e.g. GIF, BMP) are rejected."""
        # Create a valid GIF
        gif_img = Image.new("P", (100, 100), color=1)
        buf = io.BytesIO()
        gif_img.save(buf, format="GIF")
        gif_bytes = buf.getvalue()

        is_valid, err_msg, fmt, _ = validate_image_bytes(gif_bytes)
        self.assertFalse(is_valid)
        self.assertIn("Unsupported image format", err_msg)
        self.assertEqual(fmt, "GIF")


if __name__ == "__main__":
    unittest.main()
