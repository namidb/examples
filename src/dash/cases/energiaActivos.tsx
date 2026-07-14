import { useState } from "react";

import {
  Chip,
  ColumnChart,
  DashGrid,
  DashSection,
  DataTable,
  DonutChart,
  Gauge,
  GraphView,
  KpiCard,
  KpiRow,
  Panel,
  RankList,
  accent,
  fmtDec,
  fmtInt,
  firstRow,
  flags,
  num,
  str,
  useGrafo,
  usePanels,
  type Column,
} from "../kit";
import type { DashProps } from "../dashProps";

const EQUIPO_DEFECTO = "P-201";

const Q = {
  equipos: `MATCH (e:Equipo) RETURN count(e) AS n`,

  criticos: `MATCH (e:Equipo {criticidad:'alta'}) RETURN count(e) AS n`,

  alarmas: `MATCH (a:Alarma {activa: true}) RETURN count(a) AS n`,

  horas: `MATCH (e:Equipo)-[:TUVO_FALLA]->(f:Falla)
RETURN sum(f.horas_indisponible) AS h, count(f) AS n`,

  expuestos: `MATCH (r:Repuesto {stock: 0})<-[:REQUIERE]-(comp:Componente)-[:PARTE_DE]->(e:Equipo)
RETURN count(DISTINCT e) AS n`,

  contexto: `MATCH (s:Sensor)-[:DISPARA]->(al:Alarma {activa: true})
MATCH (s)-[:MONITOREA]->(comp:Componente)-[:PARTE_DE]->(e:Equipo)-[:EN_PLANTA]->(pl:Planta)
RETURN al.codigo AS alarma, al.variable AS variable, al.severidad AS severidad,
       s.tag AS sensor, comp.codigo AS componente, e.tag AS equipo, pl.nombre AS planta
ORDER BY alarma`,

  similar: `MATCH (:Sensor)-[:DISPARA]->(act:Alarma {activa: true})
WITH DISTINCT act.variable AS variable_activa
MATCH (f:Falla)-[:PRECEDIDA_POR]->(prev:Alarma)
WHERE prev.variable = variable_activa
WITH f, count(DISTINCT variable_activa) AS variables_coincidentes
WHERE variables_coincidentes >= 2
MATCH (e:Equipo)-[:TUVO_FALLA]->(f)
RETURN f.codigo AS falla, e.tag AS equipo, f.modo AS modo, f.fecha AS fecha,
       f.horas_indisponible AS horas, variables_coincidentes AS coincidencias
ORDER BY f.fecha`,

  conectividad: `MATCH (e:Equipo)
OPTIONAL MATCH (e)-[rel]-(x)
RETURN e.tag AS equipo, e.criticidad AS criticidad, count(rel) AS conexiones
ORDER BY conexiones DESC
LIMIT 8`,

  ficha: `MATCH (comp:Componente)-[:PARTE_DE]->(e:Equipo {tag: $tag})
MATCH (comp)-[:REQUIERE]->(r:Repuesto)
MATCH (comp)-[:DOCUMENTADO_EN]->(m:Manual)
RETURN comp.codigo AS componente, comp.tipo AS tipo,
       r.sku AS repuesto, r.stock AS stock,
       m.codigo AS manual, m.seccion AS seccion
ORDER BY componente`,

  riesgo: `MATCH (e:Equipo)-[:TUVO_FALLA]->(f:Falla)
WITH e, count(f) AS fallas, sum(f.horas_indisponible) AS horas
MATCH (e)-[:EN_PLANTA]->(p:Planta)
RETURN e.tag AS equipo, e.criticidad AS criticidad, p.nombre AS planta,
       fallas, horas,
       CASE WHEN e.criticidad = 'alta' THEN horas * 3
            WHEN e.criticidad = 'media' THEN horas * 2
            ELSE horas END AS indice_riesgo
ORDER BY indice_riesgo DESC
LIMIT 8`,

  concentracion: `MATCH (e:Equipo)-[:TUVO_FALLA]->(f:Falla)
WITH sum(f.horas_indisponible) AS total,
     sum(CASE WHEN e.criticidad = 'alta' THEN f.horas_indisponible ELSE 0 END) AS criticas
RETURN total AS total, criticas AS criticas, round(criticas * 1000.0 / total) / 10 AS pct`,

  flota: `MATCH (e:Equipo) RETURN e.criticidad AS criticidad, count(e) AS n ORDER BY n DESC`,

  propagacion: `MATCH (s:Sensor)-[:DISPARA]->(:Alarma {activa: true})
MATCH (s)-[:MONITOREA]->(comp:Componente)-[:REQUIERE]->(r:Repuesto)
MATCH (otro:Componente)-[:REQUIERE]->(r)
MATCH (otro)-[:PARTE_DE]->(e:Equipo)
RETURN DISTINCT r.sku AS repuesto, r.stock AS stock,
       otro.codigo AS componente, e.tag AS equipo, e.criticidad AS criticidad
ORDER BY criticidad, equipo`,
};

