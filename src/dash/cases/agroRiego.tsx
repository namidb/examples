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
  LineChart,
  Panel,
  RankList,
  accent,
  firstRow,
  flags,
  fmtInt,
  fmtPct,
  num,
  str,
  useGrafo,
  usePanels,
  type Column,
} from "../kit";
import type { DashProps } from "../dashProps";

const PARCELA_INICIAL = "PA-19";

const Q = {
  parcelas: `MATCH (p:Parcela) RETURN count(p) AS n`,

  red: `MATCH ()-[r:ALIMENTA]->() RETURN count(r) AS n`,

  riesgo: `MATCH (cg:Compuerta {estado: 'falla'})-[:ALIMENTA*1..6]->(p:Parcela)
RETURN count(p) AS parcelas, sum(p.hectareas) AS hectareas`,

  sobreKpi: `MATCH (co:Concesion)-[:AUTORIZA]->(t:Toma)
WHERE t.caudal_asignado_lps > co.caudal_max_lps
RETURN count(t) AS n, sum(t.caudal_asignado_lps - co.caudal_max_lps) AS exceso_lps`,

  incidentes: `MATCH (i:IncidenteCalidad) RETURN count(i) AS n`,

  fuentes: `MATCH (f:Fuente)-[:ALIMENTA*1..6]->(t:Toma)
WITH f, sum(t.caudal_asignado_lps) AS demanda_lps
RETURN f.nombre AS fuente, f.tipo AS tipo, f.nivel_pct AS nivel_pct,
       f.caudal_lps AS caudal_disponible_lps, demanda_lps,
       round(demanda_lps * 10000.0 / f.caudal_lps) / 100 AS utilizacion_pct
ORDER BY utilizacion_pct DESC`,

  balance: `MATCH (c:Canal)-[:ALIMENTA*1..5]->(t:Toma)
WITH c, sum(t.caudal_asignado_lps) AS demanda_lps
RETURN c.codigo AS canal, c.nombre AS nombre,
       c.capacidad_lps AS capacidad_lps, demanda_lps,
       round(demanda_lps * 10000.0 / c.capacidad_lps) / 100 AS utilizacion_pct
ORDER BY utilizacion_pct DESC`,

  sobre: `MATCH (co:Concesion)-[:AUTORIZA]->(t:Toma)
WHERE t.caudal_asignado_lps > co.caudal_max_lps
MATCH (u:Usuario)-[:TITULAR_DE]->(co)
MATCH (t)-[:ALIMENTA]->(p:Parcela)
RETURN u.nombre AS usuario, t.codigo AS toma, p.codigo AS parcela,
       t.caudal_asignado_lps AS asignado_lps, co.caudal_max_lps AS autorizado_lps,
       t.caudal_asignado_lps - co.caudal_max_lps AS exceso_lps,
       co.prioridad AS prioridad
ORDER BY exceso_lps DESC`,

  serie: `MATCH (s:Sensor {codigo: 'SN-01'})-[:REGISTRO]->(m:Medicion)
RETURN m.fecha AS fecha, m.valor AS caudal_lps, s.umbral AS umbral
ORDER BY fecha`,

  compuertas: `MATCH (cg:Compuerta)-[:ALIMENTA*1..6]->(p:Parcela)
WITH cg, count(DISTINCT p) AS parcelas_aguas_abajo
RETURN cg.codigo AS compuerta, cg.estado AS estado, parcelas_aguas_abajo
ORDER BY parcelas_aguas_abajo DESC`,

  impacto: `MATCH (cg:Compuerta {estado: 'falla'})-[:ALIMENTA*1..6]->(p:Parcela)
MATCH (t:Toma)-[:ALIMENTA]->(p)
MATCH (co:Concesion)-[:AUTORIZA]->(t)
MATCH (u:Usuario)-[:OPERA]->(p)
RETURN cg.codigo AS compuerta, p.codigo AS parcela, p.cultivo AS cultivo,
       p.hectareas AS hectareas, u.nombre AS usuario, co.prioridad AS prioridad
ORDER BY prioridad DESC, parcela`,

  traza: `MATCH (ic:IncidenteCalidad)-[:DETECTADO_EN]->(seg)
MATCH (seg)-[:ALIMENTA*1..6]->(p:Parcela)
MATCH (u:Usuario)-[:OPERA]->(p)
RETURN ic.codigo AS incidente, ic.tipo AS tipo, ic.severidad AS severidad,
       coalesce(seg.codigo, seg.nombre) AS detectado_en, p.codigo AS parcela,
       p.cultivo AS cultivo, u.nombre AS notificar_a
ORDER BY incidente, parcela`,

  critica: `CALL algo.betweenness({labels: ['Fuente', 'Canal', 'Compuerta', 'Ramal', 'Toma', 'Parcela'], edge_types: ['ALIMENTA']})
YIELD node_id, score
WITH node_id AS n, score
WHERE score > 0
MATCH (x) WHERE id(x) = id(n)
RETURN coalesce(x.codigo, x.nombre) AS punto, labels(x)[0] AS tipo,
       round(score * 100) / 100 AS criticidad
ORDER BY criticidad DESC
LIMIT 10`,

  prioridad: `MATCH (co:Concesion)-[:AUTORIZA]->(t:Toma)
MATCH (t)-[:ALIMENTA]->(p:Parcela)
WITH co.prioridad AS prioridad, count(DISTINCT p) AS parcelas,
     sum(p.hectareas) AS hectareas, sum(t.caudal_asignado_lps) AS caudal_lps
RETURN prioridad, parcelas, hectareas, caudal_lps,
       CASE WHEN prioridad = 'humano' THEN 1
            WHEN prioridad = 'agricola' THEN 2
            ELSE 3 END AS orden_de_corte
ORDER BY orden_de_corte`,

  cola: `MATCH (t:Toma)-[:ALIMENTA]->(p:Parcela)
MATCH (u:Usuario)-[:OPERA]->(p)
WITH p, t, u, p.hectareas * 5 AS necesidad_lps
RETURN p.codigo AS parcela, p.zona AS zona, p.nivel AS nivel,
       p.cultivo AS cultivo, p.hectareas AS hectareas,
       t.caudal_asignado_lps AS asignado_lps, necesidad_lps,
       CASE WHEN t.caudal_asignado_lps < necesidad_lps
            THEN 'sub-atendida' ELSE 'cubierta' END AS estado
ORDER BY nivel DESC, parcela`,

  // Drill-down: la cadena de suministro aguas arriba de la parcela elegida,
  // ordenada por 'nivel' (orden desde la fuente) — sin nodes(path).
  ruta: `MATCH (up)-[:ALIMENTA*1..8]->(p:Parcela {codigo: $parcela})
RETURN coalesce(up.codigo, up.nombre) AS punto, labels(up)[0] AS tipo,
       up.nivel AS nivel,
       coalesce(up.capacidad_lps, up.caudal_lps, up.caudal_asignado_lps) AS caudal_lps,
       coalesce(up.estado, '—') AS estado
ORDER BY nivel`,

  derecho: `MATCH (t:Toma)-[:ALIMENTA]->(p:Parcela {codigo: $parcela})
MATCH (co:Concesion)-[:AUTORIZA]->(t)
MATCH (u:Usuario)-[:TITULAR_DE]->(co)
RETURN u.nombre AS titular, u.junta AS junta, co.codigo AS concesion,
       co.prioridad AS prioridad, co.caudal_max_lps AS autorizado_lps,
       t.caudal_asignado_lps AS asignado_lps, co.volumen_m3_ano AS volumen_m3_ano`,

  sensoresRuta: `MATCH (up)-[:ALIMENTA*1..8]->(p:Parcela {codigo: $parcela})
MATCH (s:Sensor)-[:MIDE_EN]->(up)
RETURN s.codigo AS sensor, s.tipo AS tipo,
       coalesce(up.codigo, up.nombre) AS punto,
       s.umbral AS umbral, s.ultima AS ultima
ORDER BY sensor`,
};

