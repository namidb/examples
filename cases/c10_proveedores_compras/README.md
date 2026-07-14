# 10 · Industria — Inteligencia de proveedores y compras

> **Un proveedor, una sola verdad.**

## El problema de gerencia

El mismo proveedor aparece con distintos nombres o códigos en varios ERP.
Eso oculta el gasto consolidado, la dependencia, los riesgos y las
oportunidades de negociación.

En este dataset sintético, **"Aceros Andinos"** existe tres veces — como
`Aceros Andinos S.A.` (SAP), `ACEROS ANDINOS` (Oracle) y
`Aceros Andinos Cía. Ltda.` (Odoo) — con el mismo RUC. Cada sistema le ve
compras de 260–380 k; el gasto real consolidado supera los **950 k**, lo
que lo convierte en el proveedor #1 de la compañía… invisible en
cualquier ERP aislado.

## El modelo de grafo

```
(:OrdenCompra {numero, monto, fecha, sistema})
    -[:EMITIDA_A]->   (:Proveedor {nombre, codigo_erp, sistema, ruc})
    -[:DESDE_PLANTA]-> (:Planta)
    -[:POR_MATERIA]->  (:MateriaPrima {nombre, critica})

(:Proveedor)-[:PERTENECE_A]->(:GrupoEmpresarial)
(:Proveedor)-[:SUMINISTRA {precio_unitario}]->(:MateriaPrima)
(:Proveedor)-[:CON_CONTRATO]->(:Contrato {vence})
(:Proveedor)-[:CON_CERTIFICADO]->(:Certificado {tipo, vence})
(:Proveedor)-[:EXPUESTO_A]->(:Riesgo)
```

La clave del caso: la identidad real es el **RUC**, no el registro del
ERP. Todas las preguntas de negociación se responden agregando por RUC.

## Correr el caso

```bash
pip install namidb
python cases/run.py proveedores-compras

# o con storage durable (el bucket es la base de datos):
python cases/run.py proveedores-compras --store "s3://mi-bucket?ns=compras"
```

## Qué muestra cada query

| Query | Pregunta de gerencia | Qué revela aquí |
|---|---|---|
| `proveedores-duplicados` | ¿Cuántos proveedores son en realidad la misma empresa? | El RUC `1790012345001` con 3 registros en SAP/Oracle/Odoo |
| `gasto-consolidado` | ¿Quién es nuestro proveedor #1 real? | Aceros Andinos con 950 k consolidados (13 órdenes), por encima del top aparente de cada ERP |
| `dependencia-critica` | ¿Qué materias críticas dependen de un solo proveedor real? | `plancha de acero naval`: 100 % de las compras van al mismo RUC aunque "parecen" tres proveedores |
| `compras-fuera-contrato` | ¿Compramos después de que venció el contrato? | 2 órdenes (130 k) emitidas tras el vencimiento de `CT-ORA-2201` |
| `alternativas-negociacion` | ¿Con qué alternativa certificada podemos negociar? | `Siderúrgica del Litoral` (ISO 9001 vigente) a 1 085 vs 1 210 actuales: **125 de ahorro unitario** |

## Indicadores del piloto (del deck)

- Proveedores duplicados
- Gasto consolidado descubierto
- Dependencia de proveedores críticos
- Tiempo para preparar una negociación
- Alternativas de suministro encontradas
- Contratos o certificados vencidos

> **Referencia real** — ALTANA consolidó compras de 35 sistemas ERP con
> una base de grafos; predicciones de precios con ~5 % de desviación.

## Notas de implementación

- La deduplicación se hace **agregando por `ruc`** en Cypher; en un
  proyecto real puedes materializarla con `MERGE` hacia un nodo canónico
  `(:ProveedorReal {ruc})`.
- El anti-join "proveedores sin órdenes" usa
  `WHERE NOT alt.codigo_erp IN con_ordenes` (lista recolectada al inicio
  de la query) — más robusto que un `OPTIONAL MATCH` correlacionado.
- Datos 100 % sintéticos y deterministas (`Rng(1001)`): cada corrida
  produce exactamente el mismo grafo.
