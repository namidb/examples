"""Caso 14 — Agentes IA: el conocimiento interno, consultable."""
from cases.common import Rng, embed, load_edges, load_nodes

META = {
    "numero": 14,
    "slug": "agentes-conocimiento",
    "industria": "Agentes IA — El conocimiento interno, consultable",
    "titulo": "Su conocimiento, consultable por agentes.",
    "problema": (
        "El conocimiento de la organización vive en wikis, runbooks, "
        "postmortems y decisiones de arquitectura desconectadas. Un agente "
        "de IA sin contexto conectado responde con generalidades — o con "
        "documentos obsoletos."
    ),
    "conecta": [
        "Documentos", "Notas y wikilinks", "Tags", "Autores", "Proyectos",
        "Sistemas", "Decisiones (ADRs)", "Versiones", "Expertos",
        "Agentes (MCP)",
    ],
    "revela": [
        "Respuestas con fuente y contexto verificables",
        "La versión vigente, no la obsoleta",
        "Quién sabe de qué (expertos reales)",
        "Los hubs del conocimiento organizacional",
        "Conocimiento huérfano que nadie enlaza",
    ],
    "indicadores": [
        "Respuestas con fuente verificable", "Documentos obsoletos evitados",
        "Expertos identificados por tema", "Cobertura del grafo de conocimiento",
        "Tiempo de contexto para un agente",
    ],
    "referencia": (
        "NamiDB ingiere vaults de Obsidian/Markdown (wikilinks → aristas) con "
        "`namidb load-vault` y expone el grafo a agentes vía MCP (namidb-mcp). "
        "Este caso reproduce ese patrón en miniatura."
    ),
}

LEYENDA = {
    "Nota": "Runbook, postmortem, ADR o página de wiki",
    "Tag": "Etiqueta temática",
    "Persona": "Autora/or del conocimiento",
    "Proyecto": "Iniciativa de la organización",
    "Sistema": "Sistema o plataforma interna",
}

ADR_012 = "ADR-012: Migración de PostgreSQL a NamiDB para el grafo de clientes"
ADR_007 = "ADR-007: Grafo de clientes sobre PostgreSQL + JSONB"
PM_N1 = "PM-2026-03: latencia por N+1 en JSONB"
RB_HUB = "RB-001: Operación del clúster"

PREGUNTA = "por qué migramos el grafo de clientes"
_QVEC = embed(PREGUNTA)

SISTEMAS = ["grafo-clientes", "facturacion", "pipeline-datos", "plataforma-web"]
PROYECTOS = [
    "Plataforma Clientes 360", "Migración Facturación",
    "Data Lake Corporativo", "Portal Autoservicio",
]
TAGS = [
    "seguridad", "operaciones", "arquitectura", "incidentes",
    "base-de-datos", "rendimiento", "observabilidad", "onboarding",
    "api", "datos", "frontend", "compliance",
]

TEMAS = [
    "monitoreo y alertas", "gestión de credenciales", "tuning de consultas",
    "despliegues", "manejo de incidentes", "respaldo y restauración",
    "límites de tasa", "versionado de APIs", "calidad de datos",
    "escalamiento", "certificados", "migraciones de esquema",
]


def _nota(titulo, tipo, fecha, resumen, vigente=True):
    return {
        "titulo": titulo,
        "tipo": tipo,
        "fecha": fecha,
        "vigente": vigente,
        "emb": embed(f"{titulo} {resumen}"),
    }


