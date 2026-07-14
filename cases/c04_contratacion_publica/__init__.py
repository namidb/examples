"""Caso 04 — Gobierno: contratación pública y conflictos de interés."""
from cases.common import Rng, load_edges, load_nodes

META = {
    "numero": 4,
    "slug": "contratacion-publica",
    "industria": "Gobierno — Contratación pública y conflictos de interés",
    "titulo": "Quién está detrás de cada oferta.",
    "problema": (
        "Ofertas aparentemente independientes pueden pertenecer al mismo "
        "beneficiario final, o estar relacionadas con funcionarios, "
        "intermediarios o proveedores cuestionados."
    ),
    "conecta": [
        "Procesos", "Ofertas", "Proveedores", "Accionistas",
        "Beneficiarios finales", "Funcionarios", "Contratos anteriores",
        "Sanciones", "Subcontratistas", "Pagos",
    ],
    "revela": [
        "Proveedores con propietarios comunes",
        "Empresas creadas justo antes del proceso",
        "Ofertas “competitivas” relacionadas",
        "Conflictos de interés y concentración",
        "Conexiones con sancionados",
        "Redes de subcontratación ocultas",
    ],
    "indicadores": [
        "Proveedores relacionados identificados", "Alertas de propiedad común",
        "Tiempo de debida diligencia", "Concentración por beneficiario final",
        "Alertas confirmadas", "Procesos revisados antes de adjudicar",
    ],
    "referencia": (
        "Open Ownership: los datos de beneficiarios finales permiten detectar "
        "conflictos de interés y alertar colusión o manipulación de ofertas."
    ),
}

LEYENDA = {
    "Entidad": "Entidad pública convocante",
    "Proceso": "Proceso de contratación",
    "Oferta": "Oferta presentada",
    "Proveedor": "Empresa oferente / contratista",
    "Persona": "Accionista, beneficiario final o funcionario",
    "Sancion": "Sanción administrativa",
}

# Días medidos desde 2026-01-01 para poder restar fechas en Cypher.
_BASE = "2026-01-01"


