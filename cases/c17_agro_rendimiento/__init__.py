"""Caso 17 — Agro: cerrar la brecha de rendimiento con la parcela gemela."""
import math

from cases.common import Rng, embed, load_edges, load_nodes

META = {
    "numero": 17,
    "slug": "agro-rendimiento",
    "industria": "Agro — Brecha de rendimiento y transferencia de prácticas",
    "titulo": "La parcela gemela ya resolvió tu problema.",
    "problema": (
        "La mayoría de las parcelas rinde muy por debajo de su potencial "
        "agronómico, y la asistencia técnica receta lo mismo para todos. "
        "La evidencia de qué funciona ya existe — en parcelas de "
        "condiciones casi idénticas que sí cerraron la brecha — pero "
        "nadie puede encontrarlas entre miles de fichas y registros."
    ),
    "conecta": [
        "Parcelas con perfil agronómico vectorizado", "Variedades",
        "Prácticas de manejo", "Técnicos de campo", "Cooperativas",
        "Fichas técnicas (base de conocimiento)",
    ],
    "revela": [
        "Toneladas recuperables por parcela, cooperativa y técnico",
        "La parcela gemela de condiciones idénticas que ya rinde alto",
        "La variedad y las prácticas exactas que explican la diferencia",
        "El impacto medible de cada práctica sobre el rendimiento",
        "La ficha técnica correcta recuperada por texto (BM25)",
    ],
    "indicadores": [
        "Brecha de rendimiento (t/ha)", "Toneladas recuperables",
        "Parcelas bajo el 60 % de su potencial",
        "Uplift esperado por transferencia de práctica",
        "Tiempo para encontrar la recomendación correcta",
    ],
    "referencia": (
        "El Global Yield Gap Atlas (yieldgap.org) y la FAO cuantifican la "
        "brecha entre rendimiento actual y potencial; plataformas como "
        "Cropin, aWhere y Plantix recomiendan variedad y manejo por "
        "similitud de condiciones agroclimáticas."
    ),
}

LEYENDA = {
    "Parcela": "Unidad productiva con perfil agronómico vectorizado",
    "Variedad": "Material genético sembrado (con rendimiento de referencia)",
    "Practica": "Práctica de manejo (poda, riego, fertilización…)",
    "Tecnico": "Extensionista que atiende parcelas",
    "Cooperativa": "Organización de productores por zona",
    "Ficha": "Ficha técnica agronómica (búsqueda BM25 / híbrida)",
}

# ── Vocabulario controlado del perfil (las gemelas agrupan por coseno) ──

# (cultivo, suelo, clima, altitud, zona, manejos de las parcelas de fondo)
_GRUPOS = [
    ("cacao", "franco-arcilloso", "humedo-tropical", "baja", "Los Ríos",
     ["convencional", "tecnificado", "organico", "convencional"]),
    ("cacao", "franco", "humedo-tropical", "baja", "Guayas",
     ["convencional", "tecnificado", "organico", "convencional", "tecnificado"]),
    ("cacao", "arcilloso", "humedo-tropical", "media", "Manabí",
     ["convencional", "organico", "tecnificado", "convencional"]),
    ("cafe", "franco-limoso", "templado", "alta", "Loja",
     ["convencional", "tecnificado", "organico", "convencional", "tecnificado"]),
    ("cafe", "franco", "subtropical", "media", "Pichincha",
     ["tecnificado", "convencional", "organico", "convencional"]),
    ("cafe", "franco-arcilloso", "subtropical", "alta", "Zamora",
     ["organico", "convencional", "tecnificado", "convencional"]),
    ("banano", "franco", "humedo-tropical", "baja", "El Oro",
     ["tecnificado", "convencional", "tecnificado", "organico", "convencional", "tecnificado"]),
    ("banano", "arenoso", "seco-tropical", "baja", "Guayas",
     ["convencional", "tecnificado", "convencional", "organico"]),
    ("maiz", "franco-limoso", "seco-tropical", "baja", "Manabí",
     ["convencional", "tecnificado", "convencional", "organico", "tecnificado", "convencional"]),
    ("maiz", "arcilloso", "seco-tropical", "media", "Los Ríos",
     ["tecnificado", "convencional", "organico", "convencional"]),
]

