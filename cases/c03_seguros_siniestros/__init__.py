"""Caso 03 — Seguros: redes de fraude en siniestros."""
from cases.common import Rng, load_edges, load_nodes

META = {
    "numero": 3,
    "slug": "seguros-siniestros",
    "industria": "Seguros — Redes de fraude en siniestros",
    "titulo": "Un siniestro nunca llega solo.",
    "problema": (
        "Los reclamos parecen legítimos revisados uno por uno. El patrón "
        "aparece al conectar vehículos, talleres, médicos, direcciones, "
        "teléfonos, cuentas, pólizas y reclamantes."
    ),
    "conecta": [
        "Asegurados", "Beneficiarios", "Pólizas", "Siniestros", "Vehículos",
        "Talleres", "Peritos", "Médicos y centros", "Teléfonos y cuentas",
        "Investigaciones previas",
    ],
    "revela": [
        "Reclamos conectados con casos anteriores",
        "Talleres y peritos recurrentes en sospechas",
        "Reclamantes que comparten teléfonos o cuentas",
        "Investigaciones aceleradas y visuales",
    ],
    "indicadores": [
        "Minutos por investigación", "Reclamos ligados a casos previos",
        "Proveedores recurrentes", "Valor de pagos evitados",
        "Casos cerrados sin investigación extensa",
    ],
    "referencia": (
        "Zurich Switzerland investiga fraude con un grafo de ~20 millones de "
        "nodos y 35 millones de relaciones."
    ),
}

LEYENDA = {
    "Asegurado": "Cliente que reclama",
    "Poliza": "Póliza vigente",
    "Siniestro": "Reclamo presentado",
    "Vehiculo": "Vehículo asegurado",
    "Taller": "Taller de reparación",
    "Perito": "Perito evaluador",
    "Medico": "Médico o centro de salud",
    "Telefono": "Teléfono de contacto",
    "Cuenta": "Cuenta de cobro",
}


