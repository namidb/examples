import { useState } from "react";

import {
  Chip,
  ColumnChart,
  DashGrid,
  DashSection,
  DataTable,
  GraphView,
  KpiCard,
  KpiRow,
  Panel,
  RankList,
  accent,
  arr,
  firstRow,
  flags,
  fmtInt,
  num,
  str,
  useGrafo,
  usePanels,
  type Column,
} from "../kit";
import type { DashProps } from "../dashProps";

/* CVE de la ruta de ataque real — arranque del drill-down. */
const CVE_RUTA = "CVE-2026-1187";

/* Orden fijo de severidades CVSS para el histograma. */
const SEV_ORDEN = ["Critica (9+)", "Alta (7-9)", "Media (4-7)", "Baja (<4)"];

const Q = {
  cves: `MATCH (v:Vulnerabilidad) RETURN count(v) AS n`,

  activos: `MATCH (s:Servidor)
WITH count(s) AS srv
MATCH (d:Dispositivo)
WITH srv, count(d) AS disp
RETURN srv + disp AS n, srv AS servidores, disp AS dispositivos`,

  graves: `MATCH (v:Vulnerabilidad)
WHERE v.cvss >= 7.0
RETURN count(v) AS n`,

  enRuta: `MATCH (d:Dispositivo)-[:RUTA_ATAQUE]->(sr:Servidor)
WITH collect(DISTINCT sr.hostname) AS con_ruta
MATCH (s:Servidor)-[:CORRE]->(app:Aplicacion)-[:AFECTADA_POR]->(v:Vulnerabilidad)
WHERE s.hostname IN con_ruta
RETURN count(DISTINCT v) AS n`,

  rutasCriticos: `MATCH (d:Dispositivo {expuesto_internet: true})-[r:RUTA_ATAQUE]->(s:Servidor {criticidad: 'critica'})
MATCH (d)-[:GENERO]->(a:Alerta)
RETURN d.hostname AS origen, s.hostname AS destino_critico,
       r.saltos AS saltos, collect(DISTINCT a.tecnica) AS tecnicas_detectadas`,

  prioridad: `MATCH (d:Dispositivo)-[:RUTA_ATAQUE]->(sr:Servidor)
WITH collect(DISTINCT sr.hostname) AS con_ruta
MATCH (sc:Servidor {criticidad: 'critica'})
OPTIONAL MATCH (piv:Servidor)-[:PUEDE_ACCEDER*1..3]->(sc)
WITH con_ruta, collect(DISTINCT piv.hostname) AS pivotan
MATCH (s:Servidor)-[:CORRE]->(app:Aplicacion)-[:AFECTADA_POR]->(v:Vulnerabilidad)
WITH v, s, (s.hostname IN con_ruta) AS en_ruta,
     (s.criticidad = 'critica' OR s.hostname IN pivotan) AS a_critico
WITH v, s, en_ruta,
     (CASE WHEN en_ruta THEN 60 ELSE 0 END)
     + (CASE WHEN a_critico THEN 40 ELSE 0 END)
     + (CASE WHEN v.en_kev THEN 30 ELSE 0 END)
     + v.cvss AS riesgo_real
RETURN v.cve AS cve, v.cvss AS cvss, v.en_kev AS explotada_real,
       s.hostname AS servidor, s.criticidad AS criticidad,
       en_ruta AS en_ruta_de_ataque, round(riesgo_real * 10) / 10 AS riesgo_real
ORDER BY riesgo_real DESC
LIMIT 8`,

  distribucion: `MATCH (v:Vulnerabilidad)
WITH CASE
  WHEN v.cvss >= 9.0 THEN 'Critica (9+)'
  WHEN v.cvss >= 7.0 THEN 'Alta (7-9)'
  WHEN v.cvss >= 4.0 THEN 'Media (4-7)'
  ELSE 'Baja (<4)' END AS sev
RETURN sev, count(*) AS n`,

  control: `MATCH (d:Dispositivo)-[:RUTA_ATAQUE]->(s:Servidor {criticidad: 'critica'})
MATCH (d)-[:GENERO]->(a:Alerta)-[:USA_TECNICA]->(t:Tecnica)
MATCH (c:Control)-[:MITIGA]->(t)
RETURN DISTINCT t.id_attack AS tecnica, t.nombre AS nombre_tecnica,
       c.nombre AS control_que_corta, c.tipo AS tipo
ORDER BY tecnica`,

  alertas: `MATCH (d:Dispositivo)-[:GENERO]->(a:Alerta)-[:USA_TECNICA]->(t:Tecnica)
WITH d, count(DISTINCT a) AS alertas, collect(DISTINCT t.nombre) AS tecnicas
WHERE alertas >= 2
RETURN d.hostname AS dispositivo, d.expuesto_internet AS expuesto, alertas, tecnicas
ORDER BY alertas DESC`,

  memoria: `MATCH (:Dispositivo)-[:GENERO]->(:Alerta)-[:USA_TECNICA]->(t:Tecnica)
WITH collect(DISTINCT t.id_attack) AS tecnicas_hoy
MATCH (inc:Incidente)-[:USA_TECNICA]->(t2:Tecnica)
WHERE t2.id_attack IN tecnicas_hoy
RETURN inc.codigo AS incidente, inc.fecha AS fecha,
       t2.id_attack AS tecnica, t2.nombre AS nombre_tecnica
ORDER BY fecha DESC`,

  drill: `MATCH (v:Vulnerabilidad {cve: $cve})<-[:AFECTADA_POR]-(app:Aplicacion)<-[:CORRE]-(s:Servidor)
OPTIONAL MATCH (s)-[:PUEDE_ACCEDER*1..3]->(crit:Servidor {criticidad: 'critica'})
WITH v, app, s, collect(DISTINCT crit.hostname) AS criticos
WITH v, app, s, [x IN criticos WHERE x IS NOT NULL] AS ac
RETURN app.nombre AS aplicacion, s.hostname AS servidor, s.criticidad AS criticidad,
       v.cvss AS cvss, v.en_kev AS en_kev, ac AS criticos_alcanzables, size(ac) AS n_criticos`,
};

