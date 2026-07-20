# 18 · Abastecimiento de la finca a la góndola

**Comercio y agroindustria.** Un retailer surte miles de SKU desde decenas de
proveedores, por varios centros de distribución, a decenas de tiendas. El grafo
conecta **proveedor → CEDI → tienda → producto** (más la demanda, los lotes
perecederos, los quiebres y las sustituciones) para responder lo que a gerencia
le quita el sueño.

Datos sintéticos. Inspirado en el ecosistema real: **Corporación Favorita**
(Supermaxi/Megamaxi/Akí/Tuti, ventas USD 2 546 M en 2024, CEDI en Amaguaña) como
retailer y **Reybanpac** (Grupo Wong: banano marca Favorita, lácteos y cárnicos)
como proveedor agroindustrial integrado.

## El modelo de grafo

```
(Proveedor)-[:SUMINISTRA {exclusivo}]->(Producto)
(Proveedor)-[:ENTREGA_EN]->(Cedi)
(Cedi)-[:ABASTECE]->(Tienda)
(Tienda)-[:VENDE {unidades_sem, venta_sem}]->(Producto)
(Producto)-[:EN_CATEGORIA]->(Categoria)
(Producto)-[:SUSTITUYE_A {afinidad}]->(Producto)
(Lote {vence})-[:ES_SKU]->(Producto),  (Lote)-[:EN_TIENDA]->(Tienda)
(Quiebre {ventas_perdidas})-[:DE_SKU]->(Producto),  (Quiebre)-[:EN_TIENDA]->(Tienda)
```

## Qué revela

- **Ingreso semanal en riesgo por proveedor** — la venta de los SKU de cada
  proveedor sumada en todas las tiendas: su exposición si falla. El proveedor
  agroindustrial integrado encabeza (banano y lácteos de alta rotación).
- **SKU de proveedor único** — productos con un solo proveedor: sin plan B.
- **Causa raíz si cae un CEDI** — las tiendas que abastece CEDI Durán y la venta
  semanal expuesta si se detiene; PageRank confirma que es el nodo sistémico.
- **Merma y redistribución** — un perecedero por vencer en una tienda de baja
  rotación mientras otra está en quiebre del mismo SKU: mover el stock rescata
  la venta y evita la merma. El cruce que sólo un grafo hace fácil.
- **Sustitución** — qué quiebres se rescatan con otro producto (grafo de
  sustitución) y cuáles no tienen plan B (el queso fresco, p. ej.).

## Consultas destacadas

```bash
python cases/run.py retail-abastecimiento              # todas las consultas
```

- `proveedor-critico` — ingreso en riesgo por proveedor (traversal + agregación).
- `redistribucion` — lote por vencer ↔ tienda en quiebre del mismo SKU.
- `sustitucion` — comprensión de patrón `[(p)<-[:SUSTITUYE_A]-(s) | s.nombre]`.
- `sistemico` — `algo.pagerank` sobre toda la cadena.
