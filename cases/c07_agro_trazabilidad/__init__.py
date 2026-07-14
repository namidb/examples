"""Caso 07 — Agro y alimentos: trazabilidad de la finca al consumidor."""
from cases.common import Rng, load_edges, load_nodes

META = {
    "numero": 7,
    "slug": "agro-trazabilidad",
    "industria": "Agro y alimentos — Trazabilidad de la finca al consumidor",
    "titulo": "Cada lote cuenta su historia.",
    "problema": (
        "Ante contaminación o incumplimiento, las empresas tardan demasiado "
        "en determinar de qué finca, lote, proveedor o transporte provino "
        "el problema."
    ),
    "conecta": [
        "Productor", "Finca y parcela", "Insumos", "Tratamientos", "Cosecha",
        "Lote", "Transporte", "Temperatura", "Bodega", "Planta",
        "Distribuidor", "Certificaciones",
    ],
    "revela": [
        "Historia completa de cada lote",
        "Origen de una contaminación identificado",
        "Retiro selectivo de productos",
        "Certificaciones y cadena de custodia validadas",
        "Evidencia para exportación",
    ],
    "indicadores": [
        "Tiempo para rastrear un lote", "Trazabilidad completa (%)",
        "Pérdida evitada durante un retiro",
        "Documentación incompleta por proveedor", "Evidencia de exportación",
    ],
    "referencia": (
        "SourceTrace (reseñada por la FAO) registra el recorrido finca → "
        "punto de venta y acelera identificación de origen y retiros."
    ),
}

LEYENDA = {
    "Productor": "Agricultor o asociación",
    "Finca": "Unidad productiva",
    "Parcela": "Subdivisión de la finca",
    "Insumo": "Agroquímico, fertilizante o biocontrol",
    "Tratamiento": "Aplicación de un insumo",
    "Cosecha": "Evento de recolección",
    "Lote": "Unidad trazable de producto",
    "Transporte": "Tramo logístico (con temperatura)",
    "Bodega": "Almacenamiento intermedio",
    "Planta": "Procesamiento / mezcla",
    "Distribuidor": "Canal mayorista",
    "PuntoVenta": "Retail final",
    "Certificacion": "Sello de la finca (orgánico, comercio justo…)",
}

FINCAS = [
    ("Finca Santa Elena", "Península de Santa Elena"),
    ("Finca Valle Verde", "Los Ríos"),
    ("Finca Río Claro", "Guayas"),
    ("Finca La Esperanza", "Manabí"),
    ("Finca El Paraíso", "El Oro"),
    ("Finca San Rafael", "Esmeraldas"),
    ("Finca Monteverde", "Bolívar"),
    ("Finca Las Palmas", "Guayas"),
    ("Finca Bella Vista", "Cotopaxi"),
    ("Finca El Rocío", "Azuay"),
]

PRODUCTORES = [
    "Rosa Chiluisa", "Manuel Quimí", "Berta Mendoza", "Aurelio Cedeño",
    "Inés Tigrero", "Ramón Zambrano", "Dolores Anchundia", "Efrén Mera",
    "Narcisa Vera", "Gonzalo Pilay",
]


