# 15 · Agro y sanidad vegetal — Biovigilancia fitosanitaria del banano

> **Contén el brote antes de que cruce la finca.**

## El problema de gerencia

El hongo de suelo *Fusarium oxysporum* f. sp. *cubense* Raza 4 Tropical
(**Foc R4T**, el «mal de Panamá TR4») **no tiene cura** y se propaga por
**recursos compartidos**: tierra adherida a maquinaria y botas de cuadrillas,
plántulas de vivero, agua de riego y cercanía entre fincas. La reacción por
defecto —cerrar toda la zona— arruina a los productores sanos. La bioseguridad
real es poner en cuarentena el **nodo puente** correcto: la cuadrilla, el
vivero o el agua que conecta el foco con las fincas todavía limpias.

Este caso es un showcase de **algoritmos de grafo**:

- **betweenness** → el súper-propagador que hay que aislar primero.
- **louvain** → las comunidades de contagio (dónde vigilar).
- **wcc** → las zonas de contención independientes.
- **degree** (contraste) → el volumen alto que **no** es riesgo.

## El grafo

```
(Cuadrilla)-[:TRABAJO_EN {fecha}]->(Finca)
(Maquina)-[:OPERO_EN {fecha}]->(Finca)
(Vivero)-[:ABASTECIO {fecha}]->(Finca)
(FuenteAgua)-[:RIEGA]->(Finca)
(Finca)-[:VECINA_DE {km}]->(Finca)          # no-dirigida (ambas direcciones)
(Deteccion)-[:EN_FINCA]->(Finca)
(Deteccion)-[:DE_PATOGENO]->(Patogeno)

# proyecciones materializadas para los algoritmos
(Finca)-[:CONTACTO {via, recurso}]->(Finca)  # red homogénea → louvain / wcc
(*)-[:CONECTA]-(Finca)                        # recurso↔finca bidireccional → betweenness
```

`CONTACTO` proyecta la red **finca–finca**: hay una arista por cada recurso
compartido (cuadrilla, máquina, vivero, agua) o vecindad. Es sobre esta
proyección que **louvain** encuentra las comunidades de contagio y **wcc** las
zonas de contención.

`CONECTA` es la proyección **bidireccional recurso↔finca**: sin ella, un recurso
con sólo aristas salientes tendría betweenness 0. Con ella, **betweenness**
revela el nodo por el que pasan más rutas de contagio.

## La trama plantada

**Hacienda El Guabo** (El Oro) es el **foco**: la detección **DET-01** dio
Foc R4T positivo por PCR el 2026-05-12. La cuadrilla de fumigación **CU-07**
(bioseguridad **nula**) trabajó en El Guabo **y** en cuatro fincas antes sanas
—San Vicente, La Julia, Los Álamos, Buenos Aires—, hoy en **sospecha**. En la
red de contacto, **CU-07 es el nodo de mayor betweenness de todo el grafo**: el
objetivo #1 de cuarentena. El **Estero Pagua** riega el foco y dos fincas aguas
abajo: puente secundario.

El **distractor**: el **Vivero San Carlos** (certificado) abasteció a cinco
fincas de **otra** comunidad, sin nexo con el foco. Tiene el **mismo grado**
que CU-07 (5), pero su **betweenness es 30× menor**. La lección: *grado ≠
riesgo; lo que importa es ser puente hacia el foco*.

## Las consultas

| Query | Qué demuestra |
|---|---|
| `superpropagadores` | **betweenness** sobre la red de contacto: CU-07 encabeza la cola de cuarentena, por encima incluso del foco. |
| `focos-comunidades` | **louvain** separa la comunidad del foco (El Oro) de la de sospecha (Guayas) y del distractor (Los Ríos). |
| `zonas-contencion` | **wcc** parte la red en zonas de contención; la del foco concentra las 5 fincas afectadas. |
| `cuadrillas-vector` | Cuadrillas que tocaron foco/sospecha y cuántas fincas sanas visitaron: CU-07 lidera con bioseguridad nula. |
| `recurso-critico` | Recursos que estuvieron en el foco y su alcance: CU-07 llega a 5 fincas, más que ninguno. |

## Correr este caso

```bash
pip install namidb
python cases/run.py agro-sanidad

# Persistente: el mismo grafo en tu bucket
python cases/run.py agro-sanidad --store "s3://mi-bucket?ns=sanidad&region=us-east-1"
```

## Indicadores del piloto (del deck)

Fincas en foco / sospecha / vigilancia · Súper-propagador identificado ·
Comunidades de contagio · Zonas de contención · Fincas limpias protegidas de la
cuarentena.

> **Referencia real** — El ICA de Colombia declaró cuarentena por Foc R4T en
> 2019 y el SENASA de Perú lo detectó en 2021; Ecuador es el mayor exportador
> de banano del mundo, por lo que la contención selectiva del TR4 es política de
> Estado en la región.
