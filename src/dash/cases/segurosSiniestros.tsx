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

const Q = {
  totalSiniestros: `MATCH (s:Siniestro) RETURN count(s) AS n`,

  enRevision: `MATCH (s:Siniestro)
WHERE s.estado = 'en revisión'
RETURN count(s) AS n, sum(s.monto) AS monto`,

  tercerosKpi: `MATCH (s:Siniestro)-[:REPARADO_EN|EVALUADO_POR|ATENDIDO_POR]->(x)
WHERE s.estado = 'en revisión'
WITH x, count(DISTINCT s) AS reclamos
WHERE reclamos >= 2
RETURN count(x) AS n`,

  ligadosPrevio: `MATCH (previo:Siniestro {fraude_confirmado: true})
      -[:REPARADO_EN|EVALUADO_POR|ATENDIDO_POR]->(c)
      <-[:REPARADO_EN|EVALUADO_POR|ATENDIDO_POR]-(nuevo:Siniestro {estado: 'en revisión'})
RETURN count(DISTINCT nuevo) AS n, sum(DISTINCT nuevo.monto) AS monto`,

  reclamantesKpi: `MATCH (a1:Asegurado)-[r1:USA_TELEFONO|COBRA_EN]->(x)<-[r2:USA_TELEFONO|COBRA_EN]-(a2:Asegurado)
WHERE a1.nombre < a2.nombre AND type(r1) = type(r2)
RETURN count(*) AS n`,

  porEstado: `MATCH (s:Siniestro)
RETURN s.estado AS estado, count(*) AS n, sum(s.monto) AS monto
ORDER BY n DESC`,

  tercerosRank: `MATCH (s:Siniestro)-[:REPARADO_EN|EVALUADO_POR|ATENDIDO_POR]->(x)
WHERE s.estado = 'en revisión'
WITH x, labels(x)[0] AS tipo, count(DISTINCT s) AS reclamos, sum(s.monto) AS monto
WHERE reclamos >= 2
RETURN tipo, x.nombre AS tercero, reclamos, monto
ORDER BY reclamos DESC, monto DESC`,

  proveedores: `MATCH (s:Siniestro)-[:REPARADO_EN]->(t:Taller),
      (s)-[:EVALUADO_POR]->(p:Perito)
WHERE s.estado = 'en revisión'
WITH t, p, count(s) AS siniestros, collect(s.codigo) AS codigos,
     sum(s.monto) AS monto_en_riesgo
WHERE siniestros >= 3
RETURN t.nombre AS taller, p.nombre AS perito, siniestros,
       monto_en_riesgo, codigos
ORDER BY siniestros DESC`,

  reclamantes: `MATCH (a1:Asegurado)-[r1:USA_TELEFONO|COBRA_EN]->(x)<-[r2:USA_TELEFONO|COBRA_EN]-(a2:Asegurado)
WHERE a1.nombre < a2.nombre AND type(r1) = type(r2)
RETURN labels(x)[0] AS via,
       coalesce(x.numero, x.iban) AS compartido,
       a1.nombre AS reclamante_a, a2.nombre AS reclamante_b`,

  previos: `MATCH (previo:Siniestro {fraude_confirmado: true})
      -[:REPARADO_EN|EVALUADO_POR|ATENDIDO_POR]->(conector)
      <-[:REPARADO_EN|EVALUADO_POR|ATENDIDO_POR]-(nuevo:Siniestro {estado: 'en revisión'})
WITH nuevo, previo, collect(DISTINCT conector.nombre) AS conectores
RETURN nuevo.codigo AS siniestro_nuevo, conectores,
       previo.codigo AS fraude_previo, previo.fecha AS fecha_del_fraude
ORDER BY size(conectores) DESC`,

  lista: `MATCH (a:Asegurado)-[:RECLAMA]->(s:Siniestro)
WHERE s.estado = 'en revisión'
OPTIONAL MATCH (s)-[:REPARADO_EN]->(t:Taller)
OPTIONAL MATCH (s)-[:EVALUADO_POR]->(p:Perito)
RETURN s.codigo AS codigo, a.nombre AS asegurado, s.monto AS monto,
       t.nombre AS taller, p.nombre AS perito
ORDER BY s.monto DESC`,

  drill: `MATCH (sel:Siniestro {codigo: $cod})-[:REPARADO_EN|EVALUADO_POR|ATENDIDO_POR]->(x)
      <-[:REPARADO_EN|EVALUADO_POR|ATENDIDO_POR]-(otro:Siniestro)
WHERE otro.codigo <> $cod
MATCH (a:Asegurado)-[:RECLAMA]->(otro)
WITH otro, a, collect(DISTINCT x.nombre) AS compartidos
RETURN otro.codigo AS codigo, a.nombre AS asegurado, otro.monto AS monto,
       otro.estado AS estado, compartidos
ORDER BY size(compartidos) DESC, otro.monto DESC`,
};

