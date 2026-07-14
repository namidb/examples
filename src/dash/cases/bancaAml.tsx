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
  fmtInt,
  fmtMoney,
  fmtMoneyExact,
  firstRow,
  flags,
  num,
  str,
  useGrafo,
  usePanels,
  type Column,
} from "../kit";
import type { DashProps } from "../dashProps";

const CTRL = "EC00-CTRL-000001";

const Q = {
  cuentas: `MATCH (c:Cuenta) RETURN count(c) AS n`,
  transfers: `MATCH ()-[t:TRANSFIERE]->() RETURN count(t) AS n, sum(t.monto) AS vol`,
  naive: `MATCH ()-[t:TRANSFIERE]->() WHERE t.monto < 500 RETURN count(t) AS n`,
  ring: `MATCH (m:Cuenta)-[:USA_DISPOSITIVO]->(:Dispositivo {device_id:'DEV-MULA'})
RETURN count(DISTINCT m) AS n`,
  expuesto: `MATCH (:Cuenta)-[s:TRANSFIERE]->(ctrl:Cuenta {iban:'${CTRL}'})
RETURN sum(s.monto) AS v, count(s) AS n`,

  prioridad: `CALL algo.pagerank({labels: ['Cuenta'], edge_types: ['TRANSFIERE']})
YIELD node_id, score
WITH node_id AS cta, score
MATCH (p:Persona)-[:TITULAR_DE]->(cta)
MATCH (c:Cuenta) WHERE id(c) = id(cta)
RETURN DISTINCT c.iban AS cuenta, p.nombre AS titular,
       round(score * 10000) / 10000 AS score
ORDER BY score DESC
LIMIT 8`,

  histograma: `MATCH ()-[t:TRANSFIERE]->()
WITH CASE
  WHEN t.monto < 300  THEN '0–300'
  WHEN t.monto < 500  THEN '300–500'
  WHEN t.monto < 1000 THEN '500–1K'
  WHEN t.monto < 4000 THEN '1K–4K'
  ELSE '4K+' END AS rango
RETURN rango, count(*) AS transferencias`,

  anillo: `MATCH (o:Cuenta)-[t:TRANSFIERE]->(m:Cuenta)-[:USA_DISPOSITIVO]->(d:Dispositivo {device_id:'DEV-MULA'})
WHERE t.monto < 500
WITH m, count(t) AS depositos, sum(t.monto) AS entrante
MATCH (p:Persona)-[:TITULAR_DE]->(m)
MATCH (m)-[s:TRANSFIERE]->(ctrl:Cuenta)
RETURN p.nombre AS titular, m.iban AS cuenta, depositos, entrante, s.monto AS reexpide
ORDER BY entrante DESC`,

  ciclo: `MATCH (a:Cuenta)-[t1:TRANSFIERE]->(b:Cuenta)-[t2:TRANSFIERE]->(c:Cuenta)-[t3:TRANSFIERE]->(a)
WHERE a.iban < b.iban AND a.iban < c.iban AND t1.monto > 5000
RETURN a.iban AS a, b.iban AS b, c.iban AS c,
       t1.monto AS m1, t2.monto AS m2, t3.monto AS m3
LIMIT 1`,

  empresas: `MATCH (p:Persona)-[:ACCIONISTA_DE]->(e1:Empresa),
      (p)-[:ACCIONISTA_DE]->(e2:Empresa)
WHERE e1.nombre < e2.nombre
MATCH (e1)-[:TITULAR_DE]->(c1:Cuenta)-[t:TRANSFIERE]->(c2:Cuenta)<-[:TITULAR_DE]-(e2)
RETURN p.nombre AS accionista, e1.nombre AS empresa_a, e2.nombre AS empresa_b,
       count(t) AS movimientos, sum(t.monto) AS monto
ORDER BY monto DESC`,

  contagio: `MATCH (d:Dispositivo {investigado: true})<-[:USA_DISPOSITIVO]-(c:Cuenta)<-[:TITULAR_DE]-(p:Persona)
OPTIONAL MATCH (c)-[:TRANSFIERE]-(c2:Cuenta)<-[:TITULAR_DE]-(p2:Persona)
RETURN d.device_id AS dispositivo,
       collect(DISTINCT p.nombre) AS directos,
       collect(DISTINCT p2.nombre) AS a_un_salto`,

  drill: `MATCH (o:Cuenta)-[t:TRANSFIERE]->(sel:Cuenta {iban:$iban})
MATCH (h)-[:TITULAR_DE]->(o)
RETURN coalesce(h.nombre, o.iban) AS titular, o.iban AS cuenta, t.monto AS monto, t.fecha AS fecha
ORDER BY monto DESC
LIMIT 12`,
};

const HISTO_ORDEN = ["0–300", "300–500", "500–1K", "1K–4K", "4K+"];

