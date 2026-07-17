"""Caso 16 — Agro: riego y derechos de agua en una cuenca bajo sequía."""
from cases.common import Rng, load_edges, load_nodes

META = {
    "numero": 16,
    "slug": "agro-riego",
    "industria": "Agro y agua — Riego y derechos de agua en cuenca bajo sequía",
    "titulo": "Cada gota, cada parcela, cada derecho.",
    "problema": (
        "En sequía, la autoridad de cuenca debe priorizar concesiones y "
        "anticipar el impacto de cada falla, pero la red hidráulica vive en "
        "planos y hojas de cálculo: nadie sabe en minutos qué parcelas se "
        "quedan sin agua cuando una compuerta falla, quién extrae más de lo "
        "autorizado ni hasta dónde llega una contaminación."
    ),
    "conecta": [
        "Fuente", "Canal", "Compuerta", "Ramal", "Toma", "Parcela",
        "Usuario", "Concesion", "Sensor", "Medicion", "IncidenteCalidad",
    ],
    "revela": [
        "Parcelas y hectáreas afectadas por una falla, aguas abajo",
        "Tomas que extraen más caudal del autorizado en su concesión",
        "La cola de canal sub-atendida: la inequidad hecha consulta",
        "La infraestructura crítica de la red (puntos únicos de falla)",
        "El alcance aguas abajo de un incidente de calidad de agua",
    ],
    "indicadores": [
        "Hectáreas en riesgo por falla", "Tomas en sobre-extracción",
        "Utilización de fuente y canal (%)", "Parcelas sub-atendidas en cola",
        "Tiempo para trazar una contaminación",
    ],
    "referencia": (
        "Autoridades de cuenca como SENAGUA (Ecuador), ANA (Perú) o la DGA "
        "(Chile) asignan derechos de aprovechamiento de agua y deben "
        "priorizar el uso humano y fiscalizar extracciones en sequía."
    ),
}

LEYENDA = {
    "Fuente": "Embalse o río que origina el agua",
    "Canal": "Canal principal de conducción",
    "Compuerta": "Punto de control del flujo (abierta / cerrada / falla)",
    "Ramal": "Ramal o sub-ramal de distribución",
    "Toma": "Bocatoma con caudal asignado a una parcela",
    "Parcela": "Predio regado (cultivo, hectáreas, zona)",
    "Usuario": "Regante o empresa, socio de una junta de riego",
    "Concesion": "Derecho de agua: volumen y caudal máximo autorizado",
    "Sensor": "Sensor de caudal o nivel instalado en la red",
    "Medicion": "Lectura fechada de un sensor",
    "IncidenteCalidad": "Evento de salinidad, agroquímico o sedimento",
}

# ── Red hidráulica (árbol dirigido por ALIMENTA; 'nivel' = orden desde
#    la fuente, para ordenar rutas sin nodes(path)) ─────────────────────

FUENTES = [
    {"nombre": "Embalse La Esperanza", "tipo": "embalse", "caudal_lps": 420, "nivel_pct": 38, "nivel": 0},
    {"nombre": "Río Chanchán", "tipo": "rio", "caudal_lps": 210, "nivel_pct": 51, "nivel": 0},
]

CANALES = [
    # (codigo, nombre, capacidad_lps, fuente)
    ("CN-01", "Canal Principal Norte", 250, "Embalse La Esperanza"),
    ("CN-02", "Canal Margen Izquierda", 150, "Embalse La Esperanza"),
    ("CN-03", "Canal Derivación Sur", 90, "Río Chanchán"),
    ("CN-04", "Canal Cola Chanchán", 120, "Río Chanchán"),
]

COMPUERTAS = [
    # (codigo, estado, canal)
    ("CG-01", "abierta", "CN-01"),
    ("CG-02", "abierta", "CN-01"),
    ("CG-03", "falla", "CN-02"),      # ← la falla plantada
    ("CG-04", "abierta", "CN-02"),
    ("CG-05", "abierta", "CN-03"),
    ("CG-06", "cerrada", "CN-03"),
    ("CG-07", "abierta", "CN-04"),
    ("CG-08", "abierta", "CN-04"),
]

