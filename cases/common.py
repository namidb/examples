"""Toolkit compartido por los 14 casos: RNG determinista, datos LATAM,
embeddings offline y helpers de carga por lotes.

Cada `seed(db)` debe ser 100 % determinista (mismo grafo en cada corrida)
para que las queries de los README siempre devuelvan lo documentado.
"""
from __future__ import annotations

import hashlib
import math
import random

# ── Pools de datos sintéticos (es-LATAM) ───────────────────────────────

NOMBRES = [
    "María", "José", "Carmen", "Luis", "Ana", "Carlos", "Rosa", "Jorge",
    "Lucía", "Miguel", "Elena", "Pedro", "Sofía", "Diego", "Valeria",
    "Andrés", "Camila", "Fernando", "Gabriela", "Ricardo", "Paula",
    "Héctor", "Daniela", "Óscar", "Verónica", "Raúl", "Isabel", "Marco",
    "Patricia", "Iván",
]

APELLIDOS = [
    "García", "Rodríguez", "Martínez", "López", "González", "Pérez",
    "Sánchez", "Ramírez", "Torres", "Flores", "Rivera", "Vargas",
    "Castro", "Morales", "Ortiz", "Silva", "Rojas", "Mendoza", "Cruz",
    "Herrera", "Medina", "Aguilar", "Vega", "Campos", "Reyes", "Paredes",
    "Salazar", "Ponce", "Cabrera", "Espinoza",
]

EMPRESAS_PREFIJO = [
    "Comercial", "Inversiones", "Distribuidora", "Servicios", "Corporación",
    "Importadora", "Constructora", "Agroindustrial", "Logística", "Grupo",
    "Consultora", "Transportes", "Textiles", "Alimentos", "Tecnología",
]

EMPRESAS_RAIZ = [
    "Andina", "del Pacífico", "Cóndor", "Amazonas", "del Valle", "Austral",
    "Central", "Metropolitana", "Nacional", "Global", "Latam", "Sierra",
    "Costa", "Delta", "Meridional", "Insignia", "Titán", "Horizonte",
    "Cumbre", "Pionera",
]

CIUDADES = [
    "Quito", "Guayaquil", "Cuenca", "Bogotá", "Medellín", "Lima",
    "Arequipa", "Ciudad de México", "Monterrey", "Santiago", "Valparaíso",
    "Buenos Aires", "Córdoba", "Montevideo", "Asunción", "La Paz",
    "San José", "Panamá", "Tegucigalpa", "Santo Domingo",
]


class Rng:
    """random.Random con helpers de dominio, siempre sembrado."""

    def __init__(self, seed: int):
        self.r = random.Random(seed)

    def nombre(self) -> str:
        return f"{self.r.choice(NOMBRES)} {self.r.choice(APELLIDOS)}"

    def empresa(self) -> str:
        return f"{self.r.choice(EMPRESAS_PREFIJO)} {self.r.choice(EMPRESAS_RAIZ)}"

    def ciudad(self) -> str:
        return self.r.choice(CIUDADES)

    def iban(self) -> str:
        return f"EC{self.r.randint(10, 99)}-{self.r.randint(1000, 9999)}-{self.r.randint(100000, 999999)}"

    def telefono(self) -> str:
        return f"+593 9{self.r.randint(10000000, 99999999)}"

    def ruc(self) -> str:
        return f"{self.r.randint(10 ** 12, 10 ** 13 - 1)}"

    def fecha(self, año: int = 2026, mes_ini: int = 1, mes_fin: int = 6) -> str:
        mes = self.r.randint(mes_ini, mes_fin)
        dia = self.r.randint(1, 28)
        return f"{año}-{mes:02d}-{dia:02d}"

    def choice(self, seq):
        return self.r.choice(seq)

    def sample(self, seq, k):
        return self.r.sample(seq, k)

    def randint(self, a, b):
        return self.r.randint(a, b)

    def uniform(self, a, b):
        return self.r.uniform(a, b)

    def shuffle(self, seq):
        self.r.shuffle(seq)


# ── Embeddings offline y deterministas ─────────────────────────────────

def embed(texto: str, dim: int = 24) -> list[float]:
    """Embedding bag-of-tokens con hashing: determinista, sin APIs externas.

    No pretende calidad semántica real — alcanza para que textos que
    comparten vocabulario queden cerca en coseno, que es lo que las
    demos necesitan. En producción: NAMIDB_EMBED_PROVIDER (openai,
    voyage, cohere, gemini, jina) o el embedder que prefieras.
    """
    vec = [0.0] * dim
    tokens = "".join(c.lower() if c.isalnum() else " " for c in texto).split()
    for token in tokens:
        digest = hashlib.md5(token.encode("utf-8")).digest()
        idx = digest[0] % dim
        sign = 1.0 if digest[1] % 2 == 0 else -1.0
        weight = 1.0 + (digest[2] / 255.0)
        vec[idx] += sign * weight
    norm = math.sqrt(sum(v * v for v in vec)) or 1.0
    return [round(v / norm, 5) for v in vec]


# ── Carga por lotes ────────────────────────────────────────────────────

def load_nodes(db, label: str, rows: list[dict], batch: int = 400) -> None:
    """CREATE masivo de nodos con UNWIND (una transacción por lote)."""
    if not rows:
        return
    keys = sorted(rows[0].keys())
    props = ", ".join(f"{k}: r.{k}" for k in keys)
    query = f"UNWIND $rows AS r CREATE (:{label} {{{props}}})"
    for i in range(0, len(rows), batch):
        db.cypher(query, params={"rows": rows[i : i + batch]})


def load_edges(
    db,
    src_label: str,
    src_key: str,
    rel: str,
    dst_label: str,
    dst_key: str,
    rows: list[dict],
    rel_props: list[str] | None = None,
    batch: int = 400,
) -> None:
    """CREATE masivo de aristas: cada fila trae `src`, `dst` y props del rel."""
    if not rows:
        return
    props = ""
    if rel_props:
        props = " {" + ", ".join(f"{p}: r.{p}" for p in rel_props) + "}"
    query = (
        f"UNWIND $rows AS r "
        f"MATCH (a:{src_label} {{{src_key}: r.src}}) "
        f"MATCH (b:{dst_label} {{{dst_key}: r.dst}}) "
        f"CREATE (a)-[:{rel}{props}]->(b)"
    )
    for i in range(0, len(rows), batch):
        db.cypher(query, params={"rows": rows[i : i + batch]})
