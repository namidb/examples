# 06 · Salud — Visión integral del paciente

> **Todo el historial, en contexto.**

La información del paciente está separada entre consultas, laboratorios,
recetas, imágenes, especialidades, clínicas, aseguradoras y sistemas
administrativos. Cada sistema ve su fragmento; nadie ve al paciente
completo. Este caso arma ese rompecabezas como grafo y hace que las
preguntas clínicas de siempre sean una consulta Cypher.

> **Nota del deck:** capa de conocimiento, búsqueda e integración clínica.
> **No reemplaza la historia clínica ni diagnostica de forma autónoma** —
> genera relaciones y hallazgos explicables para que el profesional revise
> cada caso con fuente verificable.

## El modelo

```
(Paciente)-[:TUVO]->(Consulta)-[:EN_CLINICA]->(Clinica)
(Consulta)-[:ATENDIDA_POR]->(Profesional)
(Consulta)-[:DIAGNOSTICA]->(Diagnostico)      # CIE-10
(Consulta)-[:PRESCRIBE {fecha}]->(Medicamento)
(Consulta)-[:SOLICITA]->(Prueba)
(Paciente)-[:ALERGICO_A]->(Alergia)
(Medicamento)-[:INTERACTUA_CON {severidad}]->(Medicamento)
(Medicamento)-[:CONTRAINDICADO_PARA]->(Alergia)
(Medicamento)-[:TRATA]->(Diagnostico)
(Guia)-[:APLICA_A]->(Diagnostico)
(Guia)-[:RECOMIENDA]->(Prueba)
```

## El patrón plantado

**Marta Quishpe** (diabetes tipo 2 + hipertensión) tiene su historial
fragmentado en **cuatro clínicas** que no se ven entre sí:

- La *Clínica Metropolitana* la controla por diabetes (metformina, HbA1c).
- El *Hospital San Rafael* la controla por presión (enalapril).
- El *Centro Médico del Valle* — que no ve nada de lo anterior — le
  prescribe **trimetoprim-sulfametoxazol**, que interactúa con severidad
  **alta** con su enalapril vigente, y le repite una **HbA1c** que ya se
  hizo 44 días antes en otra clínica.
- La *Clínica Vida Sana* le receta **amoxicilina** pese a su alergia a la
  **penicilina** declarada en otro sistema.
- El *Protocolo ADA* que aplica a su diagnóstico recomienda un **fondo de
  ojo** que nadie ha solicitado todavía.

Alrededor hay ~18 pacientes con historiales normales (cada uno fiel a una
sola clínica): el ruido realista sobre el que estos hallazgos destacan.

## Las queries

| id | Pregunta del deck que responde |
|---|---|
| `historial-en-contexto` | ¿Qué antecedentes son relevantes? — todo el historial reunido, ordenado por fecha |
| `interacciones-activas` | ¿Qué medicamentos y diagnósticos se relacionan? — interacciones entre recetas de clínicas distintas |
| `pruebas-duplicadas` | ¿Qué pruebas ya fueron realizadas? — exámenes repetidos en <60 días entre clínicas |
| `contraindicaciones` | ¿Existe información contradictoria? — recetas que chocan con alergias declaradas |
| `guias-aplicables` | ¿Qué guías o protocolos aplican? — y qué recomendación sigue pendiente |

Indicadores del piloto que respaldan: tiempo para localizar antecedentes,
pruebas duplicadas detectadas, información clínica reconciliada y
respuestas con fuente verificable.

## Correr el caso

```bash
pip install namidb
python cases/run.py salud-paciente

# Persistente: el mismo grafo en tu bucket.
python cases/run.py salud-paciente --store "s3://mi-bucket?ns=salud&region=us-east-1"
```

Cada query del módulo (`QUERIES` en `__init__.py`) es un punto de partida:
cámbiale el nombre del paciente, agrega tus catálogos reales de
interacciones o conecta tu HIS/LIS y las mismas consultas siguen
funcionando.
