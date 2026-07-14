# 14 · Agentes IA — Su conocimiento, consultable por agentes

> El conocimiento de la organización vive en wikis, runbooks, postmortems y
> decisiones de arquitectura desconectadas. Un agente de IA sin contexto
> conectado responde con generalidades — o con documentos obsoletos.

Este caso arma en miniatura lo que NamiDB hace con una base de conocimiento
real: las notas son nodos, los wikilinks son aristas, los embeddings viven
como propiedades — y un agente pregunta en lenguaje natural y recibe la
fuente correcta **con su contexto conectado**.

## El modelo

```
(Persona)-[:AUTOR_DE]->(Nota)-[:LINKS_TO]->(Nota)
                        (Nota)-[:TAGGED]->(Tag)
                        (Nota)-[:SOBRE]->(Sistema)
                        (Nota)-[:DECIDE_SOBRE]->(Proyecto)     # ADRs
                        (Nota)-[:REEMPLAZA]->(Nota)            # versiones
```

`Nota.emb` es un embedding del título + resumen. Aquí se genera con un
hash determinista y offline (`cases/common.py::embed`) para que la demo no
dependa de ninguna API; la mecánica de búsqueda es idéntica con embeddings
reales.

**Lo plantado en los datos** (todo determinista, `Rng(1401)`):

- `ADR-012: Migración de PostgreSQL a NamiDB para el grafo de clientes`
  (vigente) **reemplaza** a `ADR-007` (obsoleto). El postmortem
  `PM-2026-03: latencia por N+1 en JSONB` lo enlaza — la motivación.
- Paola Terán es la experta real del sistema `grafo-clientes` (6 notas).
- `RB-001: Operación del clúster` es el hub más enlazado de la red.
- Cuatro notas huérfanas sin un solo backlink — una de ellas crítica de
  seguridad.

## Las preguntas (queries)

| Query | Qué demuestra |
|---|---|
| `busqueda-hibrida-agente` | `CALL search.hybrid` (BM25 + coseno) responde “¿por qué migramos el grafo de clientes?” — gana ADR-012, la fuente vigente |
| `contexto-para-el-agente` | Todo lo que un agente cargaría alrededor de la fuente: autora, sistema, proyecto, enlaces entrantes y salientes |
| `version-vigente` | Los pares `REEMPLAZA`: qué documento ya no citar y cuál usar |
| `expertos-por-tema` | Quién escribió el conocimiento de cada sistema — a quién escalar |
| `hubs-conocimiento` | `algo.pagerank` sobre los wikilinks: las notas que sostienen la operación |
| `conocimiento-huerfano` | Notas sin backlinks: invisibles para la navegación y para los agentes |

## Correr el caso

```bash
pip install namidb
python cases/run.py agentes-conocimiento
# persistente: python cases/run.py agentes-conocimiento --store "file:///tmp/nami?ns=kb"
```

## Del ejemplo al producto real

Este caso siembra ~70 notas a mano para ser reproducible. Con NamiDB real
el pipeline es directo desde tu vault de Obsidian/Markdown:

```bash
# Ingesta un vault completo: wikilinks → LINKS_TO, tags → :Tag,
# frontmatter → propiedades; --embed añade vectores por nota.
namidb load-vault --store "s3://mi-bucket?ns=conocimiento" --embed ./mi-vault
```

Y para los agentes, el servidor MCP del producto expone este mismo grafo
como herramientas (búsqueda híbrida, expansión de contexto, Cypher):

```bash
namidb-mcp --store "s3://mi-bucket?ns=conocimiento"
```

Un agente conectado por MCP hace exactamente lo que muestran las queries
de este caso: buscar híbrido → cargar el contexto conectado → citar la
versión vigente. Los indicadores del piloto (respuestas con fuente
verificable, documentos obsoletos evitados, expertos identificados,
cobertura del grafo) salen de estas mismas consultas sobre datos reales.
