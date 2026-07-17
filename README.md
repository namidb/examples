<div align="center">

# NamiDB · Ejemplos

### Diecisiete casos de uso, ejecutándose contra el motor real.

Un problema de gerencia por industria — con datos sintéticos, el modelo de grafo,
y las consultas Cypher que revelan la red. Cada carpeta de `cases/` es una base
lista para copiar y empezar tu propio desarrollo.

[**Sitio en vivo**](https://ejemplos.namidb.com) · [**namidb.com**](https://namidb.com) · [**Documentación**](https://docs.namidb.com) · [**Imagen Docker**](https://hub.docker.com/r/namidb/namidb-server)

</div>

---

Todo aquí corre sobre el mismo motor que instalas con `pip install namidb`: no hay
simulaciones ni respuestas grabadas. El sitio web ejecuta las consultas dentro de
funciones Python en Vercel contra `memory://`, y localmente puedes correr cualquier
caso desde la terminal en segundos.

## 60 segundos

```bash
pip install namidb
python cases/run.py banca-aml
```

Verás el grafo sembrarse y cada consulta del caso imprimir la red que detecta:
anillos de mulas, ciclos de dinero, empresas hermanas. Cambia el caso por
cualquier slug de la tabla de abajo.

Persistir en tu propia nube es un cambio de una línea — la URI es toda la config:

```bash
python cases/run.py banca-aml --store "s3://mi-bucket?ns=demo&region=us-east-1"
# o file:///… , gs://… , az://…  — el bucket es la base de datos.
```

## Los diecisiete casos

| # | Caso | Industria | Qué revela |
|---|------|-----------|------------|
| 01 | [`banca-aml`](cases/c01_banca_aml) | Banca — Lavado de activos | Anillos de cuentas, ciclos de dinero, empresas hermanas |
| 02 | [`grupos-economicos`](cases/c02_grupos_economicos) | Banca — Partes relacionadas | Exposición real del grupo, garantías cruzadas |
| 03 | [`seguros-siniestros`](cases/c03_seguros_siniestros) | Seguros — Fraude en siniestros | Talleres/peritos recurrentes, reclamantes conectados |
| 04 | [`contratacion-publica`](cases/c04_contratacion_publica) | Gobierno — Contratación | Beneficiario final común, colusión, sancionados |
| 05 | [`subsidios`](cases/c05_subsidios) | Gobierno — Subsidios | Duplicados complejos, cuentas intermediarias |
| 06 | [`salud-paciente`](cases/c06_salud_paciente) | Salud — Visión del paciente | Interacciones, pruebas duplicadas, contraindicaciones |
| 07 | [`agro-trazabilidad`](cases/c07_agro_trazabilidad) | Agro — Trazabilidad | Origen de contaminación, retiro selectivo |
| 08 | [`agro-cumplimiento`](cases/c08_agro_cumplimiento) | Agro — Cumplimiento | Embarques sin certificación, documentos vencidos |
| 09 | [`energia-activos`](cases/c09_energia_activos) | Energía — Activos | Contexto de alarma, fallas recurrentes |
| 10 | [`proveedores-compras`](cases/c10_proveedores_compras) | Industria — Compras | Proveedor duplicado en varios ERP, gasto real |
| 11 | [`recomendaciones`](cases/c11_recomendaciones) | Comercio — Recomendaciones | Complementarios, evitar devoluciones, segmentos |
| 12 | [`telecom-causa-raiz`](cases/c12_telecom_causa_raiz) | Telecom — Causa raíz | De cien alarmas a una causa, impacto por SLA |
| 13 | [`ciberseguridad`](cases/c13_ciberseguridad) | Ciberseguridad — Rutas de ataque | Priorización por exposición real, no por CVSS |
| 14 | [`agentes-conocimiento`](cases/c14_agentes_conocimiento) | Agentes IA — Conocimiento | Búsqueda híbrida, versión vigente, expertos |
| 15 | [`agro-sanidad`](cases/c15_agro_sanidad) | Agro — Biovigilancia fitosanitaria | Súper-propagador a poner en cuarentena, focos y zonas de contención |
| 16 | [`agro-riego`](cases/c16_agro_riego) | Agro — Riego y derechos de agua | Impacto de una falla aguas abajo, sobre-extracción, infraestructura crítica |
| 17 | [`agro-rendimiento`](cases/c17_agro_rendimiento) | Agro — Brecha de rendimiento | Parcela gemela por búsqueda vectorial, práctica que mueve la aguja |

Cada carpeta tiene un `README.md` con la historia, el modelo de grafo y qué
demuestra cada consulta.

## Anatomía de un caso

```
cases/c01_banca_aml/
├── __init__.py      # META (la historia del deck), LEYENDA, seed(db), QUERIES
└── README.md        # problema → modelo → consultas → cómo adaptarlo
```

- **`seed(db)`** carga un dataset sintético 100 % determinista (mismo grafo en cada
  corrida) con un patrón real plantado dentro del ruido.
- **`QUERIES`** son las consultas Cypher nombradas que aparecen en el sitio y en
  la terminal; cada una responde a un punto del "qué revela el mapa" del caso.
- **`cases/common.py`** es el toolkit compartido: RNG sembrado, nombres y empresas
  LATAM, embeddings offline deterministas y carga por lotes con `UNWIND`.

## El sitio web

Una SPA (Vite + React) con una landing de los 17 casos y, por caso, el grafo
interactivo en vivo y un editor de Cypher que ejecuta contra el motor real.

```bash
npm install
# Terminal 1 — las mismas funciones que Vercel, en local:
python scripts/dev_server.py
# Terminal 2:
npm run dev
```

El backend son tres funciones Python en `api/` (`meta`, `graph`, `cypher`) que
comparten un cliente NamiDB embebido por caso. En producción son funciones
serverless de Vercel; en local las sirve `scripts/dev_server.py`.

## Tests

La suite siembra cada caso y comprueba que **cada consulta devuelve filas** — o
sea, que el patrón plantado realmente se detecta. Corre contra el wheel
publicado, el mismo que usa el sitio:

```bash
pip install namidb pytest
pytest tests/ -q
```

## Licencia

[MIT](LICENSE) — copia, adapta y construye. (El motor NamiDB es BSL 1.1.)
