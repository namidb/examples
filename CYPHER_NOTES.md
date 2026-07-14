# Notas de Cypher en NamiDB 2.0.0

Patrones que aprendimos construyendo los catorce casos, contra el wheel
`namidb==2.0.0`. Útiles al escribir tus propias consultas: el dialecto es
Cypher/GQL estándar, pero hay bordes que conviene conocer.

## Nombra siempre los nodos intermedios

Un nodo anónimo en medio de un patrón multi-salto puede hacer que el `MATCH`
devuelva cero filas en silencio:

```cypher
-- ✗ evita esto
MATCH (p:Paciente)-[:TUVO]->(:Consulta)-[:DIAGNOSTICA]->(d:Diagnostico)

-- ✓ nombra el intermedio aunque no lo uses
MATCH (p:Paciente)-[:TUVO]->(c:Consulta)-[:DIAGNOSTICA]->(d:Diagnostico)
```

## `EXISTS { }`: la variable externa va primero

Dentro de un subquery `EXISTS`, el patrón debe **arrancar** en la variable ya
ligada afuera; si va como destino de un patrón que empieza en un nodo anónimo,
falla en runtime (`Expand back-reference target … is not a Node`).

```cypher
-- ✗
WHERE EXISTS { (:Consulta)-[:SOLICITA]->(t) }
-- ✓  (misma semántica, arranca en t)
WHERE EXISTS { (t)<-[:SOLICITA]-(:Consulta) }
```

`EXISTS { }` solo vive en el `WHERE`. En `RETURN`/`CASE` el motor pide
"hoist to a SemiApply"; para esos casos, materializa la condición antes con un
`MATCH`/`OPTIONAL MATCH` + bandera.

## Anti-joins: recolecta y usa `IN`, no `OPTIONAL MATCH` como existencia

Un `OPTIONAL MATCH` correlacionado sobre una variable ya ligada puede degenerar
en producto cartesiano (cuenta de más). Para "los que NO tienen X":

```cypher
-- ✓ patrón robusto de anti-join
MATCH (p:Proveedor)-[:EMITE]->(o:Orden)
WITH collect(DISTINCT o.proveedor) AS con_ordenes
MATCH (alt:Proveedor)
WHERE NOT alt.codigo IN con_ordenes
RETURN alt.nombre
```

`OPTIONAL MATCH ... WHERE x IS NULL` también funciona **si** el opcional se
ancla sobre una variable de un `MATCH` plano (no sobre otro opcional).

## Procedimientos `algo.*`: el `node_id` viene sin propiedades

`CALL algo.pagerank(...) YIELD node_id, score` entrega el nodo **sin
hidratar** (sin labels ni props). Para leer propiedades, vuelve a matchear por
identidad:

```cypher
CALL algo.pagerank({labels:['Cuenta'], edge_types:['TRANSFIERE']})
YIELD node_id, score
WITH node_id AS n, score
MATCH (c:Cuenta) WHERE id(c) = id(n)
RETURN DISTINCT c.iban, score
ORDER BY score DESC LIMIT 10
```

Procedimientos disponibles: `algo.wcc`, `algo.scc`, `algo.pagerank`,
`algo.degree`, `algo.triangle_count`, `algo.label_propagation`, `algo.louvain`,
`algo.betweenness`, `algo.shortest_path`, `algo.fastRP`.

## Búsqueda vectorial, texto e híbrida: modo scan por mapa

Los procedimientos `search.*` toman **un argumento de mapa** y entregan
`node` (ya hidratado) + `score`:

```cypher
CALL search.vector({label:'Doc', property:'emb', query:$vector, k:5})
  YIELD node, score RETURN node.titulo, score

CALL search.bm25({label:'Doc', text_property:'titulo', query:'riesgo', k:5})
  YIELD node, score RETURN node.titulo, score

CALL search.hybrid({label:'Doc', text_property:'titulo', query_text:'riesgo',
                    vector_property:'emb', query_vector:$vector, k:5})
  YIELD node, score RETURN node.titulo, score
```

Estos ejemplos usan búsqueda en modo scan (sin declarar índice), que funciona
out-of-the-box. Para escala, el servidor soporta `CREATE VECTOR INDEX` /
`CREATE FULLTEXT INDEX` como **sentencia única** (no combinada con otras
cláusulas).

## Detalles menores

- `round(x)` toma **un** argumento. Para 2 decimales: `round(x * 100) / 100`.
- No mezcles un agregado con una propiedad en la misma expresión
  (`count(x) * n.precio` falla); computa el agregado en un `WITH` y multiplica
  después.
- `RETURN DISTINCT` con 3+ columnas puede ignorar el `ORDER BY`; ordena con ≤2
  columnas o quita `DISTINCT` cuando no hay duplicados por construcción.
- Las fechas ISO (`'2026-06-20'`) comparan lexicográficamente — perfecto para
  rangos sin funciones de fecha.
- Para enumerar rutas usa saltos explícitos o `shortestPath` + `nodes(p)`; el
  var-length `-[:R*1..4]->` es ideal para alcance/existencia, no para listar los
  nodos intermedios de cada camino.
