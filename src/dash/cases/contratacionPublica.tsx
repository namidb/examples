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
  arr,
  fmtInt,
  fmtMoney,
  fmtMoneyExact,
  fmtPct,
  firstRow,
  flags,
  num,
  serie,
  str,
  useGrafo,
  usePanels,
  type Column,
  type ToneKey,
} from "../kit";
import type { DashProps } from "../dashProps";

const ROJO = "var(--bad, #ff5a5f)";

const Q = {
  procesos: `MATCH (p:Proceso) RETURN count(p) AS n`,

  adjudicado: `MATCH (pr:Proceso)-[:ADJUDICADO_A]->(:Proveedor)
RETURN count(pr) AS procesos, sum(pr.monto) AS monto`,

  vinculados: `MATCH (b:Persona)-[:BENEFICIARIO_FINAL]->(p:Proveedor)
WITH b, collect(DISTINCT p.nombre) AS empresas
WHERE size(empresas) >= 2
UNWIND empresas AS e
RETURN count(DISTINCT e) AS n`,

  concentracion: `MATCH (pr:Proceso)-[:ADJUDICADO_A]->(p:Proveedor)
WITH sum(pr.monto) AS total
MATCH (b:Persona)-[:BENEFICIARIO_FINAL]->(pp:Proveedor)<-[:ADJUDICADO_A]-(prc:Proceso)
WITH b, total, sum(prc.monto) AS suyo
ORDER BY suyo DESC LIMIT 1
RETURN b.nombre AS beneficiario, suyo, total, round(suyo * 1000.0 / total) / 10 AS pct`,

  porProveedor: `MATCH (pr:Proceso)-[:ADJUDICADO_A]->(p:Proveedor)
RETURN p.nombre AS proveedor, count(pr) AS procesos, sum(pr.monto) AS monto
ORDER BY monto DESC
LIMIT 10`,

  porBeneficiario: `MATCH (b:Persona)-[:BENEFICIARIO_FINAL]->(p:Proveedor)<-[:ADJUDICADO_A]-(pr:Proceso)
RETURN b.nombre AS beneficiario, count(DISTINCT pr) AS procesos, sum(pr.monto) AS monto
ORDER BY monto DESC`,

  distribucion: `MATCH (pr:Proceso)-[:ADJUDICADO_A]->(:Proveedor)
WITH pr, CASE
  WHEN pr.monto < 500000  THEN '<500K'
  WHEN pr.monto < 800000  THEN '500–800K'
  WHEN pr.monto < 1500000 THEN '0.8–1.5M'
  ELSE '1.5M+' END AS rango
RETURN rango, count(*) AS procesos, sum(pr.monto) AS monto`,

  sospechosos: `MATCH (b:Persona)-[:BENEFICIARIO_FINAL]->(p1:Proveedor)-[:PRESENTA]->(o1:Oferta)-[:PARA]->(pr:Proceso),
      (b)-[:BENEFICIARIO_FINAL]->(p2:Proveedor)-[:PRESENTA]->(o2:Oferta)-[:PARA]->(pr)
WHERE p1.nombre < p2.nombre
MATCH (pr)-[:ADJUDICADO_A]->(adj:Proveedor)
RETURN DISTINCT pr.codigo AS proceso, pr.objeto AS objeto, pr.monto AS monto,
       adj.nombre AS adjudicatario, 'Colusión de oferentes' AS senal
UNION
MATCH (pr2:Proceso)-[:ADJUDICADO_A]->(a:Proveedor)-[:SUBCONTRATA*1..2]->(x:Proveedor)-[:SANCIONADO_CON]->(s:Sancion)
RETURN DISTINCT pr2.codigo AS proceso, pr2.objeto AS objeto, pr2.monto AS monto,
       a.nombre AS adjudicatario, 'Sanción en la cadena' AS senal
UNION
MATCH (f:Persona)-[:FUNCIONARIO_DE]->(e:Entidad)-[:CONVOCA]->(pr3:Proceso)
MATCH (f)-[:ACCIONISTA_DE]->(prov:Proveedor)-[:PRESENTA]->(o3:Oferta)-[:PARA]->(pr3)
MATCH (pr3)-[:ADJUDICADO_A]->(adj3:Proveedor)
RETURN DISTINCT pr3.codigo AS proceso, pr3.objeto AS objeto, pr3.monto AS monto,
       adj3.nombre AS adjudicatario, 'Conflicto de interés' AS senal
UNION
MATCH (pv:Proveedor)-[:PRESENTA]->(o4:Oferta)-[:PARA]->(pr4:Proceso)
WHERE pr4.convocado_dias - pv.constituido_dias < 60
  AND pv.constituido_dias <= pr4.convocado_dias
MATCH (pr4)-[:ADJUDICADO_A]->(adj4:Proveedor)
RETURN DISTINCT pr4.codigo AS proceso, pr4.objeto AS objeto, pr4.monto AS monto,
       adj4.nombre AS adjudicatario, 'Oferente recién creado' AS senal`,

  colusion: `MATCH (b:Persona)-[:BENEFICIARIO_FINAL]->(p1:Proveedor)-[:PRESENTA]->(o1:Oferta)-[:PARA]->(pr:Proceso),
      (b)-[:BENEFICIARIO_FINAL]->(p2:Proveedor)-[:PRESENTA]->(o2:Oferta)-[:PARA]->(pr)
WHERE p1.nombre < p2.nombre
RETURN pr.codigo AS proceso, b.nombre AS beneficiario_final,
       p1.nombre AS oferente_a, o1.monto AS monto_a,
       p2.nombre AS oferente_b, o2.monto AS monto_b`,

  conflicto: `MATCH (f:Persona)-[fu:FUNCIONARIO_DE]->(e:Entidad)-[:CONVOCA]->(pr:Proceso)
MATCH (f)-[a:ACCIONISTA_DE]->(prov:Proveedor)-[:PRESENTA]->(o:Oferta)-[:PARA]->(pr)
RETURN f.nombre AS funcionario, fu.cargo AS cargo, e.nombre AS entidad,
       pr.codigo AS proceso, prov.nombre AS oferente, a.pct AS participacion`,

  sancionados: `MATCH (pr:Proceso)-[:ADJUDICADO_A]->(adj:Proveedor)
MATCH (adj)-[:SUBCONTRATA*1..2]->(x:Proveedor)-[:SANCIONADO_CON]->(s:Sancion)
RETURN pr.codigo AS proceso, adj.nombre AS adjudicatario,
       x.nombre AS sancionado, s.motivo AS motivo, s.vigente AS vigente`,

  drillProc: `MATCH (pr:Proceso)-[:ADJUDICADO_A]->(p:Proveedor {nombre:$prov})
RETURN pr.codigo AS proceso, pr.objeto AS objeto,
       pr.fecha_convocatoria AS fecha, pr.monto AS monto
ORDER BY monto DESC`,

  drillAcc: `MATCH (ac:Persona)-[a:ACCIONISTA_DE]->(p:Proveedor {nombre:$prov})
RETURN ac.nombre AS accionista, a.pct AS pct
ORDER BY a.pct DESC`,

  drillBenef: `MATCH (b:Persona)-[:BENEFICIARIO_FINAL]->(p:Proveedor {nombre:$prov})
RETURN p.nombre AS proveedor, p.fecha_constitucion AS constituida,
       collect(DISTINCT b.nombre) AS beneficiarios`,
};

