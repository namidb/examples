"""Caso 13 — Ciberseguridad: rutas de ataque y priorización de vulnerabilidades.

Contexto defensivo (blue-team / SOC). Datos 100 % sintéticos. La tesis del
deck: la prioridad de una vulnerabilidad no es su CVSS, sino si está en un
camino real hacia un activo crítico.

Como las herramientas reales de análisis de rutas de ataque (p. ej.
BloodHound), la alcanzabilidad se precomputa: durante el seed hacemos el BFS
en Python siguiendo el pivoteo de credenciales y materializamos aristas
RUTA_ATAQUE (Dispositivo)->(Servidor). Así las consultas son directas y
explicables, y el grafo guarda el porqué.
"""
from collections import defaultdict, deque

from cases.common import load_edges, load_nodes

META = {
    "numero": 13,
    "slug": "ciberseguridad",
    "industria": "Ciberseguridad — Rutas de ataque y priorización de vulnerabilidades",
    "titulo": "Priorice el riesgo que se propaga.",
    "problema": (
        "Miles de vulnerabilidades, pero no todas presentan el mismo riesgo. "
        "La prioridad depende de cómo están conectados usuarios, activos, "
        "identidades, aplicaciones y permisos."
    ),
    "conecta": [
        "Usuarios e identidades", "Dispositivos", "Servidores", "Aplicaciones",
        "Vulnerabilidades", "Permisos", "Credenciales", "Alertas",
        "Técnicas de ataque", "Controles",
    ],
    "revela": [
        "Rutas posibles hacia activos críticos",
        "Alertas agrupadas por incidente",
        "Priorización por exposición real",
        "Ataques ligados a controles defensivos",
        "Memoria histórica para el SOC",
        "Riesgo explicable ante la gerencia",
    ],
    "indicadores": [
        "Rutas posibles hacia activos críticos", "Alertas agrupadas por incidente",
        "Priorización por exposición real", "Ataques ligados a controles defensivos",
        "Memoria histórica para el SOC", "Riesgo explicable ante la gerencia",
    ],
    "referencia": (
        "MITRE mantiene D3FEND (knowledge graph de contramedidas) y ATT&CK "
        "(tácticas y técnicas reales de adversarios). Radical, socio fundador "
        "enfocado en ciberseguridad e infraestructura crítica."
    ),
}

LEYENDA = {
    "Dispositivo": "Laptop / estación de trabajo",
    "Servidor": "Servidor (con criticidad)",
    "Identidad": "Cuenta / identidad",
    "Vulnerabilidad": "CVE en una aplicación",
    "Alerta": "Detección del SOC",
    "Tecnica": "Técnica ATT&CK",
    "Control": "Control defensivo",
    "Credencial": "Credencial cacheada",
}


