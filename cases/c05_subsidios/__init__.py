"""Caso 05 — Gobierno: subsidios, beneficios y registros."""
from cases.common import APELLIDOS, Rng, load_edges, load_nodes

META = {
    "numero": 5,
    "slug": "subsidios",
    "industria": "Gobierno — Subsidios, beneficios y registros",
    "titulo": "Un beneficio, un beneficiario.",
    "problema": (
        "Una misma persona o grupo aparece bajo registros diferentes, con "
        "direcciones compartidas, intermediarios o empresas relacionadas, "
        "para acceder indebidamente a beneficios públicos."
    ),
    "conecta": [
        "Beneficiarios", "Identificaciones", "Direcciones", "Teléfonos",
        "Cuentas", "Empresas", "Programas sociales", "Solicitudes", "Pagos",
        "Oficinas tramitadoras",
    ],
    "revela": [
        "Duplicados complejos detectados",
        "Beneficiarios relacionados e intermediarios",
        "Pagos indebidos prevenidos",
        "Trazabilidad completa de la decisión",
        "Auditorías más rápidas",
    ],
    "indicadores": [
        "Duplicados complejos detectados", "Pagos indebidos prevenidos",
        "Trazabilidad completa de la decisión", "Auditorías más rápidas",
    ],
    "referencia": (
        "NamiDB no excluye personas automáticamente: genera relaciones y "
        "alertas explicables para que la institución revise cada caso."
    ),
}

LEYENDA = {
    "Beneficiario": "Persona registrada en un programa social",
    "Direccion": "Domicilio declarado",
    "Telefono": "Teléfono de contacto",
    "Cuenta": "Cuenta de cobro",
    "Programa": "Programa social",
    "Solicitud": "Solicitud de beneficio",
    "Pago": "Pago desembolsado",
    "Oficina": "Oficina tramitadora",
}

PROGRAMAS = [
    {"nombre": "Bono de Desarrollo", "monto": 240},
    {"nombre": "Pensión Adulto Mayor", "monto": 300},
    {"nombre": "Beca Escolar", "monto": 150},
]