def seed(db):
    rng = Rng(701)

    productores = [{"nombre": n} for n in PRODUCTORES]
    fincas = [{"nombre": n, "ubicacion": u} for n, u in FINCAS]
    opera = [{"src": PRODUCTORES[i], "dst": FINCAS[i][0]} for i in range(10)]

    prefijos = ["SANTA", "VERDE", "RIO", "ESP", "PAR", "SAN", "MON", "PAL", "BEL", "ROC"]
    parcelas, tiene_parcela = [], []
    for i, (finca, _) in enumerate(FINCAS):
        for j in (1, 2, 3) if prefijos[i] == "SANTA" else (1, 2):
            codigo = f"P-{prefijos[i]}-{j:02d}"
            parcelas.append({"codigo": codigo})
            tiene_parcela.append({"src": finca, "dst": codigo})

    insumos = [
        {"codigo": "AGQ-77", "tipo": "agroquímico"},
        {"codigo": "AGQ-15", "tipo": "agroquímico autorizado"},
        {"codigo": "FERT-12", "tipo": "fertilizante"},
        {"codigo": "FERT-08", "tipo": "fertilizante"},
        {"codigo": "FERT-21", "tipo": "fertilizante"},
        {"codigo": "BIO-03", "tipo": "biocontrol"},
    ]

    # ── Tratamientos: los plantados primero, luego fondo ────────────────
    tratamientos, aplicado_en, usa_insumo = [], [], []

    def tratamiento(codigo, parcela, insumo, producto, fecha):
        tratamientos.append({"codigo": codigo, "producto": producto, "fecha": fecha})
        aplicado_en.append({"src": codigo, "dst": parcela, "fecha": fecha})
        usa_insumo.append({"src": codigo, "dst": insumo})

    tratamiento("T-101", "P-SANTA-03", "AGQ-77", "fungicida no autorizado", "2026-02-10")
    tratamiento("T-102", "P-SANTA-03", "FERT-12", "fertilizante NPK", "2026-01-22")
    tratamiento("T-103", "P-VERDE-01", "AGQ-77", "fungicida no autorizado", "2026-02-18")
    tratamiento("T-104", "P-VERDE-01", "FERT-08", "fertilizante orgánico", "2026-01-30")
    tratamiento("T-105", "P-RIO-02", "BIO-03", "control biológico", "2026-02-05")
    tratamiento("T-106", "P-RIO-01", "BIO-03", "control biológico", "2026-02-07")
    tratamiento("T-107", "P-RIO-01", "FERT-21", "fertilizante potásico", "2026-01-15")

    benignos = ["AGQ-15", "FERT-12", "FERT-08", "FERT-21", "BIO-03"]
    fondo_parcelas = [p["codigo"] for p in parcelas if p["codigo"] not in
                      ("P-SANTA-03", "P-VERDE-01", "P-RIO-01", "P-RIO-02")]
    n = 108
    for parcela in fondo_parcelas:
        for _ in range(rng.randint(1, 2)):
            tratamiento(f"T-{n}", parcela, rng.choice(benignos),
                        "aplicación de rutina", rng.fecha(mes_ini=1, mes_fin=3))
            n += 1

    # ── Cosechas y lotes ────────────────────────────────────────────────
    # PRODUCE: cosecha → lote físico inmediato. APORTA_A: linaje
    # materializado cosecha → lote comercializable final (para lotes
    # mezclados en planta apunta al compuesto). Es la arista que hace la
    # trazabilidad consultable sin OR ni caminos variables.
    cosechas, lotes, cosechada_de, produce, aporta = [], [], [], [], []

    def lote(numero, parcela, estado, fecha, vendible=True):
        lcod, ccod = f"L-2026-{numero:04d}", f"C-2026-{numero:04d}"
        cosechas.append({"codigo": ccod, "fecha": fecha})
        lotes.append({"codigo": lcod, "estado": estado})
        cosechada_de.append({"src": ccod, "dst": parcela})
        produce.append({"src": ccod, "dst": lcod})
        if vendible:
            aporta.append({"src": ccod, "dst": lcod})
        return lcod

    # cadena plantada
    lote(41, "P-SANTA-03", "mezclado", "2026-04-02", vendible=False)  # origen contaminado
    lote(44, "P-RIO-02", "mezclado", "2026-04-03", vendible=False)    # origen limpio
    lote(93, "P-VERDE-01", "alerta", "2026-04-10")         # 2.º positivo en retail
    lote(102, "P-VERDE-01", "en_bodega", "2026-05-06")     # retiro: aún en bodega
    lote(55, "P-SANTA-03", "en_distribuidor", "2026-04-20")  # retiro: en distribuidor
    lotes.append({"codigo": "L-2026-0087", "estado": "alerta"})  # compuesto en planta

    # fondo limpio
    fondo_specs = [
        (10, "P-RIO-01", "exportable"), (21, "P-SAN-01", "vendido"),
        (22, "P-SAN-02", "vendido"), (33, "P-MON-01", "en_distribuidor"),
        (60, "P-ESP-01", "en_planta"), (71, "P-PAR-01", "en_bodega"),
        (74, "P-PAL-01", "vendido"), (78, "P-BEL-01", "en_distribuidor"),
        (81, "P-ROC-01", "vendido"), (84, "P-ESP-02", "en_planta"),
    ]
    for numero, parcela, estado in fondo_specs:
        lote(numero, parcela, estado, rng.fecha(mes_ini=3, mes_fin=5))

    mezclado_en = [
        {"src": "L-2026-0041", "dst": "L-2026-0087"},
        {"src": "L-2026-0044", "dst": "L-2026-0087"},
    ]
    # linaje de las cosechas de origen hacia el lote compuesto
    aporta.append({"src": "C-2026-0041", "dst": "L-2026-0087"})
    aporta.append({"src": "C-2026-0044", "dst": "L-2026-0087"})

    # ── Logística ───────────────────────────────────────────────────────
    transportes = [{"codigo": f"T-CAM-{i:02d}",
                    "temperatura_max": t}
                   for i, t in [(1, 4.5), (2, 4.0), (3, 6.0), (4, 5.5),
                                (5, 6.5), (6, 3.5), (7, 7.0), (9, 14.0), (11, 9.0)]]
    bodegas = [{"nombre": n} for n in ("Bodega Guayas", "Bodega Central", "Bodega Manta")]
    plantas = [{"nombre": n} for n in ("ProCacao Durán", "Planta Norte")]
    distribuidores = [{"nombre": n} for n in ("Distribuidora Sur", "Distribuidora Norte", "ExportCorp")]
    puntos = [{"nombre": n, "ciudad": c} for n, c in [
        ("Mercado Central", "Quito"), ("Supermaxi Norte", "Quito"),
        ("Mi Comisariato", "Guayaquil"), ("Tía Centro", "Cuenca"),
        ("Coral", "Manta"),
    ]]

    transportado, almacenado, procesado, distribuido, vendido = [], [], [], [], []

    def ruta(lcod, transporte=None, bodega=None, planta=None, dist=None, pv=None):
        if transporte:
            transportado.append({"src": lcod, "dst": transporte})
        if bodega:
            almacenado.append({"src": lcod, "dst": bodega})
        if planta:
            procesado.append({"src": lcod, "dst": planta})
        if dist:
            distribuido.append({"src": lcod, "dst": dist})
        if pv:
            vendido.append({"src": lcod, "dst": pv})

    # plantados
    ruta("L-2026-0041", transporte="T-CAM-01", planta="ProCacao Durán")
    ruta("L-2026-0044", transporte="T-CAM-04", planta="ProCacao Durán")
    ruta("L-2026-0087", transporte="T-CAM-03", pv="Mercado Central")   # positivo 1
    ruta("L-2026-0093", transporte="T-CAM-05", dist="Distribuidora Norte", pv="Supermaxi Norte")  # positivo 2
    ruta("L-2026-0102", transporte="T-CAM-06", bodega="Bodega Guayas")  # retirar
    ruta("L-2026-0055", transporte="T-CAM-07", dist="Distribuidora Sur")  # retirar
    ruta("L-2026-0060", transporte="T-CAM-09", planta="ProCacao Durán")  # frío violado (14°)
    ruta("L-2026-0071", transporte="T-CAM-11", bodega="Bodega Central")  # frío violado (9°)
    ruta("L-2026-0010", transporte="T-CAM-02", planta="Planta Norte")    # exportable

    destinos_pv = ["Mi Comisariato", "Tía Centro", "Coral", "Mercado Central"]
    frios = ["T-CAM-01", "T-CAM-02", "T-CAM-03", "T-CAM-04", "T-CAM-05", "T-CAM-06", "T-CAM-07"]
    for numero, _, estado in fondo_specs:
        lcod = f"L-2026-{numero:04d}"
        if lcod in ("L-2026-0060", "L-2026-0071", "L-2026-0010"):
            continue
        destino = {
            "vendido": {"pv": rng.choice(destinos_pv)},
            "en_distribuidor": {"dist": rng.choice(["Distribuidora Sur", "ExportCorp"])},
            "en_bodega": {"bodega": rng.choice(["Bodega Central", "Bodega Manta"])},
            "en_planta": {"planta": "Planta Norte"},
        }[estado]
        ruta(lcod, transporte=rng.choice(frios), **destino)

    certificaciones = [
        {"codigo": "CERT-01", "tipo": "Orgánico UE", "vigente_hasta": "2027-01-15"},
        {"codigo": "CERT-02", "tipo": "Rainforest Alliance", "vigente_hasta": "2026-11-30"},
        {"codigo": "CERT-03", "tipo": "Orgánico UE", "vigente_hasta": "2027-03-01"},
        {"codigo": "CERT-04", "tipo": "Comercio Justo", "vigente_hasta": "2026-12-01"},
        {"codigo": "CERT-05", "tipo": "GlobalG.A.P.", "vigente_hasta": "2026-02-01"},
        {"codigo": "CERT-06", "tipo": "Rainforest Alliance", "vigente_hasta": "2027-05-01"},
    ]
    certificada = [
        {"src": "Finca Santa Elena", "dst": "CERT-01"},
        {"src": "Finca Valle Verde", "dst": "CERT-02"},
        {"src": "Finca Río Claro", "dst": "CERT-03"},
        {"src": "Finca Río Claro", "dst": "CERT-04"},
        {"src": "Finca La Esperanza", "dst": "CERT-05"},
        {"src": "Finca El Paraíso", "dst": "CERT-06"},
    ]

    db.cypher("CREATE CONSTRAINT lote_codigo IF NOT EXISTS FOR (l:Lote) REQUIRE l.codigo IS UNIQUE")
    db.cypher("CREATE CONSTRAINT parcela_codigo IF NOT EXISTS FOR (p:Parcela) REQUIRE p.codigo IS UNIQUE")

    load_nodes(db, "Productor", productores)
    load_nodes(db, "Finca", fincas)
    load_nodes(db, "Parcela", parcelas)
    load_nodes(db, "Insumo", insumos)
    load_nodes(db, "Tratamiento", tratamientos)
    load_nodes(db, "Cosecha", cosechas)
    load_nodes(db, "Lote", lotes)
    load_nodes(db, "Transporte", transportes)
    load_nodes(db, "Bodega", bodegas)
    load_nodes(db, "Planta", plantas)
    load_nodes(db, "Distribuidor", distribuidores)
    load_nodes(db, "PuntoVenta", puntos)
    load_nodes(db, "Certificacion", certificaciones)

    load_edges(db, "Productor", "nombre", "OPERA", "Finca", "nombre", opera)
    load_edges(db, "Finca", "nombre", "TIENE_PARCELA", "Parcela", "codigo", tiene_parcela)
    load_edges(db, "Tratamiento", "codigo", "APLICADO_EN", "Parcela", "codigo", aplicado_en, rel_props=["fecha"])
    load_edges(db, "Tratamiento", "codigo", "USA_INSUMO", "Insumo", "codigo", usa_insumo)
    load_edges(db, "Cosecha", "codigo", "COSECHADA_DE", "Parcela", "codigo", cosechada_de)
    load_edges(db, "Cosecha", "codigo", "PRODUCE", "Lote", "codigo", produce)
    load_edges(db, "Cosecha", "codigo", "APORTA_A", "Lote", "codigo", aporta)
    load_edges(db, "Lote", "codigo", "MEZCLADO_EN", "Lote", "codigo", mezclado_en)
    load_edges(db, "Lote", "codigo", "TRANSPORTADO_POR", "Transporte", "codigo", transportado)
    load_edges(db, "Lote", "codigo", "ALMACENADO_EN", "Bodega", "nombre", almacenado)
    load_edges(db, "Lote", "codigo", "PROCESADO_EN", "Planta", "nombre", procesado)
    load_edges(db, "Lote", "codigo", "DISTRIBUIDO_A", "Distribuidor", "nombre", distribuido)
    load_edges(db, "Lote", "codigo", "VENDIDO_EN", "PuntoVenta", "nombre", vendido)
    load_edges(db, "Finca", "nombre", "CERTIFICADA_CON", "Certificacion", "codigo", certificada)