const DIST_ORDEN = ["<500K", "500–800K", "0.8–1.5M", "1.5M+"];

const SENAL_TONE: Record<string, ToneKey> = {
  "Colusión de oferentes": "bad",
  "Sanción en la cadena": "bad",
  "Conflicto de interés": "warn",
  "Oferente recién creado": "warn",
};

export default function ContratacionPublica({ slug }: DashProps) {
  const acc = accent(slug);
  const [sel, setSel] = useState("Constructora Andes Riobamba");

  const { panels } = usePanels(slug, {
    procesos: { cypher: Q.procesos },
    adjudicado: { cypher: Q.adjudicado },
    vinculados: { cypher: Q.vinculados },
    concentracion: { cypher: Q.concentracion },
    porProveedor: { cypher: Q.porProveedor },
    porBeneficiario: { cypher: Q.porBeneficiario },
    distribucion: { cypher: Q.distribucion },
    sospechosos: { cypher: Q.sospechosos },
    colusion: { cypher: Q.colusion },
    conflicto: { cypher: Q.conflicto },
    sancionados: { cypher: Q.sancionados },
  });

  const { panels: drillP } = usePanels(slug, {
    proc: { cypher: Q.drillProc, params: { prov: sel } },
    acc: { cypher: Q.drillAcc, params: { prov: sel } },
    benef: { cypher: Q.drillBenef, params: { prov: sel } },
  });

  const { grafo } = useGrafo(slug);

  const adjudicado = firstRow(panels.adjudicado);
  const concentracion = firstRow(panels.concentracion);

  // KPI de alertas: procesos DISTINTOS tocados por al menos una señal.
  const sospechososRows = panels.sospechosos?.rows ?? [];
  const procesosAlerta = new Set(sospechososRows.map((r) => str(r, "proceso")));

  const porProveedor = panels.porProveedor?.rows ?? [];
  const provData = porProveedor.map((r) => ({
    label: str(r, "proveedor"),
    value: num(r, "monto"),
    sub: `${fmtInt(num(r, "procesos"))} proc.`,
    color: str(r, "proveedor") === sel ? acc : "var(--acero, #7c9cff)",
  }));

  // Dona: top 6 beneficiarios + "Otros".
  const benefRows = panels.porBeneficiario?.rows ?? [];
  const benefTotal = benefRows.reduce((a, r) => a + num(r, "monto"), 0);
  const benefTop = benefRows.slice(0, 6);
  const benefResto = benefRows.slice(6).reduce((a, r) => a + num(r, "monto"), 0);
  const donutData = [
    ...benefTop.map((r, i) => ({
      label: str(r, "beneficiario"),
      value: num(r, "monto"),
      color: i === 0 ? ROJO : serie(i + 1),
    })),
    ...(benefResto > 0 ? [{ label: "Otros oferentes", value: benefResto, color: "var(--muted, #9b8a93)" }] : []),
  ];

  // Distribución de montos adjudicados (columnas), orden fijo, faltantes en 0.
  const distData = DIST_ORDEN.map((rango) => {
    const row = panels.distribucion?.rows.find((r) => str(r, "rango") === rango);
    return {
      label: rango,
      value: row ? num(row, "procesos") : 0,
      color: rango === "1.5M+" ? ROJO : acc,
    };
  });

  // Tabla de procesos sospechosos: agrupar señales por proceso.
  type Fila = { proceso: string; objeto: string; monto: number; adjudicatario: string; senales: string[] };
  const agrupados = new Map<string, Fila>();
  for (const r of sospechososRows) {
    const codigo = str(r, "proceso");
    const f = agrupados.get(codigo) ?? {
      proceso: codigo,
      objeto: str(r, "objeto"),
      monto: num(r, "monto"),
      adjudicatario: str(r, "adjudicatario"),
      senales: [],
    };
    f.senales.push(str(r, "senal"));
    agrupados.set(codigo, f);
  }
  const sospechososData: Record<string, unknown>[] = [...agrupados.values()]
    .sort((a, b) => b.senales.length - a.senales.length || b.monto - a.monto);

  const drillProfil = firstRow(drillP.benef);

  const sospechososCols: Column[] = [
    { key: "proceso", label: "Proceso", mono: true },
    { key: "objeto", label: "Objeto" },
    { key: "monto", label: "Monto", align: "right", format: (n) => fmtMoney(n) },
    {
      key: "senales",
      label: "Señales",
      render: (_v, row) => (
        <span style={{ display: "flex", flexWrap: "wrap", gap: "0.3rem" }}>
          {arr(row, "senales").map((s, i) => (
            <Chip key={i} tone={SENAL_TONE[String(s)] ?? "warn"}>
              {String(s)}
            </Chip>
          ))}
        </span>
      ),
    },
  ];

  const drillCols: Column[] = [
    { key: "proceso", label: "Proceso", mono: true },
    { key: "objeto", label: "Objeto" },
    { key: "fecha", label: "Convocatoria", mono: true },
    { key: "monto", label: "Adjudicado", align: "right", format: (n) => fmtMoneyExact(n) },
  ];

  const colusionCols: Column[] = [
    { key: "proceso", label: "Proceso", mono: true },
    { key: "beneficiario_final", label: "Dueño real" },
    { key: "oferente_a", label: "Oferente A" },
    { key: "monto_a", label: "Oferta A", align: "right", format: (n) => fmtMoneyExact(n) },
    { key: "oferente_b", label: "Oferente B" },
    { key: "monto_b", label: "Oferta B", align: "right", format: (n) => fmtMoneyExact(n) },
  ];

  const conflictoCols: Column[] = [
    { key: "funcionario", label: "Funcionario" },
    { key: "cargo", label: "Cargo" },
    { key: "oferente", label: "Es accionista de" },
    { key: "participacion", label: "%", align: "right", format: (n) => fmtPct(n) },
    { key: "proceso", label: "En proceso", mono: true },
  ];

  const sancionadosCols: Column[] = [
    { key: "proceso", label: "Proceso", mono: true },
    { key: "adjudicatario", label: "Adjudicatario (limpio)" },
    { key: "sancionado", label: "Subcontratista sancionado" },
    { key: "motivo", label: "Motivo" },
    { key: "vigente", label: "Vigente", align: "center" },
  ];

  return (
    <div>
      <KpiRow>
        <KpiCard
          label="Procesos monitoreados"
          value={fmtInt(num(firstRow(panels.procesos), "n"))}
          loading={panels.procesos?.loading}
          sub="convocatorias del ejercicio en el grafo"
        />
        <KpiCard
          label="Monto adjudicado"
          value={fmtMoney(num(adjudicado, "monto"))}
          loading={panels.adjudicado?.loading}
          sub={`${fmtInt(num(adjudicado, "procesos"))} contratos revisados uno por uno`}
        />
        <KpiCard
          label="Proveedores vinculados"
          value={fmtInt(num(firstRow(panels.vinculados), "n"))}
          tone="warn"
          loading={panels.vinculados?.loading}
          sub="empresas con un mismo dueño real detrás"
        />
        <KpiCard
          label="Concentración del líder"
          value={fmtPct(num(concentracion, "pct"), 1)}
          tone="bad"
          loading={panels.concentracion?.loading}
          sub={`${str(concentracion, "beneficiario")} · ${fmtMoney(num(concentracion, "suyo"))} del pastel`}
        />
        <KpiCard
          label="Procesos con alertas"
          value={fmtInt(procesosAlerta.size)}
          tone="bad"
          loading={panels.sospechosos?.loading}
          sub="colusión, conflicto, sanción o empresa exprés"
        />
      </KpiRow>

      <DashSection eyebrow="El dinero público, en una vista" title="Concentración de la adjudicación">
        <DashGrid min={380}>
          <Panel
            title="Adjudicación por proveedor"
            subtitle="Monto total ganado por cada contratista. Clic para radiografiar al adjudicatario."
            cypher={Q.porProveedor}
            accent={acc}
            {...flags(panels.porProveedor)}
          >
            <RankList
              data={provData}
              format={(n) => fmtMoney(n)}
              onClick={(_, i) => setSel(str(porProveedor[i], "proveedor"))}
              activeLabel={sel}
            />
          </Panel>

          <Panel
            title={`Radiografía — ${sel}`}
            subtitle={
              drillProfil
                ? `Constituida ${str(drillProfil, "constituida")} · dueño real: ${arr(drillProfil, "beneficiarios").map(String).join(", ") || "—"}`
                : "Procesos ganados por el proveedor seleccionado"
            }
            cypher={Q.drillProc}
            accent={ROJO}
            {...flags(drillP.proc)}
            emptyLabel="este proveedor no tiene adjudicaciones"
            footer={
              <span style={{ display: "flex", flexWrap: "wrap", gap: "0.35rem", alignItems: "center" }}>
                <span className="dash-kpi__label" style={{ marginRight: "0.2rem" }}>
                  Accionistas:
                </span>
                {(drillP.acc?.rows ?? []).map((r, i) => (
                  <Chip key={i} tone={str(r, "accionista") === "Efrén Maldonado" ? "bad" : "muted"}>
                    {str(r, "accionista")} · {fmtPct(num(r, "pct"))}
                  </Chip>
                ))}
              </span>
            }
          >
            <DataTable rows={drillP.proc?.rows ?? []} columns={drillCols} maxHeight={240} />
          </Panel>

          <Panel
            title="Distribución de montos adjudicados"
            subtitle="Casi todo el gasto se apila en un puñado de contratos: el tramo grande es un solo proceso."
            cypher={Q.distribucion}
            accent={acc}
            {...flags(panels.distribucion)}
          >
            <ColumnChart data={distData} accent={acc} />
            <p className="dash-note">
              El único proceso <b style={{ color: ROJO }}>1.5M+</b> es la obra vial adjudicada al
              grupo del beneficiario líder.
            </p>
          </Panel>
        </DashGrid>
      </DashSection>

      <DashSection
        eyebrow="La competencia era teatro"
        title="Colusión, propiedad común y conflicto de interés"
      >
        <DashGrid min={360}>
          <Panel
            title="Concentración por beneficiario final"
            subtitle="Cuánto dinero termina, vía sus empresas, en cada dueño real. La resolución UBO está precalculada."
            cypher={Q.porBeneficiario}
            accent={acc}
            {...flags(panels.porBeneficiario)}
          >
            <DonutChart
              data={donutData}
              format={(n) => fmtMoney(n)}
              centerValue={fmtMoney(benefTotal)}
              centerLabel="adjudicado"
            />
          </Panel>

          <Panel
            title="Procesos con banderas rojas"
            subtitle="Cada proceso, con todas sus señales de integridad acumuladas. Un proceso concentra las cuatro."
            cypher={Q.sospechosos}
            accent={ROJO}
            span={2}
            {...flags(panels.sospechosos)}
          >
            <DataTable
              rows={sospechososData}
              columns={sospechososCols}
              maxHeight={280}
              rowTone={(r) => (arr(r, "senales").length >= 3 ? "bad" : "warn")}
            />
          </Panel>

          <Panel
            title="Ofertas “competitivas”, mismo dueño"
            subtitle="Dos o más ofertas de un mismo proceso cuyo beneficiario final es la misma persona."
            cypher={Q.colusion}
            accent={ROJO}
            {...flags(panels.colusion)}
          >
            <DataTable
              rows={panels.colusion?.rows ?? []}
              columns={colusionCols}
              maxHeight={240}
              rowTone={() => "bad"}
            />
          </Panel>

          <Panel
            title="Funcionaria con interés en la oferente"
            subtitle="Quien convoca y evalúa el proceso es, a la vez, accionista de una de las empresas que oferta."
            cypher={Q.conflicto}
            accent="var(--warn, #ffb020)"
            {...flags(panels.conflicto)}
          >
            <DataTable
              rows={panels.conflicto?.rows ?? []}
              columns={conflictoCols}
              maxHeight={240}
              rowTone={() => "bad"}
            />
          </Panel>
        </DashGrid>
      </DashSection>

      <DashSection eyebrow="El fraude vive en las conexiones" title="Sanciones ocultas y mapa de la red">
        <DashGrid min={360}>
          <Panel
            title="Sanciones en la cadena de subcontratación"
            subtitle="El adjudicatario aparece limpio; a uno o dos saltos, quien ejecuta la obra tiene sanción vigente."
            cypher={Q.sancionados}
            accent={ROJO}
            {...flags(panels.sancionados)}
          >
            <DataTable
              rows={panels.sancionados?.rows ?? []}
              columns={sancionadosCols}
              maxHeight={260}
              rowTone={(r) => (r["vigente"] ? "bad" : "warn")}
            />
          </Panel>

          <Panel
            title="Mapa de la red"
            span={2}
            accent={acc}
            subtitle="Entidades, procesos, ofertas, proveedores y personas — el conflicto no está en un documento, está en las aristas."
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