RAMALES = [
    # (codigo, capacidad_lps, nivel, padre_label, padre_codigo)
    ("RM-01", 160, 3, "Compuerta", "CG-01"),
    ("RM-02", 140, 3, "Compuerta", "CG-01"),   # ← incidente de salinidad
    ("RM-03", 180, 3, "Compuerta", "CG-01"),
    ("RM-04", 150, 3, "Compuerta", "CG-03"),   # aguas abajo de la falla
    ("RM-05", 90, 3, "Compuerta", "CG-03"),    # aguas abajo de la falla
    ("RM-06", 120, 3, "Compuerta", "CG-02"),
    ("RM-07", 140, 3, "Compuerta", "CG-05"),
    ("RM-08", 100, 3, "Compuerta", "CG-06"),
    ("RM-09", 120, 3, "Compuerta", "CG-07"),
    ("RM-10", 90, 3, "Compuerta", "CG-08"),
    ("RM-11", 60, 4, "Ramal", "RM-10"),        # sub-ramal
    ("RM-12", 40, 5, "Ramal", "RM-11"),        # sub-sub-ramal: la cola
    ("RM-13", 90, 3, "Compuerta", "CG-04"),
]

TOMAS = [
    # (num, ramal, caudal_asignado_lps, caudal_max_lps de la concesión,
    #  prioridad, cultivo, hectareas, zona)
    (1, "RM-01", 30, 35, "agricola", "arroz", 6, "Cabecera"),
    (2, "RM-01", 25, 30, "agricola", "maíz", 5, "Cabecera"),
    (3, "RM-02", 28, 30, "agricola", "banano", 5, "Cabecera"),
    (4, "RM-02", 22, 25, "agricola", "cacao", 4, "Cabecera"),
    (5, "RM-04", 35, 40, "humano", "hortalizas", 7, "Media"),   # ← prioridad humana bajo la falla
    (6, "RM-04", 30, 32, "agricola", "arroz", 6, "Media"),
    (7, "RM-04", 20, 25, "agricola", "maíz", 5, "Media"),
    (8, "RM-05", 18, 20, "agricola", "papa", 4, "Media"),
    (9, "RM-05", 16, 20, "agricola", "cacao", 4, "Media"),
    (10, "RM-03", 32, 35, "agricola", "arroz", 6, "Cabecera"),
    (11, "RM-03", 26, 24, "agricola", "banano", 5, "Cabecera"),   # exceso leve: 2 l/s
    (12, "RM-03", 24, 28, "agricola", "maíz", 4, "Cabecera"),
    (13, "RM-06", 38, 40, "industrial", "caña", 7, "Media"),
    (14, "RM-07", 45, 30, "industrial", "caña", 8, "Media"),      # ← sobre-extracción plantada: 15 l/s
    (15, "RM-07", 30, 34, "agricola", "arroz", 6, "Media"),
    (16, "RM-08", 25, 28, "agricola", "cacao", 5, "Media"),
    (17, "RM-09", 28, 30, "humano", "hortalizas", 5, "Media"),
    (18, "RM-09", 24, 20, "agricola", "maíz", 4, "Media"),        # exceso leve: 4 l/s
    (19, "RM-12", 8, 25, "agricola", "arroz", 10, "Cola"),        # ← cola sub-atendida
    (20, "RM-12", 6, 22, "agricola", "banano", 12, "Cola"),       # ← cola sub-atendida
    (21, "RM-13", 20, 24, "agricola", "papa", 4, "Media"),
]

JUNTA_POR_CANAL = {
    "CN-01": "Junta de Riego Norte",
    "CN-02": "Junta Margen Izquierda",
    "CN-03": "Junta Derivación Sur",
    "CN-04": "Junta Chanchán",
}

SENSORES = [
    # (codigo, tipo, umbral, ultima, label_punto, punto)
    ("SN-01", "caudal", 200, 118, "Canal", "CN-01"),
    ("SN-02", "nivel", 60, 47, "Canal", "CN-02"),
    ("SN-03", "caudal", 80, 0, "Ramal", "RM-04"),      # aguas abajo de CG-03: caudal 0
    ("SN-04", "caudal", 90, 96, "Canal", "CN-03"),     # canal sobre-suscrito
    ("SN-05", "nivel", 20, 6, "Ramal", "RM-12"),       # la cola, casi seca
    ("SN-06", "caudal", 100, 0, "Compuerta", "CG-03"), # confirma la falla
]