def _build(rng_seed=1301):
    import random
    r = random.Random(rng_seed)

    usuarios, identidades, dispositivos, servidores = [], [], [], []
    aplicaciones, vulnerabilidades, alertas = [], [], []
    controles, incidentes = [], []
    usa, tiene_ident, puede_acceder = [], [], []
    corre, afectada, cacheada, de_identidad = [], [], [], []
    genero, usa_tecnica, mitiga, protege, inc_tecnica = [], [], [], [], []

    tecnicas = [
        {"id_attack": "T1566", "nombre": "Phishing"},
        {"id_attack": "T1078", "nombre": "Cuentas validas (pivoteo)"},
        {"id_attack": "T1003", "nombre": "Volcado de credenciales"},
        {"id_attack": "T1210", "nombre": "Explotacion de servicio remoto"},
        {"id_attack": "T1021", "nombre": "Servicios remotos (RDP/SSH)"},
        {"id_attack": "T1486", "nombre": "Cifrado para impacto"},
    ]

    for i in range(9):
        servidores.append({"hostname": f"SRV-{i:02d}", "criticidad": "media", "datos": "operacional"})
    servidores.append({"hostname": "SRV-APP-01", "criticidad": "alta", "datos": "app de negocio"})
    servidores.append({"hostname": "SRV-DB-CLIENTES", "criticidad": "critica", "datos": "PII de clientes"})
    servidores.append({"hostname": "SRV-TEST-99", "criticidad": "media", "datos": "laboratorio aislado"})

    areas = ["Finanzas", "Marketing", "TI", "Operaciones", "RRHH", "Legal"]
    nombres = ["Marco", "Daniela", "Sofia", "Ivan", "Paula", "Hector", "Rosa",
               "Andres", "Camila", "Diego", "Elena", "Jorge", "Lucia", "Raul"]
    apellidos = ["Vega", "Ponce", "Rojas", "Cruz", "Salazar", "Vera"]
    for i in range(14):
        nombre = f"{nombres[i]} {r.choice(apellidos)}"
        host = f"WKS-{i:02d}"
        cuenta = f"{nombres[i].lower()}.{i}"
        usuarios.append({"nombre": nombre, "area": r.choice(areas)})
        dispositivos.append({"hostname": host, "expuesto_internet": i in (2, 5, 11)})
        identidades.append({"cuenta": cuenta, "privilegio": "usuario"})
        usa.append({"src": nombre, "dst": host})
        tiene_ident.append({"src": nombre, "dst": cuenta})
        for s in r.sample([s["hostname"] for s in servidores[:9]], r.randint(1, 2)):
            puede_acceder.append({"src": cuenta, "dst": s})

    for i in range(13):
        app = {"nombre": f"app-{i:02d}"}
        aplicaciones.append(app)
        corre.append({"src": r.choice([s["hostname"] for s in servidores[:9]]), "dst": app["nombre"]})
        cve = {"cve": f"CVE-2026-{2000 + i}", "cvss": round(r.uniform(3.0, 9.6), 1), "en_kev": r.random() < 0.25}
        vulnerabilidades.append(cve)
        afectada.append({"src": app["nombre"], "dst": cve["cve"]})

    # ── LA RUTA DE ATAQUE (la tesis del deck) ──────────────────────────
    usuarios.append({"nombre": "Renata Ibanez", "area": "Marketing"})
    dispositivos.append({"hostname": "LAP-MKT-07", "expuesto_internet": True})
    identidades.append({"cuenta": "renata.mkt", "privilegio": "usuario"})
    usa.append({"src": "Renata Ibanez", "dst": "LAP-MKT-07"})
    tiene_ident.append({"src": "Renata Ibanez", "dst": "renata.mkt"})

    identidades.append({"cuenta": "svc-backup", "privilegio": "admin"})
    cacheada.append({"src": "cred:svc-backup", "dst": "LAP-MKT-07"})
    de_identidad.append({"src": "cred:svc-backup", "dst": "svc-backup"})
    puede_acceder.append({"src": "svc-backup", "dst": "SRV-APP-01"})
    puede_acceder.append({"src": "SRV-APP-01", "dst": "SRV-DB-CLIENTES"})

    aplicaciones.append({"nombre": "portal-negocio"})
    corre.append({"src": "SRV-APP-01", "dst": "portal-negocio"})
    vulnerabilidades.append({"cve": "CVE-2026-1187", "cvss": 7.5, "en_kev": True})
    afectada.append({"src": "portal-negocio", "dst": "CVE-2026-1187"})

    # CONTRASTE: CVSS 9.8 en un servidor aislado, sin ruta.
    aplicaciones.append({"nombre": "sandbox-tool"})
    corre.append({"src": "SRV-TEST-99", "dst": "sandbox-tool"})
    vulnerabilidades.append({"cve": "CVE-2026-0042", "cvss": 9.8, "en_kev": False})
    afectada.append({"src": "sandbox-tool", "dst": "CVE-2026-0042"})

    alertas += [
        {"codigo": "ALR-9001", "timestamp": "2026-07-13T08:12:00", "tecnica": "T1566"},
        {"codigo": "ALR-9002", "timestamp": "2026-07-13T08:41:00", "tecnica": "T1078"},
    ]
    genero += [{"src": "LAP-MKT-07", "dst": "ALR-9001"}, {"src": "LAP-MKT-07", "dst": "ALR-9002"}]
    usa_tecnica += [{"src": "ALR-9001", "dst": "T1566"}, {"src": "ALR-9002", "dst": "T1078"}]
    for i in range(8):
        host = f"WKS-{r.randint(0, 13):02d}"
        code = f"ALR-{2000 + i}"
        tech = r.choice(["T1566", "T1021", "T1003"])
        alertas.append({"codigo": code, "timestamp": f"2026-07-1{r.randint(0,2)}T1{i}:00:00", "tecnica": tech})
        genero.append({"src": host, "dst": code})
        usa_tecnica.append({"src": code, "dst": tech})

    controles = [
        {"nombre": "MFA corporativo", "tipo": "identidad"},
        {"nombre": "EDR en endpoints", "tipo": "endpoint"},
        {"nombre": "Segmentacion de red", "tipo": "red"},
    ]
    mitiga += [{"src": "MFA corporativo", "dst": "T1078"},
               {"src": "EDR en endpoints", "dst": "T1003"},
               {"src": "Segmentacion de red", "dst": "T1210"}]
    protege += [{"src": "MFA corporativo", "dst": "SRV-DB-CLIENTES"},
                {"src": "Segmentacion de red", "dst": "SRV-DB-CLIENTES"}]

    incidentes += [{"codigo": "INC-2026-031", "fecha": "2026-05-02", "tecnica": "T1078"},
                   {"codigo": "INC-2026-018", "fecha": "2026-04-11", "tecnica": "T1021"}]
    inc_tecnica += [{"src": "INC-2026-031", "dst": "T1078"},
                    {"src": "INC-2026-018", "dst": "T1021"}]

    # ── BFS: materializar RUTA_ATAQUE dispositivo -> servidor ──────────
    salientes = defaultdict(list)
    cred_ident = {c["src"]: c["dst"] for c in de_identidad}
    for c in cacheada:
        ident = cred_ident.get(c["src"])
        if ident:
            salientes[("D", c["dst"])].append(("I", ident))
    cuentas = {i["cuenta"] for i in identidades}
    hosts = {s["hostname"] for s in servidores}
    for pa in puede_acceder:
        if pa["src"] in cuentas:
            salientes[("I", pa["src"])].append(("S", pa["dst"]))
        elif pa["src"] in hosts:
            salientes[("S", pa["src"])].append(("S", pa["dst"]))

    disp_con_alerta = {g["src"] for g in genero}
    ruta_ataque = []
    for disp in dispositivos:
        if disp["hostname"] not in disp_con_alerta:
            continue
        origen = ("D", disp["hostname"])
        visto, cola, alcanzados = {origen}, deque([(origen, 0)]), {}
        while cola:
            nodo, saltos = cola.popleft()
            for sig in salientes.get(nodo, []):
                if sig in visto:
                    continue
                visto.add(sig)
                if sig[0] == "S":
                    alcanzados[sig[1]] = min(saltos + 1, alcanzados.get(sig[1], 99))
                cola.append((sig, saltos + 1))
        for host, saltos in alcanzados.items():
            ruta_ataque.append({"src": disp["hostname"], "dst": host, "saltos": saltos})

    return dict(
        usuarios=usuarios, identidades=identidades, dispositivos=dispositivos,
        servidores=servidores, aplicaciones=aplicaciones, vulnerabilidades=vulnerabilidades,
        alertas=alertas, tecnicas=tecnicas, controles=controles, incidentes=incidentes,
        usa=usa, tiene_ident=tiene_ident, puede_acceder=puede_acceder, corre=corre,
        afectada=afectada, cacheada=cacheada, de_identidad=de_identidad, genero=genero,
        usa_tecnica=usa_tecnica, mitiga=mitiga, protege=protege, inc_tecnica=inc_tecnica,
        ruta_ataque=ruta_ataque,
    )


