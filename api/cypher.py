"""POST /api/cypher — run a named query or free-form Cypher for a case.

Body: {"case": "banca-aml", "queryId": "anillo-dispositivos"}
   or {"case": "banca-aml", "cypher": "MATCH ...", "params": {...}}
Optional: {"reset": true} re-seeds the namespace (the demo data is
ephemeral and shared per serverless instance).
"""
import os
import sys
from http.server import BaseHTTPRequestHandler

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from _lib import error_payload, read_json_body, run, send_json  # noqa: E402
import cases  # noqa: E402


class handler(BaseHTTPRequestHandler):
    def do_POST(self):
        try:
            body = read_json_body(self)
            slug = body.get("case") or ""
            case = cases.get_case(slug)

            cypher = body.get("cypher")
            params = body.get("params") or {}
            if not cypher:
                query_id = body.get("queryId") or ""
                match = next((q for q in case.QUERIES if q["id"] == query_id), None)
                if match is None:
                    send_json(self, 404, {"error": f"query '{query_id}' no existe en {slug}"})
                    return
                cypher = match["cypher"]
                params = match.get("params") or {}

            payload = run(slug, cypher, params, reset=bool(body.get("reset")))
            send_json(self, 200, payload)
        except KeyError:
            send_json(self, 404, {"error": "caso desconocido"})
        except Exception as exc:  # noqa: BLE001 — surface engine errors to the UI
            send_json(self, 400, error_payload(exc))

    def do_OPTIONS(self):
        send_json(self, 204, {})
