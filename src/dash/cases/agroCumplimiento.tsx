import { useState } from "react";

import {
  Chip,
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
  firstRow,
  flags,
  fmtInt,
  fmtPct,
  num,
  riskColor,
  str,
  useGrafo,
  usePanels,
  type Column,
} from "../kit";
import type { DashProps } from "../dashProps";

/* Fecha de corte del piloto: hoy contra la vigencia de cada certificado. */
const HOY = "2026-07-13";
const EMBARQUE_DEF = "EXP-2026-114";

const Q = {
  embarques: `MATCH (e:Embarque) RETURN count(e) AS n`,

  productos: `MATCH (p:Producto) RETURN count(p) AS n`,

  certVencidas: `MATCH (c:Certificacion)
WITH c, CASE WHEN c.vigente_hasta < '${HOY}' THEN 1 ELSE 0 END AS vencida
RETURN sum(vencida) AS vencidas, count(c) AS total`,

  cumplimiento: `MATCH (e:Embarque)-[:CONTIENE]->(p:Producto)-[:PROVISTO_POR]->(prov:Proveedor)
OPTIONAL MATCH (prov)-[:CERTIFICADO_CON]->(c:Certificacion)
WITH e, p, CASE WHEN coalesce(c.vigente_hasta, '0000-00-00') >= e.fecha THEN 0 ELSE 1 END AS problema
WITH e, sum(problema) AS con_problemas
WITH count(e) AS total, sum(CASE WHEN con_problemas = 0 THEN 1 ELSE 0 END) AS listos
RETURN total, listos, round(listos * 10000.0 / total) / 100 AS pct`,

  semaforo: `MATCH (e:Embarque)-[:CONTIENE]->(p:Producto)-[:PROVISTO_POR]->(prov:Proveedor)
OPTIONAL MATCH (prov)-[:CERTIFICADO_CON]->(c:Certificacion)
WITH e, p, CASE WHEN coalesce(c.vigente_hasta, '0000-00-00') >= e.fecha THEN 0 ELSE 1 END AS problema
WITH e, count(p) AS productos, sum(problema) AS con_problemas
RETURN e.codigo AS embarque, e.fecha AS fecha, e.destino AS destino,
       productos, con_problemas,
       CASE WHEN con_problemas = 0 THEN 'listo' ELSE 'revisar antes de zarpar' END AS semaforo
ORDER BY con_problemas DESC, fecha`,

  noConformidades: `MATCH (e:Embarque)-[:CONTIENE]->(p:Producto)-[:PROVISTO_POR]->(prov:Proveedor)
OPTIONAL MATCH (prov)-[:CERTIFICADO_CON]->(c:Certificacion)
WITH e, p, c WHERE coalesce(c.vigente_hasta, '0000-00-00') < e.fecha
RETURN 'Proveedor sin certificación' AS categoria, count(p) AS n
UNION ALL
MATCH (e:Embarque)-[:RESPALDADO_POR]->(d:Documento)
WHERE d.vence < e.fecha
RETURN 'Documento vencido' AS categoria, count(d) AS n
UNION ALL
MATCH (e:Embarque)-[:CON_DESTINO]->(comp:Comprador),
      (e)-[:CONTIENE]->(p:Producto)-[:ORIGINADO_EN]->(par:Parcela)-[:UBICADA_EN]->(z:Zona)
WHERE z.riesgo_deforestacion = 'alto' AND comp.region = 'UE'
RETURN 'Origen en zona de riesgo' AS categoria, count(p) AS n`,

  mercados: `MATCH (comp:Comprador)<-[:CON_DESTINO]-(e:Embarque)-[:CONTIENE]->(p:Producto)
RETURN comp.region AS region, count(DISTINCT e) AS embarques, count(p) AS productos
ORDER BY productos DESC`,

  proveedores: `MATCH (prov:Proveedor)
OPTIONAL MATCH (prov)-[:CERTIFICADO_CON]->(c:Certificacion)
WITH prov, c
OPTIONAL MATCH (prov)<-[:PROVISTO_POR]-(p:Producto)
WITH prov, c, count(DISTINCT p) AS productos
RETURN prov.nombre AS proveedor, productos, c.tipo AS tipo,
       coalesce(c.vigente_hasta, '—') AS vigente_hasta,
       CASE WHEN coalesce(c.vigente_hasta, '0000-00-00') < '${HOY}' THEN 'vencida' ELSE 'vigente' END AS estado
ORDER BY productos DESC`,

  territorios: `MATCH (e:Embarque)-[:CON_DESTINO]->(comp:Comprador),
      (e)-[:CONTIENE]->(p:Producto)-[:ORIGINADO_EN]->(par:Parcela)-[:UBICADA_EN]->(z:Zona)
WHERE z.riesgo_deforestacion = 'alto' AND comp.region = 'UE'
OPTIONAL MATCH (par)-[:CERTIFICADO_CON]->(c:Certificacion)
RETURN e.codigo AS embarque, p.codigo AS producto, par.codigo AS parcela,
       par.geohash AS geohash, z.nombre AS zona, comp.pais AS destino,
       coalesce(c.tipo, 'SIN CERTIFICACIÓN') AS certificacion`,

  origen: `MATCH (p:Producto {codigo: 'P-CACAO-903'})-[:ORIGINADO_EN]->(par:Parcela)-[:UBICADA_EN]->(z:Zona),
      (prod:Productor)-[:PRODUCE_EN]->(par),
      (p)-[:PROVISTO_POR]->(prov:Proveedor)-[:CERTIFICADO_CON]->(c:Certificacion)-[:VERIFICADA_POR]->(i:Inspector)
RETURN p.codigo AS producto, par.codigo AS parcela, par.geohash AS geohash,
       z.nombre AS zona, prod.nombre AS productor, prov.nombre AS proveedor,
       c.tipo AS certificacion, c.vigente_hasta AS vigente_hasta,
       i.nombre AS inspector`,

  drill: `MATCH (e:Embarque {codigo: $embarque})-[:CONTIENE]->(p:Producto)-[:PROVISTO_POR]->(prov:Proveedor)
OPTIONAL MATCH (prov)-[:CERTIFICADO_CON]->(c:Certificacion)
OPTIONAL MATCH (p)-[:ORIGINADO_EN]->(par:Parcela)-[:UBICADA_EN]->(z:Zona)
WITH e, p, prov, c, par, z
RETURN p.codigo AS producto, prov.nombre AS proveedor,
       coalesce(c.vigente_hasta, 'sin certificación') AS cert_hasta,
       coalesce(z.nombre, '—') AS zona, coalesce(z.riesgo_deforestacion, '—') AS riesgo,
       CASE
         WHEN coalesce(c.vigente_hasta, '0000-00-00') < e.fecha THEN 'proveedor vencido'
         WHEN z.riesgo_deforestacion = 'alto' THEN 'zona de riesgo'
         ELSE 'en regla' END AS estado
ORDER BY estado, producto`,
};

