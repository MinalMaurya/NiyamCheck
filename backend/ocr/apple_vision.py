import json
import logging
import os
import platform
import subprocess
import tempfile
from pathlib import Path
from PIL import Image

from backend.ocr.base import BaseOCREngine
from backend.schemas.analysis import OCRResult, OCRRegion

logger = logging.getLogger(__name__)

BIN_PATH = Path(__file__).parent / "bin" / "mac_vision_ocr"
SRC_PATH = Path(__file__).parent / "bin" / "mac_vision_ocr.m"


def _ensure_binary_built() -> bool:
    """Ensures the mac_vision_ocr helper binary is compiled on macOS."""
    if platform.system() != "Darwin":
        return False
    if BIN_PATH.is_file() and os.access(BIN_PATH, os.X_OK):
        return True
    if not SRC_PATH.is_file():
        return False

    try:
        BIN_PATH.parent.mkdir(parents=True, exist_ok=True)
        cmd = [
            "clang",
            "-O3",
            "-framework", "Foundation",
            "-framework", "Vision",
            "-framework", "CoreGraphics",
            str(SRC_PATH),
            "-o", str(BIN_PATH),
        ]
        res = subprocess.run(cmd, capture_output=True, text=True, timeout=10)
        if res.returncode == 0:
            BIN_PATH.chmod(0o755)
            return True
        logger.warning(f"Failed to compile mac_vision_ocr: {res.stderr}")
        return False
    except Exception as exc:
        logger.warning(f"Could not build mac_vision_ocr helper: {exc}")
        return False


class AppleVisionEngine(BaseOCREngine):
    """
    Native macOS Vision framework OCR engine.
    Uses Apple's VNRecognizeTextRequest for high-speed, local neural-engine-backed OCR
    with zero external dependencies.
    """

    def __init__(self):
        self._available = _ensure_binary_built()

    @property
    def name(self) -> str:
        return "Apple-Vision-OCR"

    @property
    def is_available(self) -> bool:
        if not self._available:
            self._available = _ensure_binary_built()
        return self._available

    def extract_text(self, image: Image.Image) -> OCRResult:
        if not self.is_available:
            logger.warning("AppleVisionEngine is not available on this platform.")
            return OCRResult(text="", confidence=0.0, regions=[])

        # Write image to temporary JPEG file for Vision analysis
        tmp_file = None
        try:
            with tempfile.NamedTemporaryFile(suffix=".jpg", delete=False) as f:
                tmp_file = f.name
                # Ensure RGB mode for Vision
                rgb_img = image.convert("RGB")
                rgb_img.save(f, format="JPEG", quality=95)

            cmd = [str(BIN_PATH), tmp_file]
            proc = subprocess.run(cmd, capture_output=True, text=True, timeout=15)
            if proc.returncode != 0:
                logger.warning(f"mac_vision_ocr returned code {proc.returncode}: {proc.stderr}")
                return OCRResult(text="", confidence=0.0, regions=[])

            raw_json = proc.stdout.strip()
            if not raw_json:
                return OCRResult(text="", confidence=0.0, regions=[])

            items = json.loads(raw_json)
            regions = []
            text_lines = []
            conf_sum = 0.0

            for item in items:
                t = item.get("text", "").strip()
                c = float(item.get("confidence", 0.0))
                box = item.get("box", [0.0, 0.0, 1.0, 1.0])
                if t:
                    # Normalized clamped box
                    ymin = max(0.0, min(1.0, float(box[0])))
                    xmin = max(0.0, min(1.0, float(box[1])))
                    ymax = max(0.0, min(1.0, float(box[2])))
                    xmax = max(0.0, min(1.0, float(box[3])))
                    if ymin > ymax:
                        ymin, ymax = ymax, ymin
                    if xmin > xmax:
                        xmin, xmax = xmax, xmin

                    regions.append(
                        OCRRegion(
                            text=t,
                            confidence=round(c, 2),
                            box=[round(ymin, 4), round(xmin, 4), round(ymax, 4), round(xmax, 4)],
                        )
                    )
                    text_lines.append(t)
                    conf_sum += c

            avg_conf = round(conf_sum / len(regions), 2) if regions else 0.0
            return OCRResult(
                text="\n".join(text_lines),
                confidence=avg_conf,
                regions=regions,
            )
        except Exception as exc:
            logger.error(f"AppleVisionEngine extraction failed: {exc}")
            return OCRResult(text="", confidence=0.0, regions=[])
        finally:
            if tmp_file and os.path.exists(tmp_file):
                try:
                    os.unlink(tmp_file)
                except OSError:
                    pass