def seed(db):
    rng = Rng(401)

    entidades = [
        {"nombre": "GAD Municipal de Riobamba"},
        {"nombre": "Ministerio de Obras Públicas"},
        {"nombre": "GAD Provincial de Tungurahua"},
    ]

    personas, proveedores, procesos, ofertas, sanciones = [], [], [], [], []
    convoca, presenta, para, accionista, funcionario = [], [], [], [], []
    adjudicado, sancionado, subcontrata, familiar = [], [], [], []

    nombres_usados: set[str] = set()

    def persona_unica() -> str:
        while True:
            nombre = rng.nombre()
            if nombre not in nombres_usados:
                nombres_usados.add(nombre)
                personas.append({"nombre": nombre})
                return nombre

    # ── Trama plantada ──────────────────────────────────────────────────
    for fijo in ("Efrén Maldonado", "Nelly Maldonado", "Karla Sempértegui"):
        nombres_usados.add(fijo)
        personas.append({"nombre": fijo})
    # FAMILIAR_DE simétrico para poder recorrerlo en ambos sentidos.
    familiar += [
        {"src": "Efrén Maldonado", "dst": "Nelly Maldonado"},
        {"src": "Nelly Maldonado", "dst": "Efrén Maldonado"},
    ]
    funcionario.append({
        "src": "Karla Sempértegui", "dst": "GAD Municipal de Riobamba",
        "cargo": "Directora de Compras Públicas",
    })

    colusores = [
        {"nombre": "Constructora Andes Riobamba", "ruc": rng.ruc(),
         "fecha_constitucion": "2014-06-11", "constituido_dias": -4222},
        {"nombre": "Vialidad y Asfaltos Puruhá", "ruc": rng.ruc(),
         "fecha_constitucion": "2018-03-02", "constituido_dias": -2862},
        # Constituida 18 días antes de la convocatoria del 2026-02-20.
        {"nombre": "Constructora Vial Chimborazo", "ruc": rng.ruc(),
         "fecha_constitucion": "2026-02-02", "constituido_dias": 32},
    ]
    proveedores += colusores
    accionista += [
        {"src": "Efrén Maldonado", "dst": "Constructora Andes Riobamba", "pct": 80},
        {"src": "Efrén Maldonado", "dst": "Vialidad y Asfaltos Puruhá", "pct": 65},
        {"src": "Karla Sempértegui", "dst": "Vialidad y Asfaltos Puruhá", "pct": 30},
        {"src": "Nelly Maldonado", "dst": "Constructora Vial Chimborazo", "pct": 90},
    ]
    # Resolución de beneficiario final (UBO): la participación de Nelly se
    # consolida en Efrén por parentesco directo — como lo haría un pipeline
    # de entity resolution antes de cargar el grafo.
    beneficiario_final = [
        {"src": "Efrén Maldonado", "dst": "Constructora Andes Riobamba"},
        {"src": "Efrén Maldonado", "dst": "Vialidad y Asfaltos Puruhá"},
        {"src": "Efrén Maldonado", "dst": "Constructora Vial Chimborazo"},
    ]

    proveedores += [
        {"nombre": "Áridos del Centro", "ruc": rng.ruc(),
         "fecha_constitucion": "2011-09-19", "constituido_dias": -5218},
        {"nombre": "Transporte Pesado Colta", "ruc": rng.ruc(),
         "fecha_constitucion": "2013-04-25", "constituido_dias": -4634},
    ]
    sanciones.append({
        "codigo": "SAN-2024-017", "motivo": "Incumplimiento contractual",
        "fecha": "2024-08-30", "vigente": True,
    })
    sancionado.append({"src": "Áridos del Centro", "dst": "SAN-2024-017"})
    subcontrata += [
        {"src": "Constructora Andes Riobamba", "dst": "Áridos del Centro"},
        {"src": "Áridos del Centro", "dst": "Transporte Pesado Colta"},
    ]

    procesos.append({
        "codigo": "LICI-2026-004",
        "objeto": "Rehabilitación vial Riobamba–Chambo (14 km)",
        "monto": 2400000, "fecha_convocatoria": "2026-02-20",
        "convocado_dias": 50,
    })
    convoca.append({"src": "GAD Municipal de Riobamba", "dst": "LICI-2026-004"})
    adjudicado.append({"src": "LICI-2026-004", "dst": "Constructora Andes Riobamba"})

    ofertas_lici4 = [
        ("OF-2026-004-A", "Constructora Andes Riobamba", 2390000),
        ("OF-2026-004-B", "Vialidad y Asfaltos Puruhá", 2410000),
        ("OF-2026-004-C", "Constructora Vial Chimborazo", 2430000),
    ]

    # Concentración: Efrén ya ganó otros 3 procesos del GAD este año.
    previos = [
        ("LICI-2026-001", "Adoquinado urbano fase II", 640000, "2026-01-10", 9,
         "Constructora Andes Riobamba"),
        ("LICI-2026-002", "Puente peatonal río Chibunga", 480000, "2026-01-22", 21,
         "Constructora Andes Riobamba"),
        ("LICI-2026-003", "Mantenimiento vías rurales", 720000, "2026-02-05", 35,
         "Vialidad y Asfaltos Puruhá"),
    ]
    for codigo, objeto, monto, fecha, dias, ganador in previos:
        procesos.append({
            "codigo": codigo, "objeto": objeto, "monto": monto,
            "fecha_convocatoria": fecha, "convocado_dias": dias,
        })
        convoca.append({"src": "GAD Municipal de Riobamba", "dst": codigo})
        adjudicado.append({"src": codigo, "dst": ganador})
        oferta_id = f"OF-{codigo[5:]}-G"
        ofertas.append({"codigo": oferta_id, "monto": int(monto * 0.98)})
        presenta.append({"src": ganador, "dst": oferta_id})
        para.append({"src": oferta_id, "dst": codigo})

    # ── Fondo limpio ────────────────────────────────────────────────────
    independientes = []
    for _ in range(16):
        nombre = rng.empresa()
        while any(p["nombre"] == nombre for p in proveedores):
            nombre = rng.empresa()
        año = rng.randint(2005, 2023)
        proveedores.append({
            "nombre": nombre, "ruc": rng.ruc(),
            "fecha_constitucion": f"{año}-{rng.randint(1, 12):02d}-{rng.randint(1, 28):02d}",
            "constituido_dias": (año - 2026) * 365,
        })
        independientes.append(nombre)
        dueño = persona_unica()
        accionista.append({"src": dueño, "dst": nombre, "pct": 100})
        beneficiario_final.append({"src": dueño, "dst": nombre})

    # Un proveedor de fondo sancionado pero sin vínculo con adjudicatarios.
    sanciones.append({
        "codigo": "SAN-2023-088", "motivo": "Retraso en obra",
        "fecha": "2023-05-12", "vigente": False,
    })
    sancionado.append({"src": independientes[-1], "dst": "SAN-2023-088"})

    # Oferta honesta en la licitación plantada.
    ofertas_lici4.append(("OF-2026-004-D", independientes[0], 2510000))
    for codigo, proveedor, monto in ofertas_lici4:
        ofertas.append({"codigo": codigo, "monto": monto})
        presenta.append({"src": proveedor, "dst": codigo})
        para.append({"src": codigo, "dst": "LICI-2026-004"})

    # Funcionarios de fondo sin conflicto.
    for entidad in ("Ministerio de Obras Públicas", "GAD Provincial de Tungurahua"):
        funcionario.append({
            "src": persona_unica(), "dst": entidad, "cargo": "Analista de contratación",
        })

    # 10 procesos limpios con 2–3 ofertas de independientes.
    objetos = [
        "Alcantarillado pluvial", "Iluminación LED", "Mercado municipal",
        "Ciclovía urbana", "Agua potable rural", "Parque lineal",
        "Terminal terrestre", "Muro de contención", "Canchas deportivas",
        "Centro de salud tipo B", "Puente carrozable El Batán",
        "Repotenciación de aceras y bordillos",
    ]
    for i, objeto in enumerate(objetos):
        codigo = f"COTO-2026-{i + 10:03d}"
        dias = rng.randint(5, 160)
        mes, dia = 1 + dias // 30, 1 + dias % 28
        procesos.append({
            "codigo": codigo, "objeto": objeto,
            "monto": rng.randint(150, 900) * 1000,
            "fecha_convocatoria": f"2026-{mes:02d}-{dia:02d}",
            "convocado_dias": dias,
        })
        convoca.append({"src": rng.choice(entidades)["nombre"], "dst": codigo})
        oferentes = rng.sample(independientes, rng.randint(2, 3))
        for j, oferente in enumerate(oferentes):
            oferta_id = f"OF-{codigo[5:]}-{j}"
            ofertas.append({"codigo": oferta_id, "monto": rng.randint(140, 950) * 1000})
            presenta.append({"src": oferente, "dst": oferta_id})
            para.append({"src": oferta_id, "dst": codigo})
        adjudicado.append({"src": codigo, "dst": oferentes[0]})

    # Un par de familiares de fondo cuyos negocios NO compiten entre sí.
    a, b = persona_unica(), persona_unica()
    familiar += [{"src": a, "dst": b}, {"src": b, "dst": a}]

    db.cypher("CREATE CONSTRAINT proveedor_nombre IF NOT EXISTS FOR (p:Proveedor) REQUIRE p.nombre IS UNIQUE")
    db.cypher("CREATE CONSTRAINT proceso_codigo IF NOT EXISTS FOR (p:Proceso) REQUIRE p.codigo IS UNIQUE")

    load_nodes(db, "Entidad", entidades)
    load_nodes(db, "Persona", personas)
    load_nodes(db, "Proveedor", proveedores)
    load_nodes(db, "Proceso", procesos)
    load_nodes(db, "Oferta", ofertas)
    load_nodes(db, "Sancion", sanciones)
    load_edges(db, "Entidad", "nombre", "CONVOCA", "Proceso", "codigo", convoca)
    load_edges(db, "Proveedor", "nombre", "PRESENTA", "Oferta", "codigo", presenta)
    load_edges(db, "Oferta", "codigo", "PARA", "Proceso", "codigo", para)
    load_edges(db, "Persona", "nombre", "ACCIONISTA_DE", "Proveedor", "nombre", accionista, rel_props=["pct"])
    load_edges(db, "Persona", "nombre", "BENEFICIARIO_FINAL", "Proveedor", "nombre", beneficiario_final)
    load_edges(db, "Persona", "nombre", "FUNCIONARIO_DE", "Entidad", "nombre", funcionario, rel_props=["cargo"])
    load_edges(db, "Proceso", "codigo", "ADJUDICADO_A", "Proveedor", "nombre", adjudicado)
    load_edges(db, "Proveedor", "nombre", "SANCIONADO_CON", "Sancion", "codigo", sancionado)
    load_edges(db, "Proveedor", "nombre", "SUBCONTRATA", "Proveedor", "nombre", subcontrata)
    load_edges(db, "Persona", "nombre", "FAMILIAR_DE", "Persona", "nombre", familiar)


