# Kit de dashboards NamiDB — guía para construir un caso

Cada caso de uso tiene un **dashboard bespoke**: un producto analítico completo
(el que usaría gerencia) que corre contra el **motor real** de NamiDB vía
`POST /api/cypher`. El Cypher de cada panel queda visible (botón `‹/› Cypher`)
para que el dashboard sea, además, una plantilla copiable para desarrolladores.

La referencia canónica es **`cases/bancaAml.tsx`**. Léela entera: muestra todos
los patrones. Este documento es el contrato de la API del kit.

## Contrato del archivo

Un archivo por caso en `src/dash/cases/<camelCase>.tsx`:

```tsx
import { usePanels, flags, Panel, KpiRow, KpiCard, DashSection, DashGrid,
         BarChart, RankList, ColumnChart, LineChart, DonutChart, Gauge,
         DataTable, GraphView, useGrafo, num, str, arr, firstRow,
         fmtInt, fmtMoney, fmtMoneyExact, fmtPct, accent, serie, type Column } from "../kit";
import type { DashProps } from "../dashProps";

export default function MiCaso({ slug }: DashProps) {
  const { panels } = usePanels(slug, {
    kpi:   { cypher: `MATCH (n:Cosa) RETURN count(n) AS n` },
    top:   { cypher: `MATCH ... RETURN etiqueta, valor ORDER BY valor DESC LIMIT 8` },
  });
  return (
    <div>
      <KpiRow>
        <KpiCard label="Cosas" value={fmtInt(num(firstRow(panels.kpi), "n"))} loading={panels.kpi?.loading} />
      </KpiRow>
      <DashSection eyebrow="lo que revela" title="Título de sección">
        <DashGrid>
          <Panel title="Top" subtitle="…" cypher={/* string */ ""} {...flags(panels.top)}>
            <RankList data={panels.top.rows.map((r) => ({ label: str(r,"etiqueta"), value: num(r,"valor") }))} />
          </Panel>
        </DashGrid>
      </DashSection>
    </div>
  );
}
```

**Reglas:** `export default`. Importa SOLO de `../kit` y `../dashProps`. No toques
otros archivos (kit, registry, styles, otros casos). Todo texto en español.

## Datos: hooks

- `const { panels } = usePanels(slug, specs)` — corre un mapa de consultas.
  `specs = { id: { cypher, params? } }`. Cada `panels[id]` es
  `{ rows, columns, ms, loading, error }`. Carga progresiva (cada panel se pinta
  al resolverse). Las specs pueden ser inline (se recalcula por contenido).
- `flags(panels.id)` → `{ loading, error, empty, ms }` para hacer
  `<Panel {...flags(panels.id)}>`. El Panel muestra skeleton / error / “sin
  coincidencias” solo, y pinta `children` cuando hay datos.
- `firstRow(panels.id)` → primera fila (KPIs de un valor).
- `useGrafo(slug)` → `{ grafo }` para `<GraphView grafo={grafo} />`.
- Lectores de fila: `num(row,"k")`, `str(row,"k")`, `arr(row,"k")` (para
  `collect(...)`). Siempre con fallback seguro.

**Drill-down:** `const [sel,setSel]=useState(<def>)`; un segundo
`usePanels(slug,{ d:{cypher, params:{ x: sel }} })`; en un `RankList`/`DataTable`
pon `onClick={(_,i)=>setSel(...)}`. El panel de detalle se re-corre solo.

## Componentes

- **KPIs:** `<KpiRow>` envuelve `<KpiCard label value sub? tone? loading? delta? />`.
  `tone`: `plain|ok|warn|bad|info|rosa|muted`. `value` suele ser
  `fmtInt(num(...))` o `fmtMoney(...)`.
- **`<DashSection eyebrow? title? actions?>`** — bloque con encabezado.
- **`<DashGrid min?>`** — grilla responsiva de paneles (min px por columna, def 340).
- **`<Panel title subtitle? cypher? accent? span? {...flags(p)} emptyLabel?>`** —
  tarjeta. `cypher` (string) activa el toggle de código. `span`: `1|2|3|"full"`.
  `accent`: color de la barra (usa `accent(slug)` o un color por panel).
- **Charts** (todos SVG propios, sin libs):
  - `<BarChart data format? accent? onClick? activeLabel? />` — barras
    horizontales. `data: {label,value,color?,sub?}[]`.
  - `<RankList … />` — igual con número de posición.
  - `<ColumnChart data format? height? accent? labelRotate? />` — columnas.
  - `<LineChart series format? height? area? />` —
    `series: {name,color?,points:{x,y}[]}[]`.
  - `<DonutChart data centerValue? centerLabel? format? />` — dona + leyenda.
  - `<Gauge value max label? format? color? />` — semicírculo (riesgo/% ).
  - `<Sparkline points color? />`.
- **`<DataTable rows columns? onRowClick? activeIndex? rowTone? maxHeight? />`** —
  `Column = { key, label?, align?, format?, render?, mono? }`. `format` solo se
  aplica a números. `rowTone(row)` colorea el borde izquierdo.
- **`<Chip tone>` `<GraphView grafo>`**.

## Colores y formato

`accent(slug)` (color del caso), `serie(i)` (paleta categórica), `colorFor(label)`
(color estable por texto), `riskColor(t∈0..1)` (verde→ámbar→rojo).
`fmtInt`, `fmtMoney` ($1.2M), `fmtMoneyExact` ($1,234,567), `fmtCompact`,
`fmtPct(n,dec?)`, `fmtDec`.

## Cypher — reglas de oro (ver `../../CYPHER_NOTES.md`)

- **Nombra los nodos intermedios** en multi-hop (anónimo → 0 filas silencioso).
- **Anti-joins con `collect(...)` + `IN`**, NUNCA `OPTIONAL MATCH` correlacionado
  (degenera en producto cartesiano y cuenta de más).
- Para un titular/1:1, usa un `MATCH` directo, no `OPTIONAL MATCH`.
- `algo.*` da `node_id` sin props → rehidrata con `MATCH (x:L) WHERE id(x)=id(node_id)`.
- `search.*` toma UN mapa y da `node`(hidratado)+`score`.
- `round(x)` = 1 arg → 2 decimales: `round(x*100)/100`. No mezcles agregado con
  propiedad en una expresión: computa el agregado en un `WITH` y opera después.
- Fechas ISO comparan lexicográficamente. Buckets con `CASE WHEN … THEN 'a' …`.

## Verificación OBLIGATORIA

Antes de pegar CUALQUIER Cypher en el TSX, córrelo contra el motor real:

```bash
.venv/bin/python scripts/probe.py <slug> --cypher "MATCH ... RETURN ..."
.venv/bin/python scripts/probe.py <slug> --labels     # inventario labels/rels/props
.venv/bin/python scripts/probe.py <slug>              # corre las QUERIES nombradas
```

Cada consulta del dashboard DEBE devolver filas con datos con sentido. Si una
devuelve 0 filas o error, arréglala (revisa labels/rels reales con `--labels`) —
no la dejes en el TSX. Prefiere trabajar con el `seed()` existente; solo si los
datos son insuficientes para un buen gráfico, enriquece el seed manteniéndolo
determinista y sin romper las `QUERIES`/`META` existentes ni los tests.
