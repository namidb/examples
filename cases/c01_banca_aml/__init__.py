"""Caso 01 — Banca: lavado de activos y redes de fraude."""
from cases.common import Rng, load_edges, load_nodes

META = {
    "numero": 1,
    "slug": "banca-aml",
    "industria": "Banca — Lavado de activos y redes de fraude",
    "titulo": "Siga el dinero, no la alerta.",
    "problema": (
        "Los sistemas tradicionales analizan transacciones individuales y "
        "generan miles de alertas. El fraude real está distribuido entre "
        "cuentas, empresas, dispositivos, beneficiarios y jurisdicciones."
    ),
    "conecta": [
        "Clientes", "Cuentas", "Transferencias", "Beneficiarios",
        "Dispositivos e IP", "Teléfonos", "Empresas y accionistas", "PEP",
        "Listas de vigilancia",
    ],
    "revela": [
        "Cuentas controladas por una misma persona",
        "Transferencias circulares e intermediarios",
        "Empresas “independientes” con dueños comunes",
        "Clientes ligados a dispositivos ya investigados",
        "Caminos del dinero entre instituciones",
    ],
    "indicadores": [
        "Porcentaje de falsas alertas", "Tiempo medio de investigación",
        "Relaciones nuevas encontradas", "Casos vinculados entre sí",
        "Valor monetario expuesto", "Alertas priorizadas correctamente",
    ],
    "referencia": (
        "Proyecto Aurora (BIS): hasta 3× más esquemas complejos detectados y "
        "hasta 80 % menos falsos positivos en su prueba de concepto."
    ),
}

LEYENDA = {
    "Persona": "Cliente o beneficiario",
    "Cuenta": "Cuenta bancaria",
    "Empresa": "Persona jurídica",
    "Dispositivo": "Dispositivo / IP de banca digital",
    "Telefono": "Teléfono de contacto",
}


