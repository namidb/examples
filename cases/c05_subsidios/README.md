# 05 · Gobierno — Subsidios, beneficios y registros

> **Un beneficio, un beneficiario.**

## El problema de gerencia

Una misma persona o grupo aparece bajo registros diferentes, con
direcciones compartidas, intermediarios o empresas relacionadas, para
acceder indebidamente a beneficios públicos. Revisado registro por
registro, cada solicitud parece legítima: la cédula es distinta, el
nombre varía en una inicial, el formulario está completo. El patrón solo
existe **entre** los registros — y ahí ningún sistema tabular está
mirando.

## Qué conecta NamiDB

Beneficiarios · identificaciones · direcciones · teléfonos · cuentas ·
programas sociales · solicitudes · pagos · oficinas tramitadoras.

```
(:Beneficiario {nombre, cedula})
    -[:RESIDE_EN]->   (:Direccion)
    -[:USA_TELEFONO]->(:Telefono)
    -[:COBRA_EN]->    (:Cuenta)
    -[:SOLICITA]->    (:Solicitud {codigo, fecha, estado})
                          -[:DE_PROGRAMA]-> (:Programa {nombre, monto})
                          -[:TRAMITADA_EN]->(:Oficina)
                          -[:GENERA]->      (:Pago {codigo, monto, fecha})
                                                -[:DEPOSITADO_EN]->(:Cuenta)
```

## El dataset sintético (determinista)

~206 nodos y ~301 relaciones, con tres patrones plantados entre el ruido
legítimo:

1. **La misma persona bajo 3 registros** — "María Chicaiza Toapanta",
   "Maria E. Chicaiza" y "M. Elena Chicaiza T." tienen cédulas distintas
   pero comparten dirección, teléfono y cuenta, y cobran el *Bono de
   Desarrollo* tres veces.
2. **Una cuenta intermediaria** — `EC-INTER-0001` recibe los pagos de
   cuatro beneficiarios "sin relación".
3. **Una oficina concentradora** — todas las solicitudes anómalas se
   tramitaron en la *Oficina Zonal 5*.

Además hay dos familias que comparten **solo** la dirección: señal
legítima que las queries distinguen del fraude (ver nota de diseño).

## Correr el caso

```bash
pip install namidb
python cases/run.py subsidios

# El mismo grafo, durable en tu bucket:
python cases/run.py subsidios --store "s3://mi-bucket?ns=subsidios&region=us-east-1"
```

## Las preguntas (queries incluidas)

| Query | Qué revela |
|---|---|
| `duplicados-complejos` | Registros con cédulas distintas que comparten ≥ 2 de {dirección, teléfono, cuenta}. El trío de María aparece con las tres evidencias; las familias que solo comparten techo, no. |
| `cuenta-intermediaria` | Cuentas donde cobran ≥ 3 beneficiarios distintos, con monto total expuesto. |
| `doble-cobro-programa` | El mismo programa pagado varias veces a titulares relacionados, con la evidencia (`comparten`) en cada fila. |
| `oficina-concentradora` | % de solicitudes con señales de duplicidad por oficina: Zonal 5 al 50 %, el resto en 0 %. |
| `trazabilidad-decision` | El camino auditable completo de un caso anómalo: beneficiario → solicitud → programa → oficina → pago → cuenta destino. |

## Indicadores del piloto

Duplicados complejos detectados · pagos indebidos prevenidos ·
trazabilidad completa de la decisión · auditorías más rápidas.

> **Nota de diseño** — NamiDB no excluye personas automáticamente:
> genera relaciones y alertas **explicables** para que la institución
> revise cada caso. Por eso cada query devuelve la evidencia (qué se
> comparte, por dónde pasó la decisión), no un veredicto.

## Adaptarlo a tus datos

`seed()` en `__init__.py` es la plantilla: reemplaza el generador por tu
carga real (CSV del registro social, extractos de pagos) manteniendo las
mismas etiquetas y relaciones, y las cinco queries funcionan sin cambios.
