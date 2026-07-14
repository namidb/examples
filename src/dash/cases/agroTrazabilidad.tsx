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
  fmtMs,
  num,
  str,
  useGrafo,
  usePanels,
  type Column,
} from "../kit";
import type { DashProps } from "../dashProps";

const LOTE_INICIAL = "L-2026-0087";

const Q = {
  lotes: `MATCH (l:Lote) RETURN count(l) AS n`,

  eslabones: `MATCH ()-[r]->() RETURN count(r) AS n`,

  alerta: `MATCH (l:Lote {estado: 'alerta'}) RETURN count(l) AS n`,

  origen: `MATCH (alerta:Lote {estado: 'alerta'})
MATCH (c:Cosecha)-[:APORTA_A]->(alerta)
MATCH (c)-[:COSECHADA_DE]->(p:Parcela)
MATCH (t:Tratamiento)-[:APLICADO_EN]->(p)
MATCH (t)-[:USA_INSUMO]->(i:Insumo)
RETURN i.codigo AS insumo, i.tipo AS tipo,
       count(DISTINCT alerta) AS lotes_alerta_alcanzados,
       collect(DISTINCT alerta.codigo) AS lotes,
       collect(DISTINCT p.codigo) AS parcelas
ORDER BY lotes_alerta_alcanzados DESC`,

  retiro: `MATCH (i:Insumo {codigo: 'AGQ-77'})<-[:USA_INSUMO]-(tr:Tratamiento)-[:APLICADO_EN]->(p:Parcela)
MATCH (c:Cosecha)-[:COSECHADA_DE]->(p)
MATCH (c)-[:APORTA_A]->(riesgo:Lote)
WHERE riesgo.estado <> 'alerta'
OPTIONAL MATCH (riesgo)-[:ALMACENADO_EN]->(b:Bodega)
OPTIONAL MATCH (riesgo)-[:DISTRIBUIDO_A]->(d:Distribuidor)
OPTIONAL MATCH (riesgo)-[:VENDIDO_EN]->(pv:PuntoVenta)
RETURN DISTINCT riesgo.codigo AS lote, riesgo.estado AS estado,
       p.codigo AS parcela_origen,
       coalesce(b.nombre, d.nombre, pv.nombre, 'en tránsito') AS interceptar_en`,

  distribucion: `MATCH (l:Lote)
RETURN l.estado AS estado, count(*) AS n
ORDER BY n DESC`,

  lotesTrazables: `MATCH (c:Cosecha)-[:APORTA_A]->(l:Lote)
RETURN l.codigo AS lote, l.estado AS estado, count(DISTINCT c) AS origenes
ORDER BY origenes DESC, lote`,

  detalle: `MATCH (l:Lote {codigo: $lote})
MATCH (c:Cosecha)-[:APORTA_A]->(l)
MATCH (c)-[:COSECHADA_DE]->(p:Parcela)
MATCH (f:Finca)-[:TIENE_PARCELA]->(p)
MATCH (pr:Productor)-[:OPERA]->(f)
MATCH (t:Tratamiento)-[:APLICADO_EN]->(p)
MATCH (t)-[:USA_INSUMO]->(i:Insumo)
RETURN f.nombre AS finca, pr.nombre AS productor,
       p.codigo AS parcela, c.codigo AS cosecha,
       collect(DISTINCT i.codigo) AS insumos
ORDER BY finca`,

  frio: `MATCH (l:Lote)-[:TRANSPORTADO_POR]->(t:Transporte)
WHERE t.temperatura_max > 8
MATCH (c:Cosecha)-[:PRODUCE]->(l)
MATCH (c)-[:COSECHADA_DE]->(p:Parcela)
MATCH (f:Finca)-[:TIENE_PARCELA]->(p)
RETURN l.codigo AS lote, l.estado AS estado, t.codigo AS transporte,
       t.temperatura_max AS temperatura, 8 AS limite,
       f.nombre AS finca_origen
ORDER BY t.temperatura_max DESC`,

  exportacion: `MATCH (l:Lote {codigo: 'L-2026-0010'})
MATCH (c:Cosecha)-[:PRODUCE]->(l)
MATCH (c)-[:COSECHADA_DE]->(p:Parcela)
MATCH (f:Finca)-[:TIENE_PARCELA]->(p)
MATCH (pr:Productor)-[:OPERA]->(f)
MATCH (f)-[:CERTIFICADA_CON]->(cert:Certificacion)
OPTIONAL MATCH (l)-[:TRANSPORTADO_POR]->(tr:Transporte)
RETURN l.codigo AS lote, pr.nombre AS productor, f.nombre AS finca,
       cert.tipo AS certificacion, cert.vigente_hasta AS vigente_hasta,
       CASE WHEN cert.vigente_hasta >= '2026-07-14'
            THEN 'vigente' ELSE 'vencida' END AS estado_certificado,
       tr.temperatura_max AS temp_transporte`,
};