_POTENCIAL = {"cacao": (1.0, 1.3), "cafe": (0.9, 1.4), "banano": (42.0, 55.0), "maiz": (6.5, 9.0)}
_FACTOR = {"convencional": (0.42, 0.60), "organico": (0.62, 0.78), "tecnificado": (0.82, 0.95)}
_HECTAREAS = {"cacao": (4, 18), "cafe": (3, 12), "banano": (15, 60), "maiz": (8, 35)}

_VARIEDADES = [
    {"nombre": "CCN-51", "cultivo": "cacao", "rend_ref": 1.4, "resistencia": "monilia"},
    {"nombre": "Nacional-criollo", "cultivo": "cacao", "rend_ref": 0.9, "resistencia": "baja"},
    {"nombre": "EET-103", "cultivo": "cacao", "rend_ref": 1.2, "resistencia": "escoba de bruja"},
    {"nombre": "Typica", "cultivo": "cafe", "rend_ref": 0.8, "resistencia": "baja"},
    {"nombre": "Caturra", "cultivo": "cafe", "rend_ref": 1.1, "resistencia": "media"},
    {"nombre": "Sarchimor", "cultivo": "cafe", "rend_ref": 1.3, "resistencia": "roya"},
    {"nombre": "Cavendish-Williams", "cultivo": "banano", "rend_ref": 52.0, "resistencia": "media"},
    {"nombre": "Gran-Enano", "cultivo": "banano", "rend_ref": 46.0, "resistencia": "sigatoka parcial"},
    {"nombre": "INIAP-528", "cultivo": "maiz", "rend_ref": 8.8, "resistencia": "alta"},
    {"nombre": "Trueno-NB", "cultivo": "maiz", "rend_ref": 7.6, "resistencia": "media"},
]

_PRACTICAS = [
    {"codigo": "PR-01", "nombre": "poda-sanitaria", "categoria": "poda", "impacto_tha": 0.25},
    {"codigo": "PR-02", "nombre": "fertilizacion-balanceada", "categoria": "fertilizacion", "impacto_tha": 0.30},
    {"codigo": "PR-03", "nombre": "riego-goteo", "categoria": "riego", "impacto_tha": 0.40},
    {"codigo": "PR-04", "nombre": "control-monilia", "categoria": "sanidad", "impacto_tha": 0.22},
    {"codigo": "PR-05", "nombre": "analisis-suelo", "categoria": "suelo", "impacto_tha": 0.15},
    {"codigo": "PR-06", "nombre": "sombra-regulada", "categoria": "poda", "impacto_tha": 0.10},
    {"codigo": "PR-07", "nombre": "riego-aspersion", "categoria": "riego", "impacto_tha": 0.18},
    {"codigo": "PR-08", "nombre": "abonado-organico", "categoria": "fertilizacion", "impacto_tha": 0.16},
    {"codigo": "PR-09", "nombre": "encalado", "categoria": "suelo", "impacto_tha": 0.20},
    {"codigo": "PR-10", "nombre": "manejo-integrado-plagas", "categoria": "sanidad", "impacto_tha": 0.24},
]

_TECNICOS = [
    ("Elena Vásquez", "cacao"), ("Marco Tuárez", "banano"),
    ("Rosa Guamán", "cafe"), ("Diego Cedeño", "maiz"),
    ("Patricia Molina", "suelos"), ("Iván Chiluisa", "riego"),
]

_COOPS = [
    ("Aroma de Los Ríos", "Los Ríos"), ("Cacao Fino del Guayas", "Guayas"),
    ("Sierra Sur Cafetalera", "Loja"), ("Bananera El Oro", "El Oro"),
    ("Granos de Manabí", "Manabí"),
]

_ZONA_COOP = {
    "Los Ríos": "Aroma de Los Ríos", "Guayas": "Cacao Fino del Guayas",
    "Manabí": "Granos de Manabí", "El Oro": "Bananera El Oro",
    "Loja": "Sierra Sur Cafetalera", "Pichincha": "Sierra Sur Cafetalera",
    "Zamora": "Sierra Sur Cafetalera",
}

_ESPECIALISTA = {"cacao": "Elena Vásquez", "banano": "Marco Tuárez",
                 "cafe": "Rosa Guamán", "maiz": "Diego Cedeño"}

