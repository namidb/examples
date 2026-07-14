"""Caso 02 — Banca y cooperativas: grupos económicos y partes relacionadas."""
from cases.common import Rng, load_edges, load_nodes

META = {
    "numero": 2,
    "slug": "grupos-economicos",
    "industria": "Banca y cooperativas — Grupos económicos y partes relacionadas",
    "titulo": "La exposición real de la institución.",
    "problema": (
        "La institución cree que otorgó créditos a clientes diferentes "
        "cuando, en realidad, todos pertenecen al mismo grupo familiar "
        "o económico."
    ),
    "conecta": [
        "Personas", "Empresas", "Accionistas", "Familiares (con base legal)",
        "Garantes", "Garantías", "Proveedores", "Direcciones", "Créditos",
        "Beneficiarios finales",
    ],
    "revela": [
        "¿Exposición total frente a este grupo?",
        "¿Qué empresas comparten propietarios?",
        "¿Quiénes dependen del mismo ingreso?",
        "¿Qué garantías respaldan varias obligaciones?",
        "¿Qué créditos “independientes” no lo son?",
    ],
    "indicadores": [
        "Control de concentración", "Evaluación integral del riesgo",
        "Beneficiarios finales identificados",
        "Créditos vinculados no declarados",
        "Explicaciones visuales para comités",
    ],
    "referencia": "",
}

LEYENDA = {
    "Persona": "Cliente, accionista o garante",
    "Empresa": "Persona jurídica deudora",
    "Credito": "Obligación vigente",
    "Garantia": "Colateral que respalda créditos",
    "Direccion": "Domicilio declarado",
}