def seed(db):
    rng = Rng(301)

    asegurados, polizas, siniestros, vehiculos = [], [], [], []
    talleres, peritos, medicos, telefonos, cuentas = [], [], [], [], []
    tiene_poliza, reclama, bajo_poliza, sobre_vehiculo = [], [], [], []
    reparado_en, evaluado_por, atendido_por, usa_telefono, cobra_en = [], [], [], [], []

    # ── Proveedores ─────────────────────────────────────────────────────
    nombres_talleres = [
        "Talleres El Rayo", "AutoFix Norte", "Mecánica La 10", "Taller Rueda Libre",
        "Enderezada Total", "Fibra y Pintura Sur",
    ]
    for nombre in nombres_talleres:
        talleres.append({"nombre": nombre})
    nombres_peritos = ["Nelson Vinueza", "Karla Andrade", "Julio Cepeda", "Mónica Ríos"]
    for nombre in nombres_peritos:
        peritos.append({"nombre": nombre})
    nombres_medicos = ["Dr. Aníbal Suárez", "Clínica Vial", "Dra. Rebeca Palma"]
    for nombre in nombres_medicos:
        medicos.append({"nombre": nombre})

    def nuevo_asegurado(nombre=None):
        nombre = nombre or rng.nombre()
        tel = rng.telefono()
        iban = rng.iban()
        asegurados.append({"nombre": nombre})
        telefonos.append({"numero": tel})
        cuentas.append({"iban": iban})
        usa_telefono.append({"src": nombre, "dst": tel})
        cobra_en.append({"src": nombre, "dst": iban})
        return nombre

    def nueva_poliza(dueno):
        numero = f"POL-{2026}-{len(polizas):04d}"
        polizas.append({"numero": numero})
        tiene_poliza.append({"src": dueno, "dst": numero})
        return numero

    def nuevo_vehiculo():
        placa = f"P{rng.choice('ABCDEF')}{rng.choice('XYZ')}-{rng.randint(1000, 9999)}"
        vehiculos.append({"placa": placa})
        return placa

    def nuevo_siniestro(codigo, dueno, poliza, placa, taller, perito, medico,
                        fecha, monto, estado, fraude=False):
        siniestros.append({
            "codigo": codigo, "fecha": fecha, "monto": monto,
            "estado": estado, "fraude_confirmado": fraude,
        })
        reclama.append({"src": dueno, "dst": codigo})
        bajo_poliza.append({"src": codigo, "dst": poliza})
        sobre_vehiculo.append({"src": codigo, "dst": placa})
        reparado_en.append({"src": codigo, "dst": taller})
        evaluado_por.append({"src": codigo, "dst": perito})
        if medico:
            atendido_por.append({"src": codigo, "dst": medico})

    # ── Fondo: reclamos normales ────────────────────────────────────────
    for i in range(20):
        dueno = nuevo_asegurado()
        poliza = nueva_poliza(dueno)
        placa = nuevo_vehiculo()
        if i < 14:  # no todos tienen siniestros
            nuevo_siniestro(
                codigo=f"S-2026-{100 + i}",
                dueno=dueno, poliza=poliza, placa=placa,
                taller=rng.choice(nombres_talleres[1:]),
                perito=rng.choice(nombres_peritos[1:]),
                medico=rng.choice(nombres_medicos) if i % 3 == 0 else None,
                fecha=rng.fecha(),
                monto=rng.randint(400, 5200),
                estado="pagado" if i % 5 else "en revisión",
            )

    # ── Red plantada: El Rayo + Vinueza en 5 reclamos "independientes" ──
    tel_compartido = "+593 991111111"
    telefonos.append({"numero": tel_compartido})
    cuenta_compartida = "EC99-FRAU-000777"
    cuentas.append({"iban": cuenta_compartida})

    red = []
    for k in range(5):
        dueno = nuevo_asegurado()
        red.append(dueno)
        poliza = nueva_poliza(dueno)
        placa = nuevo_vehiculo()
        nuevo_siniestro(
            codigo=f"S-FRAUDE-{k + 1:02d}",
            dueno=dueno, poliza=poliza, placa=placa,
            taller="Talleres El Rayo", perito="Nelson Vinueza",
            medico="Clínica Vial" if k % 2 == 0 else None,
            fecha=f"2026-0{4 + (k % 3)}-{8 + k:02d}",
            monto=rng.randint(4800, 9600),
            estado="en revisión",
        )
    # dos comparten teléfono, otros dos comparten cuenta de cobro
    usa_telefono.append({"src": red[0], "dst": tel_compartido})
    usa_telefono.append({"src": red[1], "dst": tel_compartido})
    cobra_en.append({"src": red[2], "dst": cuenta_compartida})
    cobra_en.append({"src": red[3], "dst": cuenta_compartida})

    # ── Vehículo reciclado: PBX-1234 bajo 3 pólizas de dueños distintos ─
    vehiculos.append({"placa": "PBX-1234"})
    duenos_pbx = [red[4], nuevo_asegurado(), nuevo_asegurado()]
    for j, dueno in enumerate(duenos_pbx):
        poliza = nueva_poliza(dueno)
        nuevo_siniestro(
            codigo=f"S-PBX-{j + 1:02d}",
            dueno=dueno, poliza=poliza, placa="PBX-1234",
            taller=rng.choice(nombres_talleres),
            perito=rng.choice(nombres_peritos),
            medico=None,
            fecha=f"2026-0{2 + j}-1{j}",
            monto=rng.randint(3000, 7000),
            estado="en revisión" if j == 0 else "pagado",
        )

    # ── Caso previo confirmado que ancla la red ─────────────────────────
    previo = nuevo_asegurado("Édgar Villamar")
    poliza_previa = nueva_poliza(previo)
    placa_previa = nuevo_vehiculo()
    nuevo_siniestro(
        codigo="S-2024-099",
        dueno=previo, poliza=poliza_previa, placa=placa_previa,
        taller="Talleres El Rayo", perito="Nelson Vinueza",
        medico="Clínica Vial",
        fecha="2024-11-20", monto=8200,
        estado="pagado", fraude=True,
    )

    db.cypher("CREATE CONSTRAINT asegurado_nombre IF NOT EXISTS FOR (a:Asegurado) REQUIRE a.nombre IS UNIQUE")
    db.cypher("CREATE CONSTRAINT siniestro_codigo IF NOT EXISTS FOR (s:Siniestro) REQUIRE s.codigo IS UNIQUE")

    load_nodes(db, "Asegurado", asegurados)
    load_nodes(db, "Poliza", polizas)
    load_nodes(db, "Siniestro", siniestros)
    load_nodes(db, "Vehiculo", vehiculos)
    load_nodes(db, "Taller", talleres)
    load_nodes(db, "Perito", peritos)
    load_nodes(db, "Medico", medicos)
    load_nodes(db, "Telefono", telefonos)
    load_nodes(db, "Cuenta", cuentas)
    load_edges(db, "Asegurado", "nombre", "TIENE_POLIZA", "Poliza", "numero", tiene_poliza)
    load_edges(db, "Asegurado", "nombre", "RECLAMA", "Siniestro", "codigo", reclama)
    load_edges(db, "Siniestro", "codigo", "BAJO_POLIZA", "Poliza", "numero", bajo_poliza)
    load_edges(db, "Siniestro", "codigo", "SOBRE_VEHICULO", "Vehiculo", "placa", sobre_vehiculo)
    load_edges(db, "Siniestro", "codigo", "REPARADO_EN", "Taller", "nombre", reparado_en)
    load_edges(db, "Siniestro", "codigo", "EVALUADO_POR", "Perito", "nombre", evaluado_por)
    load_edges(db, "Siniestro", "codigo", "ATENDIDO_POR", "Medico", "nombre", atendido_por)
    load_edges(db, "Asegurado", "nombre", "USA_TELEFONO", "Telefono", "numero", usa_telefono)
    load_edges(db, "Asegurado", "nombre", "COBRA_EN", "Cuenta", "iban", cobra_en)


