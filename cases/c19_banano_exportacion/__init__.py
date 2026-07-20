"""Caso 19 — Agro-exportación: banano de Ecuador al mundo.

El corazón del negocio bananero: cada caja recorre finca → empacadora →
naviera → ruta → mercado → cliente. El grafo conecta ese recorrido con el
precio realizado, los reclamos de calidad y la cadena de frío para responder
lo que a la gerencia exportadora le importa: ¿de qué mercado y qué cliente
dependemos?, ¿qué mercado paga sobre el precio oficial?, ¿de qué empacadora
y finca vienen los reclamos?

Datos sintéticos. Inspirado en Reybanpac (Grupo Wong), 2.º exportador bananero
del Ecuador (banano marca Favorita). Anclas reales 2026: precio mínimo de
sustentación (PMS) de la caja 22XU = USD 7,50 y FOB de referencia = USD 9,75
(MAG); la Unión Europea es el mayor comprador (~30 %).
"""
from cases.common import Rng, load_edges, load_nodes

PMS = 7.50        # precio mínimo de sustentación 2026 (caja 22XU, 43 lb)
FOB_REF = 9.75    # FOB mínimo de referencia 2026

META = {
    "numero": 19,
    "slug": "banano-exportacion",
    "industria": "Agro-exportación — Banano de Ecuador al mundo",
    "titulo": "Cada caja, a su mejor mercado.",
    "problema": (
        "Un exportador embarca millones de cajas a decenas de clientes en varios "
        "continentes, por distintas navieras y rutas. Pero no ve a tiempo de qué "
        "mercado y qué cliente depende su facturación, qué mercado paga sobre el "
        "precio oficial y cuál por debajo, ni de qué empacadora y finca provienen "
        "los reclamos de calidad que le descuentan la venta."
    ),
    "conecta": [
        "Finca", "Empacadora", "Embarque (cajas)", "Naviera", "Ruta",
        "Mercado destino", "Cliente / importador", "Reclamo de calidad",
        "Certificación",
    ],
    "revela": [
        "Concentración de mercado y de cliente (riesgo de dependencia)",
        "Precio realizado por mercado vs el precio oficial (PMS/FOB)",
        "Causa raíz de los reclamos: de un mercado a la empacadora y la finca",
        "Cadena de frío: reclamos por daño de frío por naviera",
        "Premium por certificación (orgánico, Rainforest, comercio justo)",
    ],
    "indicadores": [
        "Cajas exportadas y FOB total", "% de facturación por mercado",
        "Precio realizado vs PMS", "Tasa de reclamo por empacadora",
        "Cajas con daño de frío por naviera",
    ],
    "referencia": (
        "El MAG fijó para 2026 el precio mínimo de sustentación de la caja de "
        "banano en USD 7,50 y el FOB de referencia en USD 9,75; la Unión Europea "
        "es el mayor comprador del banano ecuatoriano (~30 %), con Rusia en alza. "
        "Reybanpac (banano marca Favorita) exporta a 30 puertos en cinco continentes."
    ),
}

LEYENDA = {
    "Finca": "Hacienda productora de banano",
    "Empacadora": "Estación de empaque (calidad y trazabilidad)",
    "Embarque": "Lote de cajas exportado en una semana",
    "Naviera": "Línea marítima refrigerada (reefer)",
    "Ruta": "Tramo puerto de origen → destino",
    "Mercado": "Mercado destino (UE, EE. UU., Rusia…)",
    "Cliente": "Importador / comprador en destino",
    "Reclamo": "Reclamo de calidad desde el destino",
}

FINCAS = [
    ("Hacienda Rey del Guabo", "El Oro", 420, "Rainforest"),
    ("Finca La Corriente", "Los Ríos", 310, "GlobalG.A.P."),
    ("Hacienda San Miguel", "Guayas", 500, "GlobalG.A.P."),
    ("Finca El Deseo", "El Oro", 260, "Orgánico UE"),
    ("Hacienda Balao", "Guayas", 380, "Rainforest"),
    ("Finca Tres Palmas", "Los Ríos", 220, "Comercio Justo"),
    ("Hacienda La Julia", "El Oro", 340, "GlobalG.A.P."),
    ("Finca Río Chico", "Cañar", 180, "Orgánico UE"),
    ("Hacienda Naranjal", "Guayas", 410, "Rainforest"),
    ("Finca Santa Rosa", "El Oro", 200, "ninguna"),
]