export default function BancaAml({ slug }: DashProps) {
  const acc = accent(slug);
  const [sel, setSel] = useState(CTRL);
  const { panels } = usePanels(slug, {
    cuentas: { cypher: Q.cuentas },
    transfers: { cypher: Q.transfers },
    naive: { cypher: Q.naive },
    ring: { cypher: Q.ring },
    expuesto: { cypher: Q.expuesto },
    prioridad: { cypher: Q.prioridad },
    histograma: { cypher: Q.histograma },
    anillo: { cypher: Q.anillo },
    ciclo: { cypher: Q.ciclo },
    empresas: { cypher: Q.empresas },
    contagio: { cypher: Q.contagio },
  });
  const { panels: drillP } = usePanels(slug, { drill: { cypher: Q.drill, params: { iban: sel } } });
  const { grafo } = useGrafo(slug);

  const expuesto = firstRow(panels.expuesto);
  const transfers = firstRow(panels.transfers);
  const cyc = firstRow(panels.ciclo);

  const histoData = HISTO_ORDEN.map((rango) => {
    const row = panels.histograma?.rows.find((r) => str(r, "rango") === rango);
    return {
      label: rango,
      value: row ? num(row, "transferencias") : 0,
      color: rango === "300–500" ? "var(--error)" : acc,
    };
  });

  const prioridad = panels.prioridad?.rows ?? [];
  const selTitular = prioridad.find((r) => str(r, "cuenta") === sel);

  const anilloCols: Column[] = [
    { key: "titular", label: "Titular (mula)" },
    { key: "depositos", label: "Dep. <$500", align: "right", format: fmtInt },
    { key: "entrante", label: "Entra", align: "right", format: (n) => fmtMoneyExact(n) },
    { key: "reexpide", label: "→ Reexpide", align: "right", format: (n) => fmtMoneyExact(n) },
  ];

  const drillCols: Column[] = [
    { key: "titular", label: "Ordenante" },
    { key: "cuenta", label: "Cuenta origen", mono: true },
    { key: "monto", label: "Monto", align: "right", format: (n) => fmtMoneyExact(n) },
    { key: "fecha", label: "Fecha", mono: true },
  ];

  return (
    <div>
      <KpiRow>
        <KpiCard label="Cuentas monitoreadas" value={fmtInt(num(firstRow(panels.cuentas), "n"))}
          loading={panels.cuentas?.loading} sub="grafo completo en memoria" />
        <KpiCard label="Alertas transaccionales" value={fmtInt(num(firstRow(panels.naive), "n"))}
          tone="warn" loading={panels.naive?.loading}
          sub={`de ${fmtInt(num(transfers, "n"))} transferencias · revisadas una por una`} />
        <KpiCard label="Cuentas en el anillo" value={fmtInt(num(firstRow(panels.ring), "n"))}
          tone="bad" loading={panels.ring?.loading} sub="un dispositivo, cuatro titulares" />
        <KpiCard label="Canalizado al controlador" value={fmtMoney(num(expuesto, "v"))}
          tone="bad" loading={panels.expuesto?.loading}
          sub={`${fmtInt(num(expuesto, "n"))} movimientos concentran el lavado`} />
      </KpiRow>

      <DashSection eyebrow="Menos alertas, mejores casos" title="Cola de investigación priorizada">
        <DashGrid min={380}>
          <Panel title="Prioridad por centralidad (PageRank)"
            subtitle="Las cuentas más centrales de la red primero. Clic para seguir el dinero."
            cypher={Q.prioridad} accent={acc} {...flags(panels.prioridad)}>
            <RankList
              data={prioridad.map((r) => ({
                label: str(r, "titular"),
                value: num(r, "score"),
                sub: str(r, "cuenta"),
                color: str(r, "cuenta") === sel ? "var(--error)" : acc,
              }))}
              format={(n) => n.toFixed(4)}
              onClick={(_, i) => setSel(str(prioridad[i], "cuenta"))}
              activeLabel={selTitular ? str(selTitular, "titular") : undefined}
            />
          </Panel>

          <Panel title={`Flujo entrante — ${sel === CTRL ? "controlador" : sel}`}
            subtitle={selTitular ? `Titular: ${str(selTitular, "titular")} — quién le transfiere y cuánto` : "Ordenantes de la cuenta seleccionada"}
            cypher={Q.drill} accent="var(--error)" {...flags(drillP.drill)}
            emptyLabel="esta cuenta no recibe transferencias">
            <DataTable rows={drillP.drill?.rows ?? []} columns={drillCols} maxHeight={320}
              rowTone={(r) => (num(r, "monto") < 500 ? "warn" : undefined)} />
          </Panel>
        </DashGrid>
      </DashSection>

      <DashSection eyebrow="Lo que una transacción aislada nunca muestra" title="Redes de fraude detectadas">
        <DashGrid min={360}>
          <Panel title="Firma de estructuración (smurfing)"
            subtitle="Depósitos fraccionados justo bajo el umbral de reporte de $500 — el pico delata el anillo."
            cypher={Q.histograma} accent="var(--error)" {...flags(panels.histograma)}>
            <ColumnChart data={histoData} accent={acc} />
            <p className="dash-note">
              El tramo <b style={{ color: "var(--error)" }}>$300–500</b> concentra los depósitos de las mulas:
              cada uno pasaría el filtro tradicional por separado.
            </p>
          </Panel>

          <Panel title="Anatomía del anillo de mulas"
            subtitle="Cuatro titulares distintos, un dispositivo, casi todo reexpedido al mismo destino."
            cypher={Q.anillo} accent="var(--error)" {...flags(panels.anillo)}>
            <DataTable rows={panels.anillo?.rows ?? []} columns={anilloCols} maxHeight={260}
              rowTone={() => "bad"} />
          </Panel>

          <Panel title="Ciclo de dinero A → B → C → A"
            subtitle="El dinero vuelve a su origen tras tres saltos: invisible transacción por transacción."
            cypher={Q.ciclo} accent={acc} {...flags(panels.ciclo)}>
            {cyc && <CicloFlujo cyc={cyc} />}
          </Panel>

          <Panel title="Empresas “independientes”, dueño común"
            subtitle="Sociedades que se facturan entre sí y comparten accionista: concentración disfrazada."
            cypher={Q.empresas} accent="#a56bff" {...flags(panels.empresas)}>
            <DataTable
              rows={panels.empresas?.rows ?? []}
              columns={[
                { key: "empresa_a", label: "Empresa A" },
                { key: "empresa_b", label: "Empresa B" },
                { key: "accionista", label: "Accionista común" },
                { key: "monto", label: "Facturado", align: "right", format: (n) => fmtMoneyExact(n) },
              ]}
              maxHeight={220}
            />
          </Panel>
        </DashGrid>
      </DashSection>

      <DashSection eyebrow="Contexto que salta de un caso a otro" title="Contagio y mapa de la red">
        <DashGrid min={360}>
          <Panel title="Dispositivo ya investigado"
            subtitle="Un equipo marcado en un caso previo alcanza, a un salto, clientes que hoy parecen limpios."
            cypher={Q.contagio} accent="var(--warn)" {...flags(panels.contagio)}>
            {(() => {
              const c = firstRow(panels.contagio);
              const dir = arr(c, "directos");
              const salto = arr(c, "a_un_salto");
              return (
                <div>
                  <div className="dash-kpirow" style={{ margin: "0 0 0.9rem" }}>
                    <div className="dash-kpi" style={{ ["--accent" as string]: "var(--warn)" }}>
                      <span className="dash-kpi__label">Usuarios directos</span>
                      <span className="dash-kpi__value display">{dir.length}</span>
                    </div>
                    <div className="dash-kpi" style={{ ["--accent" as string]: "var(--error)" }}>
                      <span className="dash-kpi__label">Contactos a un salto</span>
                      <span className="dash-kpi__value display">{salto.length}</span>
                    </div>
                  </div>
                  <p className="dash-note" style={{ marginBottom: "0.4rem" }}>
                    Dispositivo <b>{str(c, "dispositivo")}</b> · en el radar por contagio:
                  </p>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "0.35rem" }}>
                    {[...dir, ...salto].map((n, i) => (
                      <Chip key={i} tone={i < dir.length ? "bad" : "warn"}>{String(n)}</Chip>
                    ))}
                  </div>
                </div>
              );
            })()}
          </Panel>

          <Panel title="Mapa de la red" span={2} accent={acc}
            subtitle="Personas, cuentas, empresas y dispositivos — el fraude vive en las conexiones.">
            {grafo ? <GraphView grafo={grafo} /> : <div className="grafo-caja"><span className="grafo-caja__estado">sembrando…</span></div>}
          </Panel>
        </DashGrid>
      </DashSection>
    </div>
  );
}