export default function Ciberseguridad({ slug }: DashProps) {
  const acc = accent(slug);
  const [sel, setSel] = useState(CVE_RUTA);
  const { panels } = usePanels(slug, {
    cves: { cypher: Q.cves },
    activos: { cypher: Q.activos },
    graves: { cypher: Q.graves },
    enRuta: { cypher: Q.enRuta },
    rutasCriticos: { cypher: Q.rutasCriticos },
    prioridad: { cypher: Q.prioridad },
    distribucion: { cypher: Q.distribucion },
    control: { cypher: Q.control },
    alertas: { cypher: Q.alertas },
    memoria: { cypher: Q.memoria },
  });
  const { panels: drillP } = usePanels(slug, { drill: { cypher: Q.drill, params: { cve: sel } } });
  const { grafo } = useGrafo(slug);

  const activos = firstRow(panels.activos);
  const ruta = firstRow(panels.rutasCriticos);
  const drill = firstRow(drillP.drill);

  const prioridad = panels.prioridad?.rows ?? [];

  const prioData = prioridad.map((r) => {
    const enRuta = str(r, "en_ruta_de_ataque") === "true";
    return {
      label: str(r, "cve"),
      value: num(r, "riesgo_real"),
      sub: `CVSS ${num(r, "cvss").toFixed(1)} · ${str(r, "servidor")}${enRuta ? " · EN RUTA" : ""}`,
      color: str(r, "cve") === sel ? "var(--rosa)" : enRuta ? "var(--error)" : "rgba(244,238,241,0.26)",
    };
  });

  const distData = SEV_ORDEN.map((sev, i) => {
    const row = panels.distribucion?.rows.find((r) => str(r, "sev") === sev);
    return {
      label: sev,
      value: row ? num(row, "n") : 0,
      color: i === 0 ? "var(--error)" : i === 1 ? "#ffb020" : "rgba(244,238,241,0.32)",
    };
  });

  const rutasCols: Column[] = [
    { key: "origen", label: "Origen (expuesto)", mono: true },
    { key: "destino_critico", label: "Activo crítico", mono: true },
    { key: "saltos", label: "Saltos", align: "right", format: fmtInt },
    {
      key: "tecnicas_detectadas",
      label: "Técnicas (ATT&CK)",
      render: (v) => (Array.isArray(v) ? v.map((t) => String(t)).join(" · ") : String(v ?? "")),
    },
  ];

  const alertasCols: Column[] = [
    { key: "dispositivo", label: "Dispositivo", mono: true },
    { key: "expuesto", label: "Expuesto", align: "center" },
    { key: "alertas", label: "Alertas", align: "right", format: fmtInt },
    {
      key: "tecnicas",
      label: "Técnicas correlacionadas",
      render: (v) => (Array.isArray(v) ? v.map((t) => String(t)).join(", ") : String(v ?? "")),
    },
  ];

  const memoriaCols: Column[] = [
    { key: "incidente", label: "Incidente", mono: true },
    { key: "fecha", label: "Fecha", mono: true },
    { key: "tecnica", label: "Técnica", mono: true },
    { key: "nombre_tecnica", label: "Descripción" },
  ];

  const drillCriticos = arr(drill, "criticos_alcanzables");
  const drillExpone = drillCriticos.length > 0;

  return (
    <div>
      <KpiRow>
        <KpiCard label="CVEs monitoreados" value={fmtInt(num(firstRow(panels.cves), "n"))}
          tone="info" loading={panels.cves?.loading} sub="catálogo completo del inventario" />
        <KpiCard label="Activos en el grafo" value={fmtInt(num(activos, "n"))}
          loading={panels.activos?.loading}
          sub={`${fmtInt(num(activos, "servidores"))} servidores · ${fmtInt(num(activos, "dispositivos"))} dispositivos`} />
        <KpiCard label="Graves por CVSS (≥7.0)" value={fmtInt(num(firstRow(panels.graves), "n"))}
          tone="warn" loading={panels.graves?.loading} sub="la cola que priorizaría el método tradicional" />
        <KpiCard label="En ruta a un activo crítico" value={fmtInt(num(firstRow(panels.enRuta), "n"))}
          tone="bad" loading={panels.enRuta?.loading} sub="el único CVE que realmente expone la BD de clientes" />
        <KpiCard label="Saltos hasta la BD de clientes" value={fmtInt(num(ruta, "saltos"))}
          tone="bad" loading={panels.rutasCriticos?.loading}
          sub={ruta ? `${str(ruta, "origen")} → ${str(ruta, "destino_critico")}` : "cadena de credenciales"} />
      </KpiRow>

      <DashSection eyebrow="El CVSS miente" title="Priorización por exposición real">
        <DashGrid min={400}>
          <Panel title="CVEs reordenados por riesgo real"
            subtitle="La misma lista de vulnerabilidades, repuntuada: estar en una ruta a un activo crítico pesa más que el CVSS. Clic en un CVE para abrir su anatomía."
            cypher={Q.prioridad} accent={acc} {...flags(panels.prioridad)}>
            <RankList
              data={prioData}
              format={(n) => n.toFixed(1)}
              onClick={(_, i) => setSel(str(prioridad[i], "cve"))}
              activeLabel={sel}
            />
            <p className="dash-note">
              <b style={{ color: "var(--error)" }}>CVE-2026-1187 (7.5)</b> encabeza la cola pese a un CVSS menor:
              está en el camino directo a la BD. El <b>9.8 aislado</b> cae al fondo.
            </p>
          </Panel>

          <Panel title={`Anatomía de ${sel}`}
            subtitle={drillExpone ? "Este CVE abre camino a un activo crítico — arréglalo primero." : "Vulnerabilidad sin ruta a un activo crítico — prioridad baja pese al CVSS."}
            cypher={Q.drill} accent={drillExpone ? "var(--error)" : "#ffb020"} {...flags(drillP.drill)}>
            {drill && (
              <div style={{ display: "flex", flexDirection: "column", gap: "0.9rem" }}>
                <div className="dash-kpirow" style={{ margin: 0 }}>
                  <div className="dash-kpi" style={{ ["--accent" as string]: "var(--hueso)" }}>
                    <span className="dash-kpi__label">CVSS</span>
                    <span className="dash-kpi__value display">{num(drill, "cvss").toFixed(1)}</span>
                  </div>
                  <div className="dash-kpi" style={{ ["--accent" as string]: str(drill, "en_kev") === "true" ? "var(--error)" : "var(--gris)" }}>
                    <span className="dash-kpi__label">Explotada real (KEV)</span>
                    <span className="dash-kpi__value display">{str(drill, "en_kev") === "true" ? "Sí" : "No"}</span>
                  </div>
                  <div className="dash-kpi" style={{ ["--accent" as string]: drillExpone ? "var(--error)" : "var(--ok)" }}>
                    <span className="dash-kpi__label">Críticos alcanzables</span>
                    <span className="dash-kpi__value display">{drillCriticos.length}</span>
                  </div>
                </div>
                <p className="dash-note" style={{ margin: 0 }}>
                  Corre en <b>{str(drill, "aplicacion")}</b> sobre <b className="mono">{str(drill, "servidor")}</b>
                  {" "}(criticidad {str(drill, "criticidad")}).
                </p>
                {drillExpone ? (
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "0.35rem", alignItems: "center" }}>
                    <span className="dash-note" style={{ margin: 0 }}>Desde aquí se alcanza:</span>
                    {drillCriticos.map((c, i) => (
                      <Chip key={i} tone="bad">{String(c)}</Chip>
                    ))}
                  </div>
                ) : (
                  <Chip tone="ok">contenido — no pivota a ningún activo crítico</Chip>
                )}
              </div>
            )}
          </Panel>
        </DashGrid>
      </DashSection>

      <DashSection eyebrow="Lo que una lista de CVEs nunca muestra" title="De la alerta a la ruta">
        <DashGrid min={360}>
          <Panel title="Rutas posibles hacia activos críticos"
            subtitle="Dispositivo expuesto con alertas activas cuyo pivoteo de credenciales alcanza un servidor crítico. La ruta está materializada (RUTA_ATAQUE)."
            cypher={Q.rutasCriticos} accent="var(--error)" {...flags(panels.rutasCriticos)}>
            <DataTable rows={panels.rutasCriticos?.rows ?? []} columns={rutasCols} maxHeight={220}
              rowTone={() => "bad"} sortable={false} />
          </Panel>

          <Panel title="Distribución por severidad CVSS"
            subtitle="El CVSS solo no discrimina: hay tantas 'críticas' como inofensivas. El riesgo está en la topología, no en el número."
            cypher={Q.distribucion} accent={acc} {...flags(panels.distribucion)}>
            <ColumnChart data={distData} accent={acc} />
            <p className="dash-note">
              4 CVEs pasan el umbral de <b>CVSS ≥ 7</b>, pero <b style={{ color: "var(--error)" }}>solo 1</b> está
              en una ruta real a la BD de clientes.
            </p>
          </Panel>

          <Panel title="Alertas agrupadas por incidente"
            subtitle="Detecciones sueltas colapsadas por el dispositivo que las originó: de un puñado de alertas a una narrativa de incidente."
            cypher={Q.alertas} accent="#ffb020" {...flags(panels.alertas)}>
            <DataTable rows={panels.alertas?.rows ?? []} columns={alertasCols} maxHeight={220}
              rowTone={(r) => (str(r, "expuesto") === "true" ? "bad" : "warn")} sortable={false} />
          </Panel>
        </DashGrid>
      </DashSection>

      <DashSection eyebrow="Respuesta ejecutable y memoria" title="El control que corta y el mapa de exposición">
        <DashGrid min={360}>
          <Panel title="El control que corta la ruta"
            subtitle="Para la técnica de pivoteo presente en la ruta activa, qué control existente la mitiga — la acción concreta."
            cypher={Q.control} accent="var(--ok)" {...flags(panels.control)}>
            <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem" }}>
              {(panels.control?.rows ?? []).map((r, i) => (
                <div key={i} style={{ display: "grid", gridTemplateColumns: "1fr auto 1fr", gap: "0.7rem", alignItems: "center" }}>
                  <span style={{ display: "flex", flexDirection: "column", gap: "0.15rem" }}>
                    <span className="mono" style={{ fontSize: "0.74rem", color: "var(--error)" }}>{str(r, "tecnica")}</span>
                    <span style={{ fontSize: "0.8rem", color: "var(--hueso)" }}>{str(r, "nombre_tecnica")}</span>
                  </span>
                  <span style={{ color: "var(--ok)", letterSpacing: "0.1em" }}>⛒</span>
                  <span style={{ display: "flex", flexDirection: "column", gap: "0.2rem", alignItems: "flex-end", textAlign: "right" }}>
                    <Chip tone="ok">{str(r, "control_que_corta")}</Chip>
                    <span className="dash-note" style={{ margin: 0 }}>{str(r, "tipo")}</span>
                  </span>
                </div>
              ))}
              <p className="dash-note">Activar MFA sobre <b>svc-backup</b> rompe el pivoteo T1078 y colapsa toda la ruta.</p>
            </div>
          </Panel>

          <Panel title="Memoria histórica del SOC"
            subtitle="Incidentes pasados que usaron las mismas técnicas detectadas hoy: el ataque de hoy no es el primero."
            cypher={Q.memoria} accent="#a56bff" {...flags(panels.memoria)}>
            <DataTable rows={panels.memoria?.rows ?? []} columns={memoriaCols} maxHeight={220} sortable={false} />
          </Panel>

          <Panel title="Mapa de exposición" span={2} accent={acc}
            subtitle="Usuarios, identidades, credenciales, servidores y CVEs — la ruta de ataque vive en las conexiones, no en un nodo aislado.">
            {grafo ? <GraphView grafo={grafo} /> : <div className="grafo-caja"><span className="grafo-caja__estado">sembrando…</span></div>}
          </Panel>
        </DashGrid>
      </DashSection>
    </div>
  );
}