const lps = (n: number) => `${fmtInt(n)} l/s`;

function chipEstadoCompuerta(v: unknown) {
  const e = String(v);
  const tone = e === "falla" ? "bad" : e === "cerrada" ? "warn" : e === "abierta" ? "ok" : "muted";
  return <Chip tone={tone}>{e}</Chip>;
}

export default function AgroRiego({ slug }: DashProps) {
  const acc = accent(slug);
  const [sel, setSel] = useState(PARCELA_INICIAL);

  const { panels } = usePanels(slug, {
    parcelas: { cypher: Q.parcelas },
    red: { cypher: Q.red },
    riesgo: { cypher: Q.riesgo },
    sobreKpi: { cypher: Q.sobreKpi },
    incidentes: { cypher: Q.incidentes },
    fuentes: { cypher: Q.fuentes },
    balance: { cypher: Q.balance },
    sobre: { cypher: Q.sobre },
    serie: { cypher: Q.serie },
    compuertas: { cypher: Q.compuertas },
    impacto: { cypher: Q.impacto },
    traza: { cypher: Q.traza },
    critica: { cypher: Q.critica },
    prioridad: { cypher: Q.prioridad },
    cola: { cypher: Q.cola },
  });
  const { panels: drillP } = usePanels(slug, {
    ruta: { cypher: Q.ruta, params: { parcela: sel } },
    derecho: { cypher: Q.derecho, params: { parcela: sel } },
    sensoresRuta: { cypher: Q.sensoresRuta, params: { parcela: sel } },
  });
  const { grafo } = useGrafo(slug);

  const riesgo = firstRow(panels.riesgo);
  const sobreKpi = firstRow(panels.sobreKpi);
  const fuenteTop = firstRow(panels.fuentes);
  const derecho = firstRow(drillP.derecho);

  // Utilización por canal: el sobre-suscrito (>100 %) se pinta en rojo.
  const balanceData = (panels.balance?.rows ?? []).map((r) => ({
    label: str(r, "canal"),
    value: num(r, "utilizacion_pct"),
    sub: str(r, "nombre"),
    color: num(r, "utilizacion_pct") > 100 ? "var(--error)" : acc,
  }));

  // Serie del sensor SN-01 + su umbral de alerta como línea de referencia.
  const serieRows = panels.serie?.rows ?? [];
  const seriesSensor = [
    {
      name: "caudal (l/s)",
      color: acc,
      points: serieRows.map((r) => ({ x: str(r, "fecha").slice(5), y: num(r, "caudal_lps") })),
    },
    {
      name: "umbral de alerta",
      color: "var(--warn)",
      points: serieRows.map((r) => ({ x: str(r, "fecha").slice(5), y: num(r, "umbral") })),
    },
  ];

  const criticaRows = panels.critica?.rows ?? [];
  const criticaData = criticaRows.map((r) => ({
    label: str(r, "punto"),
    value: num(r, "criticidad"),
    sub: str(r, "tipo"),
    color: str(r, "punto") === "CG-03" ? "var(--error)" : acc,
  }));

  const PRIO_COLOR: Record<string, string> = {
    humano: "var(--info)",
    agricola: acc,
    industrial: "var(--warn)",
  };
  const prioridadData = (panels.prioridad?.rows ?? []).map((r) => ({
    label: `${str(r, "prioridad")} (${fmtInt(num(r, "parcelas"))} parcelas)`,
    value: num(r, "caudal_lps"),
    color: PRIO_COLOR[str(r, "prioridad")],
  }));

  const colaRows = panels.cola?.rows ?? [];
  const selIdx = colaRows.findIndex((r) => str(r, "parcela") === sel);

  const sobreCols: Column[] = [
    { key: "toma", label: "Toma", mono: true },
    { key: "usuario", label: "Titular" },
    { key: "prioridad", label: "Prioridad" },
    { key: "asignado_lps", label: "Extrae", align: "right", format: lps },
    { key: "autorizado_lps", label: "Derecho", align: "right", format: lps },
    {
      key: "exceso_lps", label: "Exceso", align: "right",
      render: (v) => <b style={{ color: "var(--error)" }}>+{fmtInt(Number(v))} l/s</b>,
    },
  ];

  const compCols: Column[] = [
    { key: "compuerta", label: "Compuerta", mono: true },
    { key: "estado", label: "Estado", render: chipEstadoCompuerta },
    { key: "parcelas_aguas_abajo", label: "Parcelas aguas abajo", align: "right", format: fmtInt },
  ];

  const impactoCols: Column[] = [
    { key: "parcela", label: "Parcela", mono: true },
    { key: "cultivo", label: "Cultivo" },
    { key: "hectareas", label: "Ha", align: "right", format: fmtInt },
    { key: "usuario", label: "Usuario afectado" },
    {
      key: "prioridad", label: "Prioridad",
      render: (v) => <Chip tone={String(v) === "humano" ? "bad" : "muted"}>{String(v)}</Chip>,
    },
  ];

  const trazaCols: Column[] = [
    { key: "incidente", label: "Incidente", mono: true },
    { key: "tipo", label: "Tipo" },
    {
      key: "severidad", label: "Severidad",
      render: (v) => (
        <Chip tone={String(v) === "alta" ? "bad" : String(v) === "media" ? "warn" : "muted"}>
          {String(v)}
        </Chip>
      ),
    },
    { key: "detectado_en", label: "Detectado en", mono: true },
    { key: "parcela", label: "Parcela", mono: true },
    { key: "notificar_a", label: "Notificar a" },
  ];

  const colaCols: Column[] = [
    { key: "parcela", label: "Parcela", mono: true },
    { key: "zona", label: "Zona" },
    { key: "nivel", label: "Nivel", align: "right", format: fmtInt },
    { key: "cultivo", label: "Cultivo" },
    { key: "asignado_lps", label: "Recibe", align: "right", format: lps },
    { key: "necesidad_lps", label: "Necesita", align: "right", format: lps },
    {
      key: "estado", label: "Estado",
      render: (v) => <Chip tone={String(v) === "sub-atendida" ? "warn" : "ok"}>{String(v)}</Chip>,
    },
  ];

  const rutaCols: Column[] = [
    { key: "nivel", label: "Nivel", align: "right", format: fmtInt },
    { key: "tipo", label: "Tipo" },
    { key: "punto", label: "Punto", mono: true },
    {
      key: "caudal_lps", label: "Capacidad / caudal", align: "right",
      render: (v) => (typeof v === "number" ? lps(v) : "—"),
    },
    { key: "estado", label: "Estado", render: chipEstadoCompuerta },
  ];

  const sensCols: Column[] = [
    { key: "sensor", label: "Sensor", mono: true },
    { key: "tipo", label: "Tipo" },
    { key: "punto", label: "Instalado en", mono: true },
    { key: "umbral", label: "Umbral", align: "right", format: fmtInt },
    {
      key: "ultima", label: "Última lectura", align: "right",
      render: (v, row) => {
        const alerta = Number(v) < num(row, "umbral");
        return <b style={{ color: alerta ? "var(--error)" : "var(--ok)" }}>{fmtInt(Number(v))}</b>;
      },
    },
  ];

  return (
    <div>
      <KpiRow>
        <KpiCard label="Parcelas bajo riego" value={fmtInt(num(firstRow(panels.parcelas), "n"))}
          loading={panels.parcelas?.loading} tone="info"
          sub={`red de ${fmtInt(num(firstRow(panels.red), "n"))} tramos ALIMENTA, de la fuente a la parcela`} />
        <KpiCard label="Ha en riesgo por la falla" value={fmtInt(num(riesgo, "hectareas"))}
          loading={panels.riesgo?.loading} tone="bad"
          sub={`CG-03 en falla corta el agua a ${fmtInt(num(riesgo, "parcelas"))} parcelas`} />
        <KpiCard label="Tomas en sobre-extracción" value={fmtInt(num(sobreKpi, "n"))}
          loading={panels.sobreKpi?.loading} tone="warn"
          sub={`${fmtInt(num(sobreKpi, "exceso_lps"))} l/s extraídos sin derecho`} />
        <KpiCard label="Estrés de la fuente" value={fmtPct(num(fuenteTop, "utilizacion_pct"), 1)}
          loading={panels.fuentes?.loading} tone="warn"
          sub={`${str(fuenteTop, "fuente")} al ${fmtInt(num(fuenteTop, "nivel_pct"))} % de nivel`} />
        <KpiCard label="Incidentes de calidad" value={fmtInt(num(firstRow(panels.incidentes), "n"))}
          loading={panels.incidentes?.loading} tone="bad"
          sub="salinidad, sedimento y agroquímico con traza aguas abajo" />
      </KpiRow>

      <DashSection eyebrow="cada litro está comprometido" title="La cuenca bajo estrés">
        <DashGrid min={360}>
          <Panel title="Estrés hídrico por fuente"
            subtitle="Todo lo asignado aguas abajo contra el caudal disponible en sequía: el embalse ya opera al límite."
            cypher={Q.fuentes} accent="var(--warn)" {...flags(panels.fuentes)}>
            <Gauge value={num(fuenteTop, "utilizacion_pct")} max={100}
              label={str(fuenteTop, "fuente")} format={(n) => fmtPct(n, 1)} />
            <p className="dash-note">
              {(panels.fuentes?.rows ?? []).map((r) =>
                `${str(r, "fuente")}: ${fmtInt(num(r, "demanda_lps"))} de ${fmtInt(num(r, "caudal_disponible_lps"))} l/s comprometidos`,
              ).join(" · ")}
            </p>
          </Panel>

          <Panel title="Balance hídrico por canal"
            subtitle="Capacidad vs demanda de sus tomas aguas abajo (alcance var-length). El rojo está sobre-suscrito: se prometió agua que no cabe."
            cypher={Q.balance} accent={acc} {...flags(panels.balance)}>
            <ColumnChart data={balanceData} format={(n) => fmtPct(n, 0)} accent={acc} />
            <p className="dash-note">
              El <b style={{ color: "var(--error)" }}>Canal Derivación Sur</b> carga 100 l/s sobre 90 de
              capacidad (111 %): el papel autoriza más agua de la que pasa por el cauce.
            </p>
          </Panel>

          <Panel title="Tomas en sobre-extracción"
            subtitle="Caudal extraído contra el derecho de la concesión: el exceso aguas arriba es el agua que le falta a la cola."
            cypher={Q.sobre} accent="var(--error)" {...flags(panels.sobre)}>
            <DataTable rows={panels.sobre?.rows ?? []} columns={sobreCols} maxHeight={220}
              rowTone={(r) => (num(r, "exceso_lps") >= 10 ? "bad" : "warn")} />
          </Panel>

          <Panel title="Caudal del canal principal, en caída"
            subtitle="Diez días del sensor SN-01: la sequía medida día a día, ya bajo el umbral de alerta."
            cypher={Q.serie} accent={acc} {...flags(panels.serie)}>
            <LineChart series={seriesSensor} area format={fmtInt} />
          </Panel>

          <Panel title="Compuertas y su radio de influencia"
            subtitle="Cuántas parcelas dependen de cada compuerta aguas abajo: el tablero de operación de la red."
            cypher={Q.compuertas} accent={acc} {...flags(panels.compuertas)}>
            <DataTable rows={panels.compuertas?.rows ?? []} columns={compCols} maxHeight={260}
              rowTone={(r) => (str(r, "estado") === "falla" ? "bad" : undefined)} />
          </Panel>

          <Panel title="Orden de asignación en sequía"
            subtitle="El caudal agrupado por prioridad legal de la concesión: humano primero, industrial al final."
            cypher={Q.prioridad} accent={acc} {...flags(panels.prioridad)}>
            <DonutChart data={prioridadData} format={lps}
              centerValue={fmtInt((panels.prioridad?.rows ?? []).reduce((s, r) => s + num(r, "caudal_lps"), 0))}
              centerLabel="l/s asignados" />
          </Panel>
        </DashGrid>
      </DashSection>

      <DashSection eyebrow="alcance en la red física" title="Impacto y trazado aguas abajo">
        <DashGrid min={380}>
          <Panel title="Impacto de la compuerta en falla"
            subtitle="Un var-length sobre ALIMENTA responde en milisegundos lo que un recorrido de campo tarda días: quién se queda sin agua."
            cypher={Q.impacto} accent="var(--error)" {...flags(panels.impacto)}>
            <DataTable rows={panels.impacto?.rows ?? []} columns={impactoCols} maxHeight={260}
              rowTone={(r) => (str(r, "prioridad") === "humano" ? "bad" : "warn")} />
            <p className="dash-note">
              <b style={{ color: "var(--error)" }}>CG-03</b> corta {fmtInt(num(riesgo, "hectareas"))} ha en{" "}
              {fmtInt(num(riesgo, "parcelas"))} parcelas — una con concesión de <b>uso humano</b>: reparación prioritaria.
            </p>
          </Panel>

          <Panel title="Traza de contaminación"
            subtitle="Del punto de detección a cada parcela alcanzable aguas abajo: la lista de usuarios a notificar sale del grafo."
            cypher={Q.traza} accent="var(--warn)" {...flags(panels.traza)}>
            <DataTable rows={panels.traza?.rows ?? []} columns={trazaCols} maxHeight={260}
              rowTone={(r) => (str(r, "severidad") === "alta" ? "bad" : undefined)} />
          </Panel>

          <Panel title="Infraestructura crítica (betweenness)"
            subtitle="Los puntos por los que pasa el agua de más parcelas: dónde duele una falla y dónde invertir en redundancia."
            cypher={Q.critica} accent={acc} {...flags(panels.critica)}>
            <RankList data={criticaData} format={(n) => n.toFixed(0)} accent={acc} />
            <p className="dash-note">
              <b>CG-01</b> es el punto único de falla más crítico de la red — su falla sería peor que la de{" "}
              <b style={{ color: "var(--error)" }}>CG-03</b>, hoy averiada.
            </p>
          </Panel>
        </DashGrid>
      </DashSection>

      <DashSection eyebrow="de la fuente a la parcela" title="Mapa y ruta del agua">
        <DashGrid min={380}>
          <Panel title="La cola de canal, sub-atendida"
            subtitle="Parcelas por distancia a la fuente (nivel): las más lejanas reciben una fracción de lo que necesitan. Clic para trazar su ruta."
            cypher={Q.cola} accent={acc} {...flags(panels.cola)}>
            <DataTable rows={colaRows} columns={colaCols} maxHeight={320}
              onRowClick={(r) => setSel(str(r, "parcela"))}
              activeIndex={selIdx >= 0 ? selIdx : undefined}
              rowTone={(r) => (str(r, "estado") === "sub-atendida" ? "warn" : undefined)} />
            <p className="dash-note">
              <b>PA-19</b> y <b>PA-20</b>, al final del sistema, reciben 8 y 6 l/s cuando necesitan 50 y 60:
              la inequidad por gravedad, hecha consulta.
            </p>
          </Panel>

          <Panel title={`Ruta de suministro — ${sel}`}
            subtitle={derecho
              ? `Titular: ${str(derecho, "titular")} (${str(derecho, "junta")}) · concesión ${str(derecho, "concesion")} ${str(derecho, "prioridad")} · ${fmtInt(num(derecho, "asignado_lps"))} de ${fmtInt(num(derecho, "autorizado_lps"))} l/s autorizados`
              : "Cadena aguas arriba de la parcela seleccionada"}
            cypher={Q.ruta} accent={acc} {...flags(drillP.ruta)}
            emptyLabel="esta parcela no tiene ruta registrada">
            <DataTable rows={drillP.ruta?.rows ?? []} columns={rutaCols} maxHeight={240}
              rowTone={(r) => (str(r, "estado") === "falla" ? "bad" : undefined)} />
            {(drillP.sensoresRuta?.rows ?? []).length > 0 && (
              <>
                <p className="dash-note" style={{ marginBottom: "0.4rem" }}>
                  Sensores en el camino — lectura bajo umbral en <b style={{ color: "var(--error)" }}>rojo</b>:
                </p>
                <DataTable rows={drillP.sensoresRuta?.rows ?? []} columns={sensCols} maxHeight={160} />
              </>
            )}
            <p className="dash-note">
              La ruta se ordena con la propiedad entera <b>nivel</b> (orden desde la fuente): aguas arriba
              es un var-length <b>ALIMENTA*1..8</b>, sin reconstruir caminos.
            </p>
          </Panel>

          <Panel title="Mapa de la red hidráulica" span={2} accent={acc}
            subtitle="Fuentes, canales, compuertas, ramales, tomas, parcelas, concesiones y sensores — el agua vive en las conexiones.">
            {grafo ? <GraphView grafo={grafo} /> : <div className="grafo-caja"><span className="grafo-caja__estado">sembrando…</span></div>}
          </Panel>
        </DashGrid>
      </DashSection>
    </div>
  );
}
