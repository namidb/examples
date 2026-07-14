# 04 · Gobierno — Contratación pública y conflictos de interés

> **Quién está detrás de cada oferta.**

## El problema de gerencia

Ofertas aparentemente independientes pueden pertenecer al mismo beneficiario
final, o estar relacionadas con funcionarios, intermediarios o proveedores
cuestionados. Revisar cada oferta contra cada registro societario, sanción y
nómina pública a mano no escala: el conflicto vive en las **relaciones**, no
en los documentos individuales.

## El grafo

```
(Entidad)-[:CONVOCA]->(Proceso)<-[:PARA]-(Oferta)<-[:PRESENTA]-(Proveedor)
(Persona)-[:ACCIONISTA_DE {pct}]->(Proveedor)
(Persona)-[:BENEFICIARIO_FINAL]->(Proveedor)      ← resolución UBO precalculada
(Persona)-[:FUNCIONARIO_DE {cargo}]->(Entidad)
(Persona)-[:FAMILIAR_DE]->(Persona)                (simétrica)
(Proceso)-[:ADJUDICADO_A]->(Proveedor)
(Proveedor)-[:SUBCONTRATA]->(Proveedor)
(Proveedor)-[:SANCIONADO_CON]->(Sancion)
```

El dataset sintético (determinista, ~110 nodos) trae **una trama plantada**
alrededor del proceso `LICI-2026-004` (obra vial, USD 2.4 M):

- Tres ofertas "competitivas" cuyos beneficiarios finales convergen en
  **Efrén Maldonado** (dos empresas directas y una a nombre de su familiar
  Nelly — la arista `BENEFICIARIO_FINAL` materializa esa resolución, como lo
  haría un pipeline de entity resolution antes de cargar el grafo).
- **Constructora Vial Chimborazo** se constituyó 18 días antes de la
  convocatoria.
- La directora de compras del GAD convocante es accionista (30 %) de una
  de las oferentes.
- El adjudicatario subcontrata a **Áridos del Centro** (sanción vigente por
  incumplimiento), que a su vez subcontrata a un tercero.
- Efrén ya había ganado otros 3 procesos de la misma entidad este año.

Todo lo demás es fondo limpio: ~10 procesos con oferentes independientes.

## Correr el caso

```bash
pip install namidb
python cases/run.py contratacion-publica
# persistente:
python cases/run.py contratacion-publica --store "file:///tmp/nami?ns=compras"
```

## Queries ↔ indicadores del piloto

| Query | Qué demuestra | Indicador del deck |
|---|---|---|
| `ofertas-mismo-beneficiario` | Colusión: ofertas de un proceso con el mismo UBO | Alertas de propiedad común |
| `empresas-recien-creadas` | Vehículos constituidos a días de la convocatoria | Procesos revisados antes de adjudicar |
| `conflicto-funcionarios` | Funcionaria convocante con acciones en una oferente | Alertas confirmadas |
| `conexiones-sancionados` | Sanciones a 1–2 saltos vía subcontratación | Proveedores relacionados identificados |
| `concentracion-beneficiario` | 4 procesos / USD 4.2 M en un solo beneficiario | Concentración por beneficiario final |
| `red-subcontratacion` | Quién ejecuta de verdad el contrato | Tiempo de debida diligencia |

## Notas de implementación

- Las fechas se guardan como ISO-8601 (comparables lexicográficamente) más
  un entero `*_dias` (días desde 2026-01-01) para poder restar en Cypher.
- `BENEFICIARIO_FINAL` se calcula en el seed: en producción es el paso de
  consolidación societaria (participaciones + parentesco) previo a la carga.
- Referencia real del deck: **Open Ownership** — los datos de beneficiarios
  finales permiten detectar conflictos de interés y alertar colusión.
