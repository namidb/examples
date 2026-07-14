# 12 · Telecomunicaciones — De cien alarmas a una causa

> **El problema de gerencia.** Una sola falla genera cientos de alarmas en
> equipos, enlaces y sistemas distintos. El personal atiende síntomas en
> lugar de encontrar la causa original.

Un corte de fibra en un agregador no produce *una* alarma: produce una
tormenta — el agregador pierde señal, sus equipos de acceso reportan caída
de enlace, los servicios degradan, los clientes abren tickets. Vistas una
por una, son decenas de incidencias; vistas como grafo, son **un solo
incidente con una causa**.

## El grafo

```
(Cliente {sla})-[:CONTRATA]->(Servicio)-[:CURSA_POR]->(Equipo)
(Equipo)-[:DEPENDE_DE]->(Equipo)          # acceso → agregación → core
(Equipo)-[:CONECTADO_POR]->(Fibra)
(Equipo)-[:EMITE]->(Alarma {activa})
(Ticket)-[:REPORTA]->(Servicio)
(Incidente)-[:CAUSADO_POR]->(Fibra)       # histórico
(Alarma)-[:AGRUPADA_EN]->(Incidente)      # histórico
```

**Dataset sintético (determinista):** ~29 equipos en topología
acceso → agregación → core, ~49 servicios y clientes (5 premium),
~41 alarmas. Patrón plantado: la fibra **F-33** del agregador
**AGG-NORTE-02** está cortada — el agregador y sus 8 equipos aguas abajo
emiten 23 alarmas activas en cascada, mientras 2 eventos aislados en otras
zonas hacen de ruido. La misma F-33 ya causó dos incidentes este año.

## Las queries

| Query | Pregunta del deck | Cómo la responde el grafo |
|---|---|---|
| `causa-raiz` | Causa raíz identificada | Equipo alarmado cuyo padre topológico está sano; el tamaño del subárbol alarmado lo confirma como origen de la cascada |
| `impacto-clientes` | Clientes y servicios afectados conocidos | Todo lo que cursa por el subárbol del corte, separado por SLA |
| `alarmas-agrupadas` | Menos escalaciones innecesarias | 23 alarmas colapsan en un incidente; 2 quedan como eventos aislados |
| `incidente-repetido` | Casos ligados a incidentes anteriores | La fibra del corte ya causó INC-2026-031 e INC-2026-007: daño recurrente, candidata a reposición |
| `priorizacion-sla` | Incidentes priorizados por impacto | Ranking de equipos alarmados por clientes premium conectados |

## Correr el caso

```bash
pip install namidb
python cases/run.py telecom-causa-raiz

# o contra tu bucket (el grafo queda en tu S3/R2/GCS):
python cases/run.py telecom-causa-raiz --store "s3://mi-bucket?ns=noc&region=us-east-1"
```

## Indicadores del piloto (deck)

Tiempo medio de reparación · Alarmas agrupadas por incidente · Incidentes
repetidos · Clientes afectados identificados · Cumplimiento de SLA.

> **Referencia real.** China Telecom ha utilizado knowledge graphs para
> relacionar fallas e identificar relaciones causales, mejorando su
> capacidad predictiva.