_FICHAS = [
    ("FT-01", "Poda sanitaria en cacao", "cacao", "poda",
     "Retirar mazorcas enfermas y ramas improductivas cada quincena corta el ciclo "
     "de la monilia y mejora la entrada de luz. La poda sanitaria disciplinada "
     "puede sumar 0.2 a 0.3 t/ha en cacao en dos campañas.", "poda-sanitaria", None),
    ("FT-02", "Fertilización balanceada NPK en cacao", "cacao", "fertilizacion",
     "Un plan de fertilización balanceada con nitrógeno, fósforo y potasio según "
     "análisis foliar evita deficiencias y sostiene el llenado de mazorca. Dosis "
     "dividida en tres aplicaciones por campaña.", "fertilizacion-balanceada", None),
    ("FT-03", "Riego por goteo en banano", "banano", "riego",
     "El riego por goteo mantiene la humedad estable en la zona radicular y reduce "
     "el estrés hídrico en época seca. En banano, la uniformidad del riego se "
     "traduce directo en calibre y peso del racimo.", "riego-goteo", None),
    ("FT-04", "Control cultural de monilia", "cacao", "sanidad",
     "La moniliasis se controla combinando remoción semanal de frutos infectados, "
     "poda de aireación y cosecha oportuna. El control químico solo es rentable "
     "como complemento del manejo cultural.", "control-monilia", None),
    ("FT-05", "Manejo de sigatoka negra en banano", "banano", "sanidad",
     "El deshoje fitosanitario y la rotación de fungicidas por grupo químico frenan "
     "la sigatoka negra sin generar resistencia. Monitorear el estado evolutivo de "
     "la hoja 3 cada semana.", "manejo-integrado-plagas", None),
    ("FT-06", "Encalado de suelos ácidos", "maiz", "suelo",
     "En suelos con pH menor a 5.5 el aluminio bloquea el crecimiento radicular. "
     "El encalado con cal dolomítica corrige la acidez y libera fósforo fijado; "
     "aplicar 30 días antes de la siembra.", "encalado", None),
    ("FT-07", "Corrección de clorosis férrica en suelo alcalino", "cacao", "suelo",
     "La clorosis en suelo alcalino se reconoce por el amarillamiento entre las "
     "nervaduras de las hojas jóvenes: el pH alto bloquea la absorción de hierro. "
     "Se corrige con quelatos de hierro EDDHA al suelo, azufre elemental en la "
     "corona y materia orgánica que baje el pH de forma sostenida.", "analisis-suelo", None),
    ("FT-08", "Renovación de cacao con injerto CCN-51", "cacao", "variedad",
     "El injerto de copa con CCN-51 sobre árboles viejos renueva la plantación sin "
     "arrancarla: produce a los 18 meses con rendimiento de referencia de 1.4 t/ha "
     "y tolerancia a monilia.", None, "CCN-51"),
    ("FT-09", "Sombra regulada en café", "cafe", "poda",
     "Regular la sombra al 30-40 % equilibra temperatura y llenado de grano en "
     "café de altura. Un exceso de sombra favorece broca y roya; la regulación "
     "anual con podas de guaba es suficiente.", "sombra-regulada", None),
    ("FT-10", "Manejo integrado del gusano cogollero", "maiz", "sanidad",
     "El manejo integrado de plagas en maíz combina monitoreo con trampas de "
     "feromona, liberación de trichogramma y aplicación dirigida solo sobre "
     "umbral. Preserva controladores naturales y reduce costo.", "manejo-integrado-plagas", None),
    ("FT-11", "Análisis de suelo y plan de abonado", "cafe", "suelo",
     "Un análisis de suelo cada dos campañas permite abonar por prescripción y no "
     "por costumbre. La muestra compuesta se toma en zigzag a 20 cm de "
     "profundidad, antes de la fertilización principal.", "analisis-suelo", None),
    ("FT-12", "Compost y abonado orgánico certificable", "cacao", "fertilizacion",
     "El abonado orgánico con compost de cascarilla y gallinaza mantiene la "
     "certificación y mejora la retención de humedad. Complementar con biol "
     "foliar durante la floración.", "abonado-organico", None),
    ("FT-13", "Riego por aspersión en maíz duro", "maiz", "riego",
     "La aspersión móvil en maíz asegura la germinación uniforme y el llenado de "
     "grano en veranillo. Programar láminas de 25 mm según evapotranspiración "
     "del cultivo.", "riego-aspersion", None),
    ("FT-14", "Densidad de siembra del híbrido INIAP-528", "maiz", "variedad",
     "El híbrido INIAP-528 expresa su potencial de 8.8 t/ha con 62 500 plantas "
     "por hectárea y fertilización nitrogenada fraccionada. A mayor densidad "
     "sin riego, el rendimiento cae por competencia.", None, "INIAP-528"),
]


