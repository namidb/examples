"""Caso 12 — Telecomunicaciones: causa raíz e impacto sobre clientes."""
from cases.common import Rng, load_edges, load_nodes

META = {
    "numero": 12,
    "slug": "telecom-causa-raiz",
    "industria": "Telecomunicaciones — Causa raíz e impacto sobre clientes",
    "titulo": "De cien alarmas a una causa.",
    "problema": (
        "Una sola falla genera cientos de alarmas en equipos, enlaces y "
        "sistemas distintos. El personal atiende síntomas en lugar de "
        "encontrar la causa original."
    ),
    "conecta": [
        "Equipos", "Antenas", "Fibra y circuitos", "Servicios", "Alarmas",
        "Incidentes", "Configuración", "Proveedores", "Tickets", "Zonas",
        "Clientes", "SLA",
    ],
    "revela": [
        "Causa raíz identificada",
        "Clientes y servicios afectados conocidos",
        "Incidentes priorizados por impacto",
        "Casos ligados a incidentes anteriores",
        "Menos escalaciones innecesarias",
    ],
    "indicadores": [
        "Tiempo medio de reparación", "Alarmas agrupadas por incidente",
        "Incidentes repetidos", "Clientes afectados identificados",
        "Cumplimiento de SLA",
    ],
    "referencia": (
        "China Telecom ha utilizado knowledge graphs para relacionar fallas "
        "e identificar relaciones causales, mejorando su capacidad predictiva."
    ),
}

LEYENDA = {
    "Equipo": "Nodo de red (core, agregación, acceso, antena)",
    "Fibra": "Enlace de fibra / circuito",
    "Servicio": "Servicio contratado que cursa por la red",
    "Cliente": "Cliente final (premium o estándar)",
    "Alarma": "Alarma de red (activa o histórica)",
    "Incidente": "Incidente gestionado",
    "Ticket": "Reclamo de cliente",
}

# El subárbol del corte: AGG-NORTE-02 y todo lo que depende de él.
_RAIZ = "AGG-NORTE-02"
_FIBRA_CORTADA = "F-33"