// Etiquetas legibles para el estado técnico del lote.
const ESTADO_LABEL: Record<string, string> = {
  alerta: "En alerta (recall)",
  mezclado: "Mezclado en planta",
  en_planta: "En planta",
  en_bodega: "En bodega",
  en_distribuidor: "En distribuidor",
  vendido: "En góndola",
  exportable: "Exportable",
};

function estadoTexto(e: string): string {
  return ESTADO_LABEL[e] ?? e;
}

export default function AgroTrazabilidad({ slug }: DashProps) {
  const acc = accent(slug);
  const [sel, setSel] = useState(LOTE_INICIAL);

  const { panels } = usePanels(slug, {
    lotes: { cypher: Q.lotes },
    eslabones: { cypher: Q.eslabones },
    alerta: { cypher: Q.alerta },
    origen: { cypher: Q.origen },
    retiro: { cypher: Q.retiro },
    distribucion: { cypher: Q.distribucion },
    lotesTrazables: { cypher: Q.lotesTrazables },
    frio: { cypher: Q.frio },
    exportacion: { cypher: Q.exportacion },
  });
  const { panels: drillP } = usePanels(slug, {
    detalle: { cypher: Q.detalle, params: { lote: sel } },
  });
  const { grafo } = useGrafo(slug);

  const totalLotes = num(firstRow(panels.lotes), "n");
  const retiroRows = panels.retiro?.rows ?? [];
  const origen = panels.origen?.rows ?? [];

  // Donut: distribución de lotes por etapa de la cadena.
  const distData = (panels.distribucion?.rows ?? []).map((r) => {
    const estado = str(r, "estado");
    return {
      label: estadoTexto(estado),
      value: num(r, "n"),
      color: estado === "alerta" ? "var(--error)" : undefined,
    };
  });

  // Ranking del insumo compartido por las cadenas contaminadas.
  const origenData = origen.map((r) => ({
    label: str(r, "insumo"),
    value: num(r, "lotes_alerta_alcanzados"),
    sub: str(r, "tipo"),
    color: str(r, "insumo") === "AGQ-77" ? "var(--error)" : acc,
  }));

  const lotesTrazables = panels.lotesTrazables?.rows ?? [];
  const selIdx = lotesTrazables.findIndex((r) => str(r, "lote") === sel);
  const selEstado = selIdx >= 0 ? str(lotesTrazables[selIdx], "estado") : "";

  const retiroCols: Column[] = [
    { key: "lote", label: "Lote", mono: true },
    { key: "estado", label: "Estado", render: (v) => <Chip tone="warn">{estadoTexto(String(v))}</Chip> },
    { key: "parcela_origen", label: "Parcela origen", mono: true },
    { key: "interceptar_en", label: "Interceptar en" },
  ];

  const listaCols: Column[] = [
    { key: "lote", label: "Lote", mono: true },
    { key: "estado", label: "Estado actual", render: (v) => estadoTexto(String(v)) },
    { key: "origenes", label: "Orígenes", align: "right", format: fmtInt },
  ];

  const detalleCols: Column[] = [
    { key: "finca", label: "Finca de origen" },
    { key: "productor", label: "Productor" },
    { key: "parcela", label: "Parcela", mono: true },
    { key: "cosecha", label: "Cosecha", mono: true },
    {
      key: "insumos",
      label: "Insumos en campo",
      render: (v) => (
        <span style={{ display: "flex", flexWrap: "wrap", gap: "0.3rem" }}>
          {(v as unknown[]).map((c, i) => (
            <Chip key={i} tone={String(c) === "AGQ-77" ? "bad" : "muted"}>{String(c)}</Chip>
          ))}
        </span>
      ),
    },
  ];

  const frioCols: Column[] = [
    { key: "lote", label: "Lote", mono: true },
    { key: "transporte", label: "Transporte", mono: true },
    { key: "temperatura", label: "T° registrada", align: "right", format: (n) => `${n.toFixed(1)} °C` },
    { key: "limite", label: "Límite", align: "right", format: (n) => `${n} °C` },
    { key: "finca_origen", label: "Reclamar a" },
  ];

  const expCols: Column[] = [
    { key: "certificacion", label: "Certificación" },
    { key: "vigente_hasta", label: "Vigente hasta", mono: true },
    {
      key: "estado_certificado",
      label: "Estado",
      render: (v) => <Chip tone={String(v) === "vigente" ? "ok" : "bad"}>{String(v)}</Chip>,
    },
    { key: "temp_transporte", label: "T° transporte", align: "right", format: (n) => `${n.toFixed(1)} °C` },
  ];

  return (
    <div>
      <KpiRow>
        <KpiCard label="Lotes trazados" value={fmtInt(totalLotes)}
          loading={panels.lotes?.loading} tone="info"
          sub="de la finca a la góndola, en un solo grafo" />
        <KpiCard label="Eslabones de custodia" value={fmtInt(num(firstRow(panels.eslabones), "n"))}
          loading={panels.eslabones?.loading}
          sub="relaciones que enlazan cada paso de la cadena" />
        <KpiCard label="Lotes en alerta" value={fmtInt(num(firstRow(panels.alerta), "n"))}
          loading={panels.alerta?.loading} tone="bad"
          sub="dos positivos en retail: recall activo" />
        <KpiCard label="Retiro selectivo" value={`${retiroRows.length} de ${fmtInt(totalLotes)}`}
          loading={panels.retiro?.loading} tone="warn"
          sub="se interceptan 2 lotes, no la producción entera" />
        <KpiCard label="Tiempo de rastreo" value={drillP.detalle ? fmtMs(drillP.detalle.ms) : "—"}
          loading={drillP.detalle?.loading} tone="ok"
          sub="reconstrucción de la cadena hacia atrás: de días a milisegundos" />
      </KpiRow>

      <DashSection eyebrow="de la góndola al origen" title="El recall en curso">
        <DashGrid min={360}>
          <Panel title="Origen de la contaminación"
            subtitle="Dos positivos que no comparten finca ni distribuidor. Lo único común: el insumo aplicado en campo."
            cypher={Q.origen} accent="var(--error)" {...flags(panels.origen)}>
            <RankList data={origenData} format={(n) => `${n} lote${n === 1 ? "" : "s"}`} accent={acc} />
            <p className="dash-note">
              El insumo <b style={{ color: "var(--error)" }}>AGQ-77</b> (fungicida no autorizado) alcanza
              los <b>dos</b> lotes en alerta; el resto toca uno solo. La intersección lo delata.
            </p>
          </Panel>

          <Panel title="Retiro selectivo, no masivo"
            subtitle="Lotes cuya cadena tocó AGQ-77 y aún no están en alerta: qué son y dónde interceptarlos hoy."
            cypher={Q.retiro} accent="var(--warn)" {...flags(panels.retiro)}>
            <DataTable rows={retiroRows} columns={retiroCols} maxHeight={220} rowTone={() => "warn"} />
          </Panel>

          <Panel title="Lotes por etapa de la cadena"
            subtitle="Dónde está hoy cada lote — de la mezcla en planta a la góndola."
            cypher={Q.distribucion} accent={acc} {...flags(panels.distribucion)}>
            <DonutChart data={distData} centerValue={fmtInt(totalLotes)} centerLabel="lotes" />
          </Panel>
        </DashGrid>
      </DashSection>

      <DashSection eyebrow="cada lote cuenta su historia" title="Trazabilidad de lote a origen">
        <DashGrid min={380}>
          <Panel title="Lotes trazables"
            subtitle="Clic en un lote para reconstruir su cadena de custodia hacia atrás."
            cypher={Q.lotesTrazables} accent={acc} {...flags(panels.lotesTrazables)}>
            <DataTable rows={lotesTrazables} columns={listaCols} maxHeight={320}
              onRowClick={(r) => setSel(str(r, "lote"))}
              activeIndex={selIdx >= 0 ? selIdx : undefined}
              rowTone={(r) => (str(r, "estado") === "alerta" ? "bad" : undefined)} />
          </Panel>

          <Panel title={`Cadena de custodia — ${sel}`}
            subtitle={selEstado ? `Estado: ${estadoTexto(selEstado)} — orígenes, parcelas e insumos aplicados en campo` : "Origen del lote seleccionado"}
            cypher={Q.detalle} accent={selEstado === "alerta" ? "var(--error)" : acc}
            {...flags(drillP.detalle)}
            emptyLabel="este lote no tiene linaje registrado">
            <DataTable rows={drillP.detalle?.rows ?? []} columns={detalleCols} maxHeight={320}
              rowTone={(r) => (arr(r, "insumos").map(String).includes("AGQ-77") ? "bad" : undefined)} />
            <p className="dash-note">
              El linaje <b>APORTA_A</b> materializa la cadena cosecha → lote final (incluidas las mezclas
              en planta): la trazabilidad es una consulta plana, sin caminos de longitud variable.
            </p>
          </Panel>
        </DashGrid>
      </DashSection>

      <DashSection eyebrow="custodia validada" title="Frío, exportación y mapa de la red">
        <DashGrid min={360}>
          <Panel title="Cadena de frío violada"
            subtitle="Transportes que superaron los 8 °C — con la finca de origen lista para el reclamo al operador."
            cypher={Q.frio} accent="var(--warn)" {...flags(panels.frio)}>
            <DataTable rows={panels.frio?.rows ?? []} columns={frioCols} maxHeight={220}
              rowTone={() => "warn"} />
          </Panel>

          <Panel title="Evidencia para exportación"
            subtitle="Dossier del lote exportable L-2026-0010: certificados, vigencia y temperatura, con fuente verificable."
            cypher={Q.exportacion} accent={acc} {...flags(panels.exportacion)}>
            {(() => {
              const e = firstRow(panels.exportacion);
              return (
                <div>
                  <p className="dash-note" style={{ marginTop: 0 }}>
                    <b>{str(e, "finca")}</b> · {str(e, "productor")} — lote listo para el comprador.
                  </p>
                  <DataTable rows={panels.exportacion?.rows ?? []} columns={expCols} maxHeight={200} />
                </div>
              );
            })()}
          </Panel>

          <Panel title="Mapa de la red" span={2} accent={acc}
            subtitle="Productores, fincas, parcelas, insumos, lotes, transporte y retail — la trazabilidad vive en las conexiones.">
            {grafo ? <GraphView grafo={grafo} /> : <div className="grafo-caja"><span className="grafo-caja__estado">sembrando…</span></div>}
          </Panel>
        </DashGrid>
      </DashSection>
    </div>
  );
}