def _perfil(cultivo, suelo, clima, altitud, zona, manejo):
    return f"{cultivo} suelo {suelo} clima {clima} altitud {altitud} zona {zona} manejo {manejo}"


def _cos(a, b):
    dot = sum(x * y for x, y in zip(a, b))
    na = math.sqrt(sum(x * x for x in a)) or 1.0
    nb = math.sqrt(sum(x * x for x in b)) or 1.0
    return dot / (na * nb)


def _practicas_de(cultivo, manejo, rng):
    if manejo == "tecnificado":
        return {
            "cacao": ["poda-sanitaria", "fertilizacion-balanceada", "control-monilia"],
            "cafe": ["poda-sanitaria", "fertilizacion-balanceada", "analisis-suelo"],
            "banano": ["riego-goteo", "fertilizacion-balanceada", "manejo-integrado-plagas"],
            "maiz": ["riego-goteo", "fertilizacion-balanceada", "analisis-suelo"],
        }[cultivo]
    if manejo == "organico":
        if cultivo in ("cacao", "cafe"):
            return ["abonado-organico", "sombra-regulada"]
        return ["abonado-organico", "analisis-suelo"]
    # convencional: poco o nada
    return [rng.choice(["riego-aspersion", "encalado"])] if rng.randint(0, 1) else []


def _variedad_de(cultivo, manejo, rng):
    if cultivo == "cacao":
        return {"tecnificado": "CCN-51", "organico": "EET-103"}.get(manejo, "Nacional-criollo")
    if cultivo == "cafe":
        if manejo == "tecnificado":
            return "Sarchimor"
        return rng.choice(["Typica", "Caturra"])
    if cultivo == "banano":
        return "Cavendish-Williams" if manejo == "tecnificado" else "Gran-Enano"
    return "INIAP-528" if manejo == "tecnificado" else "Trueno-NB"


