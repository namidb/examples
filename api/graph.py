"""GET /api/graph?case=<slug>[&limit=N] — graph sample for the live map."""
import os
import sys
from http.server import BaseHTTPRequestHandler
from urllib.parse import parse_qs, urlparse

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from _lib import error_payload, get_client, send_json  # noqa: E402
import cases  # noqa: E402

VIZ_QUERY = """
MATCH (a)-[r]->(b)
RETURN id(a) AS sid, labels(a) AS sl, properties(a) AS sp,
       type(r) AS rt,
       id(b) AS tid, labels(b) AS tl, properties(b) AS tp
LIMIT $limit
"""

CAPTION_KEYS = (
    "nombre", "name", "titulo", "title", "codigo", "code", "numero",
    "iban", "id_externo", "placa", "sku", "cve", "ip", "device_id", "lote",
)


def caption(props: dict) -> str:
    for key in CAPTION_KEYS:
        value = props.get(key)
        if value not in (None, ""):
            return str(value)
    for value in props.values():
        if isinstance(value, str) and value:
            return value
    return "·"


class handler(BaseHTTPRequestHandler):
    def do_GET(self):
        try:
            query = parse_qs(urlparse(self.path).query)
            slug = (query.get("case") or [""])[0]
            limit = min(int((query.get("limit") or ["600"])[0]), 1500)
            case = cases.get_case(slug)
            client = get_client(slug)
            rows = client.cypher(VIZ_QUERY, params={"limit": limit}).rows()

            nodes: dict[str, dict] = {}
            links = []
            for row in rows:
                for id_key, label_key, props_key in (
                    ("sid", "sl", "sp"),
                    ("tid", "tl", "tp"),
                ):
                    node_id = row[id_key]
                    if node_id not in nodes:
                        props = row[props_key] or {}
                        label = (row[label_key] or ["?"])[0]
                        nodes[node_id] = {
                            "id": node_id,
                            "label": label,
                            "caption": caption(props),
                            "props": props,
                        }
                links.append({"source": row["sid"], "target": row["tid"], "type": row["rt"]})

            send_json(self, 200, {
                "case": slug,
                "labels": sorted({n["label"] for n in nodes.values()}),
                "nodes": list(nodes.values()),
                "links": links,
                "leyenda": getattr(case, "LEYENDA", {}),
            })
        except KeyError:
            send_json(self, 404, {"error": f"caso desconocido"})
        except Exception as exc:  # noqa: BLE001 — surface engine errors to the UI
            send_json(self, 500, error_payload(exc))

    def do_OPTIONS(self):
        send_json(self, 204, {})
