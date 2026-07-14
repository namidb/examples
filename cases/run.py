"""Corre un caso completo sin el sitio web — la base para tu desarrollo.

    pip install namidb
    python cases/run.py banca-aml
    python cases/run.py banca-aml --store "file:///tmp/nami?ns=demo"

Cambia --store a s3://… / gs://… / az://… y el mismo grafo vive en tu bucket.
"""
from __future__ import annotations

import argparse
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import namidb

import cases


def main() -> None:
    parser = argparse.ArgumentParser(description="Ejecuta un caso de uso de NamiDB")
    parser.add_argument("slug", choices=cases.ORDEN, help="caso a ejecutar")
    parser.add_argument("--store", default=None, help="URI de storage (default memory://<slug>)")
    parser.add_argument("--max-rows", type=int, default=8)
    args = parser.parse_args()

    case = cases.get_case(args.slug)
    store = args.store or f"memory://{args.slug}"
    db = namidb.Client(store)

    print(f"\n{'=' * 72}\n{case.META['numero']:02d} · {case.META['industria']}\n"
          f"{case.META['titulo']}\n{'=' * 72}")
    print(f"store: {store}\nsembrando datos sintéticos…")
    case.seed(db)

    for query in case.QUERIES:
        print(f"\n── {query['titulo']} " + "─" * max(0, 50 - len(query["titulo"])))
        print(f"   {query['descripcion']}\n")
        rows = db.cypher(query["cypher"], params=query.get("params") or {}).rows()
        if not rows:
            print("   (sin filas)")
        for row in rows[: args.max_rows]:
            print("  ", row)
        if len(rows) > args.max_rows:
            print(f"   … {len(rows) - args.max_rows} filas más")


if __name__ == "__main__":
    main()
