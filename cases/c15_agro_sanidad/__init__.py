"""Caso 15 — Agro y biovigilancia: contener el brote fitosanitario del banano."""
from itertools import combinations

from cases.common import Rng, load_edges, load_nodes

META = {
    "numero": 15,
    "slug": "agro-sanidad",
    "industria": "Agro y sanidad vegetal — Biovigilancia fitosanitaria del banano",
    "titulo": "Contén el brote antes de que cruce la finca.",
    "problema": (
        "El hongo de suelo Fusarium oxysporum f. sp. cubense Raza 4 Tropical "
        "(Foc R4T, el «mal de Panamá TR4») no tiene cura y se propaga por "
        "recursos compartidos: tierra en maquinaria y botas de cuadrillas, "
        "plántulas de vivero, agua de riego y cercanía entre fincas. Cerrar "
        "toda la zona arruina a los productores sanos; la bioseguridad real "
        "es poner en cuarentena el NODO PUENTE correcto — la cuadrilla, el "
        "vivero o el agua que conecta el foco con las fincas todavía limpias."
    ),
    "conecta": [
        "Finca", "Cuadrilla", "Maquinaria", "Vivero", "Fuente de agua",
        "Detección de laboratorio", "Patógeno", "Vecindad geográfica",
        "Red de contactos de transmisión",
    ],
    "revela": [
        "El súper-propagador que hay que aislar primero (mayor betweenness)",
        "Los focos y las comunidades de contagio (louvain)",
        "Las zonas de contención independientes (componentes / wcc)",
        "El grado alto que NO es riesgo: puente vs. mero volumen",
        "La cadena de contagio desde el foco a las fincas aún limpias",
    ],
    "indicadores": [
        "Fincas en foco / sospecha / vigilancia",
        "Súper-propagador identificado", "Comunidades de contagio",
        "Zonas de contención", "Fincas limpias protegidas de la cuarentena",
    ],
    "referencia": (
        "El ICA de Colombia declaró cuarentena por Foc R4T en 2019 y el SENASA "
        "de Perú lo detectó en 2021; Ecuador es el mayor exportador de banano "
        "del mundo, por lo que la contención selectiva del TR4 es política de "
        "Estado en la región."
    ),
}

LEYENDA = {
    "Finca": "Unidad productiva de banano, con estado sanitario",
    "Cuadrilla": "Grupo de trabajadores que rota entre fincas (vector móvil)",
    "Maquina": "Tractor, implemento o fumigadora que arrastra tierra",
    "Vivero": "Proveedor de plántulas (certificado o no)",
    "FuenteAgua": "Estero, canal o pozo que riega varias fincas",
    "Deteccion": "Análisis de laboratorio o inspección visual",
    "Patogeno": "Agente causal (Foc R4T, Sigatoka negra, Moko)",
}

# ── Fincas: (nombre, zona, hectareas, estado) ──────────────────────────
# Comunidad-foco (El Oro): El Guabo es el foco confirmado; su cluster se
# conecta a la comunidad de Guayas SOLO a través de la cuadrilla CU-07.
FINCAS = [
    # El Oro — cluster del foco
    ("Hacienda El Guabo", "El Oro", 240, "foco"),
    ("El Recreo", "El Oro", 95, "vigilancia"),
    ("Santa Rita", "El Oro", 110, "vigilancia"),
    ("La Pradera", "El Oro", 78, "vigilancia"),
    ("El Porvenir", "El Oro", 132, "sano"),
    # Guayas — cluster alcanzado por CU-07 (4 fincas antes sanas)
    ("San Vicente", "Guayas", 160, "sospecha"),
    ("La Julia", "Guayas", 145, "sospecha"),
    ("Los Álamos", "Guayas", 120, "sospecha"),
    ("Buenos Aires", "Guayas", 98, "sospecha"),
    ("San Isidro", "Guayas", 175, "sano"),
    ("La Fortuna", "Guayas", 210, "sano"),
    ("El Cisne", "Guayas", 88, "sano"),
    # Los Ríos — comunidad del distractor (Vivero San Carlos), sin nexo al foco
    ("Palma Real", "Los Ríos", 190, "sano"),
    ("Nueva Esperanza", "Los Ríos", 140, "sano"),
    ("El Deseo", "Los Ríos", 115, "sano"),
    ("La Clementina", "Los Ríos", 320, "sano"),
    ("Santa Marta", "Los Ríos", 130, "sano"),
    # Esmeraldas — finca aislada (zona de contención propia)
    ("Isla Verde", "Esmeraldas", 64, "sano"),
]

