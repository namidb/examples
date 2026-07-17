# 16 · Agro y agua — Riego y derechos de agua en cuenca bajo sequía

> **Cada gota, cada parcela, cada derecho.**

## El problema de gerencia

En sequía, la autoridad de cuenca debe priorizar concesiones y anticipar el
impacto de cada falla. Pero la red hidráulica vive en planos y hojas de
cálculo: nadie sabe en minutos qué parcelas se quedan sin agua cuando una
compuerta falla, quién extrae más de lo autorizado, ni hasta dónde llega una
contaminación. Y por gravedad, la cola del canal siempre pierde.

## El grafo

```
(Fuente)-[:ALIMENTA]->(Canal)-[:ALIMENTA]->(Compuerta)-[:ALIMENTA]->(Ramal)
(Ramal)-[:ALIMENTA]->(Ramal)              # sub-ramales
(Ramal)-[:ALIMENTA]->(Toma)-[:ALIMENTA]->(Parcela)
(Usuario)-[:TITULAR_DE]->(Concesion)-[:AUTORIZA]->(Toma)
(Usuario)-[:OPERA]->(Parcela)
(Sensor)-[:MIDE_EN]->(Canal|Ramal|Compuerta) ; (Sensor)-[:REGISTRO]->(Medicion)
(IncidenteCalidad)-[:DETECTADO_EN]->(Ramal|Canal)
```

La red de flujo usa **una sola relación `ALIMENTA`** de punta a punta: el
alcance aguas abajo/arriba es un var-length (`-[:ALIMENTA*1..6]->`) y cada
nodo de flujo lleva un entero `nivel` (orden desde la fuente) para ordenar
rutas sin `nodes(path)`.

## La trama plantada

La compuerta **CG-03 está en falla** y corta el agua a **5 parcelas (26 ha)**
aguas abajo — una de ellas con concesión de **uso humano**. La toma **TM-14**
extrae **45 l/s con derecho a 30**: 15 l/s de exceso que dejan seca la cola
(**PA-19 y PA-20**, las parcelas más lejanas, reciben 8 y 6 l/s cuando
necesitan 50 y 60). El Canal Derivación Sur queda **sobre-suscrito (111 %)**.
Un incidente de **salinidad en RM-02** obliga a notificar a los usuarios
aguas abajo. Y betweenness sobre `ALIMENTA` revela que **CG-01** es el punto
único de falla más crítico de toda la red.

## Las consultas

| Query | Qué demuestra |
|---|---|
| `impacto-falla` | Alcance aguas abajo de la compuerta en falla: 5 parcelas, cultivo, hectáreas, usuario y prioridad — en una consulta var-length. |
| `sobre-extraccion` | Tomas que exceden el caudal autorizado por su concesión, con el exceso ordenado (TM-14: +15 l/s). |
| `infraestructura-critica` | Betweenness sobre la red física: los puntos por los que pasa el agua de más parcelas (CG-01 arriba). |
| `traza-contaminacion` | Del incidente de calidad a las parcelas afectadas y usuarios a notificar, aguas abajo. |
| `cola-de-canal` | Parcelas ordenadas por distancia a la fuente: la cola sub-atendida hecha consulta. |

## Correr este caso

```bash
pip install namidb
python cases/run.py agro-riego

# Persistente: el mismo grafo en tu bucket
python cases/run.py agro-riego --store "s3://mi-bucket?ns=riego&region=us-east-1"
```

## Indicadores del piloto

Hectáreas en riesgo por falla · Tomas en sobre-extracción · Utilización de
fuente y canal (%) · Parcelas sub-atendidas en cola · Tiempo para trazar una
contaminación.

> **Referencia real** — Autoridades de cuenca como SENAGUA (Ecuador), ANA
> (Perú) o la DGA (Chile) asignan derechos de aprovechamiento de agua y deben
> priorizar el uso humano y fiscalizar extracciones en sequía.