def seed(db):
    rng = Rng(201)

    personas, empresas, creditos, garantias, direcciones = [], [], [], [], []
    familiar, accionista, otorgado_p, otorgado_e = [], [], [], []
    avala, garantiza, reside, trabaja = [], [], [], []

    # ── Población de fondo: clientes sin vínculos entre sí ─────────────
    usados: set[str] = set()
    for i in range(15):
        nombre = rng.nombre()
        while nombre in usados:
            nombre = rng.nombre()
        usados.add(nombre)
        personas.append({"nombre": nombre})
        direccion = f"{rng.ciudad()}, Calle {rng.randint(1, 99)} N{rng.randint(10, 80)}-{rng.randint(10, 99)}"
        direcciones.append({"direccion": direccion})
        reside.append({"src": nombre, "dst": direccion})
        codigo = f"CRE-{5000 + i}"
        creditos.append({
            "codigo": codigo,
            "monto": rng.randint(5, 60) * 1000,
            "estado": "vigente",
        })
        otorgado_p.append({"src": codigo, "dst": nombre})
        if i % 3 == 0:
            garantia = f"G-VEH-{100 + i}"
            garantias.append({"codigo": garantia, "tipo": "vehículo", "valor": rng.randint(15, 40) * 1000})
            garantiza.append({"src": garantia, "dst": codigo})

    for i in range(5):
        nombre_emp = rng.empresa()
        empresas.append({"nombre": nombre_emp, "ruc": rng.ruc()})
        accionista.append({"src": rng.choice(personas[:15])["nombre"], "dst": nombre_emp, "pct": 100})
        codigo = f"CRE-{6000 + i}"
        creditos.append({"codigo": codigo, "monto": rng.randint(20, 90) * 1000, "estado": "vigente"})
        otorgado_e.append({"src": codigo, "dst": nombre_emp})

    # ── Patrón plantado: la familia Salvatierra ────────────────────────
    familia = ["Aurelio Salvatierra", "Beatriz Salvatierra", "Camilo Salvatierra", "Dolores Salvatierra"]
    for nombre in familia:
        personas.append({"nombre": nombre})
    familiar += [
        {"src": "Aurelio Salvatierra", "dst": "Beatriz Salvatierra", "parentesco": "cónyuge"},
        {"src": "Aurelio Salvatierra", "dst": "Camilo Salvatierra", "parentesco": "hermano"},
        {"src": "Camilo Salvatierra", "dst": "Dolores Salvatierra", "parentesco": "hija"},
    ]

    grupo_empresas = [
        ("Constructora Salvatierra", [("Aurelio Salvatierra", 60), ("Camilo Salvatierra", 40)]),
        ("Inmobiliaria Cumbre Real", [("Beatriz Salvatierra", 70), ("Aurelio Salvatierra", 30)]),
        ("Ferretería El Cimiento", [("Dolores Salvatierra", 55), ("Camilo Salvatierra", 45)]),
    ]
    for nombre_emp, socios in grupo_empresas:
        empresas.append({"nombre": nombre_emp, "ruc": rng.ruc()})
        for socio, pct in socios:
            accionista.append({"src": socio, "dst": nombre_emp, "pct": pct})

    creditos_grupo = [
        ("CRE-1001", 120_000, "persona", "Aurelio Salvatierra"),
        ("CRE-1002", 95_000, "persona", "Beatriz Salvatierra"),
        ("CRE-2001", 250_000, "empresa", "Constructora Salvatierra"),
        ("CRE-2002", 180_000, "empresa", "Inmobiliaria Cumbre Real"),
        ("CRE-2003", 110_000, "empresa", "Ferretería El Cimiento"),
        ("CRE-2004", 90_000, "empresa", "Constructora Salvatierra"),
    ]
    for codigo, monto, tipo, deudor in creditos_grupo:
        creditos.append({"codigo": codigo, "monto": monto, "estado": "vigente"})
        if tipo == "persona":
            otorgado_p.append({"src": codigo, "dst": deudor})
        else:
            otorgado_e.append({"src": codigo, "dst": deudor})

    # La misma garantía (un solo inmueble) respalda dos créditos distintos.
    garantias.append({"codigo": "G-INM-001", "tipo": "inmueble", "valor": 300_000})
    garantiza += [
        {"src": "G-INM-001", "dst": "CRE-1001"},
        {"src": "G-INM-001", "dst": "CRE-2002"},
    ]
    garantias.append({"codigo": "G-MAQ-002", "tipo": "maquinaria", "valor": 150_000})
    garantiza.append({"src": "G-MAQ-002", "dst": "CRE-2001"})

    # Avales cruzados dentro de la familia.
    avala += [
        {"src": "Camilo Salvatierra", "dst": "CRE-1002"},
        {"src": "Beatriz Salvatierra", "dst": "CRE-2003"},
        {"src": "Aurelio Salvatierra", "dst": "CRE-2004"},
    ]

    # Dirección compartida.
    direccion_familiar = "Quito, Av. República del Salvador 1082"
    direcciones.append({"direccion": direccion_familiar})
    reside += [
        {"src": "Aurelio Salvatierra", "dst": direccion_familiar},
        {"src": "Beatriz Salvatierra", "dst": direccion_familiar},
    ]

    # Empleados del grupo con créditos avalados por un Salvatierra:
    # dependen del mismo ingreso que ya está apalancado.
    for j, empleado in enumerate(["Nelson Chicaiza", "Karla Tituaña"]):
        personas.append({"nombre": empleado})
        trabaja.append({"src": empleado, "dst": "Constructora Salvatierra"})
        codigo = f"CRE-3{j:03d}"
        creditos.append({"codigo": codigo, "monto": 18_000 + j * 4_000, "estado": "vigente"})
        otorgado_p.append({"src": codigo, "dst": empleado})
        avala.append({"src": "Aurelio Salvatierra", "dst": codigo})

    db.cypher("CREATE CONSTRAINT persona_nombre_c02 IF NOT EXISTS FOR (p:Persona) REQUIRE p.nombre IS UNIQUE")
    db.cypher("CREATE CONSTRAINT credito_codigo_c02 IF NOT EXISTS FOR (c:Credito) REQUIRE c.codigo IS UNIQUE")

    load_nodes(db, "Persona", personas)
    load_nodes(db, "Empresa", empresas)
    load_nodes(db, "Credito", creditos)
    load_nodes(db, "Garantia", garantias)
    load_nodes(db, "Direccion", direcciones)
    load_edges(db, "Persona", "nombre", "FAMILIAR_DE", "Persona", "nombre", familiar, rel_props=["parentesco"])
    load_edges(db, "Persona", "nombre", "ACCIONISTA_DE", "Empresa", "nombre", accionista, rel_props=["pct"])
    load_edges(db, "Credito", "codigo", "OTORGADO_A", "Persona", "nombre", otorgado_p)
    load_edges(db, "Credito", "codigo", "OTORGADO_A", "Empresa", "nombre", otorgado_e)
    load_edges(db, "Persona", "nombre", "AVALA", "Credito", "codigo", avala)
    load_edges(db, "Garantia", "codigo", "GARANTIZA", "Credito", "codigo", garantiza)
    load_edges(db, "Persona", "nombre", "RESIDE_EN", "Direccion", "direccion", reside)
    load_edges(db, "Persona", "nombre", "TRABAJA_EN", "Empresa", "nombre", trabaja)


