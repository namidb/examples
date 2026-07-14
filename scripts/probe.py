"""Valida Cypher contra el motor real de un caso (memory://).

Uso:
    .venv/bin/python scripts/probe.py <slug>            # corre todas las QUERIES nombradas
    .venv/bin/python scripts/probe.py <slug> --cypher "MATCH (n) RETURN count(n)"
    .venv/bin/python scripts/probe.py <slug> --labels   # inventario de labels + rels + props

Pensado para el bucle de desarrollo de los dashboards: siembra el caso una
vez y ejecuta consultas mostrando columnas y primeras filas. Si una consulta
falla, imprime el error del motor tal cual (para depurar quirks de Cypher).
"""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

import namidb  # noqa: E402
import cases  # noqa: E402


def seed(slug: str):
    case = cases.get_case(slug)
    db = namidb.Client(f"memory://probe-{slug}")
    case.seed(db)
    return case, db


def show(db, cypher: str, limit: int = 8):
    try:
        rows = db.cypher(cypher).rows()
    except Exception as exc:  # noqa: BLE001
        print(f"  ✗ ERROR: {exc}")
        return False
    cols = list(rows[0].keys()) if rows else []
    print(f"  filas={len(rows)}  columnas={cols}")
    for r in rows[:limit]:
        print("   ", json.dumps(r, ensure_ascii=False, default=str))
    if not rows:
        print("   (sin filas)")
    return len(rows) > 0


def inventory(db):
    print("== LABELS + conteo ==")
    for r in db.cypher("MATCH (n) RETURN labels(n)[0] AS label, count(*) AS n ORDER BY n DESC").rows():
        print(f"  {r['label']:<22} {r['n']}")
    print("== REL TYPES + conteo ==")
    for r in db.cypher("MATCH ()-[r]->() RETURN type(r) AS rel, count(*) AS n ORDER BY n DESC").rows():
        print(f"  {r['rel']:<22} {r['n']}")
    print("== PROPS de muestra por label ==")
    labels = [r["label"] for r in db.cypher("MATCH (n) RETURN DISTINCT labels(n)[0] AS label").rows()]
    for label in labels:
        rows = db.cypher(f"MATCH (n:{label}) RETURN properties(n) AS p LIMIT 1").rows()
        if rows:
            print(f"  {label}: {json.dumps(rows[0]['p'], ensure_ascii=False, default=str)}")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("slug")
    ap.add_argument("--cypher", default=None)
    ap.add_argument("--labels", action="store_true")
    args = ap.parse_args()

    case, db = seed(args.slug)
    print(f"### {args.slug} — sembrado OK")

    if args.labels:
        inventory(db)
        return

    if args.cypher:
        ok = show(db, args.cypher)
        sys.exit(0 if ok else 1)

    all_ok = True
    for q in getattr(case, "QUERIES", []):
        print(f"\n— [{q['id']}] {q['titulo']}")
        ok = show(db, q["cypher"])
        all_ok = all_ok and ok
    print("\n" + ("TODAS con filas ✓" if all_ok else "ALGUNA sin filas / con error ✗"))
    sys.exit(0 if all_ok else 1)


if __name__ == "__main__":
    main()
