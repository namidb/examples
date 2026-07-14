"""Caso 08 — Agro: cumplimiento ambiental y acceso a mercados."""
from cases.common import Rng, load_edges, load_nodes

META = {
    "numero": 8,
    "slug": "agro-cumplimiento",
    "industria": "Agro — Cumplimiento ambiental y acceso a mercados",
    "titulo": "La trazabilidad como ventaja comercial.",
    "problema": (
        "Exportadores y comercializadores deben demostrar el origen de sus "
        "productos y verificar que los proveedores cumplen requisitos "
        "ambientales, sanitarios y sociales."
    ),
    "conecta": [
        "Parcela georreferenciada", "Productor", "Proveedor", "Producto",
        "Certificación", "Inspector", "Documento", "Vigencia",
        "Zona de riesgo", "Comprador y embarque",
    ],
    "revela": [
        "Embarques con proveedores sin certificación",
        "Documentos vencidos antes del embarque",
        "Territorios que requieren revisión especial",
        "Origen demostrable por producto y proveedor",
    ],
    "indicadores": [
        "Embarques con proveedores sin certificación",
        "Documentos vencidos antes del embarque",
        "Territorios que requieren revisión especial",
        "Origen demostrable por producto y proveedor",
    ],
    "referencia": (
        "La FAO documenta iniciativas que combinan cadenas productivas con "
        "monitoreo geoespacial para cadenas libres de deforestación."
    ),
}

LEYENDA = {
    "Zona": "Territorio con nivel de riesgo de deforestación",
    "Parcela": "Parcela georreferenciada",
    "Productor": "Agricultor",
    "Proveedor": "Acopiador / exportador local",
    "Producto": "Lote de producto exportable",
    "Certificacion": "Certificación con vigencia",
    "Inspector": "Verificador de la certificación",
    "Documento": "Documento que respalda un embarque",
    "Embarque": "Embarque de exportación",
    "Comprador": "Comprador internacional",
}

_GEO = "9q8yy,9q8yz,9q8zn,9q9p1,9q9p3,9q9p4,9q9p5,9q9p6,9q9p7,9q9p8"


