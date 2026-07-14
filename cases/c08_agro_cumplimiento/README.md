# 08 · Agro — Cumplimiento ambiental y acceso a mercados

> **La trazabilidad como ventaja comercial.**

Exportadores y comercializadores deben demostrar el origen de sus productos y
verificar que los proveedores cumplen requisitos ambientales, sanitarios y
sociales. Con reglamentos como el **EUDR** (cadenas libres de deforestación,
UE), no poder demostrar el origen ya no es un problema documental: es perder
el mercado.

La revisión clásica es archivo por archivo: certificados en una carpeta,
embarques en el ERP, parcelas en un GIS. NamiDB los conecta en un grafo y la
pregunta "¿este embarque puede zarpar?" se responde con una consulta.

## El modelo

```
(:Productor)-[:PRODUCE_EN]->(:Parcela)-[:UBICADA_EN]->(:Zona {riesgo_deforestacion})
(:Proveedor)-[:ACOPIA_DE]->(:Productor)
(:Producto)-[:ORIGINADO_EN]->(:Parcela)
(:Producto)-[:PROVISTO_POR]->(:Proveedor)
(:Embarque)-[:CONTIENE]->(:Producto)
(:Embarque)-[:CON_DESTINO]->(:Comprador {region})
(:Embarque)-[:RESPALDADO_POR]->(:Documento {vence})
(:Proveedor|:Parcela)-[:CERTIFICADO_CON]->(:Certificacion {tipo, vigente_hasta})
(:Certificacion)-[:VERIFICADA_POR]->(:Inspector)
```

Las fechas son strings ISO (`YYYY-MM-DD`): comparan lexicográficamente, así
que `d.vence < e.fecha` funciona sin funciones de fecha.

## El patrón plantado

El dataset (~105 nodos, determinista) incluye tres embarques limpios y el
embarque **EXP-2026-114** (cacao → Rotterdam, 2026-06-20) con tres problemas
reales escondidos entre productos en regla:

1. `P-CACAO-901` nace en la parcela `PARC-CN-01`, ubicada en **Cordillera
   Norte** (riesgo de deforestación alto) y **sin certificación EUDR** — con
   destino UE, es revisión obligatoria.
2. `P-CACAO-902` depende de *Acopios del Norte*, cuya certificación venció el
   `2026-05-01`, antes del zarpe.
3. El documento fitosanitario `DOC-FIT-889` vence el `2026-06-15`, cinco días
   antes del embarque.

## Las consultas

| Query | Qué demuestra |
|---|---|
| `embarques-sin-certificacion` | Productos cuyo proveedor no tiene certificación vigente a la fecha del zarpe. El `coalesce(c.vigente_hasta, '0000-00-00')` trata "sin certificado" y "vencido" con la misma vara. |
| `documentos-vencidos` | Documentos de respaldo que expiran antes del embarque — el rechazo en puerto, anticipado. |
| `territorios-revision` | Origen en zonas de alto riesgo con destino UE: el cruce parcela → zona → comprador que exige el EUDR. |
| `origen-demostrable` | La cadena completa de un producto limpio (parcela georreferenciada, zona, productor, proveedor, certificación e inspector): la evidencia que se entrega al comprador. |
| `score-embarque` | El semáforo gerencial: productos en regla vs con problemas por embarque, antes de zarpar. |

## Correr el caso

```bash
pip install namidb
python cases/run.py agro-cumplimiento

# o persistente, en tu bucket:
python cases/run.py agro-cumplimiento --store "s3://mi-bucket?ns=agro"
```

## Indicadores del piloto (del deck)

- Embarques con proveedores sin certificación
- Documentos vencidos antes del embarque
- Territorios que requieren revisión especial
- Origen demostrable por producto y proveedor

**Referencia real:** la FAO documenta iniciativas que combinan cadenas
productivas con monitoreo geoespacial para cadenas libres de deforestación.

## Adaptarlo a tu operación

1. Reemplaza `seed()` por tu ingesta real (ERP de exportación, GIS de
   parcelas, registros de certificadoras).
2. Mantén las claves únicas (`codigo` en parcela/producto/embarque) — los
   constraints del seed ya las declaran.
3. Las queries funcionan igual: cambia códigos y fechas por parámetros
   (`$embarque`) y tienes el semáforo pre-zarpe en producción.
