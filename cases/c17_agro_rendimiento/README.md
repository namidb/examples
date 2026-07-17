# 17 · Agro — Brecha de rendimiento y transferencia de prácticas

> **La parcela gemela ya resolvió tu problema.**

## El problema de gerencia

La mayoría de las parcelas rinde muy por debajo de su potencial agronómico,
y la asistencia técnica receta lo mismo para todos. La evidencia de qué
funciona ya existe — en parcelas de condiciones casi idénticas que sí
cerraron la brecha — pero nadie puede encontrarlas entre miles de fichas y
registros.

## El grafo (+ vectores)

```
(Parcela {perfil, emb, rend_actual, rend_potencial, hectareas})
(Parcela)-[:CULTIVA]->(Variedad {rend_ref})
(Parcela)-[:APLICA {desde}]->(Practica {categoria, impacto_tha})
(Parcela)-[:PERTENECE_A]->(Cooperativa)
(Tecnico)-[:ATIENDE]->(Parcela)
(Parcela)-[:GEMELA {sim}]->(Parcela)   # top-4 por coseno del perfil, materializado
(Ficha {texto, emb})-[:TRATA]->(Practica) | [:SOBRE]->(Variedad)
```

El `perfil` de cada parcela usa vocabulario controlado
(`cacao suelo franco-arcilloso clima humedo-tropical altitud baja zona Los
Ríos manejo convencional`) y se vectoriza en `emb`. Sobre ese vector corren
`search.vector` (gemelas en vivo), `search.bm25` (fichas técnicas por texto)
y la arista `GEMELA` materializada para consultas planas.

## La trama plantada

**PC-018** (cacao, Los Ríos, manejo convencional) rinde **0.42 t/ha** contra
un potencial de **1.15**. Su gemela **PC-041** — mismo suelo, clima, altitud
y zona, similitud 0.941 — ya rinde **1.08 t/ha**: cultiva **CCN-51** y aplica
**poda-sanitaria** + **fertilización-balanceada**. La recomendación no sale
de un manual: sale de una parcela comparable, con un uplift esperado de
**0.66 t/ha**. Además, las parcelas de cacao con poda sanitaria promedian
0.99 t/ha contra 0.64 de las que no la aplican, y la consulta BM25
`'clorosis suelo alcalino'` recupera primera la ficha FT-07.

## Queries destacadas

| Query | Qué demuestra |
|---|---|
| `gemelas-materializadas` | Las 4 parcelas de perfil casi idéntico a PC-018, con manejo y rendimiento — la evidencia comparable existe. |
| `recomendacion-gemela` | PC-041: misma condición, 1.08 t/ha, CCN-51 + poda sanitaria + fertilización balanceada → uplift 0.66 t/ha. |
| `ficha-tecnica-bm25` | `search.bm25` recupera la ficha exacta ('clorosis en suelo alcalino') por texto libre, sin taxonomías. |

## Correr este caso

```bash
pip install namidb
python cases/run.py agro-rendimiento
```

> **Referencia real** — El Global Yield Gap Atlas (yieldgap.org) y la FAO
> cuantifican la brecha entre rendimiento actual y potencial; plataformas
> como Cropin, aWhere y Plantix recomiendan variedad y manejo por similitud
> de condiciones agroclimáticas.
