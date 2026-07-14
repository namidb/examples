import { useState } from "react";

import {
  Chip,
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
  arr,
  firstRow,
  flags,
  fmtInt,
  fmtMoney,
  fmtMoneyExact,
  fmtPct,
  num,
  serie,
  str,
  useGrafo,
  usePanels,
  type Column,
} from "../kit";
import type { DashProps } from "../dashProps";

const CTA_DEFECTO = "EC-INTER-0001";

const Q = {
  // ── KPIs de titular ────────────────────────────────────────────────
  beneficiarios: `MATCH (b:Beneficiario) RETURN count(b) AS n`,

  entregado: `MATCH (p:Pago) RETURN sum(p.monto) AS v, count(p) AS n`,

  vinculados: `MATCH (b1:Beneficiario)-[:RESIDE_EN|USA_TELEFONO|COBRA_EN]->(x)
      <-[:RESIDE_EN|USA_TELEFONO|COBRA_EN]-(b2:Beneficiario)
WHERE b1.cedula < b2.cedula
WITH b1, b2, collect(DISTINCT labels(x)[0]) AS comparten
WHERE size(comparten) >= 2
WITH collect(b1.cedula) + collect(b2.cedula) AS todas
UNWIND todas AS c
RETURN count(DISTINCT c) AS n`,

  fuga: `MATCH (b:Beneficiario)-[:COBRA_EN]->(c:Cuenta)
WITH c, count(DISTINCT b) AS nb
WHERE nb >= 2
MATCH (p:Pago)-[:DEPOSITADO_EN]->(c)
RETURN sum(p.monto) AS v, count(DISTINCT c) AS cuentas, count(p) AS pagos`,

  // ── Distribución del gasto ─────────────────────────────────────────
  porPrograma: `MATCH (s:Solicitud)-[:DE_PROGRAMA]->(pr:Programa)
MATCH (s)-[:GENERA]->(p:Pago)
RETURN pr.nombre AS programa, count(p) AS pagos, sum(p.monto) AS monto
ORDER BY monto DESC`,

  porOficina: `MATCH (s:Solicitud)-[:TRAMITADA_EN]->(o:Oficina)
MATCH (s)<-[:SOLICITA]-(b:Beneficiario)-[:COBRA_EN]->(c:Cuenta)
OPTIONAL MATCH (c)<-[:COBRA_EN]-(otro:Beneficiario)
WITH o, s,
     sum(CASE WHEN otro.cedula <> b.cedula THEN 1 ELSE 0 END) AS senales
WITH o, count(s) AS solicitudes,
     sum(CASE WHEN senales > 0 THEN 1 ELSE 0 END) AS anomalas
RETURN o.nombre AS oficina, solicitudes, anomalas,
       round(100.0 * anomalas / solicitudes) AS pct_anomalas
ORDER BY pct_anomalas DESC`,

  // ── Ranking de vínculos indebidos (drill origin) ───────────────────
  cuentas: `MATCH (b:Beneficiario)-[:COBRA_EN]->(c:Cuenta)
WITH c, collect(DISTINCT b.nombre) AS beneficiarios, count(DISTINCT b) AS n
WHERE n >= 2
MATCH (p:Pago)-[:DEPOSITADO_EN]->(c)
WITH c, beneficiarios, n, count(p) AS pagos, sum(p.monto) AS monto_total
RETURN c.iban AS cuenta, n AS beneficiarios_distintos, pagos,
       monto_total, beneficiarios
ORDER BY monto_total DESC`,

  // ── Duplicados complejos (evidencia) ───────────────────────────────
  duplicados: `MATCH (b1:Beneficiario)-[:RESIDE_EN|USA_TELEFONO|COBRA_EN]->(x)
      <-[:RESIDE_EN|USA_TELEFONO|COBRA_EN]-(b2:Beneficiario)
WHERE b1.cedula < b2.cedula
WITH b1, b2, collect(DISTINCT labels(x)[0]) AS comparten
WHERE size(comparten) >= 2
RETURN b1.nombre AS registro_a, b1.cedula AS cedula_a,
       b2.nombre AS registro_b, b2.cedula AS cedula_b,
       comparten, size(comparten) AS evidencias
ORDER BY size(comparten) DESC`,

  // ── Doble cobro del mismo programa ─────────────────────────────────
  dobleCobro: `MATCH (b1:Beneficiario)-[:SOLICITA]->(s1:Solicitud)-[:DE_PROGRAMA]->(pr:Programa),
      (b2:Beneficiario)-[:SOLICITA]->(s2:Solicitud)-[:DE_PROGRAMA]->(pr)
WHERE b1.cedula < b2.cedula
MATCH (b1)-[:RESIDE_EN|USA_TELEFONO|COBRA_EN]->(x)
      <-[:RESIDE_EN|USA_TELEFONO|COBRA_EN]-(b2)
MATCH (s1)-[:GENERA]->(p1:Pago)
MATCH (s2)-[:GENERA]->(p2:Pago)
RETURN pr.nombre AS programa,
       b1.nombre AS registro_a, b2.nombre AS registro_b,
       collect(DISTINCT labels(x)[0]) AS comparten,
       count(DISTINCT p1) + count(DISTINCT p2) AS pagos_al_grupo,
       sum(DISTINCT p1.monto) + sum(DISTINCT p2.monto) AS monto_expuesto
ORDER BY pagos_al_grupo DESC`,

  // ── Drill: trazabilidad completa de una cuenta ─────────────────────
  traza: `MATCH (b:Beneficiario)-[:COBRA_EN]->(cta:Cuenta {iban: $cuenta})
MATCH (b)-[:SOLICITA]->(s:Solicitud)-[:DE_PROGRAMA]->(pr:Programa)
MATCH (s)-[:TRAMITADA_EN]->(o:Oficina)
MATCH (s)-[:GENERA]->(p:Pago)
RETURN b.nombre AS beneficiario, b.cedula AS cedula,
       s.codigo AS solicitud, s.fecha AS fecha, pr.nombre AS programa,
       o.nombre AS oficina, p.codigo AS pago, p.monto AS monto
ORDER BY fecha`,
};

