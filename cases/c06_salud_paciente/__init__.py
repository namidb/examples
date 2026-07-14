"""Caso 06 — Salud: visión integral del paciente."""
from cases.common import Rng, load_edges, load_nodes

META = {
    "numero": 6,
    "slug": "salud-paciente",
    "industria": "Salud — Visión integral del paciente",
    "titulo": "Todo el historial, en contexto.",
    "problema": (
        "La información del paciente está separada entre consultas, "
        "laboratorios, recetas, imágenes, especialidades, clínicas, "
        "aseguradoras y sistemas administrativos."
    ),
    "conecta": [
        "Paciente", "Diagnósticos", "Síntomas", "Medicamentos", "Alergias",
        "Laboratorio", "Procedimientos", "Profesionales", "Guías clínicas",
        "Autorizaciones",
    ],
    "revela": [
        "¿Qué antecedentes son relevantes?",
        "¿Qué medicamentos y diagnósticos se relacionan?",
        "¿Qué pruebas ya fueron realizadas?",
        "¿Qué guías o protocolos aplican?",
        "¿Existe información contradictoria?",
    ],
    "indicadores": [
        "Tiempo para localizar antecedentes", "Pruebas duplicadas detectadas",
        "Documentos consultados por caso", "Información clínica reconciliada",
        "Respuestas con fuente verificable",
    ],
    "referencia": (
        "Capa de conocimiento, búsqueda e integración clínica. No reemplaza "
        "la historia clínica ni diagnostica de forma autónoma."
    ),
}

LEYENDA = {
    "Paciente": "Persona atendida",
    "Consulta": "Atención médica registrada",
    "Diagnostico": "Diagnóstico CIE-10",
    "Medicamento": "Fármaco prescrito",
    "Alergia": "Alergia declarada",
    "Prueba": "Examen de laboratorio o imagen",
    "Profesional": "Médico tratante",
    "Clinica": "Establecimiento de salud",
    "Guia": "Guía o protocolo clínico",
}

# Catálogos clínicos (nombre, cie10) / severidades reales simplificadas.
_DIAGNOSTICOS = [
    ("Diabetes tipo 2", "E11"), ("Hipertensión esencial", "I10"),
    ("Faringitis aguda", "J02"), ("Migraña", "G43"), ("Gastritis", "K29"),
    ("Lumbalgia", "M54"), ("Rinitis alérgica", "J30"), ("Ansiedad", "F41"),
    ("Dislipidemia", "E78"), ("Artrosis", "M19"),
]

_MEDICAMENTOS = [
    "metformina", "enalapril", "glibenclamida", "losartán", "ibuprofeno",
    "paracetamol", "omeprazol", "amoxicilina", "loratadina", "sertralina",
    "atorvastatina", "naproxeno", "claritromicina",
    "trimetoprim-sulfametoxazol",
]

_TRATA = [
    ("metformina", "E11"), ("glibenclamida", "E11"), ("enalapril", "I10"),
    ("losartán", "I10"), ("atorvastatina", "E78"), ("omeprazol", "K29"),
    ("loratadina", "J30"), ("sertralina", "F41"), ("naproxeno", "M54"),
    ("amoxicilina", "J02"),
]

_TIPOS_PRUEBA = ["Hemograma", "Glucosa en ayunas", "Perfil lipídico", "TSH", "Rayos X tórax"]

_CLINICAS = [
    "Clínica Metropolitana", "Hospital San Rafael",
    "Centro Médico del Valle", "Clínica Vida Sana",
]

_ESPECIALIDADES = [
    "endocrinología", "cardiología", "medicina interna", "medicina general",
    "gastroenterología", "neurología", "traumatología", "medicina familiar",
]


