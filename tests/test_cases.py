"""Suite de los 14 casos: seed + cada query devuelve filas.

Corre contra el wheel publicado de namidb (el mismo que usa Vercel):
    pip install namidb pytest && pytest tests/ -v
"""
import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import namidb  # noqa: E402

import cases  # noqa: E402

_DBS: dict[str, "namidb.Client"] = {}


def get_db(slug: str):
    if slug not in _DBS:
        db = namidb.Client(f"memory://test-{slug}")
        cases.get_case(slug).seed(db)
        _DBS[slug] = db
    return _DBS[slug]


def all_query_params():
    params = []
    for slug in cases.ORDEN:
        case = cases.get_case(slug)
        for query in case.QUERIES:
            params.append(pytest.param(slug, query["id"], id=f"{slug}::{query['id']}"))
    return params


@pytest.mark.parametrize("slug", cases.ORDEN)
def test_seed_creates_graph(slug):
    db = get_db(slug)
    nodes = db.cypher("MATCH (n) RETURN count(n) AS n").rows()[0]["n"]
    edges = db.cypher("MATCH ()-[r]->() RETURN count(r) AS n").rows()[0]["n"]
    assert nodes > 20, f"{slug}: dataset demasiado chico ({nodes} nodos)"
    assert edges > 20, f"{slug}: dataset demasiado chico ({edges} aristas)"


@pytest.mark.parametrize("slug", cases.ORDEN)
def test_meta_shape(slug):
    case = cases.get_case(slug)
    for key in ("numero", "slug", "industria", "titulo", "problema", "conecta", "revela", "indicadores"):
        assert key in case.META, f"{slug}: META sin '{key}'"
    assert case.META["slug"] == slug
    assert case.QUERIES, f"{slug}: sin queries"
    assert case.LEYENDA, f"{slug}: sin leyenda"


@pytest.mark.parametrize("slug,query_id", all_query_params())
def test_query_returns_rows(slug, query_id):
    case = cases.get_case(slug)
    query = next(q for q in case.QUERIES if q["id"] == query_id)
    rows = get_db(slug).cypher(query["cypher"], params=query.get("params") or {}).rows()
    assert rows, f"{slug}::{query_id} devolvió 0 filas — el patrón plantado no se detecta"