def seed(db):
    rng = Rng(1401)

    personas = [{"nombre": "Paola Terán", "rol": "arquitecta"}]
    roles = ["sre", "backend", "datos", "seguridad", "plataforma", "qa"]
    while len(personas) < 12:
        nombre = rng.nombre()
        if all(p["nombre"] != nombre for p in personas):
            personas.append({"nombre": nombre, "rol": rng.choice(roles)})

    notas, links, tagged, autor_de, sobre, reemplaza, decide = [], [], [], [], [], [], []

    def add_nota(nota, autor, sistemas, tags, proyecto=None):
        notas.append(nota)
        autor_de.append({"src": autor, "dst": nota["titulo"]})
        for s in sistemas:
            sobre.append({"src": nota["titulo"], "dst": s})
        for t in tags:
            tagged.append({"src": nota["titulo"], "dst": t})
        if proyecto:
            decide.append({"src": nota["titulo"], "dst": proyecto})

    # ── Conocimiento plantado: la historia del grafo de clientes ────────
    add_nota(
        _nota(ADR_012, "adr", "2026-02-10",
              "Decisión de arquitectura: por qué migramos el grafo de "
              "clientes de PostgreSQL a NamiDB — relaciones de N saltos, "
              "búsqueda híbrida y costo de object storage."),
        "Paola Terán", ["grafo-clientes"], ["arquitectura", "base-de-datos"],
        proyecto="Plataforma Clientes 360",
    )
    add_nota(
        _nota(ADR_007, "adr", "2024-06-01",
              "Grafo de clientes sobre PostgreSQL con JSONB y tablas de "
              "adyacencia; decisión previa hoy reemplazada.", vigente=False),
        "Paola Terán", ["grafo-clientes"], ["arquitectura", "base-de-datos"],
    )
    reemplaza.append({"src": ADR_012, "dst": ADR_007})

    add_nota(
        _nota(PM_N1, "postmortem", "2026-03-08",
              "Postmortem: latencia por consultas N+1 al expandir relaciones "
              "de clientes en JSONB; motivó la migración del grafo de clientes."),
        "Paola Terán", ["grafo-clientes"], ["incidentes", "rendimiento"],
    )
    links.append({"src": PM_N1, "dst": ADR_012})
    links.append({"src": ADR_012, "dst": ADR_007})

    add_nota(
        _nota(RB_HUB, "runbook", "2025-01-15",
              "Runbook maestro: operación del clúster, procedimientos de "
              "guardia, contactos y decisiones operativas."),
        rng.choice(personas[1:])["nombre"], ["grafo-clientes", "pipeline-datos"],
        ["operaciones"],
    )

    # Más notas de Paola sobre grafo-clientes (experta real: 6 en total).
    add_nota(_nota("RB-014: Failover del grafo de clientes", "runbook", "2026-04-02",
                   "Failover y recuperación del grafo de clientes."),
             "Paola Terán", ["grafo-clientes"], ["operaciones"])
    add_nota(_nota("Wiki: Modelo de datos del grafo de clientes", "wiki", "2026-02-20",
                   "Etiquetas, relaciones y convenciones del grafo de clientes."),
             "Paola Terán", ["grafo-clientes"], ["arquitectura", "datos"])
    add_nota(_nota("PM-2025-11: agotamiento de conexiones", "postmortem", "2025-11-19",
                   "Pool de conexiones agotado en el grafo de clientes."),
             "Paola Terán", ["grafo-clientes"], ["incidentes"])

    # ── Pares versión vigente / obsoleta de fondo ───────────────────────
    add_nota(_nota("RB-020: Despliegue con downtime", "runbook", "2024-03-10",
                   "Despliegue con ventana de mantenimiento.", vigente=False),
             rng.choice(personas[1:])["nombre"], ["plataforma-web"], ["operaciones"])
    add_nota(_nota("RB-020 v2: Despliegue azul-verde", "runbook", "2026-01-22",
                   "Despliegue azul-verde sin downtime; reemplaza el RB-020."),
             rng.choice(personas[1:])["nombre"], ["plataforma-web"], ["operaciones"])
    reemplaza.append({"src": "RB-020 v2: Despliegue azul-verde",
                      "dst": "RB-020: Despliegue con downtime"})

    add_nota(_nota("Wiki: Política de accesos", "wiki", "2023-09-01",
                   "Política de accesos original.", vigente=False),
             rng.choice(personas[1:])["nombre"], ["plataforma-web"], ["seguridad"])
    add_nota(_nota("Wiki: Política de accesos v2", "wiki", "2026-05-05",
                   "Política de accesos vigente con revisión trimestral."),
             rng.choice(personas[1:])["nombre"], ["plataforma-web"],
             ["seguridad", "compliance"])
    reemplaza.append({"src": "Wiki: Política de accesos v2",
                      "dst": "Wiki: Política de accesos"})

    # ── Huérfanas plantadas (nadie las enlaza) ──────────────────────────
    huerfanas = [
        _nota("Nota crítica: rotación de credenciales del bucket", "wiki",
              "2026-06-01", "Rotación de credenciales del bucket de producción."),
        _nota("Wiki: Glosario de dominio", "wiki", "2024-08-14",
              "Glosario de términos del negocio."),
        _nota("RB-099: Restauración desde snapshot S3", "runbook", "2025-07-30",
              "Restauración completa desde snapshot en S3."),
        _nota("PM-2024-02: caída del portal por certificado vencido",
              "postmortem", "2024-02-12", "Certificado vencido tumbó el portal."),
    ]
    for nota in huerfanas:
        add_nota(nota, rng.choice(personas[1:])["nombre"],
                 [rng.choice(SISTEMAS)], [rng.choice(TAGS)])
    titulos_huerfanas = {n["titulo"] for n in huerfanas}

    # ── Fondo: ~52 notas repartidas entre sistemas ──────────────────────
    tipos = ["runbook", "postmortem", "wiki", "adr"]
    contador = {t: 100 for t in tipos}
    for i in range(52):
        sistema = SISTEMAS[i % len(SISTEMAS)]
        tipo = tipos[i % len(tipos)]
        contador[tipo] += 1
        tema = rng.choice(TEMAS)
        prefijo = {"runbook": "RB", "postmortem": "PM", "wiki": "Wiki", "adr": "ADR"}[tipo]
        if tipo == "wiki":
            titulo = f"Wiki: {tema.capitalize()} de {sistema} #{contador[tipo]}"
        else:
            titulo = f"{prefijo}-{contador[tipo]}: {tema} en {sistema}"
        nota = _nota(titulo, tipo, rng.fecha(rng.choice([2024, 2025, 2026])),
                     f"{tipo} sobre {tema} del sistema {sistema}.")
        proyecto = rng.choice(PROYECTOS) if tipo == "adr" else None
        add_nota(nota, rng.choice(personas[1:])["nombre"], [sistema],
                 rng.sample(TAGS, rng.randint(1, 2)), proyecto=proyecto)

    # ── Wikilinks: cobertura + hub ──────────────────────────────────────
    titulos = [n["titulo"] for n in notas]
    enlazables = [t for t in titulos if t not in titulos_huerfanas]

    # RB-001 es el hub: 15 notas distintas lo enlazan.
    fuentes_hub = [t for t in enlazables if t != RB_HUB]
    rng.shuffle(fuentes_hub)
    for src in fuentes_hub[:15]:
        links.append({"src": src, "dst": RB_HUB})

    # Toda nota no-huérfana recibe al menos un enlace (anillo barajado).
    anillo = [t for t in enlazables]
    rng.shuffle(anillo)
    ya_enlazadas = {RB_HUB, ADR_012, ADR_007}
    for i, dst in enumerate(anillo):
        if dst in ya_enlazadas:
            continue
        src = anillo[(i + 1) % len(anillo)]
        if src == dst:
            src = anillo[(i + 2) % len(anillo)]
        links.append({"src": src, "dst": dst})

    # Densidad extra entre runbooks y postmortems.
    operativas = [n["titulo"] for n in notas
                  if n["tipo"] in ("runbook", "postmortem")
                  and n["titulo"] not in titulos_huerfanas]
    for _ in range(30):
        src, dst = rng.sample(operativas, 2)
        links.append({"src": src, "dst": dst})

    # Las huérfanas sí enlazan hacia afuera (pero nadie las enlaza a ellas).
    for titulo in titulos_huerfanas:
        links.append({"src": titulo, "dst": RB_HUB})

    # dedupe de aristas repetidas del muestreo
    vistos = set()
    links_unicos = []
    for e in links:
        clave = (e["src"], e["dst"])
        if clave not in vistos and e["src"] != e["dst"]:
            vistos.add(clave)
            links_unicos.append(e)

    db.cypher("CREATE CONSTRAINT nota_titulo IF NOT EXISTS FOR (n:Nota) REQUIRE n.titulo IS UNIQUE")
    db.cypher("CREATE CONSTRAINT persona_nombre IF NOT EXISTS FOR (p:Persona) REQUIRE p.nombre IS UNIQUE")

    load_nodes(db, "Nota", notas)
    load_nodes(db, "Tag", [{"nombre": t} for t in TAGS])
    load_nodes(db, "Persona", personas)
    load_nodes(db, "Proyecto", [{"nombre": p} for p in PROYECTOS])
    load_nodes(db, "Sistema", [{"nombre": s} for s in SISTEMAS])

    load_edges(db, "Nota", "titulo", "LINKS_TO", "Nota", "titulo", links_unicos)
    load_edges(db, "Nota", "titulo", "TAGGED", "Tag", "nombre", tagged)
    load_edges(db, "Persona", "nombre", "AUTOR_DE", "Nota", "titulo", autor_de)
    load_edges(db, "Nota", "titulo", "SOBRE", "Sistema", "nombre",
               [s for s in sobre])
    load_edges(db, "Nota", "titulo", "REEMPLAZA", "Nota", "titulo", reemplaza)
    load_edges(db, "Nota", "titulo", "DECIDE_SOBRE", "Proyecto", "nombre", decide)


