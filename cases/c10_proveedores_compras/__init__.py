"""Caso 10 — Industria: inteligencia de proveedores y compras."""
from cases.common import Rng, load_edges, load_nodes

META = {
    "numero": 10,
    "slug": "proveedores-compras",
    "industria": "Industria — Inteligencia de proveedores y compras",
    "titulo": "Un proveedor, una sola verdad.",
    "problema": (
        "El mismo proveedor aparece con distintos nombres o códigos en varios "
        "ERP. Eso oculta el gasto consolidado, la dependencia, los riesgos y "
        "las oportunidades de negociación."
    ),
    "conecta": [
        "Proveedores", "Grupos empresariales", "Materias primas",
        "Órdenes de compra", "Contratos", "Plantas", "Precios", "Riesgos",
        "Certificaciones", "Sostenibilidad", "Alternativas",
    ],
    "revela": [
        "Proveedores duplicados entre ERPs",
        "Gasto consolidado descubierto",
        "Dependencia de proveedores críticos",
        "Compras posteriores al vencimiento del contrato",
        "Alternativas de suministro encontradas",
    ],
    "indicadores": [
        "Proveedores duplicados", "Gasto consolidado descubierto",
        "Dependencia de proveedores críticos",
        "Tiempo para preparar una negociación",
        "Alternativas de suministro encontradas",
        "Contratos o certificados vencidos",
    ],
    "referencia": (
        "ALTANA consolidó compras de 35 sistemas ERP con una base de grafos; "
        "predicciones de precios con ~5 % de desviación."
    ),
}

LEYENDA = {
    "Proveedor": "Registro de proveedor en un ERP",
    "GrupoEmpresarial": "Grupo o holding",
    "MateriaPrima": "Material comprado",
    "OrdenCompra": "Orden de compra (por sistema)",
    "Contrato": "Contrato marco",
    "Certificado": "Certificación vigente o vencida",
    "Planta": "Planta que origina la compra",
    "Riesgo": "Exposición identificada",
}

RUC_ACEROS = "1790012345001"
HOY = "2026-07-13"