def seed(db):
    rng = Rng(101)

    personas, cuentas, telefonos, dispositivos, empresas = [], [], [], [], []
    titular, usa_disp, usa_tel, accionista, cuenta_emp, transfiere = [], [], [], [], [], []

    # ── Población de fondo ──────────────────────────────────────────────
    for i in range(24):
        nombre = rng.nombre()
        personas.append({
            "nombre": nombre,
            "pep": i in (3, 17),
            "lista_vigilancia": i == 17,
            "ciudad": rng.ciudad(),
        })
        tel = rng.telefono()
        telefonos.append({"numero": tel})
        usa_tel.append({"src": nombre, "dst": tel})
        for _ in range(1 if i % 3 else 2):
            iban = rng.iban()
            cuentas.append({"iban": iban, "banco": rng.choice(["Banco Andino", "Banco del Pacífico Sur", "CoopCentral"])})
            titular.append({"src": nombre, "dst": iban})

    for i in range(9):
        dispositivos.append({"device_id": f"DEV-{1000 + i}", "investigado": i == 8})

    # dispositivos propios: cada cuenta de fondo usa un dispositivo cualquiera
    for cuenta in cuentas:
        usa_disp.append({"src": cuenta["iban"], "dst": rng.choice(dispositivos[:8])["device_id"]})

    # transferencias de fondo (ruido legítimo)
    for _ in range(70):
        a, b = rng.sample(cuentas, 2)
        transfiere.append({
            "src": a["iban"], "dst": b["iban"],
            "monto": rng.randint(80, 4000), "fecha": rng.fecha(),
        })

    # ── Patrón A: anillo de mulas + estructuración ─────────────────────
    # Cuatro titulares "distintos" operados desde el mismo dispositivo; cada
    # mula recibe depósitos bajo el umbral de reporte (500) y reexpide ~95 %
    # a la cuenta del controlador.
    controlador = "Ramiro Balarezo"
    cta_control = "EC00-CTRL-000001"
    personas.append({"nombre": controlador, "pep": False, "lista_vigilancia": False, "ciudad": "Guayaquil"})
    cuentas.append({"iban": cta_control, "banco": "Banco Andino"})
    titular.append({"src": controlador, "dst": cta_control})
    dispositivos.append({"device_id": "DEV-MULA", "investigado": False})
    tel_compartido = "+593 990000001"
    telefonos.append({"numero": tel_compartido})
    usa_tel.append({"src": controlador, "dst": tel_compartido})

    for m in range(4):
        nombre = rng.nombre() + " (mula)"
        iban = f"EC00-MULA-{m:06d}"
        personas.append({"nombre": nombre, "pep": False, "lista_vigilancia": False, "ciudad": "Guayaquil"})
        cuentas.append({"iban": iban, "banco": "Banco Andino"})
        titular.append({"src": nombre, "dst": iban})
        usa_disp.append({"src": iban, "dst": "DEV-MULA"})
        if m < 2:
            usa_tel.append({"src": nombre, "dst": tel_compartido})
        total = 0
        for k in range(6):
            origen = rng.choice(cuentas[: 30])
            monto = rng.randint(380, 495)
            total += monto
            transfiere.append({"src": origen["iban"], "dst": iban, "monto": monto, "fecha": f"2026-03-{10 + k:02d}"})
        transfiere.append({"src": iban, "dst": cta_control, "monto": int(total * 0.95), "fecha": "2026-03-17"})

    # ── Patrón B: ciclo de dinero A→B→C→A ──────────────────────────────
    ciclo = ["EC00-CICLO-00000A", "EC00-CICLO-00000B", "EC00-CICLO-00000C"]
    for j, iban in enumerate(ciclo):
        nombre = rng.nombre()
        personas.append({"nombre": nombre, "pep": False, "lista_vigilancia": False, "ciudad": rng.ciudad()})
        cuentas.append({"iban": iban, "banco": "Banco del Pacífico Sur"})
        titular.append({"src": nombre, "dst": iban})
        usa_disp.append({"src": iban, "dst": rng.choice(dispositivos[:8])["device_id"]})
    transfiere += [
        {"src": ciclo[0], "dst": ciclo[1], "monto": 12000, "fecha": "2026-04-02"},
        {"src": ciclo[1], "dst": ciclo[2], "monto": 11800, "fecha": "2026-04-03"},
        {"src": ciclo[2], "dst": ciclo[0], "monto": 11650, "fecha": "2026-04-04"},
    ]

    # ── Patrón C: empresas “independientes” con accionista común ───────
    for e in range(3):
        nombre_emp = f"{'Comercial Delta,Importadora Delta,Logística Delta'.split(',')[e]}"
        iban = f"EC00-EMP-{e:06d}"
        empresas.append({"nombre": nombre_emp, "ruc": rng.ruc(), "ciudad": "Quito"})
        cuentas.append({"iban": iban, "banco": "CoopCentral"})
        cuenta_emp.append({"src": nombre_emp, "dst": iban})
        accionista.append({"src": controlador, "dst": nombre_emp, "pct": [60, 55, 70][e]})
    otros_socios = rng.sample([p["nombre"] for p in personas[:24]], 3)
    for e, socio in enumerate(otros_socios):
        accionista.append({"src": socio, "dst": empresas[e]["nombre"], "pct": 100 - [60, 55, 70][e]})
    transfiere += [
        {"src": "EC00-EMP-000000", "dst": "EC00-EMP-000001", "monto": 8400, "fecha": "2026-05-05"},
        {"src": "EC00-EMP-000001", "dst": "EC00-EMP-000002", "monto": 7900, "fecha": "2026-05-08"},
        {"src": "EC00-EMP-000000", "dst": "EC00-EMP-000002", "monto": 9100, "fecha": "2026-05-12"},
        {"src": "EC00-EMP-000002", "dst": cta_control, "monto": 15300, "fecha": "2026-05-15"},
    ]

    # empresas de fondo
    for _ in range(4):
        nombre_emp = rng.empresa()
        iban = rng.iban()
        empresas.append({"nombre": nombre_emp, "ruc": rng.ruc(), "ciudad": rng.ciudad()})
        cuentas.append({"iban": iban, "banco": rng.choice(["Banco Andino", "CoopCentral"])})
        cuenta_emp.append({"src": nombre_emp, "dst": iban})
        accionista.append({"src": rng.choice(personas[:24])["nombre"], "dst": nombre_emp, "pct": 100})

    # ── Patrón D: dispositivo ya investigado tocando clientes “limpios” ─
    limpio = rng.choice(cuentas[:30])
    usa_disp.append({"src": limpio["iban"], "dst": "DEV-1008"})

    db.cypher("CREATE CONSTRAINT persona_nombre IF NOT EXISTS FOR (p:Persona) REQUIRE p.nombre IS UNIQUE")
    db.cypher("CREATE CONSTRAINT cuenta_iban IF NOT EXISTS FOR (c:Cuenta) REQUIRE c.iban IS UNIQUE")

    load_nodes(db, "Persona", personas)
    load_nodes(db, "Cuenta", cuentas)
    load_nodes(db, "Empresa", empresas)
    load_nodes(db, "Dispositivo", dispositivos)
    load_nodes(db, "Telefono", telefonos)
    load_edges(db, "Persona", "nombre", "TITULAR_DE", "Cuenta", "iban", titular)
    load_edges(db, "Empresa", "nombre", "TITULAR_DE", "Cuenta", "iban", cuenta_emp)
    load_edges(db, "Persona", "nombre", "ACCIONISTA_DE", "Empresa", "nombre", accionista, rel_props=["pct"])
    load_edges(db, "Cuenta", "iban", "USA_DISPOSITIVO", "Dispositivo", "device_id", usa_disp)
    load_edges(db, "Persona", "nombre", "USA_TELEFONO", "Telefono", "numero", usa_tel)
    load_edges(db, "Cuenta", "iban", "TRANSFIERE", "Cuenta", "iban", transfiere, rel_props=["monto", "fecha"])