QUERIES = [
    {
        "id": "proveedores-recurrentes",
        "titulo": "Talleres y peritos recurrentes en sospechas",
        "descripcion": (
            "Pares taller + perito que co-ocurren en reclamos bajo revisión "
            "de asegurados sin relación aparente — el corazón de la red."
        ),
        "cypher": """\
MATCH (s:Siniestro)-[:REPARADO_EN]->(t:Taller),
      (s)-[:EVALUADO_POR]->(p:Perito)
WHERE s.estado = 'en revisión'
WITH t, p, count(s) AS siniestros, collect(s.codigo) AS codigos,
     sum(s.monto) AS monto_en_riesgo
WHERE siniestros >= 3
RETURN t.nombre AS taller, p.nombre AS perito, siniestros,
       monto_en_riesgo, codigos
ORDER BY siniestros DESC""",
    },
    {
        "id": "reclamantes-conectados",
        "titulo": "Reclamantes que comparten teléfonos o cuentas",
        "descripcion": (
            "Asegurados “independientes” unidos por el mismo teléfono de "
            "contacto o la misma cuenta de cobro."
        ),
        "cypher": """\
MATCH (a1:Asegurado)-[r1:USA_TELEFONO|COBRA_EN]->(x)<-[r2:USA_TELEFONO|COBRA_EN]-(a2:Asegurado)
WHERE a1.nombre < a2.nombre AND type(r1) = type(r2)
RETURN labels(x)[0] AS via,
       coalesce(x.numero, x.iban) AS compartido,
       a1.nombre AS reclamante_a, a2.nombre AS reclamante_b""",
    },
    {
        "id": "vehiculo-reciclado",
        "titulo": "El mismo vehículo, varias pólizas",
        "descripcion": (
            "Vehículos que acumulan siniestros bajo pólizas y dueños "
            "distintos: chatarra que “choca” en serie."
        ),
        "cypher": """\
MATCH (v:Vehiculo)<-[:SOBRE_VEHICULO]-(s:Siniestro)-[:BAJO_POLIZA]->(po:Poliza),
      (a:Asegurado)-[:RECLAMA]->(s)
WITH v, count(DISTINCT po) AS polizas, count(DISTINCT a) AS duenos,
     collect(DISTINCT s.codigo) AS siniestros, sum(s.monto) AS monto_total
WHERE polizas >= 2
RETURN v.placa AS placa, polizas, duenos, siniestros, monto_total
ORDER BY polizas DESC""",
    },
    {
        "id": "conexion-casos-previos",
        "titulo": "Reclamos conectados con casos anteriores",
        "descripcion": (
            "Reclamos en revisión que comparten taller, perito o clínica con "
            "un fraude ya confirmado: la investigación empieza con el mapa "
            "dibujado."
        ),
        "cypher": """\
MATCH (previo:Siniestro {fraude_confirmado: true})
      -[:REPARADO_EN|EVALUADO_POR|ATENDIDO_POR]->(conector)
      <-[:REPARADO_EN|EVALUADO_POR|ATENDIDO_POR]-(nuevo:Siniestro {estado: 'en revisión'})
WITH nuevo, previo, collect(DISTINCT conector.nombre) AS conectores
RETURN nuevo.codigo AS siniestro_nuevo, conectores,
       previo.codigo AS fraude_previo, previo.fecha AS fecha_del_fraude
ORDER BY size(conectores) DESC""",
    },
    {
        "id": "comunidades-de-riesgo",
        "titulo": "Comunidades de reclamos (Louvain)",
        "descripcion": (
            "Detección de comunidades sobre toda la red: el cluster con más "
            "reclamos en revisión es la red de fraude, no un evento aislado."
        ),
        "cypher": """\
CALL algo.louvain() YIELD node_id, community
WITH node_id AS nb, community
MATCH (s:Siniestro) WHERE id(s) = id(nb)
WITH community, count(DISTINCT s.codigo) AS siniestros,
     sum(CASE WHEN s.estado = 'en revisión' THEN 1 ELSE 0 END) AS en_revision,
     collect(DISTINCT s.codigo) AS reclamos
WHERE siniestros > 1
RETURN community, siniestros, en_revision, reclamos
ORDER BY en_revision DESC
LIMIT 5""",
    },
]