def seed(db):
    rng = Rng(1001)

    proveedores, grupos, materias, ordenes = [], [], [], []
    contratos, certificados, plantas, riesgos = [], [], [], []
    pertenece, suministra, emitida, desde_planta = [], [], [], []
    por_materia, con_contrato, con_certificado, expuesto = [], [], [], []

    plantas = [{"nombre": n} for n in ("Planta Guayaquil", "Planta Quito", "Planta Manta")]

    # ── El mismo proveedor real, tres veces (uno por ERP) ───────────────
    aliases = [
        {"nombre": "Aceros Andinos S.A.", "codigo_erp": "SAP-100234", "sistema": "SAP", "ruc": RUC_ACEROS},
        {"nombre": "ACEROS ANDINOS", "codigo_erp": "ORA-55871", "sistema": "Oracle", "ruc": RUC_ACEROS},
        {"nombre": "Aceros Andinos Cía. Ltda.", "codigo_erp": "ODO-00918", "sistema": "Odoo", "ruc": RUC_ACEROS},
    ]
    proveedores += aliases

    grupos.append({"nombre": "Holding Acero Sur"})
    for alias in aliases:
        pertenece.append({"src": alias["codigo_erp"], "dst": "Holding Acero Sur"})

    hermano = {"nombre": "Metalmecánica Austral", "codigo_erp": "SAP-100901", "sistema": "SAP", "ruc": rng.ruc()}
    proveedores.append(hermano)
    pertenece.append({"src": hermano["codigo_erp"], "dst": "Holding Acero Sur"})

    # ── Materias primas ─────────────────────────────────────────────────
    nombres_materias = [
        ("plancha de acero naval", True),
        ("válvulas industriales", True),
        ("resina epóxica", False),
        ("cable de cobre 10 AWG", False),
        ("rodamientos 6205", False),
        ("pintura anticorrosiva", False),
        ("perfiles de aluminio", False),
        ("empaques de nitrilo", False),
    ]
    materias = [{"nombre": n, "critica": c} for n, c in nombres_materias]

    # Los tres alias "suministran" la plancha (es el mismo proveedor real).
    for alias, precio in zip(aliases, (1180.0, 1195.0, 1210.0)):
        suministra.append({"src": alias["codigo_erp"], "dst": "plancha de acero naval", "precio_unitario": precio})

    # ── Alternativa calificada, certificada, sin órdenes todavía ───────
    alternativa = {"nombre": "Siderúrgica del Litoral", "codigo_erp": "SAP-101777", "sistema": "SAP", "ruc": rng.ruc()}
    proveedores.append(alternativa)
    suministra.append({"src": alternativa["codigo_erp"], "dst": "plancha de acero naval", "precio_unitario": 1085.0})
    certificados.append({"tipo": "ISO 9001", "vence": "2027-06-30"})
    con_certificado.append({"src": alternativa["codigo_erp"], "dst": "ISO 9001"})

    # ── Proveedores de fondo ────────────────────────────────────────────
    sistemas = ["SAP", "Oracle", "Odoo"]
    fondo = []
    for i in range(12):
        p = {
            "nombre": rng.empresa(),
            "codigo_erp": f"{rng.choice(sistemas)[:3].upper()}-{200000 + i}",
            "sistema": sistemas[i % 3],
            "ruc": rng.ruc(),
        }
        fondo.append(p)
        proveedores.append(p)
        # Solo materias no críticas: la dependencia plantada debe quedar limpia.
        no_criticas = [m["nombre"] for m in materias if not m["critica"]]
        for materia in rng.sample(no_criticas, rng.randint(1, 3)):
            suministra.append({"src": p["codigo_erp"], "dst": materia, "precio_unitario": round(rng.uniform(8, 900), 2)})

    grupos += [{"nombre": "Grupo Industrial Cóndor"}, {"nombre": "Corporación del Valle"}]
    pertenece.append({"src": fondo[0]["codigo_erp"], "dst": "Grupo Industrial Cóndor"})
    pertenece.append({"src": fondo[1]["codigo_erp"], "dst": "Corporación del Valle"})

    # "válvulas industriales" (crítica) con DOS proveedores reales — contraste
    # para que la dependencia real sea solo la plancha.
    for p in fondo[2:4]:
        suministra.append({"src": p["codigo_erp"], "dst": "válvulas industriales", "precio_unitario": round(rng.uniform(300, 350), 2)})

    # ── Contratos ───────────────────────────────────────────────────────
    contratos.append({"codigo": "CT-ORA-2201", "vence": "2026-02-28"})  # vencido
    con_contrato.append({"src": "ORA-55871", "dst": "CT-ORA-2201"})
    contratos.append({"codigo": "CT-SAP-1088", "vence": "2026-12-31"})
    con_contrato.append({"src": "SAP-100234", "dst": "CT-SAP-1088"})
    for i, p in enumerate(fondo[:8]):
        codigo = f"CT-{p['codigo_erp']}"
        contratos.append({"codigo": codigo, "vence": "2026-12-31"})
        con_contrato.append({"src": p["codigo_erp"], "dst": codigo})

    certificados.append({"tipo": "ISO 14001", "vence": "2026-03-31"})  # vencido
    con_certificado.append({"src": fondo[5]["codigo_erp"], "dst": "ISO 14001"})

    riesgos.append({"tipo": "dependencia de proveedor único", "nivel": "alto"})
    riesgos.append({"tipo": "riesgo cambiario", "nivel": "medio"})
    for alias in aliases:
        expuesto.append({"src": alias["codigo_erp"], "dst": "dependencia de proveedor único"})
    expuesto.append({"src": fondo[6]["codigo_erp"], "dst": "riesgo cambiario"})

    # ── Órdenes de compra ───────────────────────────────────────────────
    contador = [1000]

    def orden(codigo_erp, sistema, materia, monto, fecha):
        contador[0] += 1
        numero = f"OC-{sistema[:3].upper()}-{contador[0]}"
        ordenes.append({"numero": numero, "monto": monto, "fecha": fecha, "sistema": sistema})
        emitida.append({"src": numero, "dst": codigo_erp})
        desde_planta.append({"src": numero, "dst": rng.choice(plantas)["nombre"]})
        por_materia.append({"src": numero, "dst": materia})

    # Aceros Andinos visto por cada ERP por separado (~950k consolidado).
    for monto, fecha in ((78000, "2026-01-20"), (64000, "2026-02-11"), (81000, "2026-03-07"),
                         (59000, "2026-04-15"), (52000, "2026-05-09"), (46000, "2026-06-02")):
        orden("SAP-100234", "SAP", "plancha de acero naval", monto, fecha)          # ≈ 380k
    for monto, fecha in ((92000, "2026-01-28"), (88000, "2026-02-19"),
                         (67000, "2026-03-15"), (63000, "2026-04-22")):
        orden("ORA-55871", "Oracle", "plancha de acero naval", monto, fecha)        # ≈ 310k (2 post-contrato)
    for monto, fecha in ((95000, "2026-02-05"), (86000, "2026-04-03"), (79000, "2026-06-11")):
        orden("ODO-00918", "Odoo", "plancha de acero naval", monto, fecha)          # ≈ 260k

    # El "top-1" aparente en cualquier vista por nombre: Química Nacional.
    quimica = fondo[0]
    for monto, fecha in ((110000, "2026-01-15"), (105000, "2026-02-20"),
                         (98000, "2026-04-08"), (107000, "2026-05-27")):
        orden(quimica["codigo_erp"], quimica["sistema"], "resina epóxica", monto, fecha)  # ≈ 420k

    # Válvulas con DOS proveedores reales activos: contraste de la dependencia.
    orden(fondo[2]["codigo_erp"], fondo[2]["sistema"], "válvulas industriales", 28000, "2026-03-19")
    orden(fondo[3]["codigo_erp"], fondo[3]["sistema"], "válvulas industriales", 31000, "2026-05-06")

    for _ in range(36):
        p = rng.choice(fondo)
        materia = rng.choice([s["dst"] for s in suministra if s["src"] == p["codigo_erp"]] or ["empaques de nitrilo"])
        orden(p["codigo_erp"], p["sistema"], materia, rng.randint(4000, 60000), rng.fecha())

    db.cypher("CREATE CONSTRAINT prov_codigo IF NOT EXISTS FOR (p:Proveedor) REQUIRE p.codigo_erp IS UNIQUE")
    db.cypher("CREATE CONSTRAINT oc_numero IF NOT EXISTS FOR (o:OrdenCompra) REQUIRE o.numero IS UNIQUE")

    load_nodes(db, "Proveedor", proveedores)
    load_nodes(db, "GrupoEmpresarial", grupos)
    load_nodes(db, "MateriaPrima", materias)
    load_nodes(db, "OrdenCompra", ordenes)
    load_nodes(db, "Contrato", contratos)
    load_nodes(db, "Certificado", certificados)
    load_nodes(db, "Planta", plantas)
    load_nodes(db, "Riesgo", riesgos)

    load_edges(db, "Proveedor", "codigo_erp", "PERTENECE_A", "GrupoEmpresarial", "nombre", pertenece)
    load_edges(db, "Proveedor", "codigo_erp", "SUMINISTRA", "MateriaPrima", "nombre", suministra, rel_props=["precio_unitario"])
    load_edges(db, "OrdenCompra", "numero", "EMITIDA_A", "Proveedor", "codigo_erp", emitida)
    load_edges(db, "OrdenCompra", "numero", "DESDE_PLANTA", "Planta", "nombre", desde_planta)
    load_edges(db, "OrdenCompra", "numero", "POR_MATERIA", "MateriaPrima", "nombre", por_materia)
    load_edges(db, "Proveedor", "codigo_erp", "CON_CONTRATO", "Contrato", "codigo", con_contrato)
    load_edges(db, "Proveedor", "codigo_erp", "CON_CERTIFICADO", "Certificado", "tipo", con_certificado)
    load_edges(db, "Proveedor", "codigo_erp", "EXPUESTO_A", "Riesgo", "tipo", expuesto)