MEDICIONES_SN01 = [
    ("2026-07-05", 205), ("2026-07-06", 198), ("2026-07-07", 186),
    ("2026-07-08", 172), ("2026-07-09", 163), ("2026-07-10", 151),
    ("2026-07-11", 144), ("2026-07-12", 137), ("2026-07-13", 126),
    ("2026-07-14", 118),
]

MEDICIONES_SN03 = [
    ("2026-07-10", 74), ("2026-07-11", 68), ("2026-07-12", 31),
    ("2026-07-13", 5), ("2026-07-14", 0),
]

INCIDENTES = [
    # (codigo, tipo, fecha, severidad, label_punto, punto)
    ("IC-01", "salinidad", "2026-07-08", "alta", "Ramal", "RM-02"),
    ("IC-02", "sedimento", "2026-06-21", "media", "Canal", "CN-04"),
    ("IC-03", "agroquimico", "2026-05-30", "baja", "Ramal", "RM-07"),
]


def seed(db):
    rng = Rng(1601)

    # nombres únicos y deterministas para los 21 usuarios
    nombres, vistos = [], set()
    while len(nombres) < len(TOMAS):
        n = rng.nombre()
        if n not in vistos:
            vistos.add(n)
            nombres.append(n)

    canal_de_ramal = {}
    for codigo, _cap, _niv, padre_label, padre in RAMALES:
        if padre_label == "Compuerta":
            canal = next(c for cg, _e, c in COMPUERTAS if cg == padre)
        else:
            canal = canal_de_ramal[padre]
        canal_de_ramal[codigo] = canal

    nivel_ramal = {codigo: niv for codigo, _cap, niv, _pl, _p in RAMALES}

    canales = [{"codigo": c, "nombre": n, "capacidad_lps": cap, "nivel": 1}
               for c, n, cap, _f in CANALES]
    compuertas = [{"codigo": c, "estado": e, "nivel": 2} for c, e, _cn in COMPUERTAS]
    ramales = [{"codigo": c, "capacidad_lps": cap, "nivel": niv}
               for c, cap, niv, _pl, _p in RAMALES]

    tomas, parcelas, usuarios, concesiones = [], [], [], []
    alimenta_rt, alimenta_tp = [], []
    titular, autoriza, opera = [], [], []
    for num_, ramal, asignado, caudal_max, prioridad, cultivo, ha, zona in TOMAS:
        tm, pa, co = f"TM-{num_:02d}", f"PA-{num_:02d}", f"CO-{num_:02d}"
        niv_toma = nivel_ramal[ramal] + 1
        tomas.append({"codigo": tm, "caudal_asignado_lps": asignado, "nivel": niv_toma})
        parcelas.append({"codigo": pa, "cultivo": cultivo, "hectareas": ha,
                         "zona": zona, "nivel": niv_toma + 1})
        concesiones.append({"codigo": co, "volumen_m3_ano": caudal_max * rng.randint(9000, 16000),
                            "caudal_max_lps": caudal_max, "prioridad": prioridad})
        usuarios.append({"nombre": nombres[num_ - 1],
                         "junta": JUNTA_POR_CANAL[canal_de_ramal[ramal]]})
        alimenta_rt.append({"src": ramal, "dst": tm})
        alimenta_tp.append({"src": tm, "dst": pa})
        titular.append({"src": nombres[num_ - 1], "dst": co})
        autoriza.append({"src": co, "dst": tm})
        opera.append({"src": nombres[num_ - 1], "dst": pa})

    sensores = [{"codigo": c, "tipo": t, "umbral": u, "ultima": ul}
                for c, t, u, ul, _lb, _p in SENSORES]
    mediciones, registro = [], []
    for i, (fecha, valor) in enumerate(MEDICIONES_SN01 + MEDICIONES_SN03, start=1):
        codigo = f"M-{i:02d}"
        mediciones.append({"codigo": codigo, "fecha": fecha, "valor": valor})
        registro.append({"src": "SN-01" if i <= len(MEDICIONES_SN01) else "SN-03",
                         "dst": codigo})
    incidentes = [{"codigo": c, "tipo": t, "fecha": f, "severidad": s}
                  for c, t, f, s, _lb, _p in INCIDENTES]

    for stmt in (
        "CREATE CONSTRAINT canal_codigo IF NOT EXISTS FOR (c:Canal) REQUIRE c.codigo IS UNIQUE",
        "CREATE CONSTRAINT compuerta_codigo IF NOT EXISTS FOR (c:Compuerta) REQUIRE c.codigo IS UNIQUE",
        "CREATE CONSTRAINT ramal_codigo IF NOT EXISTS FOR (r:Ramal) REQUIRE r.codigo IS UNIQUE",
        "CREATE CONSTRAINT toma_codigo IF NOT EXISTS FOR (t:Toma) REQUIRE t.codigo IS UNIQUE",
        "CREATE CONSTRAINT parcela_codigo IF NOT EXISTS FOR (p:Parcela) REQUIRE p.codigo IS UNIQUE",
        "CREATE CONSTRAINT concesion_codigo IF NOT EXISTS FOR (c:Concesion) REQUIRE c.codigo IS UNIQUE",
    ):
        db.cypher(stmt)

    load_nodes(db, "Fuente", FUENTES)
    load_nodes(db, "Canal", canales)
    load_nodes(db, "Compuerta", compuertas)
    load_nodes(db, "Ramal", ramales)
    load_nodes(db, "Toma", tomas)
    load_nodes(db, "Parcela", parcelas)
    load_nodes(db, "Usuario", usuarios)
    load_nodes(db, "Concesion", concesiones)
    load_nodes(db, "Sensor", sensores)
    load_nodes(db, "Medicion", mediciones)
    load_nodes(db, "IncidenteCalidad", incidentes)

    # flujo homogéneo ALIMENTA de la fuente a la parcela
    load_edges(db, "Fuente", "nombre", "ALIMENTA", "Canal", "codigo",
               [{"src": f, "dst": c} for c, _n, _cap, f in CANALES])
    load_edges(db, "Canal", "codigo", "ALIMENTA", "Compuerta", "codigo",
               [{"src": cn, "dst": cg} for cg, _e, cn in COMPUERTAS])
    load_edges(db, "Compuerta", "codigo", "ALIMENTA", "Ramal", "codigo",
               [{"src": p, "dst": c} for c, _cap, _n, pl, p in RAMALES if pl == "Compuerta"])
    load_edges(db, "Ramal", "codigo", "ALIMENTA", "Ramal", "codigo",
               [{"src": p, "dst": c} for c, _cap, _n, pl, p in RAMALES if pl == "Ramal"])
    load_edges(db, "Ramal", "codigo", "ALIMENTA", "Toma", "codigo", alimenta_rt)
    load_edges(db, "Toma", "codigo", "ALIMENTA", "Parcela", "codigo", alimenta_tp)

    load_edges(db, "Usuario", "nombre", "TITULAR_DE", "Concesion", "codigo", titular)
    load_edges(db, "Concesion", "codigo", "AUTORIZA", "Toma", "codigo", autoriza)
    load_edges(db, "Usuario", "nombre", "OPERA", "Parcela", "codigo", opera)

    for label in ("Canal", "Ramal", "Compuerta"):
        load_edges(db, "Sensor", "codigo", "MIDE_EN", label, "codigo",
                   [{"src": s, "dst": p} for s, _t, _u, _ul, lb, p in SENSORES if lb == label])
    load_edges(db, "Sensor", "codigo", "REGISTRO", "Medicion", "codigo", registro)
    for label in ("Ramal", "Canal"):
        load_edges(db, "IncidenteCalidad", "codigo", "DETECTADO_EN", label, "codigo",
                   [{"src": c, "dst": p} for c, _t, _f, _s, lb, p in INCIDENTES if lb == label])