const CRIT_COLOR: Record<string, string> = {
  alta: "var(--error)",
  media: "var(--warn)",
  baja: "var(--ok)",
};

export default function EnergiaActivos({ slug }: DashProps) {
  const acc = accent(slug);
  const [sel, setSel] = useState(EQUIPO_DEFECTO);

  const { panels } = usePanels(slug, {
    equipos: { cypher: Q.equipos },
    criticos: { cypher: Q.criticos },
    alarmas: { cypher: Q.alarmas },
    horas: { cypher: Q.horas },
    expuestos: { cypher: Q.expuestos },
    contexto: { cypher: Q.contexto },
    similar: { cypher: Q.similar },
    conectividad: { cypher: Q.conectividad },
    riesgo: { cypher: Q.riesgo },
    concentracion: { cypher: Q.concentracion },
    flota: { cypher: Q.flota },
    propagacion: { cypher: Q.propagacion },
  });
  const { panels: fichaP } = usePanels(slug, { ficha: { cypher: Q.ficha, params: { tag: sel } } });
  const { grafo } = useGrafo(slug);

  const horas = firstRow(panels.horas);
  const conc = firstRow(panels.concentracion);
  const conect = panels.conectividad?.rows ?? [];

  const contextoCols: Column[] = [
    { key: "alarma", label: "Alarma", mono: true },
    { key: "variable", label: "Variable" },
    { key: "severidad", label: "Severidad" },
    { key: "sensor", label: "Sensor", mono: true },
    { key: "componente", label: "Componente", mono: true },
    { key: "equipo", label: "Equipo", mono: true },
    { key: "planta", label: "Planta" },
  ];

  const fichaCols: Column[] = [
    { key: "componente", label: "Componente", mono: true },
    { key: "tipo", label: "Tipo" },
    { key: "repuesto", label: "Repuesto", mono: true },
    { key: "stock", label: "Stock", align: "right", format: fmtInt },
    { key: "manual", label: "Manual", mono: true },
    { key: "seccion", label: "Sección", mono: true, align: "right" },
  ];

  const propagCols: Column[] = [
    { key: "equipo", label: "Equipo", mono: true },
    { key: "criticidad", label: "Criticidad" },
    { key: "componente", label: "Componente", mono: true },
    { key: "repuesto", label: "Repuesto", mono: true },
    { key: "stock", label: "Stock", align: "right", format: fmtInt },
  ];

  const riesgoData = (panels.riesgo?.rows ?? []).map((r) => ({
    label: str(r, "equipo"),
    value: num(r, "indice_riesgo"),
    color: CRIT_COLOR[str(r, "criticidad")] ?? acc,
    sub: str(r, "criticidad"),
  }));

  const flotaData = (panels.flota?.rows ?? []).map((r) => ({
    label: str(r, "criticidad"),
    value: num(r, "n"),
    color: CRIT_COLOR[str(r, "criticidad")] ?? acc,
  }));
  const totalFlota = flotaData.reduce((a, d) => a + d.value, 0);

  const pct = num(conc, "pct");

  return (
    <div>
      <KpiRow>
        <KpiCard label="Activos monitoreados" value={fmtInt(num(firstRow(panels.equipos), "n"))}
          tone="info" loading={panels.equipos?.loading} sub="dos plantas · el grafo completo" />
        <KpiCard label="Activos críticos" value={fmtInt(num(firstRow(panels.criticos), "n"))}
          tone="warn" loading={panels.criticos?.loading} sub="criticidad alta en la flota" />
        <KpiCard label="Alarmas activas ahora" value={fmtInt(num(firstRow(panels.alarmas), "n"))}
          tone="bad" loading={panels.alarmas?.loading} sub="vibración + temperatura · P-201" />
        <KpiCard label="Horas fuera de servicio" value={fmtInt(num(horas, "h"))}
          tone="warn" loading={panels.horas?.loading}
          sub={`${fmtInt(num(horas, "n"))} fallas registradas`} />
        <KpiCard label="Activos expuestos a quiebre" value={fmtInt(num(firstRow(panels.expuestos), "n"))}
          tone="bad" loading={panels.expuestos?.loading} sub="dependen de SKF-6205 · stock 0" />
      </KpiRow>

      <DashSection eyebrow="La alarma de hoy" title="Todo el contexto en una sola consulta">
        <DashGrid min={380}>
          <Panel title="Contexto de la alarma activa" span={2}
            subtitle="Sensor → componente → equipo → planta de cada alarma viva. El contexto que hoy vive repartido en cinco sistemas, resuelto en un salto."
            cypher={Q.contexto} accent="var(--error)" {...flags(panels.contexto)}>
            <DataTable rows={panels.contexto?.rows ?? []} columns={contextoCols} maxHeight={200}
              rowTone={() => "bad"} />
          </Panel>

          <Panel title="¿Ya pasó antes?"
            subtitle="Fallas históricas precedidas por la MISMA firma (vibración + temperatura). El incidente repetido que nadie recuerda."
            cypher={Q.similar} accent="var(--warn)" {...flags(panels.similar)}>
            <HistorialFallas rows={panels.similar?.rows ?? []} />
          </Panel>
        </DashGrid>
      </DashSection>

      <DashSection eyebrow="Criticidad y priorización" title="Dónde concentrar el mantenimiento">
        <DashGrid min={360}>
          <Panel title="Criticidad por conectividad"
            subtitle="Grado en el grafo: cuántos sensores, órdenes, fallas y manuales cuelgan de cada activo. Clic para abrir su ficha."
            cypher={Q.conectividad} accent={acc} {...flags(panels.conectividad)}>
            <RankList
              data={conect.map((r) => ({
                label: str(r, "equipo"),
                value: num(r, "conexiones"),
                sub: str(r, "criticidad"),
                color: str(r, "equipo") === sel ? "var(--error)" : (CRIT_COLOR[str(r, "criticidad")] ?? acc),
              }))}
              format={fmtInt}
              onClick={(_, i) => setSel(str(conect[i], "equipo"))}
              activeLabel={sel}
            />
          </Panel>

          <Panel title={`Ficha del activo — ${sel}`}
            subtitle="Componentes, repuesto (y su stock) y sección de manual del equipo seleccionado. Las filas en rojo dependen de un repuesto agotado."
            cypher={Q.ficha} accent="var(--error)" {...flags(fichaP.ficha)}
            emptyLabel="este activo no tiene componentes registrados">
            <DataTable rows={fichaP.ficha?.rows ?? []} columns={fichaCols} maxHeight={240}
              rowTone={(r) => (num(r, "stock") === 0 ? "bad" : undefined)} />
          </Panel>

          <Panel title="Índice de riesgo por equipo"
            subtitle="Horas de indisponibilidad ponderadas por criticidad (alta ×3, media ×2). El ranking de a quién atender primero."
            cypher={Q.riesgo} accent={acc} {...flags(panels.riesgo)}>
            <ColumnChart data={riesgoData} accent={acc} labelRotate height={210} />
            <p className="dash-note">
              Las gemelas <b style={{ color: "var(--error)" }}>P-305</b> y <b style={{ color: "var(--error)" }}>P-201</b> encabezan:
              misma falla de rodamiento, criticidad alta.
            </p>
          </Panel>

          <Panel title="Concentración del riesgo"
            subtitle="Qué porción de las horas fuera de servicio se acumula en los activos de criticidad alta."
            cypher={Q.concentracion} accent="var(--error)" {...flags(panels.concentracion)}>
            <Gauge value={pct} max={100} label="en activos críticos"
              format={(n) => `${fmtDec(n)}%`} color="var(--error)" />
            <p className="dash-note" style={{ textAlign: "center" }}>
              {fmtInt(num(conc, "criticas"))} de {fmtInt(num(conc, "total"))} horas totales.
            </p>
          </Panel>
        </DashGrid>
      </DashSection>

      <DashSection eyebrow="Propagación y red" title="Un repuesto en cero contagia a toda la flota">
        <DashGrid min={360}>
          <Panel title="Propagación por repuesto compartido"
            subtitle="Los demás activos que dependen del MISMO repuesto que la alarma de hoy — el riesgo que se repite antes de que ocurra."
            cypher={Q.propagacion} accent="var(--error)" {...flags(panels.propagacion)}>
            <DataTable rows={panels.propagacion?.rows ?? []} columns={propagCols} maxHeight={240}
              rowTone={(r) => (str(r, "criticidad") === "alta" ? "bad" : "warn")} />
          </Panel>

          <Panel title="Flota por criticidad"
            subtitle="Cómo se reparte la criticidad declarada en el parque de activos."
            cypher={Q.flota} accent={acc} {...flags(panels.flota)}>
            <DonutChart data={flotaData} centerValue={fmtInt(totalFlota)} centerLabel="activos" />
          </Panel>

          <Panel title="Mapa de la red de activos" span={2} accent={acc}
            subtitle="Plantas, equipos, componentes, sensores, alarmas, fallas y repuestos. La falla vive en las conexiones, no en un sensor aislado.">
            {grafo ? <GraphView grafo={grafo} /> : <div className="grafo-caja"><span className="grafo-caja__estado">sembrando…</span></div>}
          </Panel>
        </DashGrid>
      </DashSection>
    </div>
  );
}

/* Historial compacto de fallas con la misma firma que la alarma de hoy. */
function HistorialFallas({ rows }: { rows: Record<string, unknown>[] }) {
  if (rows.length === 0) return null;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem" }}>
      {rows.map((r, i) => (
        <div key={i} style={{
          display: "grid", gridTemplateColumns: "auto 1fr auto", gap: "0.6rem",
          alignItems: "center", padding: "0.5rem 0.6rem", borderRadius: "8px",
          background: "color-mix(in srgb, var(--error) 8%, transparent)",
          boxShadow: "inset 3px 0 0 var(--error)",
        }}>
          <span className="mono" style={{ fontSize: "0.78rem", color: "var(--hueso)" }}>{str(r, "equipo")}</span>
          <span style={{ fontSize: "0.78rem" }}>
            {str(r, "modo")} · <span className="mono" style={{ color: "var(--hueso)" }}>{str(r, "fecha")}</span>
          </span>
          <span style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
            <Chip tone="bad">{fmtInt(num(r, "horas"))} h fuera</Chip>
          </span>
        </div>
      ))}
      <p className="dash-note">
        Dos precedentes por <b>desgaste de rodamiento</b>, ambos con las <b>2</b> variables que hoy están en alarma.
      </p>
    </div>
  );
}
