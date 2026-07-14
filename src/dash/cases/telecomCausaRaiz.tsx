import { useState } from "react";

import {
  Chip,
  ColumnChart,
  DashGrid,
  DashSection,
  DataTable,
  DonutChart,
  GraphView,
  KpiCard,
  KpiRow,
  Panel,
  RankList,
  accent,
  fmtInt,
  fmtPct,
  firstRow,
  flags,
  num,
  str,
  useGrafo,
  usePanels,
  type Column,
} from "../kit";
import type { DashProps } from "../dashProps";

const RAIZ = "AGG-NORTE-02";
const FIBRA = "F-33";

const Q = {
  activas: `MATCH (:Equipo)-[:EMITE]->(a:Alarma {activa: true})
RETURN count(a) AS n`,

  impacto: `MATCH (afectado:Equipo)-[:DEPENDE_DE*1..3]->(:Equipo {tag: 'AGG-NORTE-02'})
WITH collect(DISTINCT afectado.tag) + ['AGG-NORTE-02'] AS zona_corte
MATCH (c:Cliente)-[:CONTRATA]->(s:Servicio)-[:CURSA_POR]->(e:Equipo)
WHERE e.tag IN zona_corte
RETURN count(DISTINCT c) AS clientes,
       count(DISTINCT CASE WHEN c.sla = 'premium' THEN c.nombre END) AS premium,
       count(DISTINCT s) AS servicios`,

  tickets: `MATCH (t:Ticket)-[:REPORTA]->(:Servicio)
RETURN count(DISTINCT t) AS n`,

  agrupadas: `MATCH (afectado:Equipo)-[:DEPENDE_DE*1..3]->(:Equipo {tag: 'AGG-NORTE-02'})
WITH collect(DISTINCT afectado.tag) + ['AGG-NORTE-02'] AS zona_corte
MATCH (e:Equipo)-[:EMITE]->(a:Alarma {activa: true})
WITH zona_corte, e, a,
     CASE WHEN e.tag IN zona_corte THEN 'incidente fibra F-33'
          ELSE 'evento aislado' END AS grupo
RETURN grupo, count(a) AS alarmas, count(DISTINCT e) AS equipos
ORDER BY alarmas DESC`,

  causaRaiz: `MATCH (e:Equipo)-[:EMITE]->(:Alarma {activa: true})
MATCH (e)-[:DEPENDE_DE]->(padre:Equipo)
WHERE NOT EXISTS { (padre)-[:EMITE]->(:Alarma {activa: true}) }
WITH DISTINCT e, padre
OPTIONAL MATCH (e)-[:CONECTADO_POR]->(f:Fibra)
CALL {
  WITH e
  MATCH (h:Equipo)-[:DEPENDE_DE*1..3]->(e)
  RETURN count(DISTINCT h) AS equipos_aguas_abajo
}
RETURN e.tag AS causa_raiz, e.tipo AS tipo, f.codigo AS fibra,
       padre.tag AS padre_sano, equipos_aguas_abajo
ORDER BY equipos_aguas_abajo DESC`,

  tipos: `MATCH (:Equipo)-[:EMITE]->(a:Alarma {activa: true})
RETURN a.tipo AS tipo, count(a) AS alarmas
ORDER BY alarmas DESC`,

  impactoSla: `MATCH (afectado:Equipo)-[:DEPENDE_DE*1..3]->(:Equipo {tag: 'AGG-NORTE-02'})
WITH collect(DISTINCT afectado.tag) + ['AGG-NORTE-02'] AS zona_corte
MATCH (c:Cliente)-[:CONTRATA]->(s:Servicio)-[:CURSA_POR]->(e:Equipo)
WHERE e.tag IN zona_corte
RETURN c.sla AS sla, count(DISTINCT c) AS clientes,
       count(DISTINCT s) AS servicios
ORDER BY sla`,

  prioridad: `MATCH (e:Equipo)-[:EMITE]->(:Alarma {activa: true})
WITH DISTINCT e
CALL {
  WITH e
  MATCH (e)<-[:CURSA_POR]-(s:Servicio)<-[:CONTRATA]-(c:Cliente)
  RETURN count(DISTINCT CASE WHEN c.sla = 'premium' THEN c.nombre END) AS clientes_premium,
         count(DISTINCT c.nombre) AS clientes_totales
}
RETURN e.tag AS equipo, e.tipo AS tipo, clientes_premium, clientes_totales
ORDER BY clientes_premium DESC, clientes_totales DESC
LIMIT 8`,

  repetido: `MATCH (:Equipo {tag: 'AGG-NORTE-02'})-[:CONECTADO_POR]->(f:Fibra)
MATCH (i:Incidente)-[:CAUSADO_POR]->(f)
RETURN f.codigo AS fibra, i.numero AS incidente_previo,
       i.fecha AS fecha, i.causa AS causa
ORDER BY i.fecha DESC`,

  drill: `MATCH (tk:Ticket)-[:REPORTA]->(st:Servicio)
WITH collect(DISTINCT st.codigo) AS con_ticket
MATCH (c:Cliente)-[:CONTRATA]->(s:Servicio)-[:CURSA_POR]->(e:Equipo {tag: $equipo})
RETURN c.nombre AS cliente, c.sla AS sla, s.codigo AS servicio,
       s.tipo AS tipo, (s.codigo IN con_ticket) AS con_ticket
ORDER BY sla, cliente`,
};