def seed(db):
    d = _build()
    db.cypher("CREATE CONSTRAINT srv_host IF NOT EXISTS FOR (s:Servidor) REQUIRE s.hostname IS UNIQUE")
    db.cypher("CREATE CONSTRAINT dev_host IF NOT EXISTS FOR (x:Dispositivo) REQUIRE x.hostname IS UNIQUE")
    db.cypher("CREATE CONSTRAINT cve_id IF NOT EXISTS FOR (v:Vulnerabilidad) REQUIRE v.cve IS UNIQUE")

    load_nodes(db, "Usuario", d["usuarios"])
    load_nodes(db, "Identidad", d["identidades"])
    load_nodes(db, "Dispositivo", d["dispositivos"])
    load_nodes(db, "Servidor", d["servidores"])
    load_nodes(db, "Aplicacion", d["aplicaciones"])
    load_nodes(db, "Vulnerabilidad", d["vulnerabilidades"])
    load_nodes(db, "Alerta", d["alertas"])
    load_nodes(db, "Tecnica", d["tecnicas"])
    load_nodes(db, "Control", d["controles"])
    load_nodes(db, "Incidente", d["incidentes"])
    load_nodes(db, "Credencial", [{"cid": "cred:svc-backup", "tipo": "token de servicio"}])

    ident_cuentas = {i["cuenta"] for i in d["identidades"]}
    srv_hosts = {s["hostname"] for s in d["servidores"]}
    load_edges(db, "Usuario", "nombre", "USA", "Dispositivo", "hostname", d["usa"])
    load_edges(db, "Usuario", "nombre", "TIENE_IDENTIDAD", "Identidad", "cuenta", d["tiene_ident"])
    load_edges(db, "Identidad", "cuenta", "PUEDE_ACCEDER", "Servidor", "hostname",
               [e for e in d["puede_acceder"] if e["src"] in ident_cuentas])
    load_edges(db, "Servidor", "hostname", "PUEDE_ACCEDER", "Servidor", "hostname",
               [e for e in d["puede_acceder"] if e["src"] in srv_hosts])
    load_edges(db, "Servidor", "hostname", "CORRE", "Aplicacion", "nombre", d["corre"])
    load_edges(db, "Aplicacion", "nombre", "AFECTADA_POR", "Vulnerabilidad", "cve", d["afectada"])
    load_edges(db, "Credencial", "cid", "CACHEADA_EN", "Dispositivo", "hostname", d["cacheada"])
    load_edges(db, "Credencial", "cid", "DE_IDENTIDAD", "Identidad", "cuenta", d["de_identidad"])
    load_edges(db, "Dispositivo", "hostname", "GENERO", "Alerta", "codigo", d["genero"])
    load_edges(db, "Alerta", "codigo", "USA_TECNICA", "Tecnica", "id_attack", d["usa_tecnica"])
    load_edges(db, "Control", "nombre", "MITIGA", "Tecnica", "id_attack", d["mitiga"])
    load_edges(db, "Control", "nombre", "PROTEGE", "Servidor", "hostname", d["protege"])
    load_edges(db, "Incidente", "codigo", "USA_TECNICA", "Tecnica", "id_attack", d["inc_tecnica"])
    load_edges(db, "Dispositivo", "hostname", "RUTA_ATAQUE", "Servidor", "hostname",
               d["ruta_ataque"], rel_props=["saltos"])