const DEF_SEL = "S-FRAUDE-03";

export default function SegurosSiniestros({ slug }: DashProps) {
  const acc = accent(slug);
  const [sel, setSel] = useState(DEF_SEL);

  const { panels } = usePanels(slug, {
    totalSiniestros: { cypher: Q.totalSiniestros },
    enRevision: { cypher: Q.enRevision },
    tercerosKpi: { cypher: Q.tercerosKpi },
    ligadosPrevio: { cypher: Q.ligadosPrevio },
    reclamantesKpi: { cypher: Q.reclamantesKpi },
    porEstado: { cypher: Q.porEstado },
    tercerosRank: { cypher: Q.tercerosRank },
    proveedores: { cypher: Q.proveedores },
    reclamantes: { cypher: Q.reclamantes },
    previos: { cypher: Q.previos },
    lista: { cypher: Q.lista },
  });
  const { panels: drillP } = usePanels(slug, { drill: { cypher: Q.drill, params: { cod: sel } } });
  const { grafo } = useGrafo(slug);

  const enRev = firstRow(panels.enRevision);
  const ligados = firstRow(panels.ligadosPrevio);

  // Dona por estado del reclamo.
  const estadoData = (panels.porEstado?.rows ?? []).map((r) => ({
    label: str(r, "estado"),
    value: num(r, "n"),
    color: str(r, "estado") === "en revisión" ? "var(--error)" : acc,
    sub: fmtMoney(num(r, "monto")),
  }));

  // Ranking de terceros compartidos (talleres / peritos / clínicas).
  const terceros = panels.tercerosRank?.rows ?? [];

  const proveedoresCols: Column[] = [
    { key: "taller", label: "Taller" },
    { key: "perito", label: "Perito" },
    { key: "siniestros", label: "Reclamos", align: "right", format: fmtInt },
    { key: "monto_en_riesgo", label: "En riesgo", align: "right", format: (n) => fmtMoneyExact(n) },
  ];

  const reclamantesCols: Column[] = [
    { key: "via", label: "Vía" },
    { key: "compartido", label: "Dato compartido", mono: true },
    { key: "reclamante_a", label: "Reclamante A" },
    { key: "reclamante_b", label: "Reclamante B" },
  ];

  const listaRows = panels.lista?.rows ?? [];
  const selRow = listaRows.find((r) => str(r, "codigo") === sel);

  const drillCols: Column[] = [
    { key: "codigo", label: "Reclamo", mono: true },
    { key: "asegurado", label: "Reclamante" },
    { key: "estado", label: "Estado" },
    { key: "monto", label: "Monto", align: "right", format: (n) => fmtMoneyExact(n) },
    {
      key: "compartidos",
      label: "Proveedores en común",
      render: (_v, row) => arr(row, "compartidos").join(" · "),
    },
  ];

  return (
    <div>
      <KpiRow>
        <KpiCard label="Reclamos en revisión" value={fmtInt(num(enRev, "n"))}
          tone="warn" loading={panels.enRevision?.loading}
          sub={`de ${fmtInt(num(firstRow(panels.totalSiniestros), "n"))} siniestros en cartera`} />
        <KpiCard label="Monto en riesgo" value={fmtMoney(num(enRev, "monto"))}
          tone="bad" loading={panels.enRevision?.loading}
          sub="expuesto en reclamos aún sin pagar" />
        <KpiCard label="Terceros recurrentes" value={fmtInt(num(firstRow(panels.tercerosKpi), "n"))}
          tone="bad" loading={panels.tercerosKpi?.loading}
          sub="talleres, peritos o clínicas en ≥2 reclamos" />
        <KpiCard label="Ligados a fraude previo" value={fmtInt(num(ligados, "n"))}
          tone="bad" loading={panels.ligadosPrevio?.loading}
          sub={`${fmtMoney(num(ligados, "monto"))} comparten proveedor con el caso 2024`} />
        <KpiCard label="Reclamantes conectados" value={fmtInt(num(firstRow(panels.reclamantesKpi), "n"))}
          tone="warn" loading={panels.reclamantesKpi?.loading}
          sub="pares que comparten teléfono o cuenta de cobro" />
      </KpiRow>

      <DashSection eyebrow="Lo que un reclamo aislado nunca muestra" title="El tablero del riesgo">
        <DashGrid min={360}>
          <Panel title="Cartera de reclamos por estado"
            subtitle="Los que siguen en revisión concentran el dinero aún detenible."
            cypher={Q.porEstado} accent={acc} {...flags(panels.porEstado)}>
            <DonutChart data={estadoData} centerValue={fmtMoney(num(enRev, "monto"))}
              centerLabel="en riesgo" format={fmtInt} />
          </Panel>

          <Panel title="Ranking de terceros compartidos"
            subtitle="Talleres, peritos y clínicas que se repiten entre reclamos “independientes”. El anillo son los de arriba."
            cypher={Q.tercerosRank} accent="var(--error)" {...flags(panels.tercerosRank)}>
            <RankList
              data={terceros.map((r) => ({
                label: str(r, "tercero"),
                value: num(r, "reclamos"),
                sub: `${str(r, "tipo")} · ${fmtMoney(num(r, "monto"))}`,
                color: num(r, "reclamos") >= 3 ? "var(--error)" : acc,
              }))}
              format={(n) => `${fmtInt(n)} reclamos`}
            />
          </Panel>
        </DashGrid>
      </DashSection>

      <DashSection eyebrow="Deja de ser un siniestro y pasa a ser una red" title="Anatomía del anillo">
        <DashGrid min={360}>
          <Panel title="El par taller + perito que se repite"
            subtitle="Un mismo taller y un mismo perito firman 5 reclamos en revisión de asegurados sin relación aparente."
            cypher={Q.proveedores} accent="var(--error)" {...flags(panels.proveedores)}>
            <DataTable rows={panels.proveedores?.rows ?? []} columns={proveedoresCols}
              rowTone={() => "bad"} maxHeight={200} />
          </Panel>

          <Panel title="Reclamantes unidos por dato de contacto"
            subtitle="Asegurados “distintos” que comparten el mismo teléfono o la misma cuenta de cobro."
            cypher={Q.reclamantes} accent="var(--warn)" {...flags(panels.reclamantes)}>
            <DataTable rows={panels.reclamantes?.rows ?? []} columns={reclamantesCols}
              rowTone={() => "warn"} maxHeight={200} />
          </Panel>

          <Panel title="Herencia del fraude 2024"
            subtitle="Reclamos en revisión que comparten taller, perito o clínica con un fraude ya confirmado: la investigación arranca con el mapa dibujado."
            cypher={Q.previos} accent="var(--error)" {...flags(panels.previos)}>
            <div style={{ display: "flex", flexDirection: "column", gap: "0.55rem" }}>
              {(panels.previos?.rows ?? []).map((r, i) => (
                <div key={i} style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "0.4rem" }}>
                  <span className="mono" style={{ fontSize: "0.76rem", color: "var(--hueso)", minWidth: "5.6rem" }}>
                    {str(r, "siniestro_nuevo")}
                  </span>
                  <span style={{ color: "var(--rosa)" }}>→</span>
                  {arr(r, "conectores").map((c, j) => (
                    <Chip key={j} tone="bad">{String(c)}</Chip>
                  ))}
                </div>
              ))}
              <p className="dash-note" style={{ marginTop: "0.2rem" }}>
                Todos apuntan a <b>{str(firstRow(panels.previos), "fraude_previo")}</b> ·
                fraude confirmado el {str(firstRow(panels.previos), "fecha_del_fraude")}.
              </p>
            </div>
          </Panel>

          <Panel title="Mapa de la red" span={2} accent={acc}
            subtitle="Asegurados, siniestros, talleres, peritos, teléfonos y cuentas — el fraude vive en las conexiones, no en el nodo.">
            {grafo ? <GraphView grafo={grafo} /> : <div className="grafo-caja"><span className="grafo-caja__estado">sembrando…</span></div>}
          </Panel>
        </DashGrid>
      </DashSection>

      <DashSection eyebrow="Un caso de red, no cinco reclamos sueltos" title="Investiga un reclamo">
        <DashGrid min={380}>
          <Panel title="Reclamos en revisión"
            subtitle="Ordenados por monto expuesto. Clic en uno para ver con quién se conecta."
            cypher={Q.lista} accent="var(--error)" {...flags(panels.lista)}>
            <RankList
              data={listaRows.map((r) => ({
                label: str(r, "asegurado"),
                value: num(r, "monto"),
                sub: `${str(r, "codigo")} · ${str(r, "taller")} / ${str(r, "perito")}`,
                color: str(r, "codigo") === sel ? "var(--error)" : acc,
              }))}
              format={(n) => fmtMoneyExact(n)}
              onClick={(_, i) => setSel(str(listaRows[i], "codigo"))}
              activeLabel={selRow ? str(selRow, "asegurado") : undefined}
            />
          </Panel>

          <Panel title={`Vínculos de ${sel}`}
            subtitle={selRow
              ? `${str(selRow, "asegurado")} — otros reclamos que comparten su taller, perito o clínica`
              : "Otros reclamos que comparten proveedores con el seleccionado"}
            cypher={Q.drill} accent="var(--error)" {...flags(drillP.drill)}
            emptyLabel="este reclamo no comparte proveedores con ningún otro">
            <DataTable rows={drillP.drill?.rows ?? []} columns={drillCols} maxHeight={340}
              rowTone={(r) => (str(r, "estado") === "en revisión" ? "bad" : "warn")} />
          </Panel>
        </DashGrid>
      </DashSection>
    </div>
  );
}