def seed(db):
    rng = Rng(601)

    pacientes, consultas, pruebas, profesionales, guias = [], [], [], [], []
    tuvo, en_clinica, atendida_por, diagnostica, prescribe = [], [], [], [], []
    alergico, solicita, interactua, contraindicado, trata = [], [], [], [], []
    recomienda, aplica_a = [], []

    diagnosticos = [{"nombre": n, "cie10": c} for n, c in _DIAGNOSTICOS]
    medicamentos = [{"nombre": m} for m in _MEDICAMENTOS]
    alergias = [{"sustancia": s} for s in ["penicilina", "sulfas", "mariscos", "polen"]]
    clinicas = [{"nombre": c} for c in _CLINICAS]

    nombres_usados = set()

    def nombre_unico(sufijo=""):
        while True:
            n = rng.nombre() + sufijo
            if n not in nombres_usados:
                nombres_usados.add(n)
                return n

    for esp in _ESPECIALIDADES:
        profesionales.append({"nombre": "Dr. " + nombre_unico(), "especialidad": esp})

    # Conocimiento farmacológico (aplica a cualquier paciente).
    interactua += [
        {"src": "trimetoprim-sulfametoxazol", "dst": "enalapril", "severidad": "alta", "nivel": 1},
        {"src": "claritromicina", "dst": "atorvastatina", "severidad": "alta", "nivel": 1},
        {"src": "ibuprofeno", "dst": "losartán", "severidad": "media", "nivel": 2},
    ]
    contraindicado.append({"src": "amoxicilina", "dst": "penicilina"})
    trata += [{"src": m, "dst": d} for m, d in _TRATA]

    # ── Marta Quishpe: historial fragmentado en 3+ clínicas ────────────
    marta = "Marta Quishpe"
    nombres_usados.add(marta)
    pacientes.append({"nombre": marta, "fecha_nacimiento": "1961-04-12"})
    alergico.append({"src": marta, "dst": "penicilina"})

    marta_consultas = [
        # (codigo, fecha, motivo, clinica, especialidad, cie10, medicamento, prueba)
        ("C-MQ-1", "2026-01-20", "control de diabetes", "Clínica Metropolitana",
         "endocrinología", "E11", "metformina",
         {"codigo": "PR-MQ-1", "tipo": "HbA1c", "fecha": "2026-01-20", "dia": 19, "resultado": "8.1 %"}),
        ("C-MQ-2", "2026-02-10", "control de presión arterial", "Hospital San Rafael",
         "cardiología", "I10", "enalapril",
         {"codigo": "PR-MQ-2", "tipo": "Perfil lipídico", "fecha": "2026-02-10", "dia": 40, "resultado": "LDL 148 mg/dL"}),
        ("C-MQ-3", "2026-03-05", "chequeo general e infección urinaria", "Centro Médico del Valle",
         "medicina general", None, "trimetoprim-sulfametoxazol",
         {"codigo": "PR-MQ-3", "tipo": "HbA1c", "fecha": "2026-03-05", "dia": 63, "resultado": "7.9 %"}),
        ("C-MQ-4", "2026-03-28", "faringitis con fiebre", "Clínica Vida Sana",
         "medicina familiar", "J02", "amoxicilina", None),
    ]
    prof_por_esp = {p["especialidad"]: p["nombre"] for p in profesionales}
    for codigo, fecha, motivo, clinica, esp, cie10, med, prueba in marta_consultas:
        consultas.append({"codigo": codigo, "fecha": fecha, "motivo": motivo})
        tuvo.append({"src": marta, "dst": codigo})
        en_clinica.append({"src": codigo, "dst": clinica})
        atendida_por.append({"src": codigo, "dst": prof_por_esp[esp]})
        if cie10:
            diagnostica.append({"src": codigo, "dst": cie10})
        prescribe.append({"src": codigo, "dst": med, "fecha": fecha})
        if prueba:
            pruebas.append(prueba)
            solicita.append({"src": codigo, "dst": prueba["codigo"]})

    # Recomendación de guía aún sin solicitar: fondo de ojo pendiente.
    pruebas.append({"codigo": "PR-MQ-4", "tipo": "Fondo de ojo", "fecha": "", "dia": 0, "resultado": "pendiente"})

    guias += [
        {"nombre": "Protocolo ADA — Diabetes tipo 2", "aplica_a": "E11"},
        {"nombre": "Guía ESC — Hipertensión arterial", "aplica_a": "I10"},
    ]
    aplica_a += [
        {"src": "Protocolo ADA — Diabetes tipo 2", "dst": "E11"},
        {"src": "Guía ESC — Hipertensión arterial", "dst": "I10"},
    ]
    recomienda += [
        {"src": "Protocolo ADA — Diabetes tipo 2", "dst": "PR-MQ-3"},
        {"src": "Protocolo ADA — Diabetes tipo 2", "dst": "PR-MQ-4"},
        {"src": "Guía ESC — Hipertensión arterial", "dst": "PR-MQ-2"},
    ]

    # ── Pacientes de fondo: historiales normales en UNA sola clínica ───
    n_consulta = 0
    n_prueba = 0
    for i in range(18):
        nombre = nombre_unico()
        pacientes.append({"nombre": nombre, "fecha_nacimiento": rng.fecha(año=rng.randint(1950, 2005), mes_fin=12)})
        if i % 4 == 0:
            alergico.append({"src": nombre, "dst": rng.choice(["mariscos", "polen"])})
        clinica = rng.choice(_CLINICAS)
        dx_pool = rng.sample(_DIAGNOSTICOS, 3)
        tipos = rng.sample(_TIPOS_PRUEBA, 3)
        for j in range(rng.randint(1, 3)):
            n_consulta += 1
            codigo = f"C-{n_consulta:04d}"
            mes = rng.randint(1, 6)
            fecha = f"2026-{mes:02d}-{rng.randint(1, 28):02d}"
            nombre_dx, cie10 = dx_pool[j % 3]
            consultas.append({"codigo": codigo, "fecha": fecha, "motivo": f"control de {nombre_dx.lower()}"})
            tuvo.append({"src": nombre, "dst": codigo})
            en_clinica.append({"src": codigo, "dst": clinica})
            atendida_por.append({"src": codigo, "dst": rng.choice(profesionales)["nombre"]})
            diagnostica.append({"src": codigo, "dst": cie10})
            med = next((m for m, d in _TRATA if d == cie10), None)
            if i == 2 and j == 0:
                # Contraste de severidad media: ibuprofeno + losartán.
                for extra in ("ibuprofeno", "losartán"):
                    prescribe.append({"src": codigo, "dst": extra, "fecha": fecha})
            elif med:
                prescribe.append({"src": codigo, "dst": med, "fecha": fecha})
            if j % 2 == 0:
                n_prueba += 1
                prueba = {
                    "codigo": f"PR-{n_prueba:04d}", "tipo": tipos[j % 3],
                    "fecha": fecha, "dia": (mes - 1) * 30 + 15, "resultado": "dentro de rango",
                }
                pruebas.append(prueba)
                solicita.append({"src": codigo, "dst": prueba["codigo"]})

    db.cypher("CREATE CONSTRAINT paciente_nombre IF NOT EXISTS FOR (p:Paciente) REQUIRE p.nombre IS UNIQUE")
    db.cypher("CREATE CONSTRAINT consulta_codigo IF NOT EXISTS FOR (c:Consulta) REQUIRE c.codigo IS UNIQUE")

    load_nodes(db, "Paciente", pacientes)
    load_nodes(db, "Consulta", consultas)
    load_nodes(db, "Diagnostico", diagnosticos)
    load_nodes(db, "Medicamento", medicamentos)
    load_nodes(db, "Alergia", alergias)
    load_nodes(db, "Prueba", pruebas)
    load_nodes(db, "Profesional", profesionales)
    load_nodes(db, "Clinica", clinicas)
    load_nodes(db, "Guia", guias)

    load_edges(db, "Paciente", "nombre", "TUVO", "Consulta", "codigo", tuvo)
    load_edges(db, "Consulta", "codigo", "EN_CLINICA", "Clinica", "nombre", en_clinica)
    load_edges(db, "Consulta", "codigo", "ATENDIDA_POR", "Profesional", "nombre", atendida_por)
    load_edges(db, "Consulta", "codigo", "DIAGNOSTICA", "Diagnostico", "cie10", diagnostica)
    load_edges(db, "Consulta", "codigo", "PRESCRIBE", "Medicamento", "nombre", prescribe, rel_props=["fecha"])
    load_edges(db, "Paciente", "nombre", "ALERGICO_A", "Alergia", "sustancia", alergico)
    load_edges(db, "Consulta", "codigo", "SOLICITA", "Prueba", "codigo", solicita)
    load_edges(db, "Medicamento", "nombre", "INTERACTUA_CON", "Medicamento", "nombre", interactua, rel_props=["severidad", "nivel"])
    load_edges(db, "Medicamento", "nombre", "CONTRAINDICADO_PARA", "Alergia", "sustancia", contraindicado)
    load_edges(db, "Medicamento", "nombre", "TRATA", "Diagnostico", "cie10", trata)
    load_edges(db, "Guia", "nombre", "RECOMIENDA", "Prueba", "codigo", recomienda)
    load_edges(db, "Guia", "nombre", "APLICA_A", "Diagnostico", "cie10", aplica_a)