def seed(db):
    rng = Rng(1201)

    equipos, fibras, servicios, clientes = [], [], [], []
    alarmas, incidentes, tickets = [], [], []
    depende, conectado, cursa, contrata = [], [], [], []
    emite, agrupada, reporta, causado = [], [], [], []

    # ── Topología: acceso → agregación → core ──────────────────────────
    equipos += [
        {"tag": "CORE-01", "tipo": "core", "zona": "Nacional"},
        {"tag": "CORE-02", "tipo": "core", "zona": "Nacional"},
    ]
    aggs = [
        ("AGG-NORTE-01", "Norte", "CORE-01"),
        (_RAIZ, "Norte", "CORE-01"),
        ("AGG-SUR-01", "Sur", "CORE-02"),
        ("AGG-CENTRO-01", "Centro", "CORE-02"),
        ("AGG-CENTRO-02", "Centro", "CORE-01"),
    ]
    for tag, zona, core in aggs:
        equipos.append({"tag": tag, "tipo": "agregacion", "zona": zona})
        depende.append({"src": tag, "dst": core})

    # Fibras: cada agregador cuelga de una fibra; F-33 es la de AGG-NORTE-02.
    fibra_de = {
        "AGG-NORTE-01": "F-31", _RAIZ: _FIBRA_CORTADA, "AGG-SUR-01": "F-45",
        "AGG-CENTRO-01": "F-52", "AGG-CENTRO-02": "F-53",
    }
    for codigo in sorted(set(fibra_de.values())) + ["F-01", "F-02"]:
        fibras.append({"codigo": codigo})
    for tag, codigo in fibra_de.items():
        conectado.append({"src": tag, "dst": codigo})
    conectado += [{"src": "CORE-01", "dst": "F-01"}, {"src": "CORE-02", "dst": "F-02"}]

    # Acceso / antenas por agregador. El subárbol del corte tiene 8 equipos.
    acceso_por_agg = {
        "AGG-NORTE-01": 4, _RAIZ: 8, "AGG-SUR-01": 4,
        "AGG-CENTRO-01": 3, "AGG-CENTRO-02": 3,
    }
    subarbol = []
    for agg, cantidad in acceso_por_agg.items():
        zona = next(z for t, z, _ in aggs if t == agg)
        for i in range(cantidad):
            tipo = "antena" if i % 3 == 2 else "acceso"
            prefijo = "ANT" if tipo == "antena" else "ACC"
            tag = f"{prefijo}-{agg.split('-')[1][:3]}-{agg[-1]}{i:02d}"
            equipos.append({"tag": tag, "tipo": tipo, "zona": zona})
            depende.append({"src": tag, "dst": agg})
            if agg == _RAIZ:
                subarbol.append(tag)

    # ── Servicios y clientes ────────────────────────────────────────────
    vistos = set()

    def nombre_unico():
        while True:
            nombre = rng.nombre()
            if nombre not in vistos:
                vistos.add(nombre)
                return nombre

    contador = [0]

    def alta_cliente(equipo_tag, premium=False):
        contador[0] += 1
        svc = {"codigo": f"SVC-{contador[0]:04d}",
               "tipo": rng.choice(["internet", "movil", "dedicado"])}
        servicios.append(svc)
        cursa.append({"src": svc["codigo"], "dst": equipo_tag})
        nombre = rng.empresa() if premium else nombre_unico()
        if premium and any(c["nombre"] == nombre for c in clientes):
            nombre = f"{nombre} {contador[0]}"
        clientes.append({"nombre": nombre, "sla": "premium" if premium else "estandar"})
        contrata.append({"src": nombre, "dst": svc["codigo"]})
        return svc["codigo"], nombre

    afectados_svc = []
    # ~35 clientes bajo el subárbol del corte, 5 premium.
    premium_asignados = 0
    for i, tag in enumerate(subarbol):
        for k in range(5 if i < 3 else 4):
            es_premium = premium_asignados < 5 and k == 0 and i < 5
            svc, _ = alta_cliente(tag, premium=es_premium)
            if es_premium:
                premium_asignados += 1
            afectados_svc.append(svc)
    # Resto de la red (~12 clientes).
    otros = [e["tag"] for e in equipos if e["tipo"] in ("acceso", "antena")
             and e["tag"] not in subarbol]
    for tag in otros:
        alta_cliente(tag, premium=False)

    # ── Corte actual: F-33 → cascada de alarmas ────────────────────────
    contador_alm = [0]

    def alta_alarma(equipo_tag, tipo, ts, activa=True):
        contador_alm[0] += 1
        codigo = f"ALM-{contador_alm[0]:04d}"
        alarmas.append({"codigo": codigo, "tipo": tipo,
                        "timestamp": ts, "activa": activa})
        emite.append({"src": equipo_tag, "dst": codigo})
        return codigo

    alta_alarma(_RAIZ, "LOS", "2026-07-10T08:00:00")
    alta_alarma(_RAIZ, "LINK_DOWN", "2026-07-10T08:00:04")
    alta_alarma(_RAIZ, "BER_ALTA", "2026-07-10T08:00:09")
    for i, tag in enumerate(subarbol):
        alta_alarma(tag, "LINK_DOWN", f"2026-07-10T08:00:{12 + i * 3:02d}")
        alta_alarma(tag, "CAIDA_SERVICIO", f"2026-07-10T08:01:{5 + i * 3:02d}")
        if i % 2 == 0:
            alta_alarma(tag, "DEGRADACION", f"2026-07-10T08:02:{i * 4:02d}")

    # Ruido: eventos aislados reales en otras zonas (sin cascada).
    alta_alarma("ACC-SUR-100", "FALLA_ENERGIA", "2026-07-10T07:42:11")
    alta_alarma("ACC-CEN-100", "TEMP_ALTA", "2026-07-10T06:15:47")

    # Histórico ya resuelto (activa=false), repartido por la red.
    todos_acceso = subarbol + otros
    for _ in range(16):
        alta_alarma(rng.choice(todos_acceso),
                    rng.choice(["LINK_DOWN", "DEGRADACION", "TEMP_ALTA"]),
                    f"2026-{rng.randint(2, 6):02d}-{rng.randint(1, 28):02d}T{rng.randint(0, 23):02d}:00:00",
                    activa=False)

    # ── Incidentes históricos sobre la MISMA fibra (daño recurrente) ───
    incidentes += [
        {"numero": "INC-2026-031", "fecha": "2026-05-11",
         "causa": "Corte de fibra por obra civil"},
        {"numero": "INC-2026-007", "fecha": "2026-02-19",
         "causa": "Daño de fibra por roedores"},
    ]
    causado += [
        {"src": "INC-2026-031", "dst": _FIBRA_CORTADA},
        {"src": "INC-2026-007", "dst": _FIBRA_CORTADA},
    ]
    # Algunas alarmas históricas quedaron agrupadas en el incidente de mayo.
    historicas = [a["codigo"] for a in alarmas if not a["activa"]][:4]
    for codigo in historicas:
        agrupada.append({"src": codigo, "dst": "INC-2026-031"})

    # ── Tickets de clientes durante el corte ───────────────────────────
    for i, svc in enumerate(afectados_svc[:6]):
        numero = f"TKT-{7100 + i}"
        tickets.append({"numero": numero})
        reporta.append({"src": numero, "dst": svc})

    # ── Carga ───────────────────────────────────────────────────────────
    db.cypher("CREATE CONSTRAINT equipo_tag IF NOT EXISTS FOR (e:Equipo) REQUIRE e.tag IS UNIQUE")
    db.cypher("CREATE CONSTRAINT alarma_codigo IF NOT EXISTS FOR (a:Alarma) REQUIRE a.codigo IS UNIQUE")

    load_nodes(db, "Equipo", equipos)
    load_nodes(db, "Fibra", fibras)
    load_nodes(db, "Servicio", servicios)
    load_nodes(db, "Cliente", clientes)
    load_nodes(db, "Alarma", alarmas)
    load_nodes(db, "Incidente", incidentes)
    load_nodes(db, "Ticket", tickets)
    load_edges(db, "Equipo", "tag", "DEPENDE_DE", "Equipo", "tag", depende)
    load_edges(db, "Equipo", "tag", "CONECTADO_POR", "Fibra", "codigo", conectado)
    load_edges(db, "Servicio", "codigo", "CURSA_POR", "Equipo", "tag", cursa)
    load_edges(db, "Cliente", "nombre", "CONTRATA", "Servicio", "codigo", contrata)
    load_edges(db, "Equipo", "tag", "EMITE", "Alarma", "codigo", emite)
    load_edges(db, "Alarma", "codigo", "AGRUPADA_EN", "Incidente", "numero", agrupada)
    load_edges(db, "Ticket", "numero", "REPORTA", "Servicio", "codigo", reporta)
    load_edges(db, "Incidente", "numero", "CAUSADO_POR", "Fibra", "codigo", causado)


