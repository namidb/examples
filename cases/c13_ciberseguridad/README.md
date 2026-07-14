# 13 · Ciberseguridad — Priorice el riesgo que se propaga

> **Enfoque defensivo (blue-team / SOC).** Todo el dataset es sintético. No
> describe ningún sistema real ni contiene técnicas ofensivas accionables:
> modela el *grafo de exposición* que un equipo de defensa usa para decidir qué
> arreglar primero.

## El problema de gerencia

Miles de vulnerabilidades, pero no todas presentan el mismo riesgo. La prioridad
no depende del CVSS aislado, sino de cómo están conectados usuarios, activos,
identidades, aplicaciones y permisos. Un CVE 9.8 en un servidor de laboratorio
sin rutas importa menos que un CVE 7.5 en el camino directo a la base de datos
de clientes.

## La tesis, en una ruta

El caso planta una ruta de ataque completa y la contrasta con una vulnerabilidad
"peligrosa" pero inofensiva:

```
LAP-MKT-07 (laptop expuesta, phishing)
  └─ credencial cacheada de  svc-backup (identidad admin)
       └─ PUEDE_ACCEDER →  SRV-APP-01 (alta, corre portal con CVE-2026-1187, CVSS 7.5, en KEV)
            └─ PUEDE_ACCEDER →  SRV-DB-CLIENTES (crítico, PII)

SRV-TEST-99 (laboratorio aislado)
  └─ CVE-2026-0042, CVSS 9.8 — sin ninguna ruta hacia un activo crítico
```

La priorización por exposición real pone **CVE-2026-1187 (7.5) por encima de
CVE-2026-0042 (9.8)**, exactamente al revés de lo que diría el CVSS.

## Qué conecta NamiDB

Usuarios e identidades · Dispositivos · Servidores · Aplicaciones ·
Vulnerabilidades · Credenciales · Alertas · Técnicas de ataque (ATT&CK) ·
Controles (D3FEND).

## Cómo se modela la alcanzabilidad

Como las herramientas reales de rutas de ataque (p. ej. **BloodHound**), la
alcanzabilidad no se recalcula en cada consulta: durante `seed()` se hace un BFS
en Python sobre el pivoteo de credenciales y se **materializan** aristas
`RUTA_ATAQUE (Dispositivo)->(Servidor)` con el número de saltos. El grafo guarda
el *por qué* y las consultas quedan directas y explicables.

## Las consultas

| Consulta | Qué demuestra | Indicador |
|---|---|---|
| `rutas-a-criticos` | Dispositivos expuestos cuya cadena de credenciales alcanza un activo crítico | Rutas posibles hacia activos críticos |
| `priorizacion-real` | La lista de CVEs reordenada por exposición real: el 7.5 en ruta gana al 9.8 aislado | Priorización por exposición real |
| `alertas-por-incidente` | Alertas sueltas agrupadas por dispositivo/técnica en un incidente | Alertas agrupadas por incidente |
| `control-que-corta` | Qué control (MFA) mitiga la técnica de pivoteo (T1078) de la ruta activa | Ataques ligados a controles defensivos |
| `memoria-soc` | Incidentes históricos con las mismas técnicas de hoy | Memoria histórica para el SOC |
| `riesgo-explicable` | Por activo crítico: orígenes de ataque, vulnerabilidades en la ruta y controles | Riesgo explicable ante la gerencia |

## Cómo correrlo

```bash
pip install namidb
python cases/run.py ciberseguridad
```

Cambia `--store` a `s3://…`, `gs://…`, `az://…` o `file://…` para persistir el
grafo en tu propia nube — el bucket es la base de datos.

## Referencia real

MITRE mantiene **D3FEND** (knowledge graph de contramedidas) y **ATT&CK**
(tácticas y técnicas reales de adversarios). Radical, socio fundador enfocado en
ciberseguridad e infraestructura crítica.