QUERIES = [
    {
        "id": "rutas-a-criticos",
        "titulo": "Rutas posibles hacia activos criticos",
        "descripcion": "Dispositivos expuestos, con alertas activas, cuyo pivoteo de credenciales alcanza un servidor critico. La ruta esta materializada.",
        "cypher": """MATCH (d:Dispositivo {expuesto_internet: true})-[r:RUTA_ATAQUE]->(s:Servidor {criticidad: 'critica'})
MATCH (d)-[:GENERO]->(a:Alerta)
RETURN d.hostname AS origen, s.hostname AS destino_critico,
       r.saltos AS saltos, collect(DISTINCT a.tecnica) AS tecnicas_detectadas""",
    },
    {
        "id": "priorizacion-real",
        "titulo": "Priorizacion por exposicion real (no por CVSS)",
        "descripcion": "La misma lista de CVEs, reordenada por riesgo real: estar en una ruta de ataque a un activo critico pesa mas que el CVSS. El 7.5 en ruta le gana al 9.8 aislado.",
        "cypher": """MATCH (d:Dispositivo)-[:RUTA_ATAQUE]->(sr:Servidor)
WITH collect(DISTINCT sr.hostname) AS con_ruta
MATCH (sc:Servidor {criticidad: 'critica'})
OPTIONAL MATCH (piv:Servidor)-[:PUEDE_ACCEDER*1..3]->(sc)
WITH con_ruta, collect(DISTINCT piv.hostname) AS pivotan
MATCH (s:Servidor)-[:CORRE]->(app:Aplicacion)-[:AFECTADA_POR]->(v:Vulnerabilidad)
WITH v, s, (s.hostname IN con_ruta) AS en_ruta,
     (s.criticidad = 'critica' OR s.hostname IN pivotan) AS a_critico
WITH v, s, en_ruta,
     (CASE WHEN en_ruta THEN 60 ELSE 0 END)
     + (CASE WHEN a_critico THEN 40 ELSE 0 END)
     + (CASE WHEN v.en_kev THEN 30 ELSE 0 END)
     + v.cvss AS riesgo_real
RETURN v.cve AS cve, v.cvss AS cvss, v.en_kev AS explotada_real,
       s.hostname AS servidor, s.criticidad AS criticidad,
       en_ruta AS en_ruta_de_ataque, round(riesgo_real * 10) / 10 AS riesgo_real
ORDER BY riesgo_real DESC
LIMIT 8""",
    },
    {
        "id": "alertas-por-incidente",
        "titulo": "Alertas agrupadas por incidente",
        "descripcion": "Las detecciones sueltas se agrupan por el dispositivo que las origino: de un punado de alertas a un incidente con narrativa.",
        "cypher": """MATCH (d:Dispositivo)-[:GENERO]->(a:Alerta)-[:USA_TECNICA]->(t:Tecnica)
WITH d, count(DISTINCT a) AS alertas, collect(DISTINCT t.nombre) AS tecnicas
WHERE alertas >= 2
RETURN d.hostname AS dispositivo, d.expuesto_internet AS expuesto, alertas, tecnicas
ORDER BY alertas DESC""",
    },
    {
        "id": "control-que-corta",
        "titulo": "Ataques ligados a controles defensivos",
        "descripcion": "Para las tecnicas presentes en las rutas de ataque activas, que control existente las mitiga - la respuesta ejecutable.",
        "cypher": """MATCH (d:Dispositivo)-[:RUTA_ATAQUE]->(s:Servidor {criticidad: 'critica'})
MATCH (d)-[:GENERO]->(a:Alerta)-[:USA_TECNICA]->(t:Tecnica)
MATCH (c:Control)-[:MITIGA]->(t)
RETURN DISTINCT t.id_attack AS tecnica, t.nombre AS nombre_tecnica,
       c.nombre AS control_que_corta, c.tipo AS tipo
ORDER BY tecnica""",
    },
    {
        "id": "memoria-soc",
        "titulo": "Memoria historica para el SOC",
        "descripcion": "Incidentes pasados que usaron las mismas tecnicas detectadas hoy: el ataque de hoy no es el primero.",
        "cypher": """MATCH (:Dispositivo)-[:GENERO]->(:Alerta)-[:USA_TECNICA]->(t:Tecnica)
WITH collect(DISTINCT t.id_attack) AS tecnicas_hoy
MATCH (inc:Incidente)-[:USA_TECNICA]->(t2:Tecnica)
WHERE t2.id_attack IN tecnicas_hoy
RETURN inc.codigo AS incidente, inc.fecha AS fecha,
       t2.id_attack AS tecnica, t2.nombre AS nombre_tecnica
ORDER BY fecha DESC""",
    },
    {
        "id": "riesgo-explicable",
        "titulo": "Riesgo explicable ante la gerencia",
        "descripcion": "Por cada activo critico: desde donde se le puede llegar, que vulnerabilidades hay en la ruta y que controles lo protegen hoy.",
        "cypher": """MATCH (d:Dispositivo)-[:RUTA_ATAQUE]->(crit:Servidor {criticidad: 'critica'})
WITH crit, collect(DISTINCT d.hostname) AS origenes_de_ataque
MATCH (paso:Servidor)-[:PUEDE_ACCEDER*1..3]->(crit)
MATCH (paso)-[:CORRE]->(ap:Aplicacion)-[:AFECTADA_POR]->(v:Vulnerabilidad)
WITH crit, origenes_de_ataque, collect(DISTINCT v.cve) AS vulnerabilidades_en_ruta
MATCH (c:Control)-[:PROTEGE]->(crit)
RETURN crit.hostname AS activo_critico, crit.datos AS datos,
       origenes_de_ataque, vulnerabilidades_en_ruta,
       collect(DISTINCT c.nombre) AS controles_existentes""",
    },
]