QUERIES = [
    {
        "id": "causa-raiz",
        "titulo": "De la tormenta de alarmas a la causa raíz",
        "descripcion": (
            "El origen de la cascada: equipos alarmados cuyo padre en la "
            "topología está sano. El resto de las alarmas son síntomas."
        ),
        "cypher": """\
MATCH (e:Equipo)-[:EMITE]->(:Alarma {activa: true})
MATCH (e)-[:DEPENDE_DE]->(padre:Equipo)
WHERE NOT EXISTS { (padre)-[:EMITE]->(:Alarma {activa: true}) }
WITH DISTINCT e, padre
OPTIONAL MATCH (e)-[:CONECTADO_POR]->(f:Fibra)
CALL {
  WITH e
  MATCH (h:Equipo)-[:DEPENDE_DE*1..3]->(e)
  RETURN count(DISTINCT h) AS equipos_aguas_abajo
}
RETURN e.tag AS causa_raiz, e.tipo AS tipo, f.codigo AS fibra,
       padre.tag AS padre_sano, equipos_aguas_abajo
ORDER BY equipos_aguas_abajo DESC""",
    },
    {
        "id": "impacto-clientes",
        "titulo": "Clientes y servicios afectados",
        "descripcion": (
            "Todo lo que cursa por el subárbol del equipo causa raíz, "
            "separado por SLA: a quién llamar primero."
        ),
        "cypher": """\
MATCH (afectado:Equipo)-[:DEPENDE_DE*1..3]->(:Equipo {tag: 'AGG-NORTE-02'})
WITH collect(DISTINCT afectado.tag) + ['AGG-NORTE-02'] AS zona_corte
MATCH (c:Cliente)-[:CONTRATA]->(s:Servicio)-[:CURSA_POR]->(e:Equipo)
WHERE e.tag IN zona_corte
RETURN c.sla AS sla, count(DISTINCT c) AS clientes,
       count(DISTINCT s) AS servicios
ORDER BY sla""",
    },
    {
        "id": "alarmas-agrupadas",
        "titulo": "Alarmas agrupadas por incidente",
        "descripcion": (
            "Cuántas alarmas activas pertenecen a la cascada del corte y "
            "cuántas son eventos aislados: de decenas de síntomas a un incidente."
        ),
        "cypher": """\
MATCH (afectado:Equipo)-[:DEPENDE_DE*1..3]->(:Equipo {tag: 'AGG-NORTE-02'})
WITH collect(DISTINCT afectado.tag) + ['AGG-NORTE-02'] AS zona_corte
MATCH (e:Equipo)-[:EMITE]->(a:Alarma {activa: true})
WITH zona_corte, e, a,
     CASE WHEN e.tag IN zona_corte THEN 'incidente fibra F-33'
          ELSE 'evento aislado' END AS grupo
RETURN grupo, count(a) AS alarmas, count(DISTINCT e) AS equipos
ORDER BY alarmas DESC""",
    },
    {
        "id": "incidente-repetido",
        "titulo": "Casos ligados a incidentes anteriores",
        "descripcion": (
            "La fibra del corte de hoy ya causó incidentes antes: el grafo "
            "convierte una avería en un patrón de daño recurrente."
        ),
        "cypher": """\
MATCH (:Equipo {tag: 'AGG-NORTE-02'})-[:CONECTADO_POR]->(f:Fibra)
MATCH (i:Incidente)-[:CAUSADO_POR]->(f)
RETURN f.codigo AS fibra, i.numero AS incidente_previo,
       i.fecha AS fecha, i.causa AS causa
ORDER BY i.fecha DESC""",
    },
    {
        "id": "priorizacion-sla",
        "titulo": "Priorización por impacto en SLA",
        "descripcion": (
            "Ranking de equipos alarmados según clientes premium aguas "
            "abajo: el orden real de reparación."
        ),
        "cypher": """\
MATCH (e:Equipo)-[:EMITE]->(:Alarma {activa: true})
WITH DISTINCT e
CALL {
  WITH e
  MATCH (e)<-[:CURSA_POR]-(s:Servicio)<-[:CONTRATA]-(c:Cliente)
  RETURN count(DISTINCT CASE WHEN c.sla = 'premium' THEN c.nombre END) AS clientes_premium,
         count(DISTINCT c.nombre) AS clientes_totales
}
RETURN e.tag AS equipo, e.tipo AS tipo, clientes_premium, clientes_totales
ORDER BY clientes_premium DESC, clientes_totales DESC
LIMIT 5""",
    },
]