def seed(db):
    rng = Rng(1701)

    # ── Parcelas: fondo por grupos de perfil + 2 plantadas ──────────────
    fondo = []
    for cultivo, suelo, clima, altitud, zona, manejos in _GRUPOS:
        for manejo in manejos:
            pot = round(rng.uniform(*_POTENCIAL[cultivo]), 2)
            act = round(pot * rng.uniform(*_FACTOR[manejo]), 2)
            fondo.append({
                "cultivo": cultivo, "suelo": suelo, "clima": clima,
                "altitud": altitud, "zona": zona, "manejo": manejo,
                "hectareas": rng.randint(*_HECTAREAS[cultivo]),
                "rend_actual": act, "rend_potencial": pot,
            })

    pc018 = {
        "cultivo": "cacao", "suelo": "franco-arcilloso", "clima": "humedo-tropical",
        "altitud": "baja", "zona": "Los Ríos", "manejo": "convencional",
        "hectareas": 12, "rend_actual": 0.42, "rend_potencial": 1.15,
    }
    pc041 = {
        "cultivo": "cacao", "suelo": "franco-arcilloso", "clima": "humedo-tropical",
        "altitud": "baja", "zona": "Los Ríos", "manejo": "tecnificado",
        "hectareas": 10, "rend_actual": 1.08, "rend_potencial": 1.16,
    }

    parcelas = []
    it = iter(fondo)
    for i in range(48):
        base = pc018 if i == 17 else pc041 if i == 40 else next(it)
        p = dict(base)
        p["codigo"] = f"PC-{i + 1:03d}"
        p["perfil"] = _perfil(p["cultivo"], p["suelo"], p["clima"],
                              p["altitud"], p["zona"], p["manejo"])
        p["emb"] = embed(p["perfil"])
        parcelas.append(p)

    # ── GEMELA materializada: top-4 por coseno del perfil ───────────────
    gemelas = []
    for p in parcelas:
        sims = sorted(
            ((_cos(p["emb"], q["emb"]), q["codigo"]) for q in parcelas
             if q["codigo"] != p["codigo"]),
            key=lambda t: (-t[0], t[1]),
        )
        for cos, dst in sims[:4]:
            gemelas.append({"src": p["codigo"], "dst": dst, "sim": round(cos, 3)})

    # ── Variedades, prácticas, técnicos, cooperativas ───────────────────
    cultiva, aplica, pertenece, atiende = [], [], [], []
    contador_cultivo: dict[str, int] = {}
    for p in parcelas:
        cod, cultivo, manejo = p["codigo"], p["cultivo"], p["manejo"]

        if cod == "PC-018":
            variedad, practicas = "Nacional-criollo", ["analisis-suelo"]
        elif cod == "PC-041":
            variedad = "CCN-51"
            practicas = ["poda-sanitaria", "fertilizacion-balanceada", "control-monilia"]
        else:
            variedad = _variedad_de(cultivo, manejo, rng)
            practicas = _practicas_de(cultivo, manejo, rng)

        cultiva.append({"src": cod, "dst": variedad})
        for nombre in practicas:
            aplica.append({"src": cod, "dst": nombre,
                           "desde": rng.fecha(año=2025, mes_ini=1, mes_fin=12)})
        pertenece.append({"src": cod, "dst": _ZONA_COOP[p["zona"]]})

        i = contador_cultivo.get(cultivo, 0)
        contador_cultivo[cultivo] = i + 1
        tecnico = (_ESPECIALISTA[cultivo] if i % 3 != 2
                   else ("Patricia Molina" if i % 2 == 0 else "Iván Chiluisa"))
        atiende.append({"src": tecnico, "dst": cod})

    fichas, trata, sobre = [], [], []
    for codigo, titulo, cultivo, tema, texto, practica, variedad in _FICHAS:
        fichas.append({"codigo": codigo, "titulo": titulo, "cultivo": cultivo,
                       "tema": tema, "texto": texto,
                       "emb": embed(f"{titulo} {texto}")})
        if practica:
            trata.append({"src": codigo, "dst": practica})
        if variedad:
            sobre.append({"src": codigo, "dst": variedad})

    # ── Carga ───────────────────────────────────────────────────────────
    db.cypher("CREATE CONSTRAINT parcela_codigo IF NOT EXISTS FOR (p:Parcela) REQUIRE p.codigo IS UNIQUE")
    db.cypher("CREATE CONSTRAINT practica_codigo IF NOT EXISTS FOR (p:Practica) REQUIRE p.codigo IS UNIQUE")
    db.cypher("CREATE CONSTRAINT variedad_nombre IF NOT EXISTS FOR (v:Variedad) REQUIRE v.nombre IS UNIQUE")
    db.cypher("CREATE CONSTRAINT ficha_codigo IF NOT EXISTS FOR (f:Ficha) REQUIRE f.codigo IS UNIQUE")

    load_nodes(db, "Parcela", parcelas)
    load_nodes(db, "Variedad", _VARIEDADES)
    load_nodes(db, "Practica", _PRACTICAS)
    load_nodes(db, "Tecnico", [{"nombre": n, "especialidad": e} for n, e in _TECNICOS])
    load_nodes(db, "Cooperativa", [{"nombre": n, "zona": z} for n, z in _COOPS])
    load_nodes(db, "Ficha", fichas)

    load_edges(db, "Parcela", "codigo", "CULTIVA", "Variedad", "nombre", cultiva)
    load_edges(db, "Parcela", "codigo", "APLICA", "Practica", "nombre", aplica, rel_props=["desde"])
    load_edges(db, "Parcela", "codigo", "PERTENECE_A", "Cooperativa", "nombre", pertenece)
    load_edges(db, "Tecnico", "nombre", "ATIENDE", "Parcela", "codigo", atiende)
    load_edges(db, "Parcela", "codigo", "GEMELA", "Parcela", "codigo", gemelas, rel_props=["sim"])
    load_edges(db, "Ficha", "codigo", "TRATA", "Practica", "nombre", trata)
    load_edges(db, "Ficha", "codigo", "SOBRE", "Variedad", "nombre", sobre)