# Empacadora -> finca de origen
EMPACADORAS = [
    ("EMP-01", "Empacadora Guabo", "Hacienda Rey del Guabo"),
    ("EMP-02", "Empacadora San Miguel", "Hacienda San Miguel"),
    ("EMP-03", "Empacadora La Corriente", "Finca La Corriente"),   # alta tasa de reclamo (plantado)
    ("EMP-04", "Empacadora El Deseo", "Finca El Deseo"),
    ("EMP-05", "Empacadora Balao", "Hacienda Balao"),
    ("EMP-06", "Empacadora La Julia", "Hacienda La Julia"),
    ("EMP-07", "Empacadora Naranjal", "Hacienda Naranjal"),
    ("EMP-08", "Empacadora Santa Rosa", "Finca Santa Rosa"),
]

NAVIERAS = ["Reefer Andina", "OceanCool Line", "Pacífico Marítimo",
            "EuroReefer", "Global Cargo"]  # OceanCool: fallas de frío (plantado)

# Mercado -> (peso de asignación, precio realizado típico por caja)
MERCADOS = [
    ("Unión Europea", 0.30, 10.80),
    ("Estados Unidos", 0.18, 9.90),
    ("Rusia", 0.16, 8.20),          # spot: por debajo del FOB de referencia
    ("Medio Oriente", 0.12, 9.40),
    ("Cono Sur", 0.10, 8.90),
    ("Mediterráneo", 0.08, 9.60),
    ("China", 0.06, 9.10),
]

# Cliente -> mercado
CLIENTES = [
    ("EuroFruit GmbH", "Unión Europea"),
    ("Nordic Bananas", "Unión Europea"),
    ("Iberia Frutas", "Unión Europea"),
    ("Sunbelt Produce", "Estados Unidos"),
    ("Pacific Foods USA", "Estados Unidos"),
    ("Rus Agro Import", "Rusia"),
    ("Volga Fruit", "Rusia"),
    ("Gulf Fresh", "Medio Oriente"),
    ("Levante Trading", "Medio Oriente"),
    ("Sur Distribución", "Cono Sur"),
    ("Adriatica Frutta", "Mediterráneo"),
    ("Shanghai GreenMart", "China"),
]

RECLAMO_TIPOS = ["maduración prematura", "calibre bajo", "cicatriz",
                 "daño por thrips", "daño de frío", "faltante"]