const CAT_COLOR: Record<string, string> = {
  "Proveedor sin certificación": "#ff5a5f",
  "Documento vencido": "#ffb020",
  "Origen en zona de riesgo": "#a56bff",
};

export default function AgroCumplimiento({ slug }: DashProps) {
  const acc = accent(slug);
  const [sel, setSel] = useState(EMBARQUE_DEF);

  const { panels } = usePanels(slug, {
    embarques: { cypher: Q.embarques },
    productos: { cypher: Q.productos },
    certVencidas: { cypher: Q.certVencidas },
    cumplimiento: { cypher: Q.cumplimiento },
    semaforo: { cypher: Q.semaforo },
    noConformidades: { cypher: Q.noConformidades },
    mercados: { cypher: Q.mercados },
    proveedores: { cypher: Q.proveedores },
    territorios: { cypher: Q.territorios },
    origen: { cypher: Q.origen },
  });
  const { panels: drillP } = usePanels(slug, { drill: { cypher: Q.drill, params: { embarque: sel } } });
  const { grafo } = useGrafo(slug);

  const cumpl = firstRow(panels.cumplimiento);
  const pct = num(cumpl, "pct");
  const certRow = firstRow(panels.certVencidas);
  const noConf = panels.noConformidades?.rows ?? [];
  const hallazgos = noConf.reduce((a, r) => a + num(r, "n"), 0);

  const semaforoRows = panels.semaforo?.rows ?? [];
  const selIdx = semaforoRows.findIndex((r) => str(r, "embarque") === sel);
  const selRow = semaforoRows.find((r) => str(r, "embarque") === sel);

  const semaforoCols: Column[] = [
    { key: "embarque", label: "Embarque", mono: true },
    { key: "destino", label: "Destino" },
    { key: "fecha", label: "Zarpe", mono: true },
    { key: "productos", label: "Prod.", align: "right", format: fmtInt },
    { key: "con_problemas", label: "A revisar", align: "right", format: fmtInt },
    {
      key: "semaforo",
      label: "Estado",
      render: (v) => <Chip tone={String(v) === "listo" ? "ok" : "bad"}>{String(v)}</Chip>,
    },
  ];

  const drillCols: Column[] = [
    { key: "producto", label: "Producto", mono: true },
    { key: "proveedor", label: "Proveedor" },
    { key: "cert_hasta", label: "Cert. vigente", mono: true },
    { key: "zona", label: "Zona de origen" },
    {
      key: "estado",
      label: "Cadena",
      render: (v) => {
        const s = String(v);
        return <Chip tone={s === "en regla" ? "ok" : "bad"}>{s}</Chip>;
      },
    },
  ];

  const proveedorCols: Column[] = [
    { key: "proveedor", label: "Proveedor" },
    { key: "productos", label: "Productos", align: "right", format: fmtInt },
    { key: "tipo", label: "Certificación" },
    { key: "vigente_hasta", label: "Vigente hasta", mono: true },
    {
      key: "estado",
      label: "Estado",
      render: (v) => <Chip tone={String(v) === "vigente" ? "ok" : "bad"}>{String(v)}</Chip>,
    },
  ];

  const territorioCols: Column[] = [
    { key: "embarque", label: "Embarque", mono: true },
    { key: "producto", label: "Producto", mono: true },
    { key: "parcela", label: "Parcela", mono: true },
    { key: "geohash", label: "Geohash", mono: true },
    { key: "zona", label: "Zona" },
    { key: "destino", label: "Destino UE" },
    {
      key: "certificacion",
      label: "EUDR",
      render: (v) => <Chip tone={String(v) === "SIN CERTIFICACIÓN" ? "bad" : "ok"}>{String(v)}</Chip>,
    },
  ];

  const mercadoData = (panels.mercados?.rows ?? []).map((r) => {
    const region = str(r, "region");
    return {
      label: region,
      value: num(r, "productos"),
      sub: `${fmtInt(num(r, "embarques"))} embarques`,
      // La UE concentra el reglamento EUDR: es el mercado con exposición real.
      color: region === "UE" ? "#ff5a5f" : acc,
    };
  });

  const donutData = noConf.map((r) => ({
    label: str(r, "categoria"),
    value: num(r, "n"),
    color: CAT_COLOR[str(r, "categoria")] ?? acc,
  }));

  return (
    <div>
      <KpiRow>
        <KpiCard
          label="Embarques monitoreados"
          value={fmtInt(num(firstRow(panels.embarques), "n"))}
          tone="info"
          loading={panels.embarques?.loading}
          sub={`${fmtInt(num(firstRow(panels.productos), "n"))} productos trazados hasta la parcela`}
        />
        <KpiCard
          label="Cumplimiento de la cartera"
          value={fmtPct(pct)}
          tone={pct >= 90 ? "ok" : "warn"}
          loading={panels.cumplimiento?.loading}
          sub={`${fmtInt(num(cumpl, "listos"))} de ${fmtInt(num(cumpl, "total"))} embarques listos para zarpar`}
        />
        <KpiCard
          label="No conformidades abiertas"
          value={fmtInt(hallazgos)}
          tone="bad"
          loading={panels.noConformidades?.loading}
          sub="proveedor, documento y territorio — en un solo embarque"
        />
        <KpiCard
          label="Certificaciones vencidas"
          value={fmtInt(num(certRow, "vencidas"))}
          tone="warn"
          loading={panels.certVencidas?.loading}
          sub={`de ${fmtInt(num(certRow, "total"))} certificados en el grafo, al ${HOY}`}
        />
      </KpiRow>

      <DashSection eyebrow="¿este embarque puede zarpar?" title="El semáforo antes del puerto">
        <DashGrid min={360}>
          <Panel
            title="Cumplimiento de la cartera"
            subtitle="Porcentaje de embarques con la cadena en regla para su fecha de zarpe."
            cypher={Q.cumplimiento}
            accent={acc}
            {...flags(panels.cumplimiento)}
          >
            <Gauge value={pct} max={100} label="embarques listos" format={(n) => fmtPct(n)} color={riskColor(1 - pct / 100)} />
            <p className="dash-note" style={{ textAlign: "center" }}>
              Un solo embarque en rojo baja la cartera del 100%: el detalle está a la derecha.
            </p>
          </Panel>

          <Panel
            title="Semáforo de embarques"
            subtitle="Productos en regla vs. a corregir por embarque. Clic para abrir la cadena."
            cypher={Q.semaforo}
            accent={acc}
            {...flags(panels.semaforo)}
          >
            <DataTable
              rows={semaforoRows}
              columns={semaforoCols}
              maxHeight={280}
              activeIndex={selIdx >= 0 ? selIdx : undefined}
              onRowClick={(r) => setSel(str(r, "embarque"))}
              rowTone={(r) => (num(r, "con_problemas") > 0 ? "bad" : "ok")}
            />
          </Panel>

          <Panel
            title={`Cadena producto a producto — ${sel}`}
            subtitle={
              selRow
                ? `${str(selRow, "destino")} · ${str(selRow, "fecha")} — proveedor, certificación y territorio de cada lote`
                : "Selecciona un embarque en el semáforo"
            }
            cypher={Q.drill}
            accent={selRow && num(selRow, "con_problemas") > 0 ? "#ff5a5f" : acc}
            {...flags(drillP.drill)}
            emptyLabel="este embarque no tiene productos cargados"
          >
            <DataTable
              rows={drillP.drill?.rows ?? []}
              columns={drillCols}
              maxHeight={280}
              rowTone={(r) => (str(r, "estado") === "en regla" ? undefined : "bad")}
            />
          </Panel>
        </DashGrid>
      </DashSection>

      <DashSection eyebrow="lo que un archivador nunca cruza" title="Dónde se concentra el riesgo">
        <DashGrid min={360}>
          <Panel
            title="No conformidades por tipo"
            subtitle="Las tres fallas que bloquean el zarpe, cada una imposible de ver en su sistema aislado."
            cypher={Q.noConformidades}
            accent="#ff5a5f"
            {...flags(panels.noConformidades)}
          >
            <DonutChart
              data={donutData}
              centerValue={fmtInt(hallazgos)}
              centerLabel="hallazgos"
            />
          </Panel>

          <Panel
            title="Exposición por mercado de exportación"
            subtitle="Productos con destino por región. La UE carga el reglamento EUDR — ahí está el riesgo comercial."
            cypher={Q.mercados}
            accent={acc}
            {...flags(panels.mercados)}
          >
            <RankList
              data={mercadoData}
              format={fmtInt}
              activeLabel="UE"
            />
            <p className="dash-note">
              El embarque en rojo va a <b style={{ color: "#ff5a5f" }}>Rotterdam (UE)</b>: sin origen demostrable, no entra.
            </p>
          </Panel>

          <Panel
            title="Proveedores y vigencia de su certificación"
            subtitle="Cada acopiador con su certificado y su estado a la fecha de corte."
            cypher={Q.proveedores}
            accent={acc}
            {...flags(panels.proveedores)}
          >
            <DataTable
              rows={panels.proveedores?.rows ?? []}
              columns={proveedorCols}
              maxHeight={280}
              rowTone={(r) => (str(r, "estado") === "vigente" ? undefined : "bad")}
            />
          </Panel>
        </DashGrid>
      </DashSection>

      <DashSection eyebrow="origen demostrable vs. territorio en revisión" title="Trazabilidad y mapa de la red">
        <DashGrid min={360}>
          <Panel
            title="Territorios que requieren revisión (EUDR)"
            subtitle="Origen en zona de alto riesgo de deforestación con destino UE: el cruce parcela → zona → comprador."
            cypher={Q.territorios}
            accent="#ff5a5f"
            {...flags(panels.territorios)}
          >
            <DataTable
              rows={panels.territorios?.rows ?? []}
              columns={territorioCols}
              maxHeight={220}
              rowTone={() => "bad"}
            />
          </Panel>

          <Panel
            title="Origen demostrable — evidencia para el comprador"
            subtitle="La cadena completa de un lote en regla: parcela georreferenciada, zona, productor, proveedor, certificación e inspector."
            cypher={Q.origen}
            accent="#6fe3a5"
            {...flags(panels.origen)}
          >
            {(() => {
              const o = firstRow(panels.origen);
              const pares: [string, string][] = [
                ["Producto", str(o, "producto")],
                ["Parcela", `${str(o, "parcela")} · ${str(o, "geohash")}`],
                ["Zona", str(o, "zona")],
                ["Productor", str(o, "productor")],
                ["Proveedor", str(o, "proveedor")],
                ["Certificación", `${str(o, "certificacion")} · hasta ${str(o, "vigente_hasta")}`],
                ["Inspector", str(o, "inspector")],
              ];
              return (
                <div style={{ display: "grid", gridTemplateColumns: "auto 1fr", gap: "0.4rem 0.9rem", alignItems: "baseline" }}>
                  {pares.map(([k, v]) => (
                    <div key={k} style={{ display: "contents" }}>
                      <span className="dash-kpi__label" style={{ textAlign: "right" }}>{k}</span>
                      <span className="mono" style={{ fontSize: "0.82rem", color: "var(--hueso)" }}>{v}</span>
                    </div>
                  ))}
                </div>
              );
            })()}
            <p className="dash-note">Una sola consulta reconstruye lo que hoy exige cruzar ERP, GIS y carpeta de certificados.</p>
          </Panel>

          <Panel
            title="Mapa de la red"
            span={2}
            accent={acc}
            subtitle="Productores, parcelas, zonas, proveedores, certificaciones, embarques y compradores — el cumplimiento vive en las conexiones."
          >
            {grafo ? <GraphView grafo={grafo} /> : <div className="grafo-caja"><span className="grafo-caja__estado">sembrando…</span></div>}
          </Panel>
        </DashGrid>
      </DashSection>
    </div>
  );
}
