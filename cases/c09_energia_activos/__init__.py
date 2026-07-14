"""Caso 09 — Petróleo, gas y energía: inteligencia de activos y mantenimiento."""
from cases.common import Rng, load_edges, load_nodes

META = {
    "numero": 9,
    "slug": "energia-activos",
    "industria": "Petróleo, gas y energía — Inteligencia de activos y mantenimiento",
    "titulo": "La historia completa de cada activo.",
    "problema": (
        "La información de un activo está distribuida entre sensores, órdenes "
        "de trabajo, inspecciones, manuales, proveedores, incidentes, "
        "repuestos y el conocimiento del personal."
    ),
    "conecta": [
        "Pozo, ducto o planta", "Equipos", "Sensores", "Alarmas",
        "Inspecciones", "Órdenes", "Fallas", "Repuestos", "Manuales",
        "Límites del fabricante", "Técnicos",
    ],
    "revela": [
        "¿Qué componentes se ligan a esta alarma?",
        "¿Ocurrió antes una combinación similar?",
        "¿Qué mantenimiento y manual aplican?",
        "¿Qué otros activos usan el componente?",
        "¿Qué fallas amenazan producción o seguridad?",
    ],
    "indicadores": [
        "Tiempo para investigar una falla", "Incidentes repetidos identificados",
        "Horas de indisponibilidad", "Órdenes de trabajo relacionadas",
        "Tiempo para localizar documentación",
    ],
    "referencia": (
        "Shell ha descrito knowledge graphs que relacionan datos de pruebas, "
        "límites de fabricantes y conocimiento técnico. NamiDB no reemplaza "
        "SCADA ni historiadores."
    ),
}

LEYENDA = {
    "Planta": "Instalación industrial",
    "Equipo": "Activo físico (bomba, compresor…)",
    "Componente": "Parte monitoreada de un equipo",
    "Sensor": "Instrumento que monitorea un componente",
    "Alarma": "Evento disparado por un sensor",
    "Inspeccion": "Inspección registrada",
    "OrdenTrabajo": "Orden de mantenimiento",
    "Falla": "Falla registrada con indisponibilidad",
    "Repuesto": "Repuesto en bodega (stock)",
    "Manual": "Sección de manual técnico",
    "Tecnico": "Personal de mantenimiento",
    "Fabricante": "Fabricante y límites de operación",
}

_TIPOS_EQUIPO = ["compresor", "turbina", "motor", "válvula", "separador", "intercambiador"]
_MODOS_FONDO = ["fuga menor", "sobrecalentamiento", "desalineación", "obstrucción"]


