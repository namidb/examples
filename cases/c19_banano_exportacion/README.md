# 19 · Banano de Ecuador al mundo

**Agro-exportación.** El corazón del negocio bananero: cada caja recorre
**finca → empacadora → embarque → naviera → ruta → mercado → cliente**. El grafo
conecta ese recorrido con el precio realizado, los reclamos de calidad y la
cadena de frío.

Datos sintéticos. Inspirado en **Reybanpac** (Grupo Wong), 2.º exportador
bananero del Ecuador (banano marca Favorita). Anclas reales 2026: precio mínimo
de sustentación (PMS) de la caja 22XU = **USD 7,50** y FOB de referencia =
**USD 9,75** (MAG); la **Unión Europea** es el mayor comprador (~30 %).

## El modelo de grafo

```
(Empacadora)-[:EMPACA_DE]->(Finca)
(Empacadora)-[:PRODUJO]->(Embarque {cajas, temp_reefer, fob_caja})
(Embarque)-[:DE_FINCA]->(Finca)          # linaje para trazar reclamos
(Embarque)-[:VIA_NAVIERA]->(Naviera)
(Embarque)-[:POR_RUTA]->(Ruta)-[:HACIA]->(Mercado)
(Embarque)-[:VENDIDO_A {cajas, precio_caja, fob}]->(Cliente)-[:EN_MERCADO]->(Mercado)
(Reclamo {tipo, cajas_afectadas, monto})-[:SOBRE]->(Embarque),  (Reclamo)-[:DESDE]->(Mercado)
```

## Qué revela

- **Concentración de mercado y de cliente** — FOB por mercado (la UE ~30 %) y
  por importador: de quién depende la facturación.
- **Precio realizado vs precio oficial** — precio promedio por caja por mercado
  contra el PMS (7,50) y el FOB de referencia (9,75). La UE paga premium; Rusia
  (spot) queda por debajo del FOB.
- **Causa raíz de los reclamos** — del reclamo hacia atrás a la empacadora y la
  finca; una empacadora concentra la tasa de reclamo.
- **Cadena de frío por naviera** — daño de frío y temperatura reefer por línea
  marítima: una corre más caliente y acumula el daño.
- **Premium por certificación** — orgánico y Rainforest capturan el mayor
  premium sobre el PMS.

## Consultas destacadas

```bash
python cases/run.py banano-exportacion
```

- `mercado-mix` — concentración por mercado (UE ~30 %).
- `causa-raiz-empacadora` — tasa de reclamo por empacadora, con finca de origen.
- `precio-realizado` — precio por mercado vs PMS y FOB de referencia.
- `naviera-frio` — daño de frío por línea marítima.