export default function Subsidios({ slug }: DashProps) {
  const acc = accent(slug);
  const [sel, setSel] = useState(CTA_DEFECTO);

  const { panels } = usePanels(slug, {
    beneficiarios: { cypher: Q.beneficiarios },
    entregado: { cypher: Q.entregado },
    vinculados: { cypher: Q.vinculados },
    fuga: { cypher: Q.fuga },
    porPrograma: { cypher: Q.porPrograma },
    porOficina: { cypher: Q.porOficina },
    cuentas: { cypher: Q.cuentas },
    duplicados: { cypher: Q.duplicados },
    dobleCobro: { cypher: Q.dobleCobro },
  });
  const { panels: drillP } = usePanels(slug, {
    traza: { cypher: Q.traza, params: { cuenta: sel } },
  });
  const { grafo } = useGrafo(slug);

  const entregado = firstRow(panels.entregado);
  const fuga = firstRow(panels.fuga);
  const montoTotal = num(entregado, "v");
  const montoFuga = num(fuga, "v");

  // Distribución por programa (dona).
  const programaData = (panels.porPrograma?.rows ?? []).map((r, i) => ({
    label: str(r, "programa"),
    value: num(r, "monto"),
    color: serie(i),
    sub: `${fmtInt(num(r, "pagos"))} pagos`,
  }));

  // Cuentas con vínculos indebidos (ranking clicable → drill).
  const cuentas = panels.cuentas?.rows ?? [];
  const cuentaSel = cuentas.find((r) => str(r, "cuenta") === sel);

  const dupCols: Column[] = [
    { key: "registro_a", label: "Registro A" },
    { key: "cedula_a", label: "Cédula A", mono: true },
    { key: "registro_b", label: "Registro B" },
    { key: "cedula_b", label: "Cédula B", mono: true },
    {
      key: "comparten",
      label: "Comparten",
      render: (v) => (
        <span style={{ display: "inline-flex", gap: "0.25rem", flexWrap: "wrap" }}>
          {(Array.isArray(v) ? v : []).map((t, i) => (
            <Chip key={i} tone="bad">
              {String(t)}
            </Chip>
          ))}
        </span>
      ),
    },
  ];

  const dobleCols: Column[] = [
    { key: "programa", label: "Programa" },
    { key: "registro_a", label: "Registro A" },
    { key: "registro_b", label: "Registro B" },
    {
      key: "comparten",
      label: "Evidencia",
      render: (v) => (Array.isArray(v) ? v.join(" · ") : ""),
    },
    { key: "pagos_al_grupo", label: "Pagos", align: "right", format: fmtInt },
    { key: "monto_expuesto", label: "Expuesto", align: "right", format: (n) => fmtMoneyExact(n) },
  ];

  const trazaCols: Column[] = [
    { key: "beneficiario", label: "Beneficiario" },
    { key: "cedula", label: "Cédula", mono: true },
    { key: "programa", label: "Programa" },
    { key: "oficina", label: "Oficina" },
    { key: "fecha", label: "Fecha", mono: true },
    { key: "pago", label: "Pago", mono: true },
    { key: "monto", label: "Monto", align: "right", format: (n) => fmtMoneyExact(n) },
  ];

  return (
    <div>
      <KpiRow>
        <KpiCard
          label="Beneficiarios registrados"
          value={fmtInt(num(firstRow(panels.beneficiarios), "n"))}
          loading={panels.beneficiarios?.loading}
          sub="padrón completo en el grafo"
        />
        <KpiCard
          label="Monto entregado"
          value={fmtMoney(montoTotal)}
          tone="info"
          loading={panels.entregado?.loading}
          sub={`${fmtInt(num(entregado, "n"))} pagos desembolsados`}
        />
        <KpiCard
          label="Registros vinculados"
          value={fmtInt(num(firstRow(panels.vinculados), "n"))}
          tone="warn"
          loading={panels.vinculados?.loading}
          sub="misma persona bajo cédulas distintas"
        />
        <KpiCard
          label="Fuga estimada"
          value={fmtMoney(montoFuga)}
          tone="bad"
          loading={panels.fuga?.loading}
          sub={`${fmtInt(num(fuga, "pagos"))} pagos a ${fmtInt(num(fuga, "cuentas"))} cuentas multi-titular · ${
            montoTotal > 0 ? fmtPct((100 * montoFuga) / montoTotal) : "0%"
          } del gasto`}
        />
      </KpiRow>

      <DashSection eyebrow="A dónde va el dinero" title="Focalización del gasto público">
        <DashGrid min={360}>
          <Panel
            title="Distribución del subsidio por programa"
            subtitle="Cómo se reparte el monto entregado entre los tres programas sociales."
            cypher={Q.porPrograma}
            accent={acc}
            {...flags(panels.porPrograma)}
          >
            <DonutChart
              data={programaData}
              centerValue={fmtMoney(montoTotal)}
              centerLabel="entregado"
              format={(n) => fmtMoneyExact(n)}
            />
          </Panel>

          <Panel
            title="Concentración de anomalías por oficina"
            subtitle="Porcentaje de solicitudes con señal de duplicidad (cuenta compartida). Una oficina destaca."
            cypher={Q.porOficina}
            accent="var(--error)"
            {...flags(panels.porOficina)}
          >
            <RankList
              data={(panels.porOficina?.rows ?? []).map((r) => ({
                label: str(r, "oficina"),
                value: num(r, "pct_anomalas"),
                sub: `${fmtInt(num(r, "anomalas"))}/${fmtInt(num(r, "solicitudes"))} solicitudes`,
                color: num(r, "pct_anomalas") > 0 ? "var(--error)" : acc,
              }))}
              format={(n) => fmtPct(n)}
            />
            <p className="dash-note">
              La <b style={{ color: "var(--error)" }}>Oficina Zonal 5</b> tramitó todas las solicitudes
              anómalas: el punto por donde auditar primero.
            </p>
          </Panel>
        </DashGrid>
      </DashSection>

      <DashSection
        eyebrow="La misma persona, varios registros"
        title="Duplicados y fuga de subsidios"
      >
        <DashGrid min={380}>
          <Panel
            title="Cuentas con vínculos indebidos"
            subtitle="Una cuenta donde cobran varios beneficiarios: intermediario o registro multiplicado. Clic para trazar."
            cypher={Q.cuentas}
            accent="var(--error)"
            {...flags(panels.cuentas)}
          >
            <RankList
              data={cuentas.map((r) => ({
                label: str(r, "cuenta"),
                value: num(r, "monto_total"),
                sub: `${fmtInt(num(r, "beneficiarios_distintos"))} beneficiarios · ${fmtInt(num(r, "pagos"))} pagos`,
                color: str(r, "cuenta") === sel ? "var(--error)" : acc,
              }))}
              format={(n) => fmtMoneyExact(n)}
              onClick={(_, i) => setSel(str(cuentas[i], "cuenta"))}
              activeLabel={sel}
            />
          </Panel>

          <Panel
            title={`Trazabilidad — ${sel}`}
            subtitle={
              cuentaSel
                ? `${fmtInt(num(cuentaSel, "beneficiarios_distintos"))} beneficiarios cobran en esta cuenta — la decisión completa, auditable.`
                : "Camino auditable de la cuenta seleccionada."
            }
            cypher={Q.traza}
            accent="var(--error)"
            {...flags(drillP.traza)}
            emptyLabel="sin pagos trazados en esta cuenta"
          >
            <DataTable
              rows={drillP.traza?.rows ?? []}
              columns={trazaCols}
              maxHeight={300}
              rowTone={() => "bad"}
            />
          </Panel>

          <Panel
            title="Duplicados complejos detectados"
            subtitle="Cédulas distintas que comparten ≥ 2 de {dirección, teléfono, cuenta}. Compartir solo el techo (familia) no dispara."
            cypher={Q.duplicados}
            accent="var(--error)"
            {...flags(panels.duplicados)}
          >
            <DataTable
              rows={panels.duplicados?.rows ?? []}
              columns={dupCols}
              maxHeight={260}
              rowTone={(r) => (num(r, "evidencias") >= 3 ? "bad" : "warn")}
            />
          </Panel>

          <Panel
            title="El mismo programa, cobrado varias veces"
            subtitle="Solicitudes del mismo programa entre titulares relacionados: el doble cobro que los sistemas por registro no ven."
            cypher={Q.dobleCobro}
            accent="#a56bff"
            {...flags(panels.dobleCobro)}
          >
            <DataTable
              rows={panels.dobleCobro?.rows ?? []}
              columns={dobleCols}
              maxHeight={260}
              rowTone={(r) => (arr(r, "comparten").length >= 2 ? "bad" : "warn")}
            />
          </Panel>
        </DashGrid>
      </DashSection>

      <DashSection
        eyebrow="El fraude vive en las conexiones"
        title="Mapa de la red de beneficios"
      >
        <DashGrid min={360}>
          <Panel
            title="Mapa de la red"
            span={2}
            accent={acc}
            subtitle="Beneficiarios, direcciones, teléfonos, cuentas, solicitudes y pagos — los nodos que colapsan a una sola persona."
          >
            {grafo ? (
              <GraphView grafo={grafo} />
            ) : (
              <div className="grafo-caja">
                <span className="grafo-caja__estado">sembrando…</span>
              </div>
            )}
          </Panel>
        </DashGrid>
      </DashSection>
    </div>
  );
}