/* Mini-visualización del ciclo circular de dinero. */
function CicloFlujo({ cyc }: { cyc: Record<string, unknown> }) {
  const pasos = [
    { de: str(cyc, "a"), a: str(cyc, "b"), m: num(cyc, "m1") },
    { de: str(cyc, "b"), a: str(cyc, "c"), m: num(cyc, "m2") },
    { de: str(cyc, "c"), a: str(cyc, "a"), m: num(cyc, "m3") },
  ];
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
      {pasos.map((p, i) => (
        <div key={i} style={{ display: "grid", gridTemplateColumns: "1fr auto 1fr", gap: "0.6rem", alignItems: "center" }}>
          <span className="mono" style={{ fontSize: "0.74rem", color: "var(--hueso)", textAlign: "right" }}>{p.de}</span>
          <span style={{ display: "flex", flexDirection: "column", alignItems: "center", color: "var(--rosa)" }}>
            <span className="mono" style={{ fontSize: "0.72rem" }}>{fmtMoneyExact(p.m)}</span>
            <span style={{ letterSpacing: "0.1em" }}>→</span>
          </span>
          <span className="mono" style={{ fontSize: "0.74rem", color: "var(--hueso)" }}>{p.a}</span>
        </div>
      ))}
      <p className="dash-note" style={{ textAlign: "center", marginTop: "0.3rem" }}>↺ el saldo regresa al punto de partida</p>
    </div>
  );
}