QUERIES = [
    {
        "id": "historial-en-contexto",
        "titulo": "Todo el historial del paciente, en contexto",
        "descripcion": (
            "Consultas, diagnósticos, medicamentos y pruebas de un paciente "
            "reunidos desde todas las clínicas — lo que hoy vive en sistemas "
            "separados, en una sola consulta."
        ),
        "cypher": """\
MATCH (p:Paciente {nombre: 'Marta Quishpe'})-[:TUVO]->(c:Consulta)
MATCH (c)-[:EN_CLINICA]->(cl:Clinica)
OPTIONAL MATCH (c)-[:DIAGNOSTICA]->(d:Diagnostico)
OPTIONAL MATCH (c)-[:PRESCRIBE]->(m:Medicamento)
OPTIONAL MATCH (c)-[:SOLICITA]->(t:Prueba)
RETURN c.fecha AS fecha, cl.nombre AS clinica, c.motivo AS motivo,
       collect(DISTINCT d.nombre) AS diagnosticos,
       collect(DISTINCT m.nombre) AS medicamentos,
       collect(DISTINCT t.tipo) AS pruebas
ORDER BY fecha""",
    },
    {
        "id": "interacciones-activas",
        "titulo": "Interacciones entre medicamentos vigentes",
        "descripcion": (
            "Prescripciones hechas en clínicas distintas que interactúan "
            "entre sí — invisible cuando cada sistema solo ve su receta."
        ),
        "cypher": """\
MATCH (p:Paciente)-[:TUVO]->(c1:Consulta)-[:PRESCRIBE]->(m1:Medicamento),
      (p)-[:TUVO]->(c2:Consulta)-[:PRESCRIBE]->(m2:Medicamento)
MATCH (m1)-[i:INTERACTUA_CON]->(m2)
RETURN p.nombre AS paciente, m1.nombre AS medicamento_a,
       m2.nombre AS medicamento_b, i.severidad AS severidad,
       i.nivel AS nivel
ORDER BY nivel""",
    },
    {
        "id": "pruebas-duplicadas",
        "titulo": "Pruebas duplicadas entre clínicas",
        "descripcion": (
            "El mismo examen pedido dos veces en menos de 60 días por "
            "clínicas que no se ven entre sí: costo evitable y molestia "
            "para el paciente."
        ),
        "cypher": """\
MATCH (p:Paciente)-[:TUVO]->(c1:Consulta)-[:SOLICITA]->(t1:Prueba),
      (p)-[:TUVO]->(c2:Consulta)-[:SOLICITA]->(t2:Prueba)
WHERE t1.tipo = t2.tipo AND t1.codigo < t2.codigo
  AND t2.dia - t1.dia < 60 AND t1.dia - t2.dia < 60
MATCH (c1)-[:EN_CLINICA]->(cl1:Clinica), (c2)-[:EN_CLINICA]->(cl2:Clinica)
WHERE cl1.nombre <> cl2.nombre
RETURN p.nombre AS paciente, t1.tipo AS prueba,
       t1.fecha AS fecha_1, cl1.nombre AS clinica_1,
       t2.fecha AS fecha_2, cl2.nombre AS clinica_2""",
    },
    {
        "id": "contraindicaciones",
        "titulo": "Prescripciones contra alergias declaradas",
        "descripcion": (
            "Información contradictoria que el grafo reconcilia: una alergia "
            "registrada en una clínica y una receta incompatible emitida en otra."
        ),
        "cypher": """\
MATCH (p:Paciente)-[:ALERGICO_A]->(a:Alergia)<-[:CONTRAINDICADO_PARA]-(m:Medicamento)
MATCH (p)-[:TUVO]->(c:Consulta)-[:PRESCRIBE]->(m)
MATCH (c)-[:EN_CLINICA]->(cl:Clinica)
RETURN p.nombre AS paciente, m.nombre AS medicamento,
       a.sustancia AS alergia, c.fecha AS fecha, cl.nombre AS clinica""",
    },
    {
        "id": "guias-aplicables",
        "titulo": "Guías que aplican y qué falta por hacer",
        "descripcion": (
            "Protocolos clínicos ligados a los diagnósticos del paciente, y "
            "las recomendaciones que nadie ha solicitado todavía — respuesta "
            "con fuente verificable."
        ),
        "cypher": """\
MATCH (p:Paciente {nombre: 'Marta Quishpe'})-[:TUVO]->(c0:Consulta)-[:DIAGNOSTICA]->(d:Diagnostico)
MATCH (g:Guia)-[:APLICA_A]->(d)
MATCH (g)-[:RECOMIENDA]->(t:Prueba)
WHERE NOT EXISTS { (t)<-[:SOLICITA]-(:Consulta) }
RETURN DISTINCT g.nombre AS guia, d.nombre AS diagnostico,
       t.tipo AS recomendacion_pendiente""",
    },
]