QUERIES = [
    {
        "id": "historia-del-lote",
        "titulo": "Historia completa del lote en alerta",
        "descripcion": (
            "Del punto de venta hacia atrás: planta, lotes de origen, "
            "cosecha, parcela, tratamientos, finca y productor. Lo que un "
            "retiro tarda días en reconstruir, el grafo lo responde en una "
            "consulta."
        ),
        "cypher": """\
MATCH (l:Lote {codigo: 'L-2026-0087'})
MATCH (o:Lote)-[:MEZCLADO_EN]->(l)
MATCH (c:Cosecha)-[:PRODUCE]->(o)
MATCH (c)-[:COSECHADA_DE]->(p:Parcela)
MATCH (f:Finca)-[:TIENE_PARCELA]->(p)
MATCH (pr:Productor)-[:OPERA]->(f)
MATCH (t:Tratamiento)-[:APLICADO_EN]->(p)
MATCH (t)-[:USA_INSUMO]->(i:Insumo)
OPTIONAL MATCH (l)-[:VENDIDO_EN]->(pv:PuntoVenta)
RETURN l.codigo AS lote_alerta, pv.nombre AS punto_venta,
       o.codigo AS lote_origen, c.codigo AS cosecha, p.codigo AS parcela,
       f.nombre AS finca, pr.nombre AS productor,
       collect(DISTINCT i.codigo) AS insumos_aplicados""",
    },
    {
        "id": "origen-contaminacion",
        "titulo": "Origen de la contaminación",
        "descripcion": (
            "Dos positivos en retail que no comparten finca ni distribuidor. "
            "¿Qué SÍ comparten sus cadenas? El insumo aplicado en campo: la "
            "intersección lo delata."
        ),
        "cypher": """\
MATCH (alerta:Lote {estado: 'alerta'})
MATCH (c:Cosecha)-[:APORTA_A]->(alerta)
MATCH (c)-[:COSECHADA_DE]->(p:Parcela)
MATCH (t:Tratamiento)-[:APLICADO_EN]->(p)
MATCH (t)-[:USA_INSUMO]->(i:Insumo)
RETURN i.codigo AS insumo, i.tipo AS tipo,
       count(DISTINCT alerta) AS lotes_alerta_alcanzados,
       collect(DISTINCT alerta.codigo) AS lotes,
       collect(DISTINCT p.codigo) AS parcelas
ORDER BY lotes_alerta_alcanzados DESC""",
    },
    {
        "id": "retiro-selectivo",
        "titulo": "Retiro selectivo, no masivo",
        "descripcion": (
            "Todo lote cuya cadena tocó el insumo AGQ-77 y aún no está en "
            "alerta: qué es, en qué estado está y dónde interceptarlo hoy. "
            "Se retiran 2 lotes, no toda la producción."
        ),
        "cypher": """\
MATCH (i:Insumo {codigo: 'AGQ-77'})<-[:USA_INSUMO]-(tr:Tratamiento)-[:APLICADO_EN]->(p:Parcela)
MATCH (c:Cosecha)-[:COSECHADA_DE]->(p)
MATCH (c)-[:APORTA_A]->(riesgo:Lote)
WHERE riesgo.estado <> 'alerta'
OPTIONAL MATCH (riesgo)-[:ALMACENADO_EN]->(b:Bodega)
OPTIONAL MATCH (riesgo)-[:DISTRIBUIDO_A]->(d:Distribuidor)
OPTIONAL MATCH (riesgo)-[:VENDIDO_EN]->(pv:PuntoVenta)
RETURN DISTINCT riesgo.codigo AS lote, riesgo.estado AS estado,
       p.codigo AS parcela_origen,
       coalesce(b.nombre, d.nombre, pv.nombre, 'en tránsito') AS interceptar_en""",
    },
    {
        "id": "cadena-frio",
        "titulo": "Cadena de frío violada",
        "descripcion": (
            "Lotes cuyo transporte registró temperatura sobre el límite de "
            "8 °C — con su finca de origen para el reclamo al operador."
        ),
        "cypher": """\
MATCH (l:Lote)-[:TRANSPORTADO_POR]->(t:Transporte)
WHERE t.temperatura_max > 8
MATCH (c:Cosecha)-[:PRODUCE]->(l)
MATCH (c)-[:COSECHADA_DE]->(p:Parcela)
MATCH (f:Finca)-[:TIENE_PARCELA]->(p)
RETURN l.codigo AS lote, l.estado AS estado, t.codigo AS transporte,
       t.temperatura_max AS temperatura_registrada, 8 AS limite,
       f.nombre AS finca_origen
ORDER BY t.temperatura_max DESC""",
    },
    {
        "id": "evidencia-exportacion",
        "titulo": "Evidencia para exportación",
        "descripcion": (
            "El dossier del lote exportable: productor, finca, certificados "
            "y su vigencia, y la temperatura del transporte. Todo con fuente "
            "verificable, listo para el comprador."
        ),
        "cypher": """\
MATCH (l:Lote {codigo: 'L-2026-0010'})
MATCH (c:Cosecha)-[:PRODUCE]->(l)
MATCH (c)-[:COSECHADA_DE]->(p:Parcela)
MATCH (f:Finca)-[:TIENE_PARCELA]->(p)
MATCH (pr:Productor)-[:OPERA]->(f)
MATCH (f)-[:CERTIFICADA_CON]->(cert:Certificacion)
OPTIONAL MATCH (l)-[:TRANSPORTADO_POR]->(tr:Transporte)
RETURN l.codigo AS lote, l.estado AS estado, pr.nombre AS productor,
       f.nombre AS finca, cert.tipo AS certificacion,
       cert.vigente_hasta AS vigente_hasta,
       CASE WHEN cert.vigente_hasta >= '2026-07-13'
            THEN 'vigente' ELSE 'vencida' END AS estado_certificado,
       tr.temperatura_max AS temp_transporte""",
    },
]
