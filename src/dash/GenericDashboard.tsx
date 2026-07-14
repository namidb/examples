import { BarChart } from "./charts";
import type { DashProps } from "./dashProps";
import { fmtInt, num, str, type Row } from "./format";
import { DashGrid, Panel } from "./primitives";
import { DataTable } from "./DataTable";
import { flags, usePanels, type PanelState } from "./useCypher";

/** Elige una visualización razonable para un resultado arbitrario. */
function AutoViz({ p }: { p: PanelState }) {
  const cols = p.columns;
  const numericCols = cols.filter((c) => p.rows.every((r) => typeof r[c] === "number"));
  const labelCols = cols.filter((c) => !numericCols.includes(c));

  if (p.rows.length === 1 && numericCols.length >= 1 && numericCols.length <= 4) {
    const r = p.rows[0];
    return (
      <div className="dash-kpirow" style={{ margin: 0 }}>
        {numericCols.map((c) => (
          <div className="dash-kpi" key={c} style={{ ["--accent" as string]: "var(--rosa)" }}>
            <span className="dash-kpi__label">{c}</span>
            <span className="dash-kpi__value display">{fmtInt(num(r, c))}</span>
          </div>
        ))}
      </div>
    );
  }

  if (labelCols.length >= 1 && numericCols.length >= 1 && p.rows.length <= 14) {
    const lk = labelCols[0];
    const vk = numericCols[0];
    return <BarChart data={p.rows.map((r: Row) => ({ label: str(r, lk), value: num(r, vk) }))} />;
  }

  return <DataTable rows={p.rows} maxHeight={340} />;
}

/** Dashboard genérico: renderiza las consultas nombradas del caso como paneles.
    Es el respaldo mientras un caso no tiene su dashboard bespoke. */
export default function GenericDashboard({ slug, meta }: DashProps) {
  const specs = Object.fromEntries(meta.queries.map((q) => [q.id, { cypher: q.cypher }]));
  const { panels } = usePanels(slug, specs);

  return (
    <DashGrid>
      {meta.queries.map((q, i) => {
        const p = panels[q.id];
        const span = i === 0 ? "full" : undefined;
        return (
          <Panel key={q.id} title={q.titulo} subtitle={q.descripcion} cypher={q.cypher} span={span} {...flags(p)}>
            {p && !p.loading && !p.error && p.rows.length > 0 && <AutoViz p={p} />}
          </Panel>
        );
      })}
    </DashGrid>
  );
}
