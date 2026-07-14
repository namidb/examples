# 07 · Agro y alimentos — Trazabilidad de la finca al consumidor

> **Cada lote cuenta su historia.**

## El problema de gerencia

Ante contaminación o incumplimiento, las empresas tardan demasiado en
determinar de qué finca, lote, proveedor o transporte provino el problema.
Mientras tanto, la respuesta por defecto es retirar *toda* la producción —
el costo de no saber es masivo.

## El grafo

```
(Productor)-[:OPERA]->(Finca)-[:TIENE_PARCELA]->(Parcela)
(Tratamiento)-[:APLICADO_EN {fecha}]->(Parcela)
(Tratamiento)-[:USA_INSUMO]->(Insumo)
(Cosecha)-[:COSECHADA_DE]->(Parcela)
(Cosecha)-[:PRODUCE]->(Lote)          # lote físico inmediato
(Cosecha)-[:APORTA_A]->(Lote)         # linaje al lote comercializable final
(Lote)-[:MEZCLADO_EN]->(Lote)         # mezcla de lotes en planta
(Lote)-[:TRANSPORTADO_POR]->(Transporte {temperatura_max})
(Lote)-[:ALMACENADO_EN]->(Bodega) | [:PROCESADO_EN]->(Planta)
(Lote)-[:DISTRIBUIDO_A]->(Distribuidor) | [:VENDIDO_EN]->(PuntoVenta)
(Finca)-[:CERTIFICADA_CON]->(Certificacion {vigente_hasta})
```

La arista `APORTA_A` materializa el linaje cosecha → lote final (a través
de mezclas en planta). Es el truco de modelado que vuelve la trazabilidad
una consulta plana, sin caminos de longitud variable.

## La trama plantada

El lote compuesto **L-2026-0087** (cacao) dio positivo a residuo químico en
el Mercado Central. Fue mezclado en planta desde dos lotes de fincas
distintas. Un segundo positivo (**L-2026-0093**) apareció en otro retail,
de otra finca y otro distribuidor. Lo único que comparten sus cadenas: el
insumo **AGQ-77** aplicado en campo. Ese mismo insumo tocó dos lotes más
que **aún no llegaron al consumidor** — uno en bodega, otro en un
distribuidor. Además: un transporte rompió la cadena de frío y un lote
exportable necesita su dossier de certificaciones.

## Las consultas

| Query | Qué demuestra |
|---|---|
| `historia-del-lote` | Reconstrucción completa hacia atrás del lote en alerta: origen, cosecha, parcela, insumos, finca, productor. |
| `origen-contaminacion` | La intersección de las cadenas de los positivos delata al insumo común (AGQ-77) — 2 lotes alcanzados vs 1 del resto. |
| `retiro-selectivo` | Los 2 lotes por retirar y dónde interceptarlos hoy (bodega / distribuidor). Se retiran 2 lotes, no la producción entera. |
| `cadena-frio` | Lotes cuyo transporte superó los 8 °C, con finca de origen para el reclamo. |
| `evidencia-exportacion` | Dossier del lote exportable: certificaciones y vigencia + temperatura de transporte, con fuente verificable. |

## Correr este caso

```bash
pip install namidb
python cases/run.py agro-trazabilidad

# Persistente: el mismo grafo en tu bucket
python cases/run.py agro-trazabilidad --store "s3://mi-bucket?ns=trazabilidad&region=us-east-1"
```

## Indicadores del piloto (del deck)

Tiempo para rastrear un lote · Trazabilidad completa (%) · Pérdida evitada
durante un retiro · Documentación incompleta por proveedor · Evidencia de
exportación.

> **Referencia real** — SourceTrace (reseñada por la FAO) registra el
> recorrido finca → punto de venta y acelera identificación de origen y
> retiros.