# ── Cuadrillas: (codigo, tipo, bioseguridad) ───────────────────────────
CUADRILLAS = [
    ("CU-01", "cosecha", "estricta"),
    ("CU-02", "cosecha", "parcial"),
    ("CU-03", "mantenimiento", "estricta"),
    ("CU-04", "fumigacion", "parcial"),
    ("CU-05", "cosecha", "estricta"),
    ("CU-06", "mantenimiento", "parcial"),
    ("CU-07", "fumigacion", "nula"),      # ← súper-propagador
    ("CU-08", "cosecha", "estricta"),
]

# Cuadrilla → fincas donde trabajó. CU-07 es el ÚNICO nexo El Oro↔Guayas.
TRABAJO_EN = {
    "CU-01": ["San Vicente", "La Julia", "San Isidro"],
    "CU-02": ["Los Álamos", "La Fortuna"],
    "CU-03": ["Hacienda El Guabo", "El Recreo"],
    "CU-04": ["La Pradera", "El Porvenir"],
    "CU-05": ["El Cisne", "San Isidro"],
    "CU-06": ["Palma Real", "Nueva Esperanza", "Santa Marta"],
    "CU-07": ["Hacienda El Guabo", "San Vicente", "La Julia",
              "Los Álamos", "Buenos Aires"],
    "CU-08": ["La Clementina", "El Deseo"],
}

# ── Maquinaria: (codigo, tipo) ─────────────────────────────────────────
MAQUINAS = [
    ("MQ-01", "tractor"),
    ("MQ-02", "implemento"),
    ("MQ-03", "fumigadora"),
    ("MQ-04", "tractor"),
    ("MQ-05", "implemento"),
]
OPERO_EN = {
    "MQ-01": ["El Recreo", "Santa Rita", "La Pradera"],
    "MQ-02": ["San Vicente", "La Julia", "San Isidro"],
    "MQ-03": ["Los Álamos", "El Cisne"],
    "MQ-04": ["La Fortuna", "San Isidro"],
    "MQ-05": ["Palma Real", "El Deseo", "La Clementina"],
}

# ── Viveros: (nombre, certificado) ─────────────────────────────────────
VIVEROS = [
    ("Vivero San Carlos", True),      # ← distractor: grado alto, betweenness baja
    ("Vivero El Semillero", True),
    ("Vivero La Palma", False),
]
ABASTECIO = {
    "Vivero San Carlos": ["Palma Real", "Nueva Esperanza", "El Deseo",
                          "La Clementina", "Santa Marta"],
    "Vivero El Semillero": ["San Isidro", "La Fortuna"],
    "Vivero La Palma": ["La Pradera", "El Porvenir"],
}

# ── Fuentes de agua: (nombre, tipo) ────────────────────────────────────
FUENTES = [
    ("Estero Pagua", "estero"),       # ← puente secundario (riega el foco + aguas abajo)
    ("Canal El Oro", "canal"),
    ("Pozo Guayas", "pozo"),
    ("Estero Vinces", "estero"),
    ("Pozo Insular", "pozo"),
]
RIEGA = {
    "Estero Pagua": ["Hacienda El Guabo", "El Recreo", "Santa Rita"],
    "Canal El Oro": ["La Pradera", "El Porvenir"],
    "Pozo Guayas": ["San Isidro", "La Fortuna", "El Cisne"],
    "Estero Vinces": ["Palma Real", "Nueva Esperanza"],
    "Pozo Insular": ["Isla Verde"],
}

# ── Vecindad: (finca_a, finca_b, km) — no cruza El Oro↔Guayas ───────────
VECINAS = [
    ("Hacienda El Guabo", "El Recreo", 2.1),
    ("El Recreo", "Santa Rita", 1.8),
    ("Hacienda El Guabo", "La Pradera", 4.2),
    ("La Pradera", "El Porvenir", 3.0),
    ("San Vicente", "La Julia", 1.5),
    ("La Julia", "Los Álamos", 2.3),
    ("San Vicente", "San Isidro", 2.7),
    ("La Fortuna", "El Cisne", 2.0),
    ("Palma Real", "Nueva Esperanza", 1.2),
    ("Nueva Esperanza", "El Deseo", 2.5),
    ("La Clementina", "Santa Marta", 1.7),
]

