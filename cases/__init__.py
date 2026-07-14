"""Registry de los 14 casos de uso.

Cada caso es un paquete `cases/cNN_slug/` que expone:
  META    — dict con la historia del deck (numero, slug, industria, titulo,
            problema, conecta, revela, indicadores, referencia)
  QUERIES — lista de queries nombradas [{id, titulo, descripcion, cypher}]
  LEYENDA — dict etiqueta → descripción corta (para la leyenda del mapa)
  seed(db) — carga el dataset sintético determinista en el cliente dado
"""
from __future__ import annotations

import importlib

VERSION = "1.0.0"

_MODULES = {
    "banca-aml": "c01_banca_aml",
    "grupos-economicos": "c02_grupos_economicos",
    "seguros-siniestros": "c03_seguros_siniestros",
    "contratacion-publica": "c04_contratacion_publica",
    "subsidios": "c05_subsidios",
    "salud-paciente": "c06_salud_paciente",
    "agro-trazabilidad": "c07_agro_trazabilidad",
    "agro-cumplimiento": "c08_agro_cumplimiento",
    "energia-activos": "c09_energia_activos",
    "proveedores-compras": "c10_proveedores_compras",
    "recomendaciones": "c11_recomendaciones",
    "telecom-causa-raiz": "c12_telecom_causa_raiz",
    "ciberseguridad": "c13_ciberseguridad",
    "agentes-conocimiento": "c14_agentes_conocimiento",
}

ORDEN = list(_MODULES.keys())

_LOADED: dict[str, object] = {}


def get_case(slug: str):
    """Devuelve el módulo del caso (import perezoso). KeyError si no existe."""
    module_name = _MODULES[slug]
    if slug not in _LOADED:
        _LOADED[slug] = importlib.import_module(f"cases.{module_name}")
    return _LOADED[slug]


def all_meta() -> list[dict]:
    """Metadata + queries de todos los casos, en el orden del deck."""
    out = []
    for slug in ORDEN:
        case = get_case(slug)
        meta = dict(case.META)
        meta["queries"] = [
            {k: q[k] for k in ("id", "titulo", "descripcion", "cypher")}
            for q in case.QUERIES
        ]
        out.append(meta)
    return out