QUERIES = [
    {
        "id": "balance-hidrico",
        "titulo": "Balance hídrico por canal",
        "descripcion": (
            "Capacidad de cada canal contra la demanda que suman sus tomas "
            "aguas abajo (alcance var-length sobre ALIMENTA). El Canal "
            "Derivación Sur queda sobre-suscrito: se prometió más agua de "
            "la que cabe."
        ),
        "cypher": """\
MATCH (c:Canal)-[:ALIMENTA*1..5]->(t:Toma)
WITH c, sum(t.caudal_asignado_lps) AS demanda_lps
RETURN c.codigo AS canal, c.nombre AS nombre,
       c.capacidad_lps AS capacidad_lps, demanda_lps,
       round(demanda_lps * 10000.0 / c.capacidad_lps) / 100 AS utilizacion_pct
ORDER BY utilizacion_pct DESC""",
    },
    {
        "id": "fuente-estres",
        "titulo": "Estrés hídrico por fuente",
        "descripcion": (
            "Caudal disponible de cada fuente en sequía contra todo lo "
            "asignado aguas abajo. El embalse al 38 % de nivel ya opera al "
            "límite de lo comprometido."
        ),
        "cypher": """\
MATCH (f:Fuente)-[:ALIMENTA*1..6]->(t:Toma)
WITH f, sum(t.caudal_asignado_lps) AS demanda_lps
RETURN f.nombre AS fuente, f.tipo AS tipo, f.nivel_pct AS nivel_pct,
       f.caudal_lps AS caudal_disponible_lps, demanda_lps,
       round(demanda_lps * 10000.0 / f.caudal_lps) / 100 AS utilizacion_pct
ORDER BY utilizacion_pct DESC""",
    },
    {
        "id": "impacto-falla",
        "titulo": "Impacto de la compuerta en falla",
        "descripcion": (
            "Todas las parcelas alcanzables aguas abajo de la compuerta en "
            "falla (CG-03) por ALIMENTA*1..6: cultivo, hectáreas, usuario y "
            "prioridad de su concesión — incluida una toma de uso humano."
        ),
        "cypher": """\
MATCH (cg:Compuerta {estado: 'falla'})-[:ALIMENTA*1..6]->(p:Parcela)
MATCH (t:Toma)-[:ALIMENTA]->(p)
MATCH (co:Concesion)-[:AUTORIZA]->(t)
MATCH (u:Usuario)-[:OPERA]->(p)
RETURN cg.codigo AS compuerta, p.codigo AS parcela, p.cultivo AS cultivo,
       p.hectareas AS hectareas, u.nombre AS usuario, co.prioridad AS prioridad
ORDER BY prioridad DESC, parcela""",
    },
    {
        "id": "sobre-extraccion",
        "titulo": "Tomas en sobre-extracción",
        "descripcion": (
            "Tomas cuyo caudal asignado supera el máximo autorizado por su "
            "concesión. TM-14 extrae 45 l/s con derecho a 30: esos 15 l/s "
            "de exceso aguas arriba dejan seca la cola del sistema."
        ),
        "cypher": """\
MATCH (co:Concesion)-[:AUTORIZA]->(t:Toma)
WHERE t.caudal_asignado_lps > co.caudal_max_lps
MATCH (u:Usuario)-[:TITULAR_DE]->(co)
MATCH (t)-[:ALIMENTA]->(p:Parcela)
RETURN u.nombre AS usuario, t.codigo AS toma, p.codigo AS parcela,
       t.caudal_asignado_lps AS asignado_lps, co.caudal_max_lps AS autorizado_lps,
       t.caudal_asignado_lps - co.caudal_max_lps AS exceso_lps,
       co.prioridad AS prioridad
ORDER BY exceso_lps DESC""",
    },
    {
        "id": "infraestructura-critica",
        "titulo": "Infraestructura crítica (betweenness)",
        "descripcion": (
            "Centralidad de intermediación sobre la red ALIMENTA: los nodos "
            "por los que pasa el agua de más parcelas. CG-01 encabeza la "
            "lista — su falla sería peor que la de CG-03."
        ),
        "cypher": """\
CALL algo.betweenness({labels: ['Fuente', 'Canal', 'Compuerta', 'Ramal', 'Toma', 'Parcela'], edge_types: ['ALIMENTA']})
YIELD node_id, score
WITH node_id AS n, score
WHERE score > 0
MATCH (x) WHERE id(x) = id(n)
RETURN coalesce(x.codigo, x.nombre) AS punto, labels(x)[0] AS tipo,
       round(score * 100) / 100 AS criticidad
ORDER BY criticidad DESC
LIMIT 10""",
    },
    {
        "id": "traza-contaminacion",
        "titulo": "Traza de contaminación aguas abajo",
        "descripcion": (
            "Desde cada incidente de calidad, las parcelas alcanzables aguas "
            "abajo y el usuario a notificar. La salinidad de IC-01 en RM-02 "
            "compromete dos parcelas de cabecera."
        ),
        "cypher": """\
MATCH (ic:IncidenteCalidad)-[:DETECTADO_EN]->(seg)
MATCH (seg)-[:ALIMENTA*1..6]->(p:Parcela)
MATCH (u:Usuario)-[:OPERA]->(p)
RETURN ic.codigo AS incidente, ic.tipo AS tipo, ic.severidad AS severidad,
       coalesce(seg.codigo, seg.nombre) AS detectado_en, p.codigo AS parcela,
       p.cultivo AS cultivo, u.nombre AS notificar_a
ORDER BY incidente, parcela""",
    },
    {
        "id": "cola-de-canal",
        "titulo": "La cola de canal, sub-atendida",
        "descripcion": (
            "Parcelas ordenadas por su distancia a la fuente (nivel) con el "
            "caudal asignado contra la necesidad de riego (~5 l/s por "
            "hectárea). Las más lejanas — PA-19 y PA-20 — reciben una "
            "fracción de lo que necesitan: la inequidad por gravedad."
        ),
        "cypher": """\
MATCH (t:Toma)-[:ALIMENTA]->(p:Parcela)
MATCH (u:Usuario)-[:OPERA]->(p)
WITH p, t, u, p.hectareas * 5 AS necesidad_lps
RETURN p.codigo AS parcela, p.zona AS zona, p.nivel AS nivel,
       p.cultivo AS cultivo, p.hectareas AS hectareas,
       t.caudal_asignado_lps AS asignado_lps, necesidad_lps,
       CASE WHEN t.caudal_asignado_lps < necesidad_lps
            THEN 'sub-atendida' ELSE 'cubierta' END AS estado
ORDER BY nivel DESC, parcela""",
    },
    {
        "id": "prioridad-asignacion",
        "titulo": "Orden de asignación en sequía",
        "descripcion": (
            "Parcelas y caudal agrupados por prioridad de la concesión: el "
            "orden legal de corte cuando no alcanza para todos (humano "
            "primero, industrial al final)."
        ),
        "cypher": """\
MATCH (co:Concesion)-[:AUTORIZA]->(t:Toma)
MATCH (t)-[:ALIMENTA]->(p:Parcela)
WITH co.prioridad AS prioridad, count(DISTINCT p) AS parcelas,
     sum(p.hectareas) AS hectareas, sum(t.caudal_asignado_lps) AS caudal_lps
RETURN prioridad, parcelas, hectareas, caudal_lps,
       CASE WHEN prioridad = 'humano' THEN 1
            WHEN prioridad = 'agricola' THEN 2
            ELSE 3 END AS orden_de_corte
ORDER BY orden_de_corte""",
    },
    {
        "id": "serie-sensor",
        "titulo": "Caudal del canal principal, en caída",
        "descripcion": (
            "Serie del sensor SN-01 en el Canal Principal Norte: diez días "
            "de lecturas en descenso que cruzan el umbral de alerta de "
            "200 l/s — la sequía medida día a día."
        ),
        "cypher": """\
MATCH (s:Sensor {codigo: 'SN-01'})-[:REGISTRO]->(m:Medicion)
RETURN m.fecha AS fecha, m.valor AS caudal_lps, s.umbral AS umbral
ORDER BY fecha""",
    },
    {
        "id": "compuertas-estado",
        "titulo": "Compuertas y su radio de influencia",
        "descripcion": (
            "Cada compuerta con el número de parcelas que dependen de ella "
            "aguas abajo: el tablero de operación de la red. La que está en "
            "falla corta el agua a cinco parcelas."
        ),
        "cypher": """\
MATCH (cg:Compuerta)-[:ALIMENTA*1..6]->(p:Parcela)
WITH cg, count(DISTINCT p) AS parcelas_aguas_abajo
RETURN cg.codigo AS compuerta, cg.estado AS estado, parcelas_aguas_abajo
ORDER BY parcelas_aguas_abajo DESC""",
    },
]