# ── Patógenos: (nombre, peligro) ───────────────────────────────────────
PATOGENOS = [
    ("Foc R4T", "cuarentenario"),
    ("Moko", "alto"),
    ("Sigatoka negra", "medio"),
]

# ── Detecciones: (codigo, patogeno, fecha, resultado, metodo, finca) ───
DETECCIONES = [
    ("DET-01", "Foc R4T", "2026-05-12", "positivo", "PCR", "Hacienda El Guabo"),
    ("DET-02", "Foc R4T", "2026-05-18", "positivo", "visual", "San Vicente"),
    ("DET-03", "Foc R4T", "2026-05-19", "positivo", "visual", "La Julia"),
    ("DET-04", "Foc R4T", "2026-05-21", "positivo", "visual", "Los Álamos"),
    ("DET-05", "Foc R4T", "2026-05-22", "positivo", "visual", "Buenos Aires"),
    ("DET-06", "Sigatoka negra", "2026-04-10", "positivo", "visual", "La Fortuna"),
    ("DET-07", "Moko", "2026-03-15", "positivo", "PCR", "Palma Real"),
    ("DET-08", "Sigatoka negra", "2026-04-12", "positivo", "visual", "Nueva Esperanza"),
    ("DET-09", "Foc R4T", "2026-05-10", "negativo", "PCR", "San Isidro"),
    ("DET-10", "Foc R4T", "2026-05-11", "negativo", "PCR", "El Cisne"),
    ("DET-11", "Moko", "2026-02-20", "negativo", "visual", "Isla Verde"),
    ("DET-12", "Sigatoka negra", "2026-03-01", "positivo", "visual", "El Deseo"),
]


def _contactos():
    """Proyección homogénea Finca-[:CONTACTO]->Finca (ambas direcciones).

    Se materializa a partir de cada recurso compartido y de la vecindad, de
    forma 100 % determinista. Es el grafo sobre el que corren louvain / wcc.
    """
    filas = []

    def par(a, b, via, recurso):
        filas.append({"src": a, "dst": b, "via": via, "recurso": recurso})
        filas.append({"src": b, "dst": a, "via": via, "recurso": recurso})

    grupos = []
    grupos += [("cuadrilla", cu, sorted(fs)) for cu, fs in TRABAJO_EN.items()]
    grupos += [("maquina", mq, sorted(fs)) for mq, fs in OPERO_EN.items()]
    grupos += [("vivero", vv, sorted(fs)) for vv, fs in ABASTECIO.items()]
    grupos += [("agua", fu, sorted(fs)) for fu, fs in RIEGA.items()]
    for via, recurso, fincas in grupos:
        for a, b in combinations(fincas, 2):
            par(a, b, via, recurso)
    for a, b, _km in VECINAS:
        par(a, b, "vecindad", b if a < b else a)
    return filas