def seed(db):
    rng = Rng(1901)

    fincas = [{"nombre": n, "zona": z, "hectareas": h, "certificacion": c}
              for (n, z, h, c) in FINCAS]
    empacadoras = [{"codigo": c, "nombre": n} for (c, n, _f) in EMPACADORAS]
    empaca_de = [{"src": c, "dst": f} for (c, _n, f) in EMPACADORAS]
    navieras = [{"nombre": n} for n in NAVIERAS]
    mercados = [{"nombre": m} for (m, _w, _p) in MERCADOS]
    clientes = [{"nombre": c, "mercado": m} for (c, m) in CLIENTES]
    en_mercado = [{"src": c, "dst": m} for (c, m) in CLIENTES]

    # Rutas: una por mercado (puerto Guayaquil → destino)
    puerto_destino = {
        "Unión Europea": "Amberes", "Estados Unidos": "Wilmington",
        "Rusia": "San Petersburgo", "Medio Oriente": "Jebel Ali",
        "Cono Sur": "San Antonio", "Mediterráneo": "Génova", "China": "Shanghái",
    }
    transito = {
        "Unión Europea": 16, "Estados Unidos": 9, "Rusia": 24,
        "Medio Oriente": 22, "Cono Sur": 12, "Mediterráneo": 18, "China": 30,
    }
    rutas, hacia = [], []
    ruta_de_mercado = {}
    for i, (m, _w, _p) in enumerate(MERCADOS, start=1):
        cod = f"RT-{i:02d}"
        ruta_de_mercado[m] = cod
        rutas.append({"codigo": cod, "puerto_origen": "Guayaquil",
                      "puerto_destino": puerto_destino[m],
                      "dias_transito": transito[m]})
        hacia.append({"src": cod, "dst": m})

    clientes_por_mercado = {}
    for (c, m) in CLIENTES:
        clientes_por_mercado.setdefault(m, []).append(c)

    precio_mercado = {m: p for (m, _w, p) in MERCADOS}
    cert_de_finca = {n: c for (n, _z, _h, c) in FINCAS}
    # Premium por certificación: la fruta certificada realiza un mejor precio
    # sin importar el mercado (orgánico y Rainforest capturan el mayor premium).
    cert_premium = {"Orgánico UE": 0.95, "Rainforest": 0.55,
                    "Comercio Justo": 0.38, "GlobalG.A.P.": 0.12, "ninguna": 0.0}

    # Asignación determinista y proporcional de mercados: cada mercado ocupa
    # una fracción de los 72 embarques según su peso (UE ~30 %), luego se
    # baraja con el rng sembrado para no correlacionar mercado con empacadora.
    N_EMB = 72
    slots = []
    for (m, w, _p) in MERCADOS:
        slots.extend([m] * round(w * N_EMB))
    while len(slots) < N_EMB:
        slots.append(MERCADOS[0][0])
    slots = slots[:N_EMB]
    rng.shuffle(slots)

    # ── Embarques: recorrido completo por caja ──────────────────────────
    embarques, produjo, de_finca, via_naviera, por_ruta, vendido_a = [], [], [], [], [], []
    reclamos, rec_sobre, rec_desde = [], [], []
    nrec = 1

    for k in range(N_EMB):
        emp_cod, _emp_n, finca = EMPACADORAS[k % len(EMPACADORAS)]
        mercado = slots[k]
        naviera = rng.choice(NAVIERAS)
        cliente = rng.choice(clientes_por_mercado[mercado])
        cajas = rng.randint(900, 4200)
        precio = round(precio_mercado[mercado]
                       + cert_premium[cert_de_finca[finca]]
                       + rng.uniform(-0.35, 0.4), 2)
        # cadena de frío: OceanCool corre más caliente
        temp = round(rng.uniform(13.2, 13.8) + (1.6 if naviera == "OceanCool Line" else 0.0), 1)
        cod = f"EMB-{k + 1:03d}"
        embarques.append({"codigo": cod, "semana": f"2026-S{(k % 24) + 1:02d}",
                          "cajas": cajas, "tipo_caja": "22XU",
                          "temp_reefer": temp, "fob_caja": precio})
        produjo.append({"src": emp_cod, "dst": cod})
        de_finca.append({"src": cod, "dst": finca})
        via_naviera.append({"src": cod, "dst": naviera})
        por_ruta.append({"src": cod, "dst": ruta_de_mercado[mercado]})
        vendido_a.append({"src": cod, "dst": cliente,
                          "cajas": cajas, "precio_caja": precio,
                          "fob": round(cajas * precio, 2)})

        # ── Reclamos plantados ──
        # EMP-03: tasa alta de reclamo (maduración prematura)
        # OceanCool Line: daño de frío
        motivos = []
        if emp_cod == "EMP-03" and rng.uniform(0, 1) < 0.85:
            motivos.append("maduración prematura")
        if naviera == "OceanCool Line" and rng.uniform(0, 1) < 0.6:
            motivos.append("daño de frío")
        if rng.uniform(0, 1) < 0.05:
            motivos.append(rng.choice(RECLAMO_TIPOS))
        for motivo in motivos:
            if emp_cod == "EMP-03" and motivo == "maduración prematura":
                # el problema de calidad plantado: reclamos grandes y frecuentes
                cajas_afectadas = rng.randint(int(cajas * 0.12), int(cajas * 0.22) + 10)
            else:
                cajas_afectadas = rng.randint(30, int(cajas * 0.10) + 40)
            monto = round(cajas_afectadas * precio, 2)
            rcod = f"REC-{nrec:03d}"
            nrec += 1
            reclamos.append({"codigo": rcod, "tipo": motivo,
                             "cajas_afectadas": cajas_afectadas, "monto": monto,
                             "fecha": f"2026-{(k % 6) + 1:02d}-{(k % 27) + 1:02d}"})
            rec_sobre.append({"src": rcod, "dst": cod})
            rec_desde.append({"src": rcod, "dst": mercado})

    db.cypher("CREATE CONSTRAINT emb_cod IF NOT EXISTS FOR (e:Embarque) REQUIRE e.codigo IS UNIQUE")
    db.cypher("CREATE CONSTRAINT finca_nom19 IF NOT EXISTS FOR (f:Finca) REQUIRE f.nombre IS UNIQUE")
    db.cypher("CREATE CONSTRAINT emp_cod19 IF NOT EXISTS FOR (e:Empacadora) REQUIRE e.codigo IS UNIQUE")

    load_nodes(db, "Finca", fincas)
    load_nodes(db, "Empacadora", empacadoras)
    load_nodes(db, "Naviera", navieras)
    load_nodes(db, "Ruta", rutas)
    load_nodes(db, "Mercado", mercados)
    load_nodes(db, "Cliente", clientes)
    load_nodes(db, "Embarque", embarques)
    load_nodes(db, "Reclamo", reclamos)

    load_edges(db, "Empacadora", "codigo", "EMPACA_DE", "Finca", "nombre", empaca_de)
    load_edges(db, "Empacadora", "codigo", "PRODUJO", "Embarque", "codigo", produjo)
    load_edges(db, "Embarque", "codigo", "DE_FINCA", "Finca", "nombre", de_finca)
    load_edges(db, "Embarque", "codigo", "VIA_NAVIERA", "Naviera", "nombre", via_naviera)
    load_edges(db, "Embarque", "codigo", "POR_RUTA", "Ruta", "codigo", por_ruta)
    load_edges(db, "Ruta", "codigo", "HACIA", "Mercado", "nombre", hacia)
    load_edges(db, "Cliente", "nombre", "EN_MERCADO", "Mercado", "nombre", en_mercado)
    load_edges(db, "Embarque", "codigo", "VENDIDO_A", "Cliente", "nombre", vendido_a,
               rel_props=["cajas", "precio_caja", "fob"])
    load_edges(db, "Reclamo", "codigo", "SOBRE", "Embarque", "codigo", rec_sobre)
    load_edges(db, "Reclamo", "codigo", "DESDE", "Mercado", "nombre", rec_desde)


