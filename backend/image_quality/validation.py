"""
Robust Content-Based Image Validation for NiyamCheck.
Validates uploaded image bytes using magic byte signatures and safe Pillow decoding.
Does not trust client-supplied Content-Type or file extensions.
Supported formats: JPEG, PNG, WebP.
"""
import io
from typing import Optional, Tuple
from PIL import Image

SUPPORTED_IMAGE_FORMATS = {"JPEG", "PNG", "WEBP"}

SUPPORTED_MIME_MAP = {
    "JPEG": "image/jpeg",
    "PNG": "image/png",
    "WEBP": "image/webp",
}


def detect_image_format_from_magic_bytes(data: bytes) -> Optional[str]:
    """
    Identifies the image format strictly from file byte signatures ('magic bytes').
    Returns 'JPEG', 'PNG', 'WEBP', or None if unrecognized.
    """
    if not data or len(data) < 12:
        return None

    # JPEG: starts with \xFF\xD8\xFF
    if data.startswith(b"\xff\xd8\xff"):
        return "JPEG"

    # PNG: starts with \x89PNG\r\n\x1a\n (89 50 4E 47 0D 0A 1A 0A)
    if data.startswith(b"\x89PNG\r\n\x1a\n"):
        return "PNG"

    # WebP: starts with RIFF (bytes 0-3) and WEBP (bytes 8-11)
    if data[:4] == b"RIFF" and data[8:12] == b"WEBP":
        return "WEBP"

    return None


def get_canonical_mime_type(detected_format: Optional[str]) -> str:
    """Returns canonical MIME type for detected image format."""
    if not detected_format:
        return "application/octet-stream"
    return SUPPORTED_MIME_MAP.get(detected_format.upper(), "application/octet-stream")


def validate_image_bytes(
    data: bytes,
    max_size_bytes: Optional[int] = None,
) -> Tuple[bool, Optional[str], Optional[str], Optional[str]]:
    """
    Validates uploaded raw bytes for presence, size limits, magic bytes signature,
    supported format (JPEG, PNG, WebP), and stream decodability.

    Returns:
        (is_valid: bool, error_message: Optional[str], detected_format: Optional[str], mime_type: Optional[str])
    """
    if not data or len(data) == 0:
        return False, "Uploaded file is empty (0 bytes).", None, None

    if max_size_bytes is not None and len(data) > max_size_bytes:
        limit_mb = max_size_bytes // (1024 * 1024)
        return False, f"Uploaded file exceeds maximum size limit of {limit_mb}MB.", None, None

    # Content-based magic-byte check
    magic_format = detect_image_format_from_magic_bytes(data)

    # Safe verification using Pillow
    try:
        with Image.open(io.BytesIO(data)) as pil_img:
            pil_format = (pil_img.format or "").upper()

            # Must be one of the supported formats
            if pil_format not in SUPPORTED_IMAGE_FORMATS:
                return (
                    False,
                    f"Unsupported image format: '{pil_format}'. Supported formats: JPEG, PNG, WebP.",
                    pil_format,
                    None,
                )

            # verify() verifies stream integrity and header markers
            pil_img.verify()

        # Re-open and test load to catch truncated or corrupted compressed image scans
        with Image.open(io.BytesIO(data)) as pil_img:
            pil_img.load()

        final_format = magic_format or pil_format
        mime_type = get_canonical_mime_type(final_format)
        return True, None, final_format, mime_type

    except Exception:
        # Return clean diagnostic without exposing filesystem paths or internal memory addresses
        return False, "Invalid or corrupted image format. Please upload a valid JPEG, PNG, or WebP image.", None, None