const ORO = "#ffd23a";

export default function TelecomCausaRaiz({ slug }: DashProps) {
  const acc = accent(slug);
  const [sel, setSel] = useState("ACC-NOR-200");

  const { panels } = usePanels(slug, {
    activas: { cypher: Q.activas },
    impacto: { cypher: Q.impacto },
    tickets: { cypher: Q.tickets },
    agrupadas: { cypher: Q.agrupadas },
    causaRaiz: { cypher: Q.causaRaiz },
    tipos: { cypher: Q.tipos },
    impactoSla: { cypher: Q.impactoSla },
    prioridad: { cypher: Q.prioridad },
    repetido: { cypher: Q.repetido },
  });
  const { panels: drillP } = usePanels(slug, { drill: { cypher: Q.drill, params: { equipo: sel } } });
  const { grafo } = useGrafo(slug);

  const activas = num(firstRow(panels.activas), "n");
  const impacto = firstRow(panels.impacto);
  const clientesImp = num(impacto, "clientes");
  const premiumImp = num(impacto, "premium");

  // Cascada vs ruido: cuántas alarmas explica la única causa raíz.
  const agrup = panels.agrupadas?.rows ?? [];
  const cascada = num(agrup.find((r) => str(r, "grupo").startsWith("incidente")), "alarmas");
  const aislado = num(agrup.find((r) => str(r, "grupo") === "evento aislado"), "alarmas");
  const colapso = activas > 0 ? cascada / activas : 0;

  const donutAgr = [
    { label: "Cascada · fibra F-33", value: cascada, color: "var(--error)" },
    { label: "Eventos aislados", value: aislado, color: "var(--muted)" },
  ];

  const slaRows = panels.impactoSla?.rows ?? [];
  const donutSla = slaRows.map((r) => ({
    label: str(r, "sla") === "premium" ? "Premium (SLA)" : "Estándar",
    value: num(r, "clientes"),
    color: str(r, "sla") === "premium" ? ORO : "var(--muted)",
  }));

  const tiposData = (panels.tipos?.rows ?? []).map((r) => ({
    label: str(r, "tipo"),
    value: num(r, "alarmas"),
    color: str(r, "tipo") === "LOS" ? "var(--error)" : acc,
  }));

  const prioridad = panels.prioridad?.rows ?? [];
  const selRow = prioridad.find((r) => str(r, "equipo") === sel);

  const causaCols: Column[] = [
    { key: "causa_raiz", label: "Equipo", mono: true },
    { key: "tipo", label: "Rol" },
    { key: "fibra", label: "Fibra", mono: true },
    { key: "padre_sano", label: "Padre sano", mono: true },
    { key: "equipos_aguas_abajo", label: "Equipos abajo", align: "right", format: fmtInt },
  ];

  const drillCols: Column[] = [
    { key: "cliente", label: "Cliente" },
    { key: "sla", label: "SLA" },
    { key: "servicio", label: "Servicio", mono: true },
    { key: "tipo", label: "Tipo" },
    {
      key: "con_ticket",
      label: "Reclamo",
      align: "center",
      render: (v) => (v ? <Chip tone="bad">ticket</Chip> : <span style={{ color: "var(--muted)" }}>·</span>),
    },
  ];

  const repetidoCols: Column[] = [
    { key: "incidente_previo", label: "Incidente", mono: true },
    { key: "fecha", label: "Fecha", mono: true },
    { key: "causa", label: "Causa registrada" },
  ];

  return (
    <div>
      <KpiRow>
        <KpiCard label="Alarmas activas" value={fmtInt(activas)} tone="warn"
          loading={panels.activas?.loading}
          sub="equipos, enlaces y servicios, ahora mismo" />
        <KpiCard label="Explicadas por una causa" value={fmtInt(cascada)} tone="bad"
          loading={panels.agrupadas?.loading}
          sub={`${fmtPct(colapso * 100)} de las alarmas son la misma falla`} />
        <KpiCard label="Clientes impactados" value={fmtInt(clientesImp)} tone="bad"
          loading={panels.impacto?.loading}
          sub={`${fmtInt(premiumImp)} premium bajo el subárbol del corte`} />
        <KpiCard label="Tickets abiertos" value={fmtInt(num(firstRow(panels.tickets), "n"))} tone="warn"
          loading={panels.tickets?.loading}
          sub="clientes que ya están reclamando" />
      </KpiRow>

      <DashSection eyebrow="De cien alarmas a una causa" title="La tormenta colapsa en un incidente">
        <DashGrid min={360}>
          <Panel title="Alarmas agrupadas por causa raíz"
            subtitle={`${fmtInt(cascada)} síntomas son un solo corte de fibra; ${fmtInt(aislado)} quedan como eventos aislados. Menos escalaciones, mejores casos.`}
            cypher={Q.agrupadas} accent="var(--error)" {...flags(panels.agrupadas)}>
            <DonutChart data={donutAgr} centerValue={fmtInt(activas)} centerLabel="alarmas activas" />
          </Panel>

          <Panel title="Causa raíz identificada"
            subtitle="Equipos alarmados cuyo padre topológico está sano. Solo AGG-NORTE-02 arrastra un subárbol: es el origen; el resto es ruido aislado."
            cypher={Q.causaRaiz} accent={acc} {...flags(panels.causaRaiz)}>
            <DataTable rows={panels.causaRaiz?.rows ?? []} columns={causaCols} maxHeight={220}
              rowTone={(r) => (num(r, "equipos_aguas_abajo") > 0 ? "bad" : "muted")} />
          </Panel>

          <Panel title="Tipos de alarma activa"
            subtitle="El mismo corte se manifiesta como caída de enlace, pérdida de señal y degradación en decenas de equipos distintos."
            cypher={Q.tipos} accent={acc} {...flags(panels.tipos)}>
            <ColumnChart data={tiposData} accent={acc} labelRotate />
          </Panel>
        </DashGrid>
      </DashSection>

      <DashSection eyebrow="A quién llamar primero" title="Impacto sobre clientes y priorización">
        <DashGrid min={360}>
          <Panel title="Clientes afectados por SLA"
            subtitle="Todo lo que cursa por el subárbol del corte, separado por nivel de servicio. Los premium marcan la urgencia."
            cypher={Q.impactoSla} accent={ORO} {...flags(panels.impactoSla)}>
            <DonutChart data={donutSla} centerValue={fmtInt(clientesImp)} centerLabel="clientes" />
          </Panel>

          <Panel title="Orden de reparación"
            subtitle="Ranking de equipos alarmados por clientes conectados aguas abajo. Clic en un equipo para ver a quién afecta."
            cypher={Q.prioridad} accent={acc} {...flags(panels.prioridad)}>
            <RankList
              data={prioridad.map((r) => ({
                label: str(r, "equipo"),
                value: num(r, "clientes_totales"),
                sub: `${fmtInt(num(r, "clientes_premium"))} premium`,
                color: str(r, "equipo") === sel ? ORO : acc,
              }))}
              onClick={(_, i) => setSel(str(prioridad[i], "equipo"))}
              activeLabel={sel}
            />
          </Panel>

          <Panel title={`Clientes bajo ${sel}`}
            subtitle={selRow
              ? `${fmtInt(num(selRow, "clientes_totales"))} clientes · ${fmtInt(num(selRow, "clientes_premium"))} premium — quién pierde servicio y quién ya reclamó`
              : "Selecciona un equipo en el ranking"}
            cypher={Q.drill} accent={ORO} {...flags(drillP.drill)}
            emptyLabel="sin clientes en este equipo">
            <DataTable rows={drillP.drill?.rows ?? []} columns={drillCols} maxHeight={260}
              rowTone={(r) => (str(r, "sla") === "premium" ? "warn" : undefined)} />
          </Panel>
        </DashGrid>
      </DashSection>

      <DashSection eyebrow="El grafo recuerda" title="Historia recurrente y mapa de la red">
        <DashGrid min={360}>
          <Panel title={`La fibra ${FIBRA} ya falló antes`}
            subtitle="El mismo enlace del corte de hoy causó dos incidentes este año: no es un evento aislado, es una candidata a reposición."
            cypher={Q.repetido} accent="var(--warn)" {...flags(panels.repetido)}>
            <DataTable rows={panels.repetido?.rows ?? []} columns={repetidoCols} maxHeight={200}
              rowTone={() => "warn"} />
            <p className="dash-note" style={{ marginTop: "0.5rem" }}>
              Enlace <b style={{ color: "var(--warn)" }}>{FIBRA}</b> · daño recurrente sobre el agregador{" "}
              <b>{RAIZ}</b>: el grafo convierte una avería en un patrón.
            </p>
          </Panel>

          <Panel title="Mapa de la red" span={2} accent={acc}
            subtitle="Equipos, fibras, servicios, clientes y alarmas — la causa raíz vive en la topología, no en la alarma.">
            {grafo ? <GraphView grafo={grafo} /> : <div className="grafo-caja"><span className="grafo-caja__estado">sembrando…</span></div>}
          </Panel>
        </DashGrid>
      </DashSection>
    </div>
  );
}