QUERIES = [
    {
        "id": "panorama-export",
        "titulo": "Pulso de la exportación",
        "descripcion": (
            "Cajas embarcadas, FOB total facturado, mercados atendidos y "
            "reclamos: el tamaño del negocio exportador de un vistazo."
        ),
        "cypher": """\
MATCH (e:Embarque)-[v:VENDIDO_A]->(c:Cliente)
RETURN sum(e.cajas) AS cajas, round(sum(v.fob)) AS fob_total,
       count(e) AS embarques""",
    },
    {
        "id": "mercado-mix",
        "titulo": "Concentración por mercado",
        "descripcion": (
            "Cajas y FOB por mercado destino. La Unión Europea concentra más de "
            "un tercio de la facturación: gran mercado, gran dependencia."
        ),
        "cypher": """\
MATCH (e:Embarque)-[:POR_RUTA]->(r:Ruta)-[:HACIA]->(m:Mercado)
MATCH (e)-[v:VENDIDO_A]->(c:Cliente)
RETURN m.nombre AS mercado, sum(e.cajas) AS cajas,
       round(sum(v.fob)) AS fob, count(e) AS embarques
ORDER BY fob DESC""",
    },
    {
        "id": "precio-realizado",
        "titulo": "Precio realizado vs precio oficial",
        "descripcion": (
            "Precio promedio por caja logrado en cada mercado, contra el precio "
            "mínimo de sustentación (USD 7,50) y el FOB de referencia (USD 9,75). "
            "La UE paga premium; Rusia (spot) queda por debajo del FOB."
        ),
        "cypher": """\
MATCH (e:Embarque)-[:POR_RUTA]->(r:Ruta)-[:HACIA]->(m:Mercado)
MATCH (e)-[v:VENDIDO_A]->(c:Cliente)
RETURN m.nombre AS mercado,
       round(avg(v.precio_caja) * 100) / 100 AS precio_realizado,
       7.5 AS pms, 9.75 AS fob_ref,
       round((avg(v.precio_caja) - 7.5) * 100) / 100 AS sobre_pms
ORDER BY precio_realizado DESC""",
    },
    {
        "id": "reclamos-tipo",
        "titulo": "Reclamos por tipo",
        "descripcion": (
            "Los reclamos de calidad desde destino, por causa, con cajas "
            "afectadas y monto descontado: dónde se está yendo el margen."
        ),
        "cypher": """\
MATCH (rec:Reclamo)
RETURN rec.tipo AS tipo, count(rec) AS reclamos,
       sum(rec.cajas_afectadas) AS cajas_afectadas, round(sum(rec.monto)) AS monto
ORDER BY monto DESC""",
    },
    {
        "id": "causa-raiz-empacadora",
        "titulo": "Causa raíz: reclamos por empacadora",
        "descripcion": (
            "La trazabilidad que el grafo hace directa: de los reclamos hacia "
            "atrás a la empacadora y la finca. Una empacadora concentra la tasa "
            "de reclamo — ahí está el problema de calidad."
        ),
        "cypher": """\
MATCH (emp:Empacadora)-[:PRODUJO]->(e:Embarque)
WITH emp, sum(e.cajas) AS cajas_producidas, count(e) AS embarques
MATCH (emp)-[:EMPACA_DE]->(f:Finca)
OPTIONAL MATCH (emp)-[:PRODUJO]->(e2:Embarque)<-[:SOBRE]-(rec:Reclamo)
WITH emp, f, cajas_producidas, embarques,
     sum(rec.cajas_afectadas) AS cajas_reclamadas
RETURN emp.nombre AS empacadora, f.nombre AS finca_origen,
       f.certificacion AS certificacion, cajas_producidas,
       coalesce(cajas_reclamadas, 0) AS cajas_reclamadas,
       round(coalesce(cajas_reclamadas, 0) * 10000.0 / cajas_producidas) / 100 AS tasa_reclamo_pct
ORDER BY tasa_reclamo_pct DESC""",
    },
    {
        "id": "naviera-frio",
        "titulo": "Cadena de frío por naviera",
        "descripcion": (
            "Reclamos por daño de frío y temperatura reefer promedio por línea "
            "marítima. Una naviera corre más caliente y acumula el daño: "
            "candidata a renegociar o dejar de usar."
        ),
        "cypher": """\
MATCH (e:Embarque)-[:VIA_NAVIERA]->(n:Naviera)
WITH n, count(e) AS embarques, round(avg(e.temp_reefer) * 10) / 10 AS temp_promedio
OPTIONAL MATCH (n)<-[:VIA_NAVIERA]-(e2:Embarque)<-[:SOBRE]-(rec:Reclamo)
WITH n, embarques, temp_promedio,
     sum(CASE WHEN rec.tipo = 'daño de frío' THEN 1 ELSE 0 END) AS reclamos_frio,
     sum(CASE WHEN rec.tipo = 'daño de frío' THEN rec.cajas_afectadas ELSE 0 END) AS cajas_afectadas
RETURN n.nombre AS naviera, embarques, temp_promedio, reclamos_frio, cajas_afectadas
ORDER BY cajas_afectadas DESC""",
    },
    {
        "id": "cliente-top",
        "titulo": "Concentración por cliente",
        "descripcion": (
            "Los importadores que más facturan: si uno se cae, ¿cuánta venta se "
            "va con él? La diversificación de clientes es resiliencia."
        ),
        "cypher": """\
MATCH (e:Embarque)-[v:VENDIDO_A]->(c:Cliente)-[:EN_MERCADO]->(m:Mercado)
RETURN c.nombre AS cliente, m.nombre AS mercado,
       sum(e.cajas) AS cajas, round(sum(v.fob)) AS fob
ORDER BY fob DESC LIMIT 10""",
    },
    {
        "id": "premium-certificacion",
        "titulo": "Premium por certificación",
        "descripcion": (
            "Precio promedio realizado según la certificación de la finca de "
            "origen: orgánico y Rainforest capturan el mayor premium sobre el PMS."
        ),
        "cypher": """\
MATCH (f:Finca)<-[:DE_FINCA]-(e:Embarque)-[v:VENDIDO_A]->(c:Cliente)
RETURN f.certificacion AS certificacion, count(DISTINCT f) AS fincas,
       sum(e.cajas) AS cajas,
       round(avg(v.precio_caja) * 100) / 100 AS precio_promedio
ORDER BY precio_promedio DESC""",
    },
    {
        "id": "ruta-transito",
        "titulo": "Rutas y tránsito",
        "descripcion": (
            "Días de tránsito por ruta y reclamos acumulados: las rutas largas "
            "estresan más la cadena de frío."
        ),
        "cypher": """\
MATCH (r:Ruta)-[:HACIA]->(m:Mercado)
MATCH (e:Embarque)-[:POR_RUTA]->(r)
OPTIONAL MATCH (e)<-[:SOBRE]-(rec:Reclamo)
RETURN m.nombre AS mercado, r.puerto_destino AS puerto, r.dias_transito AS dias_transito,
       count(DISTINCT e) AS embarques, count(rec) AS reclamos
ORDER BY dias_transito DESC""",
    },
]