QUERIES = [
    {
        "id": "busqueda-hibrida-agente",
        "titulo": "La pregunta de un agente, con búsqueda híbrida",
        "descripcion": (
            "“¿Por qué migramos el grafo de clientes?” — BM25 sobre títulos "
            "+ similitud vectorial en un solo llamado. La fuente correcta "
            "gana; el agente cita, no inventa."
        ),
        "cypher": f"""\
CALL search.hybrid({{label: 'Nota', text_property: 'titulo',
                    query_text: '{PREGUNTA}',
                    vector_property: 'emb',
                    query_vector: {_QVEC},
                    k: 5}})
YIELD node, score
RETURN node.titulo AS nota, node.tipo AS tipo, node.vigente AS vigente,
       round(score * 10000) / 10000 AS score""",
    },
    {
        "id": "contexto-para-el-agente",
        "titulo": "El contexto que un agente cargaría",
        "descripcion": (
            "Alrededor de la fuente ganadora: autora, sistema, proyecto, "
            "qué enlaza y quién la enlaza. Eso es lo que MCP entrega como "
            "contexto conectado, no un fragmento suelto."
        ),
        "cypher": f"""\
MATCH (adr:Nota {{titulo: '{ADR_012}'}})
MATCH (autor:Persona)-[:AUTOR_DE]->(adr)
WITH adr, collect(DISTINCT autor.nombre) AS autores
MATCH (adr)-[:SOBRE]->(s:Sistema)
WITH adr, autores, collect(DISTINCT s.nombre) AS sistemas
MATCH (adr)-[:DECIDE_SOBRE]->(pr:Proyecto)
WITH adr, autores, sistemas, collect(DISTINCT pr.nombre) AS proyectos
MATCH (adr)-[:LINKS_TO]->(sale:Nota)
WITH adr, autores, sistemas, proyectos,
     collect(DISTINCT sale.titulo) AS enlaza_a
MATCH (entra:Nota)-[:LINKS_TO]->(adr)
RETURN adr.titulo AS nota, autores, sistemas, proyectos, enlaza_a,
       collect(DISTINCT entra.titulo) AS enlazada_desde""",
    },
    {
        "id": "version-vigente",
        "titulo": "La versión vigente, no la obsoleta",
        "descripcion": (
            "Cada REEMPLAZA le dice al agente qué documento ya no debe "
            "citar y cuál usar en su lugar."
        ),
        "cypher": """\
MATCH (nueva:Nota)-[:REEMPLAZA]->(vieja:Nota)
RETURN vieja.titulo AS obsoleta, vieja.vigente AS sigue_vigente,
       nueva.titulo AS usar_en_su_lugar, nueva.fecha AS desde
ORDER BY desde DESC""",
    },
    {
        "id": "expertos-por-tema",
        "titulo": "Quién sabe de qué (expertos reales)",
        "descripcion": (
            "La autoría conectada por sistema revela a quién preguntar — "
            "o a quién debería escalar un agente."
        ),
        "cypher": """\
MATCH (p:Persona)-[:AUTOR_DE]->(n:Nota)-[:SOBRE]->(s:Sistema)
WITH s.nombre AS sistema, p.nombre AS experto, count(DISTINCT n) AS notas
WHERE notas >= 2
RETURN sistema, experto, notas
ORDER BY sistema, notas DESC""",
    },
    {
        "id": "hubs-conocimiento",
        "titulo": "Los hubs del conocimiento (PageRank)",
        "descripcion": (
            "Las notas más enlazadas de la red de wikilinks: lo que la "
            "organización de verdad consulta y mantiene vivo."
        ),
        "cypher": """\
CALL algo.pagerank({labels: ['Nota'], edge_types: ['LINKS_TO']})
YIELD node_id, score
WITH node_id AS nb, score
MATCH (n:Nota) WHERE id(n) = id(nb)
RETURN DISTINCT n.titulo AS nota, n.tipo AS tipo,
       round(score * 10000) / 10000 AS score
ORDER BY score DESC
LIMIT 8""",
    },
    {
        "id": "conocimiento-huerfano",
        "titulo": "Conocimiento huérfano que nadie enlaza",
        "descripcion": (
            "Notas sin un solo backlink: conocimiento invisible para la "
            "navegación — y para los agentes — hasta que alguien lo conecta."
        ),
        "cypher": """\
MATCH (n:Nota)
WHERE NOT EXISTS { (n)<-[:LINKS_TO]-(:Nota) }
  AND NOT EXISTS { (n)<-[:REEMPLAZA]-(:Nota) }
RETURN n.titulo AS nota, n.tipo AS tipo, n.fecha AS fecha
ORDER BY fecha""",
    },
]