def seed(db):
    rng = Rng(1501)

    fincas = [
        {"nombre": n, "zona": z, "hectareas": h, "cultivo": "banano", "estado": e}
        for n, z, h, e in FINCAS
    ]
    cuadrillas = [{"codigo": c, "tipo": t, "bioseguridad": b} for c, t, b in CUADRILLAS]
    maquinas = [{"codigo": c, "tipo": t} for c, t in MAQUINAS]
    viveros = [{"nombre": n, "certificado": c} for n, c in VIVEROS]
    fuentes = [{"nombre": n, "tipo": t} for n, t in FUENTES]
    patogenos = [{"nombre": n, "peligro": p} for n, p in PATOGENOS]
    detecciones = [
        {"codigo": c, "patogeno": pg, "fecha": f, "resultado": r, "metodo": m}
        for c, pg, f, r, m, _fi in DETECCIONES
    ]

    # ── Aristas de recurso (contactos de transmisión) ──────────────────
    trabajo = [{"src": cu, "dst": f, "fecha": rng.fecha(2026, 4, 5)}
               for cu, fs in TRABAJO_EN.items() for f in fs]
    opero = [{"src": mq, "dst": f, "fecha": rng.fecha(2026, 4, 5)}
             for mq, fs in OPERO_EN.items() for f in fs]
    abastecio = [{"src": vv, "dst": f, "fecha": rng.fecha(2026, 1, 3)}
                 for vv, fs in ABASTECIO.items() for f in fs]
    riega = [{"src": fu, "dst": f} for fu, fs in RIEGA.items() for f in fs]
    vecinas = ([{"src": a, "dst": b, "km": km} for a, b, km in VECINAS]
               + [{"src": b, "dst": a, "km": km} for a, b, km in VECINAS])
    en_finca = [{"src": c, "dst": fi} for c, _pg, _f, _r, _m, fi in DETECCIONES]
    de_patogeno = [{"src": c, "dst": pg} for c, pg, _f, _r, _m, _fi in DETECCIONES]
    contacto = _contactos()

    # Proyección BIDIRECCIONAL recurso↔finca para centralidad. El contacto
    # de transmisión (tierra en botas, maquinaria, plántulas, agua) fluye en
    # ambos sentidos, así que betweenness debe poder atravesar el recurso —
    # de lo contrario un nodo con sólo aristas salientes tendría centralidad 0.
    def _ida_vuelta(mapa):
        fwd = [{"src": r, "dst": f} for r, fs in mapa.items() for f in fs]
        rev = [{"src": f, "dst": r} for r, fs in mapa.items() for f in fs]
        return fwd, rev

    cu_fwd, cu_rev = _ida_vuelta(TRABAJO_EN)
    mq_fwd, mq_rev = _ida_vuelta(OPERO_EN)
    vv_fwd, vv_rev = _ida_vuelta(ABASTECIO)
    fu_fwd, fu_rev = _ida_vuelta(RIEGA)

    db.cypher("CREATE CONSTRAINT finca_nombre IF NOT EXISTS FOR (f:Finca) REQUIRE f.nombre IS UNIQUE")
    db.cypher("CREATE CONSTRAINT cuadrilla_codigo IF NOT EXISTS FOR (c:Cuadrilla) REQUIRE c.codigo IS UNIQUE")
    db.cypher("CREATE CONSTRAINT maquina_codigo IF NOT EXISTS FOR (m:Maquina) REQUIRE m.codigo IS UNIQUE")
    db.cypher("CREATE CONSTRAINT vivero_nombre IF NOT EXISTS FOR (v:Vivero) REQUIRE v.nombre IS UNIQUE")
    db.cypher("CREATE CONSTRAINT fuente_nombre IF NOT EXISTS FOR (a:FuenteAgua) REQUIRE a.nombre IS UNIQUE")
    db.cypher("CREATE CONSTRAINT deteccion_codigo IF NOT EXISTS FOR (d:Deteccion) REQUIRE d.codigo IS UNIQUE")
    db.cypher("CREATE CONSTRAINT patogeno_nombre IF NOT EXISTS FOR (p:Patogeno) REQUIRE p.nombre IS UNIQUE")

    load_nodes(db, "Finca", fincas)
    load_nodes(db, "Cuadrilla", cuadrillas)
    load_nodes(db, "Maquina", maquinas)
    load_nodes(db, "Vivero", viveros)
    load_nodes(db, "FuenteAgua", fuentes)
    load_nodes(db, "Patogeno", patogenos)
    load_nodes(db, "Deteccion", detecciones)

    load_edges(db, "Cuadrilla", "codigo", "TRABAJO_EN", "Finca", "nombre", trabajo, rel_props=["fecha"])
    load_edges(db, "Maquina", "codigo", "OPERO_EN", "Finca", "nombre", opero, rel_props=["fecha"])
    load_edges(db, "Vivero", "nombre", "ABASTECIO", "Finca", "nombre", abastecio, rel_props=["fecha"])
    load_edges(db, "FuenteAgua", "nombre", "RIEGA", "Finca", "nombre", riega)
    load_edges(db, "Finca", "nombre", "VECINA_DE", "Finca", "nombre", vecinas, rel_props=["km"])
    load_edges(db, "Deteccion", "codigo", "EN_FINCA", "Finca", "nombre", en_finca)
    load_edges(db, "Deteccion", "codigo", "DE_PATOGENO", "Patogeno", "nombre", de_patogeno)
    load_edges(db, "Finca", "nombre", "CONTACTO", "Finca", "nombre", contacto, rel_props=["via", "recurso"])

    for lbl, key, fwd, rev in [
        ("Cuadrilla", "codigo", cu_fwd, cu_rev),
        ("Maquina", "codigo", mq_fwd, mq_rev),
        ("Vivero", "nombre", vv_fwd, vv_rev),
        ("FuenteAgua", "nombre", fu_fwd, fu_rev),
    ]:
        load_edges(db, lbl, key, "CONECTA", "Finca", "nombre", fwd)
        load_edges(db, "Finca", "nombre", "CONECTA", lbl, key, rev)


