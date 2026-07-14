# 11 · Comercios y negocios — Recomendaciones y conocimiento del cliente

> **Contexto, no coincidencia.**

Los sistemas comerciales recomiendan "los más vendidos", sin comprender
relaciones entre intereses, compras, búsquedas, productos complementarios y
contexto del cliente. Este caso muestra cómo un grafo convierte el historial
en recomendaciones **explicables** — y cómo evita recomendar lo que termina
en devolución.

## La historia plantada en los datos

Andrea Villamar compró una **Cámara Nakura Z50** y un filtro UV. Alrededor de
ella hay tres comunidades reales de comportamiento (fotografía, audio,
gaming) que emergen solas de la red de co-compra:

- Los complementos legítimos de la Z50 (batería original BZ-1, lente 50mm,
  tarjeta SD, mochila fotográfica) son co-comprados por los demás dueños de
  la cámara.
- La **batería genérica BAT-X200** también es co-comprada por dueños de la
  Z50… pero **no es compatible** y ya acumula 3 devoluciones por
  incompatibilidad. Un recomendador por popularidad la sugeriría; el grafo
  la excluye y cuantifica el costo evitado.
- La búsqueda de Andrea — *"mochila para llevar cámara bajo lluvia"* — no
  coincide literalmente con ningún nombre del catálogo; la búsqueda híbrida
  (BM25 + vectores) encuentra la *Mochila fotográfica impermeable*.

## Modelo

```
(:Cliente)-[:COMPRO {fecha}]->(:Producto)-[:DE_CATEGORIA]->(:Categoria)
(:Cliente)-[:VIO]->(:Producto)          (:Producto)-[:DE_MARCA]->(:Marca)
(:Cliente)-[:HIZO]->(:Busqueda)         (:Producto)-[:COMPLEMENTA]->(:Producto)
(:Cliente)-[:GENERO]->(:Devolucion)-[:DE_PRODUCTO]->(:Producto)
(:Producto)-[:COMPATIBLE_CON]->(:Producto)
```

Los productos llevan `emb`: un embedding determinista y offline
(`cases/common.py::embed`) suficiente para la demo. En producción se
reemplaza por tu proveedor de embeddings.

## Correr el caso

```bash
pip install namidb
python cases/run.py recomendaciones
# persistente: python cases/run.py recomendaciones --store "s3://mi-bucket?ns=recs"
```

## Qué muestra cada query

| Query | Qué responde | Indicador del piloto |
|---|---|---|
| `siguiente-mejor-oferta` | Co-compra entre clientes similares, excluyendo lo ya comprado y lo incompatible | Complementarios y siguiente mejor oferta |
| `recomendacion-explicable` | La evidencia de cada sugerencia: complemento directo + nº de clientes similares + marca | Recomendaciones explicables |
| `evitar-devoluciones` | Productos que se co-compran pero no son compatibles y ya generan devoluciones | Menos devoluciones por incompatibilidad |
| `segmentos-comportamiento` | Comunidades de clientes por co-compra (`algo.label_propagation`) | Segmentos por comportamiento conectado |
| `busqueda-semantica` | `search.hybrid` (BM25 + coseno) sobre el catálogo con la intención del cliente | Atención personalizada |

## Notas de implementación

- **Anti-join**: para "clientes que NO compraron X" usamos
  `OPTIONAL MATCH … WHERE x IS NULL`; en namidb 2.0.0 un `EXISTS { }`
  correlacionado con dos extremos ligados falla en runtime.
- Los procedimientos `algo.*` devuelven el nodo sin propiedades hidratadas:
  rehidrata con `MATCH (c:Cliente) WHERE id(c) = id(binding)`.
- `search.hybrid` corre en modo scan (sin índice) — de sobra para un
  catálogo de demo; con millones de productos, construye el índice
  vectorial/BM25 desde el servidor o la CLI.

## Referencia real

eBay opera grafos con miles de millones de entidades; su recomendador
multimodal reportó ~15 % más interacción de compradores.