QUERIES = [
    {
        "id": "ofertas-mismo-beneficiario",
        "titulo": "Ofertas “competitivas” del mismo beneficiario final",
        "descripcion": (
            "Dos o más ofertas de un mismo proceso cuyos accionistas son la "
            "misma persona o parientes directos: la competencia era teatro."
        ),
        "cypher": """\
MATCH (b:Persona)-[:BENEFICIARIO_FINAL]->(p1:Proveedor)-[:PRESENTA]->(o1:Oferta)-[:PARA]->(pr:Proceso),
      (b)-[:BENEFICIARIO_FINAL]->(p2:Proveedor)-[:PRESENTA]->(o2:Oferta)-[:PARA]->(pr)
WHERE p1.nombre < p2.nombre
RETURN pr.codigo AS proceso, b.nombre AS beneficiario_final,
       p1.nombre AS oferente_a, o1.monto AS monto_a,
       p2.nombre AS oferente_b, o2.monto AS monto_b""",
    },
    {
        "id": "empresas-recien-creadas",
        "titulo": "Empresas creadas justo antes del proceso",
        "descripcion": (
            "Oferentes constituidos a días de la convocatoria en la que "
            "participan — vehículos creados para ese proceso."
        ),
        "cypher": """\
MATCH (p:Proveedor)-[:PRESENTA]->(o:Oferta)-[:PARA]->(pr:Proceso)
WHERE pr.convocado_dias - p.constituido_dias < 60
  AND p.constituido_dias <= pr.convocado_dias
RETURN p.nombre AS proveedor, p.fecha_constitucion AS constituida,
       pr.codigo AS proceso, pr.fecha_convocatoria AS convocado,
       pr.convocado_dias - p.constituido_dias AS dias_de_diferencia""",
    },
    {
        "id": "conflicto-funcionarios",
        "titulo": "Funcionarios con interés en los oferentes",
        "descripcion": (
            "Personas que trabajan en la entidad convocante y a la vez son "
            "accionistas de una empresa que oferta en sus procesos."
        ),
        "cypher": """\
MATCH (f:Persona)-[fu:FUNCIONARIO_DE]->(e:Entidad)-[:CONVOCA]->(pr:Proceso)
MATCH (f)-[a:ACCIONISTA_DE]->(prov:Proveedor)-[:PRESENTA]->(o:Oferta)-[:PARA]->(pr)
RETURN f.nombre AS funcionario, fu.cargo AS cargo, e.nombre AS entidad,
       pr.codigo AS proceso, prov.nombre AS oferente, a.pct AS participacion""",
    },
    {
        "id": "conexiones-sancionados",
        "titulo": "Adjudicatarios conectados con sancionados",
        "descripcion": (
            "El ganador puede estar limpio; su cadena de subcontratación, no. "
            "Sanciones a uno o dos saltos del adjudicatario."
        ),
        "cypher": """\
MATCH (pr:Proceso)-[:ADJUDICADO_A]->(adj:Proveedor)
MATCH (adj)-[:SUBCONTRATA*1..2]->(x:Proveedor)-[:SANCIONADO_CON]->(s:Sancion)
RETURN pr.codigo AS proceso, adj.nombre AS adjudicatario,
       x.nombre AS sancionado, s.codigo AS sancion, s.motivo AS motivo,
       s.vigente AS vigente""",
    },
    {
        "id": "concentracion-beneficiario",
        "titulo": "Concentración por beneficiario final",
        "descripcion": (
            "Cuántos procesos y cuánto dinero termina, vía sus empresas, en "
            "cada beneficiario final."
        ),
        "cypher": """\
MATCH (b:Persona)-[:ACCIONISTA_DE]->(p:Proveedor)<-[:ADJUDICADO_A]-(pr:Proceso)
WITH b, count(DISTINCT pr) AS procesos_ganados,
     sum(pr.monto) AS monto_total, collect(DISTINCT p.nombre) AS empresas
WHERE procesos_ganados >= 2
RETURN b.nombre AS beneficiario, procesos_ganados, monto_total, empresas
ORDER BY monto_total DESC""",
    },
    {
        "id": "red-subcontratacion",
        "titulo": "Redes de subcontratación ocultas",
        "descripcion": (
            "Cadenas de subcontratación que arrancan en un adjudicatario: "
            "quién ejecuta de verdad el contrato."
        ),
        "cypher": """\
MATCH (pr:Proceso)-[:ADJUDICADO_A]->(a:Proveedor)-[:SUBCONTRATA]->(s1:Proveedor)
OPTIONAL MATCH (s1)-[:SUBCONTRATA]->(s2:Proveedor)
RETURN DISTINCT pr.codigo AS proceso, a.nombre AS adjudicatario,
       s1.nombre AS subcontratista, s2.nombre AS sub_subcontratista""",
    },
]