QUERIES = [
    {
        "id": "panorama-sanitario",
        "titulo": "Panorama sanitario de las fincas",
        "descripcion": (
            "Cuántas fincas y hectáreas hay en cada estado. El tablero de "
            "mando: dónde está el fuego y cuánta superficie está en juego."
        ),
        "cypher": """\
MATCH (f:Finca)
RETURN f.estado AS estado, count(*) AS fincas, sum(f.hectareas) AS hectareas
ORDER BY fincas DESC""",
    },
    {
        "id": "focos-confirmados",
        "titulo": "Focos y detecciones confirmadas",
        "descripcion": (
            "Cada análisis positivo con su finca, patógeno, peligro, método y "
            "fecha. El Foc R4T (cuarentenario) en Hacienda El Guabo encabeza."
        ),
        "cypher": """\
MATCH (d:Deteccion {resultado: 'positivo'})-[:EN_FINCA]->(f:Finca)
MATCH (d)-[:DE_PATOGENO]->(p:Patogeno)
RETURN d.codigo AS deteccion, f.nombre AS finca, f.zona AS zona,
       f.estado AS estado, p.nombre AS patogeno, p.peligro AS peligro,
       d.metodo AS metodo, d.fecha AS fecha
ORDER BY p.peligro, d.fecha""",
    },
    {
        "id": "superpropagadores",
        "titulo": "Súper-propagadores: la cola de cuarentena",
        "descripcion": (
            "Betweenness sobre la red de contacto (fincas + recursos): el nodo "
            "PUENTE por el que pasan más rutas de contagio. La cuadrilla CU-07 "
            "encabeza — es el objetivo #1 de cuarentena, no la zona entera."
        ),
        "cypher": """\
CALL algo.betweenness({labels: ['Finca', 'Cuadrilla', 'Maquina', 'Vivero', 'FuenteAgua'],
                       edge_types: ['CONECTA', 'VECINA_DE']})
YIELD node_id, score
WITH node_id AS nn, score
MATCH (x) WHERE id(x) = id(nn)
RETURN labels(x)[0] AS tipo_nodo,
       coalesce(x.codigo, x.nombre) AS recurso,
       coalesce(x.tipo, x.estado) AS detalle,
       round(score * 100) / 100 AS betweenness
ORDER BY betweenness DESC
LIMIT 10""",
    },
    {
        "id": "focos-comunidades",
        "titulo": "Comunidades de contagio (louvain)",
        "descripcion": (
            "Louvain sobre la red CONTACTO agrupa las fincas por cómo se "
            "conectan realmente. Revela la comunidad del foco separada del "
            "resto: dónde concentrar la vigilancia."
        ),
        "cypher": """\
CALL algo.louvain({labels: ['Finca'], edge_types: ['CONTACTO']})
YIELD node_id, community
WITH node_id AS nn, community
MATCH (f:Finca) WHERE id(f) = id(nn)
WITH community, count(*) AS fincas,
     sum(CASE WHEN f.estado = 'foco' THEN 1 ELSE 0 END) AS focos,
     sum(CASE WHEN f.estado = 'sospecha' THEN 1 ELSE 0 END) AS sospechas,
     collect(f.nombre) AS nombres
RETURN community, fincas, focos, sospechas, nombres[0..4] AS fincas_ejemplo
ORDER BY focos DESC, sospechas DESC, fincas DESC""",
    },
    {
        "id": "zonas-contencion",
        "titulo": "Zonas de contención (componentes)",
        "descripcion": (
            "WCC parte la red en componentes desconectados: cada uno es una "
            "zona de contención independiente. La zona del foco concentra las "
            "fincas afectadas; las demás quedan naturalmente aisladas."
        ),
        "cypher": """\
CALL algo.wcc({labels: ['Finca'], edge_types: ['CONTACTO']})
YIELD node_id, component
WITH node_id AS nn, component
MATCH (f:Finca) WHERE id(f) = id(nn)
WITH component, count(*) AS fincas,
     sum(CASE WHEN f.estado IN ['foco', 'sospecha'] THEN 1 ELSE 0 END) AS afectadas,
     collect(f.nombre) AS nombres
RETURN component, fincas, afectadas, nombres[0..5] AS fincas_ejemplo
ORDER BY afectadas DESC, fincas DESC""",
    },
    {
        "id": "cuadrillas-vector",
        "titulo": "Cuadrillas como vector de transmisión",
        "descripcion": (
            "Cuadrillas que tocaron una finca foco/sospecha y cuántas otras "
            "fincas (aún sanas o en vigilancia) visitaron: el riesgo de que "
            "muevan el hongo. CU-07 (bioseguridad nula) lidera."
        ),
        "cypher": """\
MATCH (cu:Cuadrilla)-[:TRABAJO_EN]->(fc:Finca)
WHERE fc.estado IN ['foco', 'sospecha']
WITH cu, count(DISTINCT fc) AS contaminadas
MATCH (cu)-[:TRABAJO_EN]->(fs:Finca)
WITH cu, contaminadas,
     count(DISTINCT CASE WHEN fs.estado IN ['sano', 'vigilancia'] THEN fs END) AS sanas
RETURN cu.codigo AS cuadrilla, cu.tipo AS tipo, cu.bioseguridad AS bioseguridad,
       contaminadas, sanas
ORDER BY contaminadas DESC, sanas DESC""",
    },
    {
        "id": "cadena-contagio",
        "titulo": "Cadena de contagio desde el foco",
        "descripcion": (
            "Desde Hacienda El Guabo, qué fincas alcanza la red de contacto en "
            "1 o 2 saltos y por qué vía. Las 4 fincas de sospecha aparecen a un "
            "solo salto por la cuadrilla CU-07."
        ),
        "cypher": """\
MATCH path = (foco:Finca {nombre: 'Hacienda El Guabo'})-[:CONTACTO*1..2]->(otra:Finca)
WHERE otra.nombre <> 'Hacienda El Guabo'
WITH otra, min(length(path)) AS saltos,
     collect(DISTINCT relationships(path)[0].via) AS vias
RETURN otra.nombre AS finca, otra.estado AS estado, saltos,
       vias AS vias_primer_salto
ORDER BY saltos, estado, finca""",
    },
    {
        "id": "perimetro-vecindad",
        "titulo": "Perímetro de vecindad del foco",
        "descripcion": (
            "Fincas físicamente vecinas del foco y su distancia en km: el "
            "anillo donde el hongo puede saltar por escorrentía o maquinaria."
        ),
        "cypher": """\
MATCH (foco:Finca {estado: 'foco'})-[v:VECINA_DE]->(vec:Finca)
RETURN foco.nombre AS foco, vec.nombre AS vecina,
       vec.estado AS estado_vecina, v.km AS km
ORDER BY v.km""",
    },
    {
        "id": "recurso-critico",
        "titulo": "Recursos que tocan el foco",
        "descripcion": (
            "Cada recurso (cuadrilla, máquina, agua) que estuvo en el foco y a "
            "cuántas fincas más llega: mide su alcance de propagación. CU-07 "
            "alcanza más fincas que ningún otro."
        ),
        "cypher": """\
MATCH (foco:Finca {estado: 'foco'})<-[e]-(r)
WHERE type(e) IN ['TRABAJO_EN', 'OPERO_EN', 'ABASTECIO', 'RIEGA']
MATCH (r)-[e2]->(otra:Finca)
WHERE type(e2) IN ['TRABAJO_EN', 'OPERO_EN', 'ABASTECIO', 'RIEGA']
RETURN labels(r)[0] AS tipo_recurso,
       coalesce(r.codigo, r.nombre) AS recurso,
       type(e) AS via,
       count(DISTINCT otra) AS fincas_alcanzadas
ORDER BY fincas_alcanzadas DESC, recurso""",
    },
]