def seed(db):
    rng = Rng(801)

    zonas = [
        {"nombre": "Cordillera Norte", "riesgo_deforestacion": "alto"},
        {"nombre": "Valle Central", "riesgo_deforestacion": "bajo"},
        {"nombre": "Litoral Sur", "riesgo_deforestacion": "medio"},
        {"nombre": "Piedemonte Oriental", "riesgo_deforestacion": "medio"},
    ]

    parcelas, ubicada, produce, certificaciones, cert_parcela = [], [], [], [], []
    productores, proveedores, acopia, cert_prov, verificada = [], [], [], [], []
    productos, originado, provisto = [], [], []
    embarques, contiene, destino_e, compradores, documentos, respaldado = [], [], [], [], [], []

    inspectores = [{"nombre": f"Insp. {rng.nombre()}"} for _ in range(4)]
    geohashes = _GEO.split(",")

    # ── Productores y parcelas de fondo (zonas de bajo/medio riesgo) ────
    zonas_fondo = ["Valle Central", "Valle Central", "Litoral Sur", "Piedemonte Oriental"]
    cert_seq = 0
    for i in range(16):
        productor = {"nombre": rng.nombre()}
        productores.append(productor)
        parcela = {"codigo": f"PARC-{100 + i}", "geohash": rng.choice(geohashes) + str(i)}
        parcelas.append(parcela)
        ubicada.append({"src": parcela["codigo"], "dst": rng.choice(zonas_fondo)})
        produce.append({"src": productor["nombre"], "dst": parcela["codigo"]})
        # Toda parcela limpia lleva certificación EUDR vigente.
        cert = {
            "codigo": f"CERT-{1000 + cert_seq}", "tipo": "EUDR",
            "vigente_hasta": f"2027-{rng.randint(1, 12):02d}-01",
        }
        cert_seq += 1
        certificaciones.append(cert)
        cert_parcela.append({"src": parcela["codigo"], "dst": cert["codigo"]})
        verificada.append({"src": cert["codigo"], "dst": rng.choice(inspectores)["nombre"]})

    # Parcelas en zona de alto riesgo (una alimenta el embarque plantado).
    for j, codigo in enumerate(["PARC-CN-01", "PARC-CN-02", "PARC-CN-03"]):
        productor = {"nombre": rng.nombre()}
        productores.append(productor)
        parcelas.append({"codigo": codigo, "geohash": f"6gkzw{j}"})
        ubicada.append({"src": codigo, "dst": "Cordillera Norte"})
        produce.append({"src": productor["nombre"], "dst": codigo})
        # Sin certificación EUDR: es exactamente lo que el mapa debe revelar.

    # ── Proveedores ─────────────────────────────────────────────────────
    nombres_prov = [
        "Exportadora Cumbre", "Acopios del Norte", "AgroExport Pacífico",
        "Cacao Fino del Valle", "Comercial Litoral", "Andina Trading",
    ]
    for k, nombre in enumerate(nombres_prov):
        proveedores.append({"nombre": nombre})
        for _ in range(2):
            acopia.append({"src": nombre, "dst": rng.choice(productores)["nombre"]})
        if nombre == "Acopios del Norte":
            # Certificación VENCIDA antes del embarque plantado (2026-06-20).
            cert = {"codigo": f"CERT-{1000 + cert_seq}", "tipo": "Orgánica", "vigente_hasta": "2026-05-01"}
        else:
            cert = {
                "codigo": f"CERT-{1000 + cert_seq}",
                "tipo": rng.choice(["EUDR", "Orgánica", "Comercio Justo"]),
                "vigente_hasta": f"2027-{rng.randint(1, 12):02d}-15",
            }
        cert_seq += 1
        certificaciones.append(cert)
        cert_prov.append({"src": nombre, "dst": cert["codigo"]})
        verificada.append({"src": cert["codigo"], "dst": rng.choice(inspectores)["nombre"]})

    # ── Compradores ─────────────────────────────────────────────────────
    compradores += [
        {"nombre": "Cacao Trade BV", "pais": "Países Bajos", "region": "UE"},
        {"nombre": "Hamburg Kakao GmbH", "pais": "Alemania", "region": "UE"},
        {"nombre": "Andes Export Partners", "pais": "Bélgica", "region": "UE"},
        {"nombre": "Pacific Foods Inc", "pais": "Estados Unidos", "region": "EEUU"},
        {"nombre": "Tokyo Cocoa KK", "pais": "Japón", "region": "Asia"},
    ]

    # ── Embarques limpios de fondo ──────────────────────────────────────
    limpio_specs = [
        ("EXP-2026-101", "2026-04-18", "Hamburgo", "Hamburg Kakao GmbH", "café"),
        ("EXP-2026-102", "2026-05-09", "Yokohama", "Tokyo Cocoa KK", "banano"),
        ("EXP-2026-103", "2026-06-02", "Los Ángeles", "Pacific Foods Inc", "cacao"),
    ]
    proveedores_ok = [p["nombre"] for p in proveedores if p["nombre"] != "Acopios del Norte"]
    parcelas_ok = [p["codigo"] for p in parcelas if not p["codigo"].startswith("PARC-CN")]
    seq = 700
    for codigo, fecha, destino, comprador, tipo in limpio_specs:
        embarques.append({"codigo": codigo, "fecha": fecha, "destino": destino})
        destino_e.append({"src": codigo, "dst": comprador})
        for _ in range(4):
            producto = {"codigo": f"P-{tipo.upper()}-{seq}", "tipo": tipo}
            seq += 1
            productos.append(producto)
            originado.append({"src": producto["codigo"], "dst": rng.choice(parcelas_ok)})
            provisto.append({"src": producto["codigo"], "dst": rng.choice(proveedores_ok)})
            contiene.append({"src": codigo, "dst": producto["codigo"]})
        doc = {"codigo": f"DOC-FIT-{seq}", "tipo": "fitosanitario", "vence": "2026-12-31"}
        documentos.append(doc)
        respaldado.append({"src": codigo, "dst": doc["codigo"]})

    # ── Embarque plantado: EXP-2026-114 ─────────────────────────────────
    embarques.append({"codigo": "EXP-2026-114", "fecha": "2026-06-20", "destino": "Rotterdam"})
    destino_e.append({"src": "EXP-2026-114", "dst": "Cacao Trade BV"})

    plantados = [
        # (producto, parcela, proveedor) — 901: parcela de riesgo sin EUDR;
        # 902: proveedor con certificación vencida; 903/904: cadena limpia.
        ("P-CACAO-901", "PARC-CN-01", "Exportadora Cumbre"),
        ("P-CACAO-902", parcelas_ok[0], "Acopios del Norte"),
        ("P-CACAO-903", parcelas_ok[1], "Cacao Fino del Valle"),
        ("P-CACAO-904", parcelas_ok[2], "AgroExport Pacífico"),
    ]
    for codigo, parcela, proveedor in plantados:
        productos.append({"codigo": codigo, "tipo": "cacao"})
        originado.append({"src": codigo, "dst": parcela})
        provisto.append({"src": codigo, "dst": proveedor})
        contiene.append({"src": "EXP-2026-114", "dst": codigo})

    documentos += [
        {"codigo": "DOC-FIT-889", "tipo": "fitosanitario", "vence": "2026-06-15"},
        {"codigo": "DOC-ORI-889", "tipo": "certificado de origen", "vence": "2026-12-01"},
    ]
    respaldado += [
        {"src": "EXP-2026-114", "dst": "DOC-FIT-889"},
        {"src": "EXP-2026-114", "dst": "DOC-ORI-889"},
    ]

    db.cypher("CREATE CONSTRAINT parcela_codigo IF NOT EXISTS FOR (p:Parcela) REQUIRE p.codigo IS UNIQUE")
    db.cypher("CREATE CONSTRAINT producto_codigo IF NOT EXISTS FOR (p:Producto) REQUIRE p.codigo IS UNIQUE")
    db.cypher("CREATE CONSTRAINT embarque_codigo IF NOT EXISTS FOR (e:Embarque) REQUIRE e.codigo IS UNIQUE")

    load_nodes(db, "Zona", zonas)
    load_nodes(db, "Parcela", parcelas)
    load_nodes(db, "Productor", productores)
    load_nodes(db, "Proveedor", proveedores)
    load_nodes(db, "Producto", productos)
    load_nodes(db, "Certificacion", certificaciones)
    load_nodes(db, "Inspector", inspectores)
    load_nodes(db, "Documento", documentos)
    load_nodes(db, "Embarque", embarques)
    load_nodes(db, "Comprador", compradores)

    load_edges(db, "Parcela", "codigo", "UBICADA_EN", "Zona", "nombre", ubicada)
    load_edges(db, "Productor", "nombre", "PRODUCE_EN", "Parcela", "codigo", produce)
    load_edges(db, "Proveedor", "nombre", "ACOPIA_DE", "Productor", "nombre", acopia)
    load_edges(db, "Producto", "codigo", "ORIGINADO_EN", "Parcela", "codigo", originado)
    load_edges(db, "Producto", "codigo", "PROVISTO_POR", "Proveedor", "nombre", provisto)
    load_edges(db, "Embarque", "codigo", "CONTIENE", "Producto", "codigo", contiene)
    load_edges(db, "Embarque", "codigo", "CON_DESTINO", "Comprador", "nombre", destino_e)
    load_edges(db, "Proveedor", "nombre", "CERTIFICADO_CON", "Certificacion", "codigo", cert_prov)
    load_edges(db, "Parcela", "codigo", "CERTIFICADO_CON", "Certificacion", "codigo", cert_parcela)
    load_edges(db, "Certificacion", "codigo", "VERIFICADA_POR", "Inspector", "nombre", verificada)
    load_edges(db, "Embarque", "codigo", "RESPALDADO_POR", "Documento", "codigo", respaldado)


