import { useState } from "react";

import {
  BarChart,
  Chip,
  DashGrid,
  DashSection,
  DataTable,
  Gauge,
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
  str,
  useGrafo,
  usePanels,
  type Column,
} from "../kit";
import type { DashProps } from "../dashProps";

const BENEF_INICIAL = "Aurelio Salvatierra";

const Q = {
  total: `MATCH (c:Credito) RETURN count(c) AS n, sum(c.monto) AS monto`,

  grupos: `CALL algo.wcc({labels: ['Persona', 'Empresa'],
               edge_types: ['FAMILIAR_DE', 'ACCIONISTA_DE', 'AVALA']})
YIELD node_id, component
WITH node_id AS deudor, component
MATCH (c:Credito)-[:OTORGADO_A]->(deudor)
MATCH (x:Persona|Empresa) WHERE id(x) = id(deudor)
WITH DISTINCT component, x.nombre AS miembro, c.codigo AS credito, c.monto AS monto
WITH component, collect(DISTINCT miembro) AS deudores,
     collect(DISTINCT credito) AS creditos, sum(monto) AS exposicion_total
WHERE size(creditos) > 1
RETURN component, deudores, size(deudores) AS n_deudores,
       size(creditos) AS n_creditos, exposicion_total
ORDER BY exposicion_total DESC
LIMIT 8`,

  controladores: `MATCH (p:Persona)-[a:ACCIONISTA_DE]->(e:Empresa)
WITH p, count(DISTINCT e) AS empresas, sum(a.pct) AS pct_total,
     collect(DISTINCT e.nombre) AS cartera
RETURN p.nombre AS controlador, empresas, pct_total, cartera
ORDER BY pct_total DESC, empresas DESC
LIMIT 10`,

  control: `MATCH (p:Persona {nombre:$benef})-[a:ACCIONISTA_DE]->(e:Empresa)
WITH e, a.pct AS pct
MATCH (c:Credito)-[:OTORGADO_A]->(e)
WITH e, pct, collect(DISTINCT c.codigo) AS creditos, sum(c.monto) AS deuda
RETURN e.nombre AS empresa, pct, size(creditos) AS n_creditos, deuda
ORDER BY deuda DESC`,

  comunes: `MATCH (p:Persona)-[a1:ACCIONISTA_DE]->(e1:Empresa),
      (p)-[a2:ACCIONISTA_DE]->(e2:Empresa)
WHERE e1.nombre < e2.nombre
RETURN e1.nombre AS empresa_a, e2.nombre AS empresa_b,
       collect(p.nombre) AS accionistas_comunes
ORDER BY size(accionistas_comunes) DESC`,

  garantias: `MATCH (g:Garantia)-[:GARANTIZA]->(c:Credito)-[:OTORGADO_A]->(d:Persona|Empresa)
WITH g, collect(c.codigo) AS creditos, collect(DISTINCT d.nombre) AS deudores,
     sum(c.monto) AS monto_respaldado
WHERE size(creditos) > 1
RETURN g.codigo AS garantia, g.tipo AS tipo, g.valor AS valor_garantia,
       creditos, deudores, monto_respaldado`,

  noindep: `MATCH (c1:Credito)-[:OTORGADO_A]->(d1:Persona|Empresa),
      (c2:Credito)-[:OTORGADO_A]->(d2:Persona|Empresa)
WHERE c1.codigo < c2.codigo AND d1.nombre <> d2.nombre
MATCH ruta = shortestPath((d1)-[:FAMILIAR_DE|ACCIONISTA_DE|AVALA*..3]-(d2))
RETURN c1.codigo AS credito_a, c2.codigo AS credito_b,
       [n IN nodes(ruta) | coalesce(n.nombre, n.codigo)] AS conexion,
       length(ruta) AS saltos
ORDER BY saltos
LIMIT 10`,
};

/** Etiqueta legible para un grupo económico a partir de su lista de deudores. */
function grupoLabel(deudores: unknown[]): string {
  const primero = String(deudores[0] ?? "grupo");
  return deudores.length > 1 ? `${primero} +${deudores.length - 1}` : primero;
}

