# 03 · Seguros — Redes de fraude en siniestros

> **Un siniestro nunca llega solo.**

Revisado uno por uno, cada reclamo parece legítimo: un choque, un taller,
un perito, un pago. El patrón solo aparece cuando conectas **vehículos,
talleres, peritos, médicos, teléfonos, cuentas, pólizas y reclamantes** en
un mismo grafo — y entonces deja de ser un siniestro y pasa a ser una red.

Referencia real: Zurich Switzerland investiga fraude con un grafo de
~20 millones de nodos y 35 millones de relaciones.

## El modelo

```
(Asegurado)-[:TIENE_POLIZA]->(Poliza)
(Asegurado)-[:RECLAMA]->(Siniestro)-[:BAJO_POLIZA]->(Poliza)
(Siniestro)-[:SOBRE_VEHICULO]->(Vehiculo)
(Siniestro)-[:REPARADO_EN]->(Taller)
(Siniestro)-[:EVALUADO_POR]->(Perito)
(Siniestro)-[:ATENDIDO_POR]->(Medico)
(Asegurado)-[:USA_TELEFONO]->(Telefono)
(Asegurado)-[:COBRA_EN]->(Cuenta)
```

El dataset sintético (determinista, ~150 nodos) trae una red plantada:

- **“Talleres El Rayo” + el perito “Nelson Vinueza”** co-ocurren en 5
  reclamos en revisión de asegurados sin relación aparente.
- Dos de esos reclamantes **comparten teléfono**; otros dos **comparten la
  cuenta de cobro**.
- El vehículo **PBX-1234** acumula 3 siniestros bajo 3 pólizas de dueños
  distintos.
- Un siniestro de 2024 con `fraude_confirmado: true` ancla la red al
  historial: mismo taller, mismo perito, misma clínica.

## Correlo

```bash
pip install namidb
python cases/run.py seguros-siniestros

# o persistente, en tu bucket:
python cases/run.py seguros-siniestros --store "s3://mi-bucket?ns=fraude"
```

## Qué demuestra cada query

| Query | Qué revela | Indicador del piloto |
|---|---|---|
| `proveedores-recurrentes` | El par taller+perito presente en 5 reclamos “independientes” en revisión | Proveedores recurrentes |
| `reclamantes-conectados` | Asegurados unidos por teléfono o cuenta de cobro compartida | Relaciones nuevas encontradas |
| `vehiculo-reciclado` | PBX-1234 chocando en serie bajo 3 pólizas | Valor de pagos evitados |
| `conexion-casos-previos` | Los 5 reclamos comparten proveedores con un fraude confirmado en 2024 | Reclamos ligados a casos previos |
| `comunidades-de-riesgo` | Louvain agrupa la red: el cluster top concentra los reclamos en revisión junto al fraude histórico | Minutos por investigación |

La lectura gerencial: en lugar de investigar 5 reclamos por separado
(días), el investigador abre **un** caso de red con el mapa ya dibujado
(minutos), y el pago de los 5 se detiene junto.

## Llévalo a tu desarrollo

1. Copia esta carpeta como base y reemplaza `seed()` por tu carga real
   (CSV del core asegurador, `UNWIND $rows` por lotes — ver
   `cases/common.py`).
2. Mantén las queries: son el producto. Cambia umbrales (`siniestros >= 3`,
   `monto`) a tu realidad.
3. Para producción: `namidb.Client("s3://tu-bucket?ns=fraude")` — el mismo
   código, durabilidad de object storage; o levanta `namidb-server` con la
   [imagen oficial](https://hub.docker.com/r/namidb/namidb-server) y consulta
   por HTTP/Bolt desde tus sistemas.