QUERIES = [
    {
        "id": "embarques-sin-certificacion",
        "titulo": "Embarques con proveedores sin certificación vigente",
        "descripcion": (
            "Antes de embarcar: qué productos dependen de un proveedor cuya "
            "certificación no cubre la fecha del embarque."
        ),
        "cypher": """\
MATCH (e:Embarque)-[:CONTIENE]->(p:Producto)-[:PROVISTO_POR]->(prov:Proveedor)
OPTIONAL MATCH (prov)-[:CERTIFICADO_CON]->(c:Certificacion)
WITH e, p, prov, c
WHERE coalesce(c.vigente_hasta, '0000-00-00') < e.fecha
RETURN e.codigo AS embarque, e.fecha AS fecha_embarque, p.codigo AS producto,
       prov.nombre AS proveedor,
       coalesce(c.vigente_hasta, 'sin certificación') AS certificacion_hasta
ORDER BY embarque""",
    },
    {
        "id": "documentos-vencidos",
        "titulo": "Documentos vencidos antes del embarque",
        "descripcion": (
            "Documentos de respaldo cuya vigencia expira antes de la fecha "
            "de zarpe: el rechazo en puerto se detecta en el mapa, no en la aduana."
        ),
        "cypher": """\
MATCH (e:Embarque)-[:RESPALDADO_POR]->(d:Documento)
WHERE d.vence < e.fecha
RETURN e.codigo AS embarque, e.fecha AS fecha_embarque, e.destino AS destino,
       d.codigo AS documento, d.tipo AS tipo, d.vence AS vence""",
    },
    {
        "id": "territorios-revision",
        "titulo": "Territorios que requieren revisión especial",
        "descripcion": (
            "Productos con destino UE originados en zonas de alto riesgo de "
            "deforestación — el corazón del reglamento EUDR."
        ),
        "cypher": """\
MATCH (e:Embarque)-[:CON_DESTINO]->(comp:Comprador),
      (e)-[:CONTIENE]->(p:Producto)-[:ORIGINADO_EN]->(par:Parcela)-[:UBICADA_EN]->(z:Zona)
WHERE z.riesgo_deforestacion = 'alto' AND comp.region = 'UE'
OPTIONAL MATCH (par)-[:CERTIFICADO_CON]->(c:Certificacion)
RETURN e.codigo AS embarque, p.codigo AS producto, par.codigo AS parcela,
       par.geohash AS geohash, z.nombre AS zona, comp.pais AS destino,
       coalesce(c.tipo, 'SIN CERTIFICACIÓN') AS certificacion""",
    },
    {
        "id": "origen-demostrable",
        "titulo": "Origen demostrable por producto y proveedor",
        "descripcion": (
            "La cadena completa de un producto limpio — parcela, zona, "
            "productor, proveedor, certificación e inspector — lista para el comprador."
        ),
        "cypher": """\
MATCH (p:Producto {codigo: 'P-CACAO-903'})-[:ORIGINADO_EN]->(par:Parcela)-[:UBICADA_EN]->(z:Zona),
      (prod:Productor)-[:PRODUCE_EN]->(par),
      (p)-[:PROVISTO_POR]->(prov:Proveedor)-[:CERTIFICADO_CON]->(c:Certificacion)-[:VERIFICADA_POR]->(i:Inspector)
RETURN p.codigo AS producto, par.codigo AS parcela, par.geohash AS geohash,
       z.nombre AS zona, prod.nombre AS productor, prov.nombre AS proveedor,
       c.tipo AS certificacion, c.vigente_hasta AS vigente_hasta,
       i.nombre AS inspector""",
    },
    {
        "id": "score-embarque",
        "titulo": "Semáforo de embarques",
        "descripcion": (
            "Por embarque: cuántos productos tienen la cadena en regla y "
            "cuántos requieren corrección antes de zarpar."
        ),
        "cypher": """\
MATCH (e:Embarque)-[:CONTIENE]->(p:Producto)-[:PROVISTO_POR]->(prov:Proveedor)
OPTIONAL MATCH (prov)-[:CERTIFICADO_CON]->(c:Certificacion)
WITH e, p, CASE WHEN coalesce(c.vigente_hasta, '0000-00-00') >= e.fecha THEN 0 ELSE 1 END AS problema
WITH e, count(p) AS productos, sum(problema) AS con_problemas
RETURN e.codigo AS embarque, e.fecha AS fecha, productos, con_problemas,
       CASE WHEN con_problemas = 0 THEN 'listo' ELSE 'revisar antes de zarpar' END AS semaforo
ORDER BY con_problemas DESC""",
    },
]
