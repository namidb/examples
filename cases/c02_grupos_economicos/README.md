# 02 · Banca y cooperativas — Grupos económicos y partes relacionadas

> **La exposición real de la institución.**

La institución cree que otorgó créditos a clientes diferentes cuando, en
realidad, todos pertenecen al mismo grupo familiar o económico. Revisado
expediente por expediente, cada crédito parece sano; conectando personas,
empresas, accionistas, garantías y avales, aparece **un solo deudor
consolidado** — y una concentración que ningún comité aprobó.

Este ejemplo siembra una cartera sintética con un patrón plantado: la
**familia Salvatierra** — cuatro personas emparentadas, tres empresas con
accionistas cruzados, seis créditos "independientes" que suman **$845.000**,
un mismo inmueble respaldando dos obligaciones y empleados del grupo cuyos
créditos avala el propio accionista.

## El modelo de grafo

| Nodo | Propiedades |
|---|---|
| `Persona` | `nombre` |
| `Empresa` | `nombre`, `ruc` |
| `Credito` | `codigo`, `monto`, `estado` |
| `Garantia` | `codigo`, `tipo`, `valor` |
| `Direccion` | `direccion` |

| Relación | Semántica |
|---|---|
| `(:Persona)-[:FAMILIAR_DE {parentesco}]->(:Persona)` | Parentesco con base legal |
| `(:Persona)-[:ACCIONISTA_DE {pct}]->(:Empresa)` | Participación accionaria |
| `(:Credito)-[:OTORGADO_A]->(:Persona\|Empresa)` | Deudor del crédito |
| `(:Persona)-[:AVALA]->(:Credito)` | Garante personal |
| `(:Garantia)-[:GARANTIZA]->(:Credito)` | Colateral que respalda |
| `(:Persona)-[:RESIDE_EN]->(:Direccion)` | Domicilio declarado |
| `(:Persona)-[:TRABAJA_EN]->(:Empresa)` | Fuente de ingreso |

## Correrlo

```bash
pip install namidb
python cases/run.py grupos-economicos

# El mismo grafo, durable en tu bucket:
python cases/run.py grupos-economicos --store "s3://mi-bucket?ns=grupos&region=us-east-1"
```

## Qué demuestra cada query

| Query | Pregunta del deck | Indicador del piloto |
|---|---|---|
| `exposicion-del-grupo` | ¿Exposición total frente a este grupo? — `algo.wcc` proyectado sobre `FAMILIAR_DE`/`ACCIONISTA_DE`/`AVALA` consolida los componentes conexos y suma sus créditos: los Salvatierra emergen como el #1 con $845k en 6 créditos | Control de concentración |
| `empresas-con-duenos-comunes` | ¿Qué empresas comparten propietarios? — pares de sociedades con accionistas repetidos | Beneficiarios finales identificados |
| `mismo-ingreso` | ¿Quiénes dependen del mismo ingreso? — empleados del grupo con créditos avalados por el accionista que les paga el sueldo | Evaluación integral del riesgo |
| `garantias-multiples` | ¿Qué garantías respaldan varias obligaciones? — `G-INM-001` colateraliza dos créditos de deudores distintos | Créditos vinculados no declarados |
| `creditos-no-independientes` | ¿Qué créditos "independientes" no lo son? — `shortestPath` entre deudores por parentesco/acciones/avales | Explicaciones visuales para comités |

## Ideas para tu desarrollo

- Reemplaza el seed sintético por tus tablas reales (clientes, garantías,
  registro societario): el modelo de arriba es el contrato.
- El umbral regulatorio de concentración (p. ej. 10 % del patrimonio técnico)
  es un `WHERE exposicion_total > $limite` sobre la primera query.
- `algo.louvain` sobre la misma proyección segmenta la cartera completa en
  grupos económicos sin listas manuales.