QUERIES = [
    {
        "id": "brecha-panorama",
        "titulo": "Panorama de la brecha de rendimiento",
        "descripcion": (
            "Cuánto rinde la red hoy contra su potencial agronómico: brecha "
            "promedio, toneladas absolutas recuperables y parcelas críticas "
            "bajo el 60 % de su potencial."
        ),
        "cypher": """\
MATCH (p:Parcela)
RETURN count(p) AS parcelas,
       round(avg(p.rend_potencial - p.rend_actual) * 100) / 100 AS brecha_promedio_tha,
       round(sum((p.rend_potencial - p.rend_actual) * p.hectareas) * 10) / 10 AS ton_recuperables,
       sum(CASE WHEN p.rend_actual < 0.6 * p.rend_potencial THEN 1 ELSE 0 END) AS bajo_60_pct""",
    },
    {
        "id": "oportunidad-ranking",
        "titulo": "Cola de prioridad: toneladas recuperables por parcela",
        "descripcion": (
            "Cada parcela valorada por (potencial − actual) × hectáreas: las "
            "toneladas absolutas que la asistencia técnica puede recuperar. "
            "Es la cola de trabajo de los extensionistas."
        ),
        "cypher": """\
MATCH (p:Parcela)
RETURN p.codigo AS parcela, p.cultivo AS cultivo, p.zona AS zona,
       p.manejo AS manejo, p.rend_actual AS actual_tha,
       p.rend_potencial AS potencial_tha,
       round((p.rend_potencial - p.rend_actual) * 100) / 100 AS brecha_tha,
       round((p.rend_potencial - p.rend_actual) * p.hectareas * 10) / 10 AS ton_recuperables
ORDER BY ton_recuperables DESC
LIMIT 12""",
    },
    {
        "id": "gemelas-materializadas",
        "titulo": "Las gemelas de PC-018 (similitud de perfil)",
        "descripcion": (
            "Las 4 parcelas con perfil agronómico casi idéntico a PC-018 "
            "(cacao, franco-arcilloso, húmedo-tropical, Los Ríos), con su "
            "manejo y rendimiento: la evidencia comparable ya existe."
        ),
        "cypher": """\
MATCH (s:Parcela {codigo: 'PC-018'})-[g:GEMELA]->(t:Parcela)
RETURN t.codigo AS gemela, t.manejo AS manejo, t.rend_actual AS rend_actual,
       t.rend_potencial AS rend_potencial, g.sim AS similitud
ORDER BY similitud DESC""",
    },
    {
        "id": "recomendacion-gemela",
        "titulo": "Qué hace distinto la gemela que sí rinde",
        "descripcion": (
            "De las gemelas de PC-018 (0.42 t/ha), la que ya cerró la brecha: "
            "PC-041 rinde 1.08 t/ha con CCN-51, poda sanitaria y "
            "fertilización balanceada. La receta no es genérica: viene de una "
            "parcela de condiciones idénticas."
        ),
        "cypher": """\
MATCH (s:Parcela {codigo: 'PC-018'})-[g:GEMELA]->(t:Parcela)
WHERE t.rend_actual > s.rend_actual
MATCH (t)-[:CULTIVA]->(v:Variedad)
MATCH (t)-[:APLICA]->(pr:Practica)
WITH s, t, g, v, collect(pr.nombre) AS practicas
RETURN t.codigo AS gemela, round(g.sim * 1000) / 1000 AS similitud,
       t.manejo AS manejo, v.nombre AS variedad, practicas,
       round((t.rend_actual - s.rend_actual) * 100) / 100 AS uplift_tha
ORDER BY uplift_tha DESC
LIMIT 3""",
    },
    {
        "id": "impacto-practica",
        "titulo": "La poda sanitaria mueve el rendimiento del cacao",
        "descripcion": (
            "Parcelas de cacao que aplican poda sanitaria vs las que no: la "
            "diferencia de rendimiento promedio es la evidencia con la que se "
            "vende la práctica al productor."
        ),
        "cypher": """\
MATCH (p:Parcela {cultivo: 'cacao'})-[:APLICA]->(pr:Practica {nombre: 'poda-sanitaria'})
WITH collect(DISTINCT p.codigo) AS con_poda
MATCH (q:Parcela {cultivo: 'cacao'})
WITH q, CASE WHEN q.codigo IN con_poda
             THEN 'con poda-sanitaria' ELSE 'sin poda-sanitaria' END AS grupo
RETURN grupo, count(q) AS parcelas,
       round(avg(q.rend_actual) * 100) / 100 AS rend_promedio_tha
ORDER BY rend_promedio_tha DESC""",
    },
    {
        "id": "variedad-por-zona",
        "titulo": "Qué variedad gana en cada zona",
        "descripcion": (
            "Rendimiento promedio por cultivo, zona y variedad sembrada: la "
            "genética correcta para cada condición sale de los datos, no del "
            "catálogo."
        ),
        "cypher": """\
MATCH (p:Parcela)-[:CULTIVA]->(v:Variedad)
WITH p.cultivo AS cultivo, p.zona AS zona, v.nombre AS variedad,
     count(p) AS parcelas, round(avg(p.rend_actual) * 100) / 100 AS rend_promedio_tha
RETURN cultivo, zona, variedad, parcelas, rend_promedio_tha
ORDER BY cultivo, rend_promedio_tha DESC""",
    },
    {
        "id": "ficha-tecnica-bm25",
        "titulo": "La ficha correcta por texto libre (BM25)",
        "descripcion": (
            "El técnico escribe lo que ve en campo — 'clorosis suelo "
            "alcalino' — y el motor recupera la ficha técnica exacta por "
            "relevancia textual, sin taxonomías ni carpetas."
        ),
        "cypher": """\
CALL search.bm25({label: 'Ficha', text_property: 'texto',
                  query: 'clorosis suelo alcalino', k: 5})
YIELD node, score
RETURN node.codigo AS ficha, node.titulo AS titulo, node.tema AS tema,
       node.cultivo AS cultivo, round(score * 1000) / 1000 AS score
ORDER BY score DESC""",
    },
    {
        "id": "cooperativa-brecha",
        "titulo": "Toneladas recuperables por cooperativa",
        "descripcion": (
            "Dónde concentrar el programa de asistencia: cada cooperativa con "
            "sus parcelas y las toneladas que dejaría de perder si cierran la "
            "brecha."
        ),
        "cypher": """\
MATCH (p:Parcela)-[:PERTENECE_A]->(c:Cooperativa)
RETURN c.nombre AS cooperativa, count(p) AS parcelas,
       round(sum((p.rend_potencial - p.rend_actual) * p.hectareas) * 10) / 10 AS ton_recuperables
ORDER BY ton_recuperables DESC""",
    },
    {
        "id": "tecnico-cartera",
        "titulo": "Cartera de cada técnico, valorada en toneladas",
        "descripcion": (
            "La cartera de parcelas de cada extensionista pesada por "
            "oportunidad: a quién asignar refuerzos se decide con toneladas, "
            "no con visitas."
        ),
        "cypher": """\
MATCH (t:Tecnico)-[:ATIENDE]->(p:Parcela)
RETURN t.nombre AS tecnico, t.especialidad AS especialidad,
       count(p) AS parcelas,
       round(sum((p.rend_potencial - p.rend_actual) * p.hectareas) * 10) / 10 AS ton_recuperables
ORDER BY ton_recuperables DESC""",
    },
    {
        "id": "cartera-transferencia",
        "titulo": "Transferencias listas: parcela crítica → gemela probada",
        "descripcion": (
            "Cada parcela bajo el 60 % de su potencial emparejada con una "
            "gemela (similitud ≥ 0.9) que ya rinde sobre el 80 % del suyo: "
            "recomendaciones con evidencia local, generadas por el grafo."
        ),
        "cypher": """\
MATCH (s:Parcela)-[g:GEMELA]->(t:Parcela)
WHERE g.sim >= 0.9
  AND s.rend_actual < 0.6 * s.rend_potencial
  AND t.rend_actual > 0.8 * t.rend_potencial
MATCH (t)-[:CULTIVA]->(v:Variedad)
RETURN s.codigo AS parcela, s.cultivo AS cultivo, s.rend_actual AS actual_tha,
       t.codigo AS gemela, t.rend_actual AS gemela_tha, v.nombre AS variedad_probada,
       round(g.sim * 1000) / 1000 AS similitud,
       round((t.rend_actual - s.rend_actual) * s.hectareas * 10) / 10 AS ton_en_juego
ORDER BY ton_en_juego DESC
LIMIT 15""",
    },
]