def seed(db):
    rng = Rng(901)

    plantas = [{"nombre": "Planta Esmeraldas"}, {"nombre": "Planta Shushufindi"}]
    equipos, componentes, sensores, alarmas = [], [], [], []
    inspecciones, ots, fallas, repuestos, manuales = [], [], [], [], []
    tecnicos, fabricantes = [], []

    en_planta, parte_de, monitorea, dispara = [], [], [], []
    sobre, tuvo_falla, en_componente, requiere = [], [], [], []
    documentado_comp, documentado_eq, ejecutada_por = [], [], []
    fabricado_por, inspeccionado, precedida_por = [], [], []

    tecnicos += [
        {"nombre": "Wilson Cedeño", "especialidad": "rotativos"},
        {"nombre": "Karla Mera", "especialidad": "instrumentación"},
        {"nombre": "Aníbal Suárez", "especialidad": "eléctrico"},
        {"nombre": "Diana Zambrano", "especialidad": "estática"},
    ]
    fabricantes += [
        {"nombre": "SKF", "limite_operacion": "vibración ≤ 4.5 mm/s"},
        {"nombre": "WEG", "limite_operacion": "temperatura ≤ 95 °C"},
        {"nombre": "Siemens", "limite_operacion": "corriente ≤ 1.1 In"},
        {"nombre": "Flowserve", "limite_operacion": "presión ≤ 40 bar"},
    ]
    manuales += [
        {"codigo": "MAN-BOM-12", "seccion": "§4.3", "tema": "rodamientos de bombas centrífugas"},
        {"codigo": "MAN-COM-07", "seccion": "§2.1", "tema": "sellos de compresores"},
        {"codigo": "MAN-ELE-03", "seccion": "§6.4", "tema": "devanados de motores"},
        {"codigo": "MAN-VAL-01", "seccion": "§1.2", "tema": "actuadores de válvulas"},
    ]
    repuestos += [
        {"sku": "SKF-6205", "stock": 0},
        {"sku": "SELLO-MEC-88", "stock": 4},
        {"sku": "DEVANADO-M55", "stock": 2},
        {"sku": "ACT-VAL-19", "stock": 6},
        {"sku": "EMPAQUE-T3", "stock": 9},
    ]

    # ── Protagonistas: bombas gemelas P-201 (alarma activa) y P-305 ────
    for tag, planta in (("P-201", "Planta Esmeraldas"), ("P-305", "Planta Shushufindi")):
        equipos.append({"tag": tag, "tipo": "bomba centrífuga", "criticidad": "alta"})
        en_planta.append({"src": tag, "dst": planta})
        comp = f"RDM-6205-{tag.replace('-', '')}"
        componentes.append({"codigo": comp, "tipo": "rodamiento"})
        parte_de.append({"src": comp, "dst": tag})
        requiere.append({"src": comp, "dst": "SKF-6205"})
        documentado_comp.append({"src": comp, "dst": "MAN-BOM-12"})
        documentado_eq.append({"src": tag, "dst": "MAN-BOM-12"})
        fabricado_por.append({"src": comp, "dst": "SKF"})
        for var in ("vibración", "temperatura"):
            sensor = f"SEN-{var[:3].upper()}-{tag.replace('-', '')}"
            sensores.append({"tag": sensor, "variable": var})
            monitorea.append({"src": sensor, "dst": comp})

    # Otros 2 equipos que dependen del MISMO repuesto sin stock.
    for tag, tipo, planta in (
        ("C-102", "compresor", "Planta Esmeraldas"),
        ("B-417", "bomba booster", "Planta Shushufindi"),
    ):
        equipos.append({"tag": tag, "tipo": tipo, "criticidad": "media"})
        en_planta.append({"src": tag, "dst": planta})
        comp = f"RDM-6205-{tag.replace('-', '')}"
        componentes.append({"codigo": comp, "tipo": "rodamiento"})
        parte_de.append({"src": comp, "dst": tag})
        requiere.append({"src": comp, "dst": "SKF-6205"})
        documentado_comp.append({"src": comp, "dst": "MAN-BOM-12"})
        fabricado_por.append({"src": comp, "dst": "SKF"})

    # ── Alarma activa hoy: vibración + temperatura sobre P-201 ─────────
    alarmas += [
        {"codigo": "AL-VIB-118", "severidad": "alta", "timestamp": "2026-07-13 06:42",
         "activa": True, "variable": "vibración"},
        {"codigo": "AL-TMP-042", "severidad": "media", "timestamp": "2026-07-13 06:47",
         "activa": True, "variable": "temperatura"},
    ]
    dispara += [
        {"src": "SEN-VIB-P201", "dst": "AL-VIB-118"},
        {"src": "SEN-TEM-P201", "dst": "AL-TMP-042"},
    ]

    # ── Historia: dos fallas previas con la MISMA firma ────────────────
    fallas += [
        {"codigo": "FL-0118", "modo": "desgaste de rodamiento", "fecha": "2025-11-08",
         "horas_indisponible": 36},
        {"codigo": "FL-0034", "modo": "desgaste de rodamiento", "fecha": "2025-06-21",
         "horas_indisponible": 52},
    ]
    tuvo_falla += [{"src": "P-201", "dst": "FL-0118"}, {"src": "P-305", "dst": "FL-0034"}]
    en_componente += [
        {"src": "FL-0118", "dst": "RDM-6205-P201"},
        {"src": "FL-0034", "dst": "RDM-6205-P305"},
    ]
    for falla, tag, fecha in (("FL-0118", "P201", "2025-11-07"), ("FL-0034", "P305", "2025-06-20")):
        for var, hora in (("vibración", "14:10"), ("temperatura", "18:55")):
            codigo = f"AL-{var[:3].upper()}-{falla[-3:]}-{tag}"
            alarmas.append({"codigo": codigo, "severidad": "alta",
                            "timestamp": f"{fecha} {hora}", "activa": False, "variable": var})
            sensor = f"SEN-{var[:3].upper()}-{tag}"
            dispara.append({"src": sensor, "dst": codigo})
            precedida_por.append({"src": falla, "dst": codigo})

    ots += [
        {"numero": "OT-7741", "fecha": "2025-11-09", "tipo": "correctivo", "estado": "cerrada"},
        {"numero": "OT-5210", "fecha": "2025-06-22", "tipo": "correctivo", "estado": "cerrada"},
        {"numero": "OT-8102", "fecha": "2026-05-30", "tipo": "preventivo", "estado": "cerrada"},
    ]
    sobre += [
        {"src": "OT-7741", "dst": "P-201"},
        {"src": "OT-5210", "dst": "P-305"},
        {"src": "OT-8102", "dst": "P-201"},
    ]
    ejecutada_por += [
        {"src": "OT-7741", "dst": "Wilson Cedeño"},
        {"src": "OT-5210", "dst": "Wilson Cedeño"},
        {"src": "OT-8102", "dst": "Karla Mera"},
    ]
    inspecciones.append({"codigo": "INSP-2266", "fecha": "2026-06-18",
                         "hallazgo": "vibración creciente en rodamiento"})
    inspeccionado.append({"src": "P-201", "dst": "INSP-2266"})

    # ── Fondo: 16 equipos normales ──────────────────────────────────────
    fondo_manual = {"compresor": "MAN-COM-07", "motor": "MAN-ELE-03", "válvula": "MAN-VAL-01"}
    fondo_repuesto = {"compresor": "SELLO-MEC-88", "motor": "DEVANADO-M55", "válvula": "ACT-VAL-19"}
    fondo_fabricante = {"compresor": "Flowserve", "motor": "WEG", "válvula": "Siemens"}
    for i in range(16):
        tipo = rng.choice(_TIPOS_EQUIPO)
        tag = f"{tipo[:1].upper()}X-{500 + i}"
        criticidad = rng.choice(["alta", "media", "media", "baja"])
        planta = rng.choice(plantas)["nombre"]
        equipos.append({"tag": tag, "tipo": tipo, "criticidad": criticidad})
        en_planta.append({"src": tag, "dst": planta})

        n_comp = 2 if i % 2 == 0 else 1
        for j in range(n_comp):
            comp = f"CMP-{600 + i}{chr(97 + j)}"
            tipo_comp = rng.choice(["sello", "devanado", "actuador", "empaque"])
            componentes.append({"codigo": comp, "tipo": tipo_comp})
            parte_de.append({"src": comp, "dst": tag})
            requiere.append({"src": comp, "dst": fondo_repuesto.get(tipo, "EMPAQUE-T3")})
            documentado_comp.append({"src": comp, "dst": fondo_manual.get(tipo, "MAN-VAL-01")})
            fabricado_por.append({"src": comp, "dst": fondo_fabricante.get(tipo, "Siemens")})

            var = rng.choice(["presión", "caudal", "corriente"])
            sensor = f"SEN-{var[:3].upper()}-{500 + i}{chr(97 + j)}"
            sensores.append({"tag": sensor, "variable": var})
            monitorea.append({"src": sensor, "dst": comp})

            if (i + j) % 2 == 0:
                codigo = f"AL-{var[:3].upper()}-{700 + i}{chr(97 + j)}"
                alarmas.append({"codigo": codigo, "severidad": rng.choice(["baja", "media"]),
                                "timestamp": f"{rng.fecha()} 09:00", "activa": False,
                                "variable": var})
                dispara.append({"src": sensor, "dst": codigo})

            if (i + j) % 3 == 0:
                falla = f"FL-{900 + i}{chr(97 + j)}"
                fallas.append({"codigo": falla, "modo": rng.choice(_MODOS_FONDO),
                               "fecha": rng.fecha(2025, 1, 12),
                               "horas_indisponible": rng.randint(2, 18)})
                tuvo_falla.append({"src": tag, "dst": falla})
                en_componente.append({"src": falla, "dst": comp})
                ot = f"OT-{9000 + i}{chr(97 + j)}"
                ots.append({"numero": ot, "fecha": rng.fecha(2025, 1, 12),
                            "tipo": "correctivo", "estado": "cerrada"})
                sobre.append({"src": ot, "dst": tag})
                ejecutada_por.append({"src": ot, "dst": rng.choice(tecnicos)["nombre"]})

        if i % 4 == 0:
            insp = f"INSP-{3000 + i}"
            inspecciones.append({"codigo": insp, "fecha": rng.fecha(),
                                 "hallazgo": "sin novedades"})
            inspeccionado.append({"src": tag, "dst": insp})

    db.cypher("CREATE CONSTRAINT equipo_tag IF NOT EXISTS FOR (e:Equipo) REQUIRE e.tag IS UNIQUE")
    db.cypher("CREATE CONSTRAINT comp_codigo IF NOT EXISTS FOR (c:Componente) REQUIRE c.codigo IS UNIQUE")

    load_nodes(db, "Planta", plantas)
    load_nodes(db, "Equipo", equipos)
    load_nodes(db, "Componente", componentes)
    load_nodes(db, "Sensor", sensores)
    load_nodes(db, "Alarma", alarmas)
    load_nodes(db, "Inspeccion", inspecciones)
    load_nodes(db, "OrdenTrabajo", ots)
    load_nodes(db, "Falla", fallas)
    load_nodes(db, "Repuesto", repuestos)
    load_nodes(db, "Manual", manuales)
    load_nodes(db, "Tecnico", tecnicos)
    load_nodes(db, "Fabricante", fabricantes)

    load_edges(db, "Equipo", "tag", "EN_PLANTA", "Planta", "nombre", en_planta)
    load_edges(db, "Componente", "codigo", "PARTE_DE", "Equipo", "tag", parte_de)
    load_edges(db, "Sensor", "tag", "MONITOREA", "Componente", "codigo", monitorea)
    load_edges(db, "Sensor", "tag", "DISPARA", "Alarma", "codigo", dispara)
    load_edges(db, "OrdenTrabajo", "numero", "SOBRE", "Equipo", "tag", sobre)
    load_edges(db, "Equipo", "tag", "TUVO_FALLA", "Falla", "codigo", tuvo_falla)
    load_edges(db, "Falla", "codigo", "EN_COMPONENTE", "Componente", "codigo", en_componente)
    load_edges(db, "Componente", "codigo", "REQUIERE", "Repuesto", "sku", requiere)
    load_edges(db, "Componente", "codigo", "DOCUMENTADO_EN", "Manual", "codigo", documentado_comp)
    load_edges(db, "Equipo", "tag", "DOCUMENTADO_EN", "Manual", "codigo", documentado_eq)
    load_edges(db, "OrdenTrabajo", "numero", "EJECUTADA_POR", "Tecnico", "nombre", ejecutada_por)
    load_edges(db, "Componente", "codigo", "FABRICADO_POR", "Fabricante", "nombre", fabricado_por)
    load_edges(db, "Equipo", "tag", "INSPECCIONADO_POR", "Inspeccion", "codigo", inspeccionado)
    load_edges(db, "Falla", "codigo", "PRECEDIDA_POR", "Alarma", "codigo", precedida_por)