def seed(db):
    rng = Rng(501)

    beneficiarios, direcciones, telefonos, cuentas = [], [], [], []
    solicitudes, pagos = [], []
    reside, usa_tel, cobra = [], [], []
    solicita, de_programa, tramitada, genera, depositado = [], [], [], [], []

    oficinas = [{"nombre": f"Oficina Zonal {z}"} for z in (1, 2, 3, 5)]
    monto_de = {p["nombre"]: p["monto"] for p in PROGRAMAS}

    n_sol = 0
    n_pago = 0

    def nueva_solicitud(cedula, programa, oficina, fecha, cuenta_iban):
        nonlocal n_sol, n_pago
        n_sol += 1
        codigo = f"SOL-{n_sol:04d}"
        solicitudes.append({"codigo": codigo, "fecha": fecha, "estado": "aprobada"})
        solicita.append({"src": cedula, "dst": codigo})
        de_programa.append({"src": codigo, "dst": programa})
        tramitada.append({"src": codigo, "dst": oficina})
        n_pago += 1
        pago = f"PAG-{n_pago:04d}"
        pagos.append({"codigo": pago, "monto": monto_de[programa], "fecha": fecha})
        genera.append({"src": codigo, "dst": pago})
        depositado.append({"src": pago, "dst": cuenta_iban})

    # ── Fondo: 25 beneficiarios legítimos ──────────────────────────────
    for i in range(25):
        cedula = f"09{10000000 + i}"
        beneficiarios.append({"nombre": rng.nombre(), "cedula": cedula})

        # dos parejas de fondo comparten SOLO la dirección (familia): la
        # detección exige >= 2 atributos compartidos, así que no disparan.
        if i in (1, 3):
            direccion = direcciones[-1]["direccion"]
        else:
            direccion = f"Av. {rng.choice(APELLIDOS)} N{i:02d}-{rng.randint(10, 99)}, {rng.ciudad()}"
            direcciones.append({"direccion": direccion})
        reside.append({"src": cedula, "dst": direccion})

        telefono = f"+593 9{70000000 + i}"
        telefonos.append({"numero": telefono})
        usa_tel.append({"src": cedula, "dst": telefono})

        iban = f"EC-CTA-{i:04d}"
        cuentas.append({"iban": iban})
        cobra.append({"src": cedula, "dst": iban})

        oficina = f"Oficina Zonal {rng.choice([1, 2, 3] if i < 20 else [5])}"
        for _ in range(1 if i % 3 else 2):
            nueva_solicitud(cedula, rng.choice(PROGRAMAS)["nombre"], oficina,
                            rng.fecha(), iban)

    # ── Plantado A: la misma persona bajo 3 registros ──────────────────
    maria = [
        ("María Chicaiza Toapanta", "0912345601"),
        ("Maria E. Chicaiza", "1712345602"),
        ("M. Elena Chicaiza T.", "0612345603"),
    ]
    dir_maria = "Av. Quitumbe S/N y Amaru Ñan, Quito"
    tel_maria = "+593 987654321"
    cta_maria = "EC-MARIA-7788"
    direcciones.append({"direccion": dir_maria})
    telefonos.append({"numero": tel_maria})
    cuentas.append({"iban": cta_maria})
    for k, (nombre, cedula) in enumerate(maria):
        beneficiarios.append({"nombre": nombre, "cedula": cedula})
        reside.append({"src": cedula, "dst": dir_maria})
        usa_tel.append({"src": cedula, "dst": tel_maria})
        cobra.append({"src": cedula, "dst": cta_maria})
        nueva_solicitud(cedula, "Bono de Desarrollo", "Oficina Zonal 5",
                        f"2026-02-{10 + k:02d}", cta_maria)

    # ── Plantado B: cuenta intermediaria que cobra por 4 personas ──────
    cta_inter = "EC-INTER-0001"
    cuentas.append({"iban": cta_inter})
    programas_inter = ["Bono de Desarrollo", "Bono de Desarrollo",
                       "Pensión Adulto Mayor", "Beca Escolar"]
    for k in range(4):
        cedula = f"17{20000000 + k}"
        beneficiarios.append({"nombre": rng.nombre(), "cedula": cedula})
        direccion = f"Calle {rng.choice(APELLIDOS)} Oe{k + 1}-{rng.randint(10, 99)}, Guayaquil"
        direcciones.append({"direccion": direccion})
        reside.append({"src": cedula, "dst": direccion})
        telefono = f"+593 9{80000000 + k}"
        telefonos.append({"numero": telefono})
        usa_tel.append({"src": cedula, "dst": telefono})
        cobra.append({"src": cedula, "dst": cta_inter})
        nueva_solicitud(cedula, programas_inter[k], "Oficina Zonal 5",
                        f"2026-03-{5 + k:02d}", cta_inter)

    db.cypher("CREATE CONSTRAINT beneficiario_cedula IF NOT EXISTS "
              "FOR (b:Beneficiario) REQUIRE b.cedula IS UNIQUE")
    db.cypher("CREATE CONSTRAINT solicitud_codigo IF NOT EXISTS "
              "FOR (s:Solicitud) REQUIRE s.codigo IS UNIQUE")

    load_nodes(db, "Beneficiario", beneficiarios)
    load_nodes(db, "Direccion", direcciones)
    load_nodes(db, "Telefono", telefonos)
    load_nodes(db, "Cuenta", cuentas)
    load_nodes(db, "Programa", [{"nombre": p["nombre"], "monto": p["monto"]} for p in PROGRAMAS])
    load_nodes(db, "Oficina", oficinas)
    load_nodes(db, "Solicitud", solicitudes)
    load_nodes(db, "Pago", pagos)

    load_edges(db, "Beneficiario", "cedula", "RESIDE_EN", "Direccion", "direccion", reside)
    load_edges(db, "Beneficiario", "cedula", "USA_TELEFONO", "Telefono", "numero", usa_tel)
    load_edges(db, "Beneficiario", "cedula", "COBRA_EN", "Cuenta", "iban", cobra)
    load_edges(db, "Beneficiario", "cedula", "SOLICITA", "Solicitud", "codigo", solicita)
    load_edges(db, "Solicitud", "codigo", "DE_PROGRAMA", "Programa", "nombre", de_programa)
    load_edges(db, "Solicitud", "codigo", "TRAMITADA_EN", "Oficina", "nombre", tramitada)
    load_edges(db, "Solicitud", "codigo", "GENERA", "Pago", "codigo", genera)
    load_edges(db, "Pago", "codigo", "DEPOSITADO_EN", "Cuenta", "iban", depositado)