QUERIES = [
    {
        "id": "exposicion-del-grupo",
        "titulo": "Exposición total frente al grupo",
        "descripcion": (
            "Los vínculos familiares, accionarios y de aval forman un solo "
            "componente conexo: la exposición real se mide contra el grupo, "
            "no contra cada deudor."
        ),
        "cypher": """\
CALL algo.wcc({labels: ['Persona', 'Empresa'],
               edge_types: ['FAMILIAR_DE', 'ACCIONISTA_DE', 'AVALA']})
YIELD node_id, component
WITH node_id AS deudor, component
MATCH (c:Credito)-[:OTORGADO_A]->(deudor)
MATCH (x:Persona|Empresa) WHERE id(x) = id(deudor)
WITH DISTINCT component, x.nombre AS miembro, c.codigo AS credito, c.monto AS monto
WITH component, collect(DISTINCT miembro) AS deudores,
     collect(DISTINCT credito) AS creditos, sum(monto) AS exposicion_total
WHERE size(creditos) > 1
RETURN deudores, creditos, exposicion_total
ORDER BY exposicion_total DESC
LIMIT 5""",
    },
    {
        "id": "empresas-con-duenos-comunes",
        "titulo": "Empresas que comparten propietarios",
        "descripcion": (
            "Sociedades registradas como clientes independientes cuyos "
            "accionistas se repiten: el beneficiario final es el mismo."
        ),
        "cypher": """\
MATCH (p:Persona)-[a1:ACCIONISTA_DE]->(e1:Empresa),
      (p)-[a2:ACCIONISTA_DE]->(e2:Empresa)
WHERE e1.nombre < e2.nombre
RETURN e1.nombre AS empresa_a, e2.nombre AS empresa_b,
       collect(p.nombre) AS accionistas_comunes
ORDER BY size(accionistas_comunes) DESC""",
    },
    {
        "id": "mismo-ingreso",
        "titulo": "Quiénes dependen del mismo ingreso",
        "descripcion": (
            "Empleados del grupo cuyos créditos además avala un accionista: "
            "si el grupo se estresa, estos créditos caen con él."
        ),
        "cypher": """\
MATCH (empleado:Persona)-[:TRABAJA_EN]->(e:Empresa)<-[:ACCIONISTA_DE]-(dueno:Persona)
MATCH (c:Credito)-[:OTORGADO_A]->(empleado)
MATCH (avalista:Persona)-[:AVALA]->(c)
RETURN empleado.nombre AS empleado, e.nombre AS empleador,
       c.codigo AS credito, c.monto AS monto,
       collect(DISTINCT dueno.nombre) AS duenos_del_empleador,
       collect(DISTINCT avalista.nombre) AS avalistas""",
    },
    {
        "id": "garantias-multiples",
        "titulo": "Garantías que respaldan varias obligaciones",
        "descripcion": (
            "El mismo inmueble colateraliza créditos de deudores distintos: "
            "la cobertura real es menor que la declarada."
        ),
        "cypher": """\
MATCH (g:Garantia)-[:GARANTIZA]->(c:Credito)-[:OTORGADO_A]->(d:Persona|Empresa)
WITH g, collect(c.codigo) AS creditos, collect(DISTINCT d.nombre) AS deudores,
     sum(c.monto) AS monto_respaldado
WHERE size(creditos) > 1
RETURN g.codigo AS garantia, g.tipo AS tipo, g.valor AS valor_garantia,
       creditos, deudores, monto_respaldado""",
    },
    {
        "id": "creditos-no-independientes",
        "titulo": "Créditos “independientes” que no lo son",
        "descripcion": (
            "Pares de créditos cuyos deudores se conectan en pocos saltos por "
            "parentesco, participación accionaria o avales."
        ),
        "cypher": """\
MATCH (c1:Credito)-[:OTORGADO_A]->(d1:Persona|Empresa),
      (c2:Credito)-[:OTORGADO_A]->(d2:Persona|Empresa)
WHERE c1.codigo < c2.codigo AND d1.nombre <> d2.nombre
MATCH ruta = shortestPath((d1)-[:FAMILIAR_DE|ACCIONISTA_DE|AVALA*..3]-(d2))
RETURN c1.codigo AS credito_a, c2.codigo AS credito_b,
       [n IN nodes(ruta) | coalesce(n.nombre, n.codigo)] AS conexion,
       length(ruta) AS saltos
ORDER BY saltos
LIMIT 10""",
    },
]