export default function GruposEconomicos({ slug }: DashProps) {
  const acc = accent(slug);
  const [benef, setBenef] = useState(BENEF_INICIAL);

  const { panels } = usePanels(slug, {
    total: { cypher: Q.total },
    grupos: { cypher: Q.grupos },
    controladores: { cypher: Q.controladores },
    comunes: { cypher: Q.comunes },
    garantias: { cypher: Q.garantias },
    noindep: { cypher: Q.noindep },
  });
  const { panels: drillP } = usePanels(slug, { control: { cypher: Q.control, params: { benef } } });
  const { grafo } = useGrafo(slug);

  const total = firstRow(panels.total);
  const grupos = panels.grupos?.rows ?? [];
  const grupoLider = grupos[0];
  const carteraTotal = num(total, "monto");
  const expLider = num(grupoLider, "exposicion_total");
  const concentracion = carteraTotal > 0 ? (expLider / carteraTotal) * 100 : 0;

  const controladores = panels.controladores?.rows ?? [];
  const multiEmpresa = controladores.filter((r) => num(r, "empresas") > 1);

  const gruposData = grupos.map((r, i) => ({
    label: grupoLabel(arr(r, "deudores")),
    value: num(r, "exposicion_total"),
    sub: `${num(r, "n_creditos")} créditos · ${num(r, "n_deudores")} deudores`,
    color: i === 0 ? "var(--error)" : acc,
  }));

  const drillRows = drillP.control?.rows ?? [];
  const deudaControlada = drillRows.reduce((a, r) => a + num(r, "deuda"), 0);
  const selCtrl = controladores.find((r) => str(r, "controlador") === benef);

  const controlCols: Column[] = [
    { key: "empresa", label: "Empresa controlada" },
    { key: "pct", label: "Participación", align: "right", format: (n) => fmtPct(n) },
    { key: "n_creditos", label: "Créditos", align: "right", format: fmtInt },
    { key: "deuda", label: "Deuda de la empresa", align: "right", format: (n) => fmtMoneyExact(n) },
  ];

  const comunesCols: Column[] = [
    { key: "empresa_a", label: "Empresa A" },
    { key: "empresa_b", label: "Empresa B" },
    {
      key: "accionistas_comunes",
      label: "Beneficiario final común",
      render: (v) => (Array.isArray(v) ? v.join(", ") : String(v ?? "")),
    },
  ];

  const garantiasCols: Column[] = [
    { key: "garantia", label: "Garantía", mono: true },
    { key: "tipo", label: "Tipo" },
    { key: "valor_garantia", label: "Valor declarado", align: "right", format: (n) => fmtMoneyExact(n) },
    {
      key: "deudores",
      label: "Deudores distintos",
      render: (v) => (Array.isArray(v) ? v.join(" · ") : String(v ?? "")),
    },
    { key: "monto_respaldado", label: "Respalda", align: "right", format: (n) => fmtMoneyExact(n) },
  ];

  const noindepCols: Column[] = [
    { key: "credito_a", label: "Crédito A", mono: true },
    { key: "credito_b", label: "Crédito B", mono: true },
    {
      key: "conexion",
      label: "Cadena de vínculo",
      render: (v) => (Array.isArray(v) ? v.map(String).join("  →  ") : String(v ?? "")),
    },
    { key: "saltos", label: "Saltos", align: "right", format: fmtInt },
  ];

  return (
    <div>
      <KpiRow>
        <KpiCard label="Exposición del grupo líder" value={fmtMoney(expLider)}
          tone="bad" loading={panels.grupos?.loading}
          sub={`${grupoLider ? num(grupoLider, "n_creditos") : 0} créditos “independientes”, un solo deudor consolidado`} />
        <KpiCard label="Grupos económicos ocultos" value={fmtInt(grupos.length)}
          tone="warn" loading={panels.grupos?.loading}
          sub="componentes conexos con más de un crédito" />
        <KpiCard label="Concentración de la cartera" value={fmtPct(concentracion, 1)}
          tone="bad" loading={panels.grupos?.loading || panels.total?.loading}
          sub={`de ${fmtMoney(carteraTotal)} en ${fmtInt(num(total, "n"))} créditos`} />
        <KpiCard label="Beneficiarios multi-empresa" value={fmtInt(multiEmpresa.length)}
          tone="info" loading={panels.controladores?.loading}
          sub="personas que controlan dos o más sociedades" />
      </KpiRow>

      <DashSection eyebrow="La exposición real" title="Un solo deudor consolidado">
        <DashGrid min={380}>
          <Panel title="Grupos económicos por exposición"
            subtitle="Personas y empresas unidas por parentesco, acciones y avales forman un mismo deudor. El comité aprobó cada crédito por separado."
            cypher={Q.grupos} accent={acc} {...flags(panels.grupos)}>
            <BarChart data={gruposData} format={(n) => fmtMoney(n)} accent={acc} />
            <p className="dash-note">
              La <b style={{ color: "var(--error)" }}>familia Salvatierra</b> encabeza la lista:
              seis obligaciones que ningún expediente vincula entre sí.
            </p>
          </Panel>

          <Panel title="Concentración en el grupo líder"
            subtitle="Qué proporción de toda la cartera vigente descansa sobre un único grupo económico."
            cypher={Q.total} accent="var(--error)" {...flags(panels.total)}>
            <Gauge value={concentracion} max={100} format={(n) => fmtPct(n, 1)}
              label="de la cartera en un grupo" />
            <p className="dash-note">
              {fmtMoney(expLider)} de {fmtMoney(carteraTotal)}: un solo estrés de crédito arrastra
              a la mitad del portafolio.
            </p>
          </Panel>
        </DashGrid>
      </DashSection>

      <DashSection eyebrow="Beneficiario final" title="Quién controla de verdad">
        <DashGrid min={380}>
          <Panel title="Controladores por participación"
            subtitle="Ranking de accionistas por participación sumada en varias sociedades. Clic para ver su control efectivo."
            cypher={Q.controladores} accent={acc} {...flags(panels.controladores)}>
            <RankList
              data={controladores.map((r) => ({
                label: str(r, "controlador"),
                value: num(r, "empresas"),
                sub: `${fmtInt(num(r, "empresas"))} sociedades · ${fmtInt(num(r, "pct_total"))} pts de participación`,
                color: str(r, "controlador") === benef ? "var(--error)" : num(r, "empresas") > 1 ? "#a56bff" : acc,
              }))}
              format={(n) => `${n} empresas`}
              onClick={(_, i) => setBenef(str(controladores[i], "controlador"))}
              activeLabel={benef}
            />
          </Panel>

          <Panel title={`Control efectivo — ${benef}`}
            subtitle={selCtrl
              ? `Controla ${fmtInt(num(selCtrl, "empresas"))} sociedades por ${fmtMoneyExact(deudaControlada)} en crédito vinculado.`
              : "Sociedades y deuda bajo el beneficiario seleccionado."}
            cypher={Q.control} accent="var(--error)" {...flags(drillP.control)}
            emptyLabel="esta persona no figura como accionista">
            <DataTable rows={drillRows} columns={controlCols} maxHeight={280}
              rowTone={(r) => (num(r, "pct") >= 50 ? "bad" : "warn")} />
          </Panel>

          <Panel title="Empresas “independientes”, mismo dueño"
            subtitle="Sociedades registradas como clientes distintos cuyos accionistas se repiten: el beneficiario final es uno solo."
            cypher={Q.comunes} accent="#a56bff" {...flags(panels.comunes)}>
            <DataTable rows={panels.comunes?.rows ?? []} columns={comunesCols} maxHeight={240} />
          </Panel>
        </DashGrid>
      </DashSection>

      <DashSection eyebrow="Riesgos ocultos y mapa" title="Lo que el expediente no muestra">
        <DashGrid min={360}>
          <Panel title="Una garantía, varias obligaciones"
            subtitle="El mismo colateral respalda créditos de deudores distintos: la cobertura real es menor que la declarada."
            cypher={Q.garantias} accent="var(--error)" {...flags(panels.garantias)}>
            <DataTable rows={panels.garantias?.rows ?? []} columns={garantiasCols} maxHeight={220}
              rowTone={() => "bad"} />
          </Panel>

          <Panel title="Créditos que no son independientes"
            subtitle="Pares de créditos cuyos deudores se conectan en pocos saltos por parentesco, acciones o avales."
            cypher={Q.noindep} accent="var(--warn)" {...flags(panels.noindep)}>
            <DataTable rows={panels.noindep?.rows ?? []} columns={noindepCols} maxHeight={260}
              rowTone={(r) => (num(r, "saltos") <= 1 ? "warn" : undefined)} />
          </Panel>

          <Panel title="Mapa del grupo económico" span={2} accent={acc}
            subtitle="Personas, empresas, créditos, garantías y avales — la concentración vive en las conexiones, no en cada expediente.">
            {grafo ? <GraphView grafo={grafo} /> : <div className="grafo-caja"><span className="grafo-caja__estado">sembrando…</span></div>}
          </Panel>
        </DashGrid>
      </DashSection>

      <div style={{ display: "flex", flexWrap: "wrap", gap: "0.35rem", margin: "0.4rem 0 0" }}>
        {multiEmpresa.map((r, i) => (
          <Chip key={i} tone={str(r, "controlador") === benef ? "bad" : "rosa"}>
            {str(r, "controlador")} · {fmtInt(num(r, "empresas"))} empresas
          </Chip>
        ))}
      </div>
    </div>
  );
}
