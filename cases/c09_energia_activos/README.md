# 09 · Petróleo, gas y energía — Inteligencia de activos y mantenimiento

> **La historia completa de cada activo.**

## El problema de gerencia

La información de un activo está distribuida entre sensores, órdenes de
trabajo, inspecciones, manuales, proveedores, incidentes, repuestos y el
conocimiento del personal. Cuando suena una alarma, reconstruir ese
contexto toma horas de saltar entre sistemas — y la falla ya ocurrió dos
veces antes, solo que nadie lo recuerda.

> **Referencia real** — Shell ha descrito knowledge graphs que relacionan
> datos de pruebas, límites de fabricantes y conocimiento técnico.
> **NamiDB no reemplaza SCADA ni historiadores**: es la capa de relaciones
> que los conecta.

## El grafo

```
(Equipo)-[:EN_PLANTA]->(Planta)
(Componente)-[:PARTE_DE]->(Equipo)
(Sensor)-[:MONITOREA]->(Componente)
(Sensor)-[:DISPARA]->(Alarma {activa, variable, severidad})
(Equipo)-[:TUVO_FALLA]->(Falla {modo, horas_indisponible})
(Falla)-[:PRECEDIDA_POR]->(Alarma)          ← la firma que precede la falla
(Falla)-[:EN_COMPONENTE]->(Componente)
(Componente)-[:REQUIERE]->(Repuesto {stock})
(Componente)-[:DOCUMENTADO_EN]->(Manual {seccion, tema})
(OrdenTrabajo)-[:SOBRE]->(Equipo)
(OrdenTrabajo)-[:EJECUTADA_POR]->(Tecnico {especialidad})
(Componente)-[:FABRICADO_POR]->(Fabricante {limite_operacion})
(Equipo)-[:INSPECCIONADO_POR]->(Inspeccion)
```

~137 nodos y ~231 relaciones sintéticas y deterministas (mismo grafo en
cada corrida).

## La historia plantada

La bomba **P-201** (criticidad alta, Planta Esmeraldas) tiene **dos
alarmas activas** — vibración `AL-VIB-118` y temperatura `AL-TMP-042` —
sobre su rodamiento `RDM-6205-P201`. El grafo revela lo que ningún
sistema muestra por sí solo:

- Esa **misma combinación** (vibración + temperatura) precedió dos fallas
  por *desgaste de rodamiento*: en la propia P-201 (36 h fuera) y en su
  gemela P-305 (52 h fuera).
- El manual aplicable es **MAN-BOM-12 §4.3** y el técnico **Wilson
  Cedeño** ya ejecutó las dos órdenes correctivas anteriores.
- El repuesto compartido **SKF-6205** está en **stock 0**, y otros tres
  equipos (P-305, C-102, B-417) dependen del mismo rodamiento.

## Las consultas

| id | Pregunta del deck | Qué devuelve |
|---|---|---|
| `contexto-alarma` | ¿Qué componentes se ligan a esta alarma? | Sensor → componente → equipo → planta de cada alarma activa |
| `combinacion-similar` | ¿Ocurrió antes una combinación similar? | Fallas históricas precedidas por las mismas variables hoy activas, con horas de indisponibilidad |
| `mantenimiento-aplicable` | ¿Qué mantenimiento y manual aplican? | Sección de manual + órdenes previas + técnico que las ejecutó |
| `otros-activos-componente` | ¿Qué otros activos usan el componente? | Equipos que comparten el repuesto (y su stock: ⚠ en cero) |
| `fallas-que-amenazan` | ¿Qué fallas amenazan producción o seguridad? | Ranking por criticidad × horas de indisponibilidad acumuladas |

## Correr el caso

```bash
pip install namidb
python cases/run.py energia-activos

# Persistente: el mismo grafo en tu bucket
python cases/run.py energia-activos --store "s3://mi-bucket?ns=activos&region=us-east-1"
```

## Indicadores del piloto (del deck)

Tiempo para investigar una falla · Incidentes repetidos identificados ·
Horas de indisponibilidad · Órdenes de trabajo relacionadas · Tiempo para
localizar documentación.

## De demo a piloto

1. Reemplaza `seed()` por la ingesta de tu CMMS (órdenes, fallas),
   historiador (alarmas) y bodega (repuestos) — `UNWIND $rows` por lotes,
   como hace este ejemplo.
2. Apunta `--store` a tu bucket (S3/R2/GCS/Azure) — el grafo queda
   durable y consultable por HTTP/Bolt/MCP.
3. Las cinco consultas de arriba son el arranque del piloto: cámbiales
   los tags por los de tu planta.