QUERIES = [
    {
        "id": "proveedores-duplicados",
        "titulo": "Proveedores duplicados entre ERPs",
        "descripcion": (
            "El mismo RUC registrado con nombres y códigos distintos en cada "
            "sistema: tres registros, un solo proveedor real."
        ),
        "cypher": """\
MATCH (p:Proveedor)
WITH p.ruc AS ruc, collect(DISTINCT p.nombre) AS nombres,
     collect(DISTINCT p.sistema) AS sistemas, count(*) AS registros
WHERE registros > 1
RETURN ruc, registros, sistemas, nombres
ORDER BY registros DESC""",
    },
    {
        "id": "gasto-consolidado",
        "titulo": "Gasto consolidado descubierto",
        "descripcion": (
            "Cada ERP ve compras parciales; agrupando por RUC aparece el "
            "proveedor número uno real, invisible en cualquier sistema aislado."
        ),
        "cypher": """\
MATCH (oc:OrdenCompra)-[:EMITIDA_A]->(p:Proveedor)
WITH p.ruc AS ruc, sum(oc.monto) AS gasto_total, count(oc) AS ordenes,
     collect(DISTINCT p.nombre) AS visto_como,
     collect(DISTINCT p.sistema) AS sistemas
RETURN ruc, gasto_total, ordenes, sistemas, visto_como
ORDER BY gasto_total DESC
LIMIT 5""",
    },
    {
        "id": "dependencia-critica",
        "titulo": "Dependencia de proveedores críticos",
        "descripcion": (
            "Materias primas críticas cuyas compras van a un único proveedor "
            "real — aunque en los ERP parezcan varios."
        ),
        "cypher": """\
MATCH (m:MateriaPrima {critica: true})<-[:POR_MATERIA]-(oc:OrdenCompra)-[:EMITIDA_A]->(p:Proveedor)
WITH m.nombre AS materia, count(DISTINCT p.ruc) AS proveedores_reales,
     collect(DISTINCT p.nombre) AS registrados_como, sum(oc.monto) AS gasto
WHERE proveedores_reales = 1
RETURN materia, proveedores_reales, gasto, registrados_como""",
    },
    {
        "id": "compras-fuera-contrato",
        "titulo": "Órdenes posteriores al vencimiento del contrato",
        "descripcion": (
            "Compras emitidas después de que venció el contrato marco del "
            "proveedor: riesgo jurídico y de precio que nadie estaba viendo."
        ),
        "cypher": """\
MATCH (oc:OrdenCompra)-[:EMITIDA_A]->(p:Proveedor)-[:CON_CONTRATO]->(ct:Contrato)
WHERE oc.fecha > ct.vence
RETURN p.nombre AS proveedor, p.sistema AS sistema, ct.codigo AS contrato,
       ct.vence AS vencio, oc.numero AS orden, oc.fecha AS emitida,
       oc.monto AS monto
ORDER BY oc.fecha""",
    },
    {
        "id": "alternativas-negociacion",
        "titulo": "Alternativas de suministro para negociar",
        "descripcion": (
            "Para la materia crítica dependiente de un solo proveedor: "
            "alternativas certificadas, su precio y el ahorro unitario."
        ),
        "cypher": """\
MATCH (ocx:OrdenCompra)-[:EMITIDA_A]->(px:Proveedor)
WITH collect(DISTINCT px.codigo_erp) AS con_ordenes
MATCH (m:MateriaPrima {critica: true})<-[:POR_MATERIA]-(oc:OrdenCompra)-[:EMITIDA_A]->(actual:Proveedor)
MATCH (m)<-[sa:SUMINISTRA]-(actual)
WITH con_ordenes, m.nombre AS materia, max(sa.precio_unitario) AS precio_actual
MATCH (m2:MateriaPrima {nombre: materia})<-[salt:SUMINISTRA]-(alt:Proveedor)
MATCH (alt)-[:CON_CERTIFICADO]->(c:Certificado)
WHERE c.vence > '2026-07-13' AND NOT alt.codigo_erp IN con_ordenes
RETURN materia, alt.nombre AS alternativa, c.tipo AS certificado,
       c.vence AS certificado_vigente_hasta,
       salt.precio_unitario AS precio_alternativa, precio_actual,
       round((precio_actual - salt.precio_unitario) * 100) / 100 AS ahorro_unitario""",
    },
]