QUERIES = [
    {
        "id": "duplicados-complejos",
        "titulo": "Duplicados complejos entre registros",
        "descripcion": (
            "Beneficiarios con cédulas distintas que comparten dos o más de "
            "{dirección, teléfono, cuenta}: la misma persona bajo varios "
            "registros. Compartir solo la dirección (una familia) no dispara."
        ),
        "cypher": """\
MATCH (b1:Beneficiario)-[:RESIDE_EN|USA_TELEFONO|COBRA_EN]->(x)
      <-[:RESIDE_EN|USA_TELEFONO|COBRA_EN]-(b2:Beneficiario)
WHERE b1.cedula < b2.cedula
WITH b1, b2, collect(DISTINCT labels(x)[0]) AS comparten
WHERE size(comparten) >= 2
RETURN b1.nombre AS registro_a, b1.cedula AS cedula_a,
       b2.nombre AS registro_b, b2.cedula AS cedula_b,
       comparten
ORDER BY size(comparten) DESC""",
    },
    {
        "id": "cuenta-intermediaria",
        "titulo": "Cuentas que cobran por varios beneficiarios",
        "descripcion": (
            "Una cuenta donde cobran tres o más beneficiarios distintos es un "
            "intermediario o un registro multiplicado — en ambos casos, "
            "revisión manual."
        ),
        "cypher": """\
MATCH (b:Beneficiario)-[:COBRA_EN]->(c:Cuenta)
WITH c, collect(DISTINCT b.nombre) AS beneficiarios,
     count(DISTINCT b) AS n
WHERE n >= 3
MATCH (p:Pago)-[:DEPOSITADO_EN]->(c)
WITH c, beneficiarios, n, count(p) AS pagos, sum(p.monto) AS monto_total
RETURN c.iban AS cuenta, n AS beneficiarios_distintos, pagos,
       monto_total, beneficiarios
ORDER BY n DESC""",
    },
    {
        "id": "doble-cobro-programa",
        "titulo": "El mismo programa pagado varias veces al mismo grupo",
        "descripcion": (
            "Solicitudes del mismo programa cuyos titulares comparten "
            "dirección, teléfono o cuenta: el doble cobro que los sistemas "
            "por registro no ven."
        ),
        "cypher": """\
MATCH (b1:Beneficiario)-[:SOLICITA]->(s1:Solicitud)-[:DE_PROGRAMA]->(pr:Programa),
      (b2:Beneficiario)-[:SOLICITA]->(s2:Solicitud)-[:DE_PROGRAMA]->(pr)
WHERE b1.cedula < b2.cedula
MATCH (b1)-[:RESIDE_EN|USA_TELEFONO|COBRA_EN]->(x)
      <-[:RESIDE_EN|USA_TELEFONO|COBRA_EN]-(b2)
MATCH (s1)-[:GENERA]->(p1:Pago)
MATCH (s2)-[:GENERA]->(p2:Pago)
RETURN pr.nombre AS programa,
       b1.nombre AS registro_a, b2.nombre AS registro_b,
       collect(DISTINCT labels(x)[0]) AS comparten,
       count(DISTINCT p1) + count(DISTINCT p2) AS pagos_al_grupo,
       sum(DISTINCT p1.monto) + sum(DISTINCT p2.monto) AS monto_expuesto
ORDER BY pagos_al_grupo DESC""",
    },
    {
        "id": "oficina-concentradora",
        "titulo": "Concentración de casos anómalos por oficina",
        "descripcion": (
            "Qué oficinas tramitan las solicitudes de beneficiarios con "
            "señales de duplicidad (cuenta compartida con otro titular): la "
            "concentración sugiere dónde auditar primero."
        ),
        "cypher": """\
MATCH (s:Solicitud)-[:TRAMITADA_EN]->(o:Oficina)
MATCH (s)<-[:SOLICITA]-(b:Beneficiario)-[:COBRA_EN]->(c:Cuenta)
OPTIONAL MATCH (c)<-[:COBRA_EN]-(otro:Beneficiario)
WITH o, s,
     sum(CASE WHEN otro.cedula <> b.cedula THEN 1 ELSE 0 END) AS senales
WITH o, count(s) AS solicitudes,
     sum(CASE WHEN senales > 0 THEN 1 ELSE 0 END) AS anomalas
RETURN o.nombre AS oficina, solicitudes, anomalas,
       round(100.0 * anomalas / solicitudes) AS pct_anomalas
ORDER BY pct_anomalas DESC""",
    },
    {
        "id": "trazabilidad-decision",
        "titulo": "Trazabilidad completa de la decisión",
        "descripcion": (
            "Para un caso anómalo, el camino completo y auditable: quién "
            "solicitó, qué programa, qué oficina tramitó, qué pago salió y a "
            "qué cuenta llegó."
        ),
        "cypher": """\
MATCH (b:Beneficiario)-[:COBRA_EN]->(cta:Cuenta {iban: 'EC-INTER-0001'})
MATCH (b)-[:SOLICITA]->(s:Solicitud)-[:DE_PROGRAMA]->(pr:Programa)
MATCH (s)-[:TRAMITADA_EN]->(o:Oficina)
MATCH (s)-[:GENERA]->(p:Pago)-[:DEPOSITADO_EN]->(destino:Cuenta)
RETURN b.nombre AS beneficiario, b.cedula AS cedula,
       s.codigo AS solicitud, s.fecha AS fecha, pr.nombre AS programa,
       o.nombre AS oficina, p.codigo AS pago, p.monto AS monto,
       destino.iban AS cuenta_destino
ORDER BY fecha""",
    },
]
