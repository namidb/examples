"""Smoke test de las 3 funciones tal como las verá Vercel.

Levanta dev_server, golpea /api/meta, /api/graph y /api/cypher (query
nombrada + una libre) para los 18 casos, y falla si algo no responde 200
o si un grafo llega vacío. Doble uso: verificación local y paso de CI.

    .venv/bin/python scripts/smoke_api.py
"""
import json
import subprocess
import sys
import time
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
PORT = 5271
BASE = f"http://127.0.0.1:{PORT}"


def get(path: str) -> dict:
    with urllib.request.urlopen(f"{BASE}{path}", timeout=60) as r:
        return json.load(r)


def post(path: str, body: dict) -> dict:
    req = urllib.request.Request(
        f"{BASE}{path}",
        data=json.dumps(body).encode(),
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=60) as r:
        return json.load(r)


def main() -> int:
    proc = subprocess.Popen(
        [sys.executable, str(ROOT / "scripts" / "dev_server.py"), str(PORT)],
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )
    try:
        for _ in range(40):
            try:
                get("/api/meta")
                break
            except Exception:
                time.sleep(0.5)
        else:
            print("dev_server no arrancó")
            return 1

        meta = get("/api/meta")
        casos = meta["casos"]
        assert len(casos) == 18, f"esperaba 18 casos, hay {len(casos)}"
        fallos = []

        for caso in casos:
            slug = caso["slug"]
            grafo = get(f"/api/graph?case={slug}")
            if not grafo.get("nodes"):
                fallos.append(f"{slug}: grafo vacío")
            # cada query nombrada devuelve 200 y (casi siempre) filas
            for q in caso["queries"]:
                res = post("/api/cypher", {"case": slug, "queryId": q["id"]})
                if "error" in res:
                    fallos.append(f"{slug}::{q['id']}: {res['error']}")
                elif not res.get("rows"):
                    fallos.append(f"{slug}::{q['id']}: 0 filas")
            # una consulta libre arbitraria también funciona
            libre = post("/api/cypher", {"case": slug, "cypher": "MATCH (n) RETURN count(n) AS n"})
            if libre.get("rows", [{}])[0].get("n", 0) < 1:
                fallos.append(f"{slug}: consulta libre sin nodos")
            print(f"  ✓ {slug}: {len(grafo['nodes'])} nodos, {len(caso['queries'])} queries")

        if fallos:
            print("\nFALLOS:")
            for f in fallos:
                print("  ✗", f)
            return 1
        print(f"\nOK — 18 casos, {sum(len(c['queries']) for c in casos)} queries, todos con datos.")
        return 0
    finally:
        proc.terminate()


if __name__ == "__main__":
    sys.exit(main())