QUERIES = [
    {
        "id": "anillo-dispositivos",
        "titulo": "Cuentas controladas por una misma persona",
        "descripcion": (
            "Titulares supuestamente distintos cuyas cuentas se operan desde "
            "el mismo dispositivo — la firma clásica de un anillo de mulas."
        ),
        "cypher": """\
MATCH (p:Persona)-[:TITULAR_DE]->(c:Cuenta)-[:USA_DISPOSITIVO]->(d:Dispositivo)
WITH d, collect(DISTINCT p.nombre) AS titulares, count(DISTINCT c) AS cuentas
WHERE size(titulares) > 2
RETURN d.device_id AS dispositivo, cuentas, titulares
ORDER BY cuentas DESC""",
    },
    {
        "id": "ciclos-de-dinero",
        "titulo": "Transferencias circulares",
        "descripcion": (
            "El dinero que vuelve a su origen tras 3–4 saltos no aparece "
            "mirando transacciones una por una; el grafo lo enumera."
        ),
        "cypher": """\
MATCH (a:Cuenta)-[t1:TRANSFIERE]->(b:Cuenta)-[t2:TRANSFIERE]->(c:Cuenta)-[t3:TRANSFIERE]->(a)
WHERE a.iban < b.iban AND a.iban < c.iban
  AND t1.monto > 5000
RETURN a.iban AS cuenta_a, b.iban AS cuenta_b, c.iban AS cuenta_c,
       t1.monto AS monto_1, t2.monto AS monto_2, t3.monto AS monto_3
ORDER BY monto_1 DESC
LIMIT 5""",
    },
    {
        "id": "estructuracion",
        "titulo": "Estructuración (smurfing)",
        "descripcion": (
            "Cuentas que reciben muchos depósitos bajo el umbral de reporte "
            "y reexpiden casi todo a un mismo destino."
        ),
        "cypher": """\
MATCH (o:Cuenta)-[t:TRANSFIERE]->(m:Cuenta)
WHERE t.monto < 500
WITH m, count(t) AS entradas_pequenas, sum(t.monto) AS total_entrante
WHERE entradas_pequenas >= 5
MATCH (m)-[s:TRANSFIERE]->(destino:Cuenta)
WHERE s.monto >= total_entrante * 0.8
MATCH (p:Persona)-[:TITULAR_DE]->(m)
RETURN m.iban AS cuenta_mula, p.nombre AS titular,
       entradas_pequenas, total_entrante,
       destino.iban AS reexpide_a, s.monto AS monto_salida
ORDER BY total_entrante DESC""",
    },
    {
        "id": "empresas-hermanas",
        "titulo": "Empresas “independientes” con dueños comunes",
        "descripcion": (
            "Sociedades que facturan entre sí y comparten accionista: "
            "concentración disfrazada de competencia."
        ),
        "cypher": """\
MATCH (p:Persona)-[a1:ACCIONISTA_DE]->(e1:Empresa),
      (p)-[a2:ACCIONISTA_DE]->(e2:Empresa)
WHERE e1.nombre < e2.nombre
MATCH (e1)-[:TITULAR_DE]->(c1:Cuenta)-[t:TRANSFIERE]->(c2:Cuenta)<-[:TITULAR_DE]-(e2)
RETURN p.nombre AS accionista_comun, e1.nombre AS empresa_a,
       e2.nombre AS empresa_b, count(t) AS transferencias,
       sum(t.monto) AS monto_total""",
    },
    {
        "id": "contagio-investigado",
        "titulo": "Clientes ligados a dispositivos ya investigados",
        "descripcion": (
            "Un dispositivo marcado en una investigación previa conecta, a un "
            "salto, con clientes que hoy parecen limpios."
        ),
        "cypher": """\
MATCH (d:Dispositivo {investigado: true})<-[:USA_DISPOSITIVO]-(c:Cuenta)<-[:TITULAR_DE]-(p:Persona)
OPTIONAL MATCH (c)-[:TRANSFIERE]-(c2:Cuenta)<-[:TITULAR_DE]-(p2:Persona)
RETURN d.device_id AS dispositivo,
       collect(DISTINCT p.nombre) AS usuarios_directos,
       collect(DISTINCT p2.nombre) AS contactos_a_un_salto""",
    },
    {
        "id": "priorizar-alertas",
        "titulo": "Priorización de alertas con PageRank",
        "descripcion": (
            "Las cuentas más centrales de la red de transferencias primero: "
            "menos falsas alertas, investigaciones que sí importan."
        ),
        "cypher": """\
CALL algo.pagerank({labels: ['Cuenta'], edge_types: ['TRANSFIERE']})
YIELD node_id, score
WITH node_id AS cta, score
MATCH (p:Persona)-[:TITULAR_DE]->(cta)
MATCH (c:Cuenta) WHERE id(c) = id(cta)
RETURN DISTINCT c.iban AS cuenta, p.nombre AS titular,
       round(score * 10000) / 10000 AS score
ORDER BY score DESC
LIMIT 8""",
    },
]
