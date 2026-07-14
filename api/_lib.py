"""Shared engine for the Vercel Python functions.

Each serverless instance keeps one embedded NamiDB client per use case
(`memory://<slug>`), seeded on first touch. The bucket-is-the-database
engine is exactly the one from `pip install namidb` — what runs here is
what a developer gets locally.
"""
from __future__ import annotations

import json
import sys
import threading
import time
from pathlib import Path

# The `cases` package lives at the repo root (one level above api/).
ROOT = Path(__file__).resolve().parent.parent
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

import namidb  # noqa: E402

import cases  # noqa: E402

_CLIENTS: dict[str, "namidb.Client"] = {}
_LOCK = threading.Lock()

MAX_QUERY_CHARS = 4000
MAX_ROWS = 500


def get_client(slug: str, reset: bool = False) -> "namidb.Client":
    """Return the seeded client for a case, creating it on first use."""
    case = cases.get_case(slug)  # raises KeyError for unknown slugs
    with _LOCK:
        if reset:
            _CLIENTS.pop(slug, None)
        client = _CLIENTS.get(slug)
        if client is None:
            client = namidb.Client(f"memory://{slug}")
            case.seed(client)
            _CLIENTS[slug] = client
    return client


def run(slug: str, cypher: str, params: dict | None = None, reset: bool = False) -> dict:
    """Execute Cypher against a case namespace and return JSON-safe results."""
    if len(cypher) > MAX_QUERY_CHARS:
        raise ValueError(f"query too long (max {MAX_QUERY_CHARS} chars)")
    client = get_client(slug, reset=reset)
    t0 = time.perf_counter()
    result = client.cypher(cypher, params=params or {})
    ms = (time.perf_counter() - t0) * 1000
    rows = result.rows()
    truncated = len(rows) > MAX_ROWS
    rows = rows[:MAX_ROWS]
    columns = list(rows[0].keys()) if rows else []
    return {
        "columns": columns,
        "rows": json.loads(json.dumps(rows, default=str)),
        "ms": round(ms, 1),
        "truncated": truncated,
    }


# ── HTTP helpers (BaseHTTPRequestHandler-style functions) ──────────────

def send_json(handler, status: int, payload: dict) -> None:
    body = json.dumps(payload, ensure_ascii=False, default=str).encode("utf-8")
    handler.send_response(status)
    handler.send_header("Content-Type", "application/json; charset=utf-8")
    handler.send_header("Access-Control-Allow-Origin", "*")
    handler.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
    handler.send_header("Access-Control-Allow-Headers", "Content-Type")
    handler.send_header("Content-Length", str(len(body)))
    handler.end_headers()
    handler.wfile.write(body)


def read_json_body(handler) -> dict:
    length = int(handler.headers.get("Content-Length") or 0)
    if length <= 0:
        return {}
    raw = handler.rfile.read(length)
    return json.loads(raw.decode("utf-8"))


def error_payload(exc: Exception) -> dict:
    return {"error": str(exc)}