QUERIES = [
    {
        "id": "contexto-alarma",
        "titulo": "¿Qué componentes se ligan a esta alarma?",
        "descripcion": (
            "Para cada alarma activa: sensor, componente, equipo y planta en "
            "una sola consulta — el contexto que hoy vive en cinco sistemas."
        ),
        "cypher": """\
MATCH (s:Sensor)-[:DISPARA]->(al:Alarma {activa: true})
MATCH (s)-[:MONITOREA]->(comp:Componente)-[:PARTE_DE]->(e:Equipo)-[:EN_PLANTA]->(pl:Planta)
RETURN al.codigo AS alarma, al.variable AS variable, al.severidad AS severidad,
       s.tag AS sensor, comp.codigo AS componente, comp.tipo AS tipo,
       e.tag AS equipo, pl.nombre AS planta
ORDER BY alarma""",
    },
    {
        "id": "combinacion-similar",
        "titulo": "¿Ocurrió antes una combinación similar?",
        "descripcion": (
            "Fallas históricas precedidas por las mismas variables que hoy "
            "están en alarma — el incidente repetido que nadie recuerda."
        ),
        "cypher": """\
MATCH (:Sensor)-[:DISPARA]->(act:Alarma {activa: true})
WITH DISTINCT act.variable AS variable_activa
MATCH (f:Falla)-[:PRECEDIDA_POR]->(prev:Alarma)
WHERE prev.variable = variable_activa
WITH f, count(DISTINCT variable_activa) AS variables_coincidentes
WHERE variables_coincidentes >= 2
MATCH (e:Equipo)-[:TUVO_FALLA]->(f)
RETURN f.codigo AS falla, e.tag AS equipo, f.modo AS modo, f.fecha AS fecha,
       f.horas_indisponible AS horas_indisponible, variables_coincidentes
ORDER BY f.fecha""",
    },
    {
        "id": "mantenimiento-aplicable",
        "titulo": "¿Qué mantenimiento y manual aplican?",
        "descripcion": (
            "La sección exacta del manual, las órdenes previas sobre el "
            "equipo y el técnico que ya resolvió esto antes."
        ),
        "cypher": """\
MATCH (s:Sensor)-[:DISPARA]->(:Alarma {activa: true})
MATCH (s)-[:MONITOREA]->(comp:Componente)-[:PARTE_DE]->(e:Equipo)
MATCH (comp)-[:DOCUMENTADO_EN]->(m:Manual)
MATCH (ot:OrdenTrabajo)-[:SOBRE]->(e)
MATCH (ot)-[:EJECUTADA_POR]->(t:Tecnico)
RETURN DISTINCT comp.codigo AS componente, m.codigo AS manual,
       m.seccion AS seccion, m.tema AS tema,
       ot.numero AS orden_previa, ot.tipo AS tipo, ot.fecha AS fecha,
       t.nombre AS tecnico, t.especialidad AS especialidad
ORDER BY fecha DESC""",
    },
    {
        "id": "otros-activos-componente",
        "titulo": "¿Qué otros activos usan el componente?",
        "descripcion": (
            "El mismo rodamiento vive en más equipos — y el repuesto "
            "compartido está en cero. Riesgo de repetición, visible antes."
        ),
        "cypher": """\
MATCH (s:Sensor)-[:DISPARA]->(:Alarma {activa: true})
MATCH (s)-[:MONITOREA]->(comp:Componente)-[:REQUIERE]->(r:Repuesto)
MATCH (otro:Componente)-[:REQUIERE]->(r)
MATCH (otro)-[:PARTE_DE]->(e:Equipo)
MATCH (otro)-[:FABRICADO_POR]->(fab:Fabricante)
RETURN DISTINCT r.sku AS repuesto, r.stock AS stock,
       CASE WHEN r.stock = 0 THEN '⚠ sin stock' ELSE 'disponible' END AS riesgo,
       otro.codigo AS componente, e.tag AS equipo, e.criticidad AS criticidad,
       fab.limite_operacion AS limite_fabricante
ORDER BY equipo""",
    },
    {
        "id": "fallas-que-amenazan",
        "titulo": "¿Qué fallas amenazan producción o seguridad?",
        "descripcion": (
            "Ranking de equipos por criticidad e indisponibilidad acumulada: "
            "dónde duele una falla repetida."
        ),
        "cypher": """\
MATCH (e:Equipo)-[:TUVO_FALLA]->(f:Falla)
WITH e, count(f) AS fallas, sum(f.horas_indisponible) AS horas
MATCH (e)-[:EN_PLANTA]->(p:Planta)
RETURN e.tag AS equipo, e.tipo AS tipo, e.criticidad AS criticidad,
       p.nombre AS planta, fallas, horas,
       CASE WHEN e.criticidad = 'alta' THEN horas * 3
            WHEN e.criticidad = 'media' THEN horas * 2
            ELSE horas END AS indice_riesgo
ORDER BY indice_riesgo DESC
LIMIT 8""",
    },
]
