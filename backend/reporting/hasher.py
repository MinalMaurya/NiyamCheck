import json
import hashlib
from typing import Any, Dict


def compute_integrity_hash(payload: Dict[str, Any]) -> str:
    """
    Computes a deterministic SHA-256 hash over the canonical JSON representation of the inspection payload.
    Serves as an audit integrity mechanism to detect data tampering or report divergence.
    """
    canonical_json = json.dumps(
        payload,
        sort_keys=True,
        ensure_ascii=True,
        default=str,
        separators=(",", ":"),
    )
    return hashlib.sha256(canonical_json.encode("utf-8")).hexdigest()
