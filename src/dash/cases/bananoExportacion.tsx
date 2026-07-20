import { useState } from "react";

import {
  BarChart,
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
  firstRow,
  flags,
  fmtInt,
  fmtMoney,
  fmtMoneyExact,
  num,
  str,
  useGrafo,
  usePanels,
  type Column,
} from "../kit";
import type { DashProps } from "../dashProps";

const PMS = 7.5; // precio mínimo de sustentación 2026
const FOB_REF = 9.75; // FOB de referencia 2026
const MERCADO_INICIAL = "Unión Europea";

const precioFmt = (n: number) => `$${n.toFixed(2)}`;

const Q = {
  panorama: `MATCH (e:Embarque)-[v:VENDIDO_A]->(c:Cliente)
RETURN sum(e.cajas) AS cajas, round(sum(v.fob)) AS fob_total, count(e) AS embarques`,

  mercado: `MATCH (e:Embarque)-[:POR_RUTA]->(r:Ruta)-[:HACIA]->(m:Mercado)
MATCH (e)-[v:VENDIDO_A]->(c:Cliente)
RETURN m.nombre AS mercado, sum(e.cajas) AS cajas,
       round(sum(v.fob)) AS fob, count(e) AS embarques
ORDER BY fob DESC`,

  precio: `MATCH (e:Embarque)-[:POR_RUTA]->(r:Ruta)-[:HACIA]->(m:Mercado)
MATCH (e)-[v:VENDIDO_A]->(c:Cliente)
RETURN m.nombre AS mercado,
       round(avg(v.precio_caja) * 100) / 100 AS precio_realizado,
       round((avg(v.precio_caja) - 7.5) * 100) / 100 AS sobre_pms
ORDER BY precio_realizado DESC`,

  reclamosTipo: `MATCH (rec:Reclamo)
RETURN rec.tipo AS tipo, count(rec) AS reclamos,
       sum(rec.cajas_afectadas) AS cajas_afectadas, round(sum(rec.monto)) AS monto
ORDER BY monto DESC`,

  causaRaiz: `MATCH (emp:Empacadora)-[:PRODUJO]->(e:Embarque)
WITH emp, sum(e.cajas) AS cajas_producidas
MATCH (emp)-[:EMPACA_DE]->(f:Finca)
OPTIONAL MATCH (emp)-[:PRODUJO]->(e2:Embarque)<-[:SOBRE]-(rec:Reclamo)
WITH emp, f, cajas_producidas, sum(rec.cajas_afectadas) AS cajas_reclamadas
RETURN emp.nombre AS empacadora, f.nombre AS finca_origen,
       f.certificacion AS certificacion, cajas_producidas,
       coalesce(cajas_reclamadas, 0) AS cajas_reclamadas,
       round(coalesce(cajas_reclamadas, 0) * 10000.0 / cajas_producidas) / 100 AS tasa_reclamo_pct
ORDER BY tasa_reclamo_pct DESC`,

  navieraFrio: `MATCH (e:Embarque)-[:VIA_NAVIERA]->(n:Naviera)
WITH n, count(e) AS embarques, round(avg(e.temp_reefer) * 10) / 10 AS temp_promedio
OPTIONAL MATCH (n)<-[:VIA_NAVIERA]-(e2:Embarque)<-[:SOBRE]-(rec:Reclamo)
WITH n, embarques, temp_promedio,
     sum(CASE WHEN rec.tipo = 'daño de frío' THEN 1 ELSE 0 END) AS reclamos_frio,
     sum(CASE WHEN rec.tipo = 'daño de frío' THEN rec.cajas_afectadas ELSE 0 END) AS cajas_afectadas
RETURN n.nombre AS naviera, embarques, temp_promedio, reclamos_frio, cajas_afectadas
ORDER BY cajas_afectadas DESC`,

  clientes: `MATCH (e:Embarque)-[v:VENDIDO_A]->(c:Cliente)-[:EN_MERCADO]->(m:Mercado)
RETURN c.nombre AS cliente, m.nombre AS mercado,
       sum(e.cajas) AS cajas, round(sum(v.fob)) AS fob
ORDER BY fob DESC LIMIT 10`,

  certificacion: `MATCH (f:Finca)<-[:DE_FINCA]-(e:Embarque)-[v:VENDIDO_A]->(c:Cliente)
RETURN f.certificacion AS certificacion, count(DISTINCT f) AS fincas,
       sum(e.cajas) AS cajas,
       round(avg(v.precio_caja) * 100) / 100 AS precio_promedio
ORDER BY precio_promedio DESC`,

  rutas: `MATCH (r:Ruta)-[:HACIA]->(m:Mercado)
MATCH (e:Embarque)-[:POR_RUTA]->(r)
OPTIONAL MATCH (e)<-[:SOBRE]-(rec:Reclamo)
RETURN m.nombre AS mercado, r.puerto_destino AS puerto, r.dias_transito AS dias_transito,
       count(DISTINCT e) AS embarques, count(rec) AS reclamos
ORDER BY dias_transito DESC`,

  // ── drill por mercado (con $mercado) ──
  detalleMercado: `MATCH (r:Ruta)-[:HACIA]->(m:Mercado {nombre: $mercado})
MATCH (e:Embarque)-[:POR_RUTA]->(r)
MATCH (e)-[v:VENDIDO_A]->(c:Cliente)
RETURN c.nombre AS cliente, sum(e.cajas) AS cajas, round(sum(v.fob)) AS fob,
       round(avg(v.precio_caja) * 100) / 100 AS precio
ORDER BY fob DESC`,

  fincasMercado: `MATCH (r:Ruta)-[:HACIA]->(m:Mercado {nombre: $mercado})
MATCH (e:Embarque)-[:POR_RUTA]->(r)
MATCH (e)-[:DE_FINCA]->(f:Finca)
RETURN f.nombre AS finca, f.certificacion AS cert, sum(e.cajas) AS cajas
ORDER BY cajas DESC LIMIT 6`,
};

const CERT_TONE: Record<string, "ok" | "warn" | "info" | "muted" | "rosa"> = {
  "Orgánico UE": "ok",
  Rainforest: "info",
  "Comercio Justo": "rosa",
  "GlobalG.A.P.": "muted",
  ninguna: "warn",
};

export default function BananoExportacion({ slug }: DashProps) {
  const acc = accent(slug);
  const [sel, setSel] = useState(MERCADO_INICIAL);

  const { panels } = usePanels(slug, {
    panorama: { cypher: Q.panorama },
    mercado: { cypher: Q.mercado },
    precio: { cypher: Q.precio },
    reclamosTipo: { cypher: Q.reclamosTipo },
    causaRaiz: { cypher: Q.causaRaiz },
    navieraFrio: { cypher: Q.navieraFrio },
    clientes: { cypher: Q.clientes },
    certificacion: { cypher: Q.certificacion },
    rutas: { cypher: Q.rutas },
  });
  const { panels: drillP } = usePanels(slug, {
    detalle: { cypher: Q.detalleMercado, params: { mercado: sel } },
    fincas: { cypher: Q.fincasMercado, params: { mercado: sel } },
  });
  const { grafo } = useGrafo(slug);

  const pano = firstRow(panels.panorama);
  const fobTotal = num(pano, "fob_total");

  const mercadoRows = panels.mercado?.rows ?? [];
  const mercadoTop = mercadoRows[0];
  const selIdx = mercadoRows.findIndex((r) => str(r, "mercado") === sel);

  const reclamosRows = panels.reclamosTipo?.rows ?? [];
  const cajasReclamadas = reclamosRows.reduce((a, r) => a + num(r, "cajas_afectadas"), 0);
  const montoReclamos = reclamosRows.reduce((a, r) => a + num(r, "monto"), 0);
  const causaTop = firstRow(panels.causaRaiz);

  // RankList mercados por FOB (con % y drill).
  const mercadoData = mercadoRows.map((r) => {
    const fob = num(r, "fob");
    const pct = fobTotal ? Math.round((fob / fobTotal) * 100) : 0;
    return {
      label: str(r, "mercado"),
      value: fob,
      sub: `${pct}% · ${fmtInt(num(r, "cajas"))} cajas`,
      color: str(r, "mercado") === sel ? acc : undefined,
    };
  });

  // BarChart precio realizado por mercado (rojo si < FOB de referencia).
  const precioData = (panels.precio?.rows ?? []).map((r) => {
    const p = num(r, "precio_realizado");
    return {
      label: str(r, "mercado"),
      value: p,
      color: p < PMS ? "var(--error)" : p < FOB_REF ? "var(--warn)" : "var(--ok)",
    };
  });

  // Donut reclamos por monto.
  const reclamosData = reclamosRows.map((r) => ({
    label: str(r, "tipo"),
    value: num(r, "monto"),
    sub: `${fmtInt(num(r, "cajas_afectadas"))} cajas`,
  }));

  // BarChart premium por certificación.
  const certData = (panels.certificacion?.rows ?? []).map((r) => ({
    label: str(r, "certificacion"),
    value: num(r, "precio_promedio"),
    color: CERT_TONE[str(r, "certificacion")] === "ok" ? "var(--ok)" : acc,
    sub: `${fmtInt(num(r, "cajas"))} cajas`,
  }));

  const clientesData = (panels.clientes?.rows ?? []).map((r) => ({
    label: str(r, "cliente"),
    value: num(r, "fob"),
    sub: str(r, "mercado"),
  }));

  const causaCols: Column[] = [
    { key: "empacadora", label: "Empacadora" },
    { key: "finca_origen", label: "Finca de origen" },
    {
      key: "certificacion",
      label: "Certificación",
      render: (v) => <Chip tone={CERT_TONE[String(v)] ?? "muted"}>{String(v)}</Chip>,
    },
    { key: "cajas_reclamadas", label: "Cajas recl.", align: "right", format: fmtInt },
    { key: "tasa_reclamo_pct", label: "Tasa reclamo", align: "right", format: (n) => `${n.toFixed(2)}%` },
  ];

  const navieraCols: Column[] = [
    { key: "naviera", label: "Naviera" },
    { key: "temp_promedio", label: "T° reefer", align: "right", format: (n) => `${n.toFixed(1)} °C` },
    { key: "reclamos_frio", label: "Reclamos frío", align: "right", format: fmtInt },
    { key: "cajas_afectadas", label: "Cajas dañadas", align: "right", format: fmtInt },
  ];

  const rutasCols: Column[] = [
    { key: "mercado", label: "Mercado" },
    { key: "puerto", label: "Puerto destino" },
    { key: "dias_transito", label: "Tránsito", align: "right", format: (n) => `${n} d` },
    { key: "embarques", label: "Embarques", align: "right", format: fmtInt },
    { key: "reclamos", label: "Reclamos", align: "right", format: fmtInt },
  ];

  const detalleCols: Column[] = [
    { key: "cliente", label: "Cliente / importador" },
    { key: "cajas", label: "Cajas", align: "right", format: fmtInt },
    { key: "precio", label: "Precio caja", align: "right", format: precioFmt },
    { key: "fob", label: "FOB", align: "right", format: fmtMoneyExact },
  ];

  const fincasSel = drillP.fincas?.rows ?? [];

  return (
    <div>
      <KpiRow>
        <KpiCard label="Cajas exportadas" value={fmtInt(num(pano, "cajas"))}
          loading={panels.panorama?.loading} tone="info"
          sub={`${fmtInt(num(pano, "embarques"))} embarques a ${mercadoRows.length} mercados`} />
        <KpiCard label="FOB facturado" value={fmtMoney(fobTotal)}
          loading={panels.panorama?.loading} tone="ok"
          sub="valor libre a bordo, todos los mercados" />
        <KpiCard label="Mercado #1" value={mercadoTop ? str(mercadoTop, "mercado") : "—"}
          loading={panels.mercado?.loading} tone="warn"
          sub={mercadoTop ? `${Math.round((num(mercadoTop, "fob") / (fobTotal || 1)) * 100)}% de la facturación — dependencia` : ""} />
        <KpiCard label="Reclamos de calidad" value={fmtMoneyExact(montoReclamos)}
          loading={panels.reclamosTipo?.loading} tone="bad"
          sub={`${fmtInt(cajasReclamadas)} cajas descontadas del destino`} />
        <KpiCard label="Empacadora a revisar" value={causaTop ? str(causaTop, "empacadora").replace("Empacadora ", "") : "—"}
          loading={panels.causaRaiz?.loading} tone="bad"
          sub={causaTop ? `${num(causaTop, "tasa_reclamo_pct").toFixed(2)}% de tasa de reclamo` : ""} />
      </KpiRow>

      <DashSection eyebrow="¿de quién depende la facturación?" title="Mercados y precio realizado">
        <DashGrid min={360}>
          <Panel title="Concentración por mercado" span={2}
            subtitle="FOB facturado por mercado destino. Clic en un mercado para ver sus clientes y las fincas que lo surten."
            cypher={Q.mercado} accent={acc} {...flags(panels.mercado)}>
            <RankList data={mercadoData} format={fmtMoneyExact} accent={acc}
              onClick={(_d, i) => setSel(str(mercadoRows[i], "mercado"))} activeLabel={sel} />
            {mercadoTop && (
              <p className="dash-note">
                <b style={{ color: acc }}>{str(mercadoTop, "mercado")}</b> concentra ~{Math.round((num(mercadoTop, "fob") / (fobTotal || 1)) * 100)}% de la
                facturación: gran mercado, gran dependencia. Diversificar es resiliencia.
              </p>
            )}
          </Panel>

          <Panel title={`Detalle de ${sel}`}
            subtitle="Clientes que compran en el mercado y las fincas que lo surten."
            cypher={Q.detalleMercado} accent={acc} {...flags(drillP.detalle)}
            emptyLabel="sin embarques a este mercado">
            <DataTable rows={drillP.detalle?.rows ?? []} columns={detalleCols} maxHeight={200} />
            {fincasSel.length > 0 && (
              <p className="dash-note">
                Fincas de origen:{" "}
                <span style={{ display: "inline-flex", flexWrap: "wrap", gap: "0.3rem" }}>
                  {fincasSel.slice(0, 5).map((r, i) => (
                    <Chip key={i} tone={CERT_TONE[str(r, "cert")] ?? "muted"}>{str(r, "finca")}</Chip>
                  ))}
                </span>
              </p>
            )}
          </Panel>

          <Panel title="Precio realizado vs precio oficial" span={2}
            subtitle="Precio promedio por caja logrado en cada mercado. Referencias 2026: PMS $7,50 · FOB $9,75. La UE paga premium; Rusia (spot) queda bajo el FOB."
            cypher={Q.precio} accent={acc} {...flags(panels.precio)}>
            <BarChart data={precioData} format={precioFmt} accent={acc} />
            <p className="dash-note">
              Verde = sobre el FOB de referencia ($9,75) · ámbar = entre PMS y FOB · rojo = bajo el PMS ($7,50).
            </p>
          </Panel>

          <Panel title="Top clientes por FOB"
            subtitle="Los importadores que más facturan: si uno se cae, ¿cuánta venta se va con él?"
            cypher={Q.clientes} accent={acc} {...flags(panels.clientes)}>
            <RankList data={clientesData} format={fmtMoneyExact} accent={acc} />
          </Panel>
        </DashGrid>
      </DashSection>

      <DashSection eyebrow="dónde se va el margen" title="Calidad y reclamos">
        <DashGrid min={360}>
          <Panel title="Causa raíz: reclamos por empacadora" span={2}
            subtitle="La trazabilidad que el grafo hace directa: del reclamo hacia atrás a la empacadora y la finca. Una empacadora concentra la tasa de reclamo."
            cypher={Q.causaRaiz} accent="var(--error)" {...flags(panels.causaRaiz)}>
            <DataTable rows={panels.causaRaiz?.rows ?? []} columns={causaCols} maxHeight={300}
              rowTone={(r) => (num(r, "tasa_reclamo_pct") > 5 ? "bad" : undefined)} />
            <p className="dash-note">
              <b style={{ color: "var(--error)" }}>{causaTop ? str(causaTop, "empacadora") : ""}</b> (de {causaTop ? str(causaTop, "finca_origen") : ""})
              concentra la tasa de reclamo — ahí está el problema de calidad, no en toda la operación.
            </p>
          </Panel>

          <Panel title="Reclamos por causa"
            subtitle="Dónde se descuenta el margen desde el destino, por tipo de defecto."
            cypher={Q.reclamosTipo} accent="var(--error)" {...flags(panels.reclamosTipo)}>
            <DonutChart data={reclamosData} centerValue={fmtMoneyExact(montoReclamos)}
              centerLabel="reclamado" format={fmtMoneyExact} />
          </Panel>

          <Panel title="Cadena de frío por naviera"
            subtitle="Temperatura reefer promedio y daño de frío por línea marítima: una corre más caliente y acumula el daño."
            cypher={Q.navieraFrio} accent="var(--warn)" {...flags(panels.navieraFrio)}>
            <DataTable rows={panels.navieraFrio?.rows ?? []} columns={navieraCols} maxHeight={260}
              rowTone={(r) => (num(r, "cajas_afectadas") > 1500 ? "bad" : undefined)} />
          </Panel>
        </DashGrid>
      </DashSection>

      <DashSection eyebrow="logística y valor" title="Rutas, tránsito y certificación">
        <DashGrid min={360}>
          <Panel title="Rutas y días de tránsito"
            subtitle="Las rutas largas estresan más la cadena de frío: tránsito y reclamos acumulados por destino."
            cypher={Q.rutas} accent={acc} {...flags(panels.rutas)}>
            <DataTable rows={panels.rutas?.rows ?? []} columns={rutasCols} maxHeight={280} sortable />
          </Panel>

          <Panel title="Premium por certificación"
            subtitle="Precio promedio realizado según la certificación de la finca: orgánico y Rainforest capturan el mayor premium."
            cypher={Q.certificacion} accent="var(--ok)" {...flags(panels.certificacion)}>
            <BarChart data={certData} format={precioFmt} accent={acc} />
          </Panel>

          <Panel title="Mapa de la exportación" span="full" accent={acc}
            subtitle="Finca → empacadora → embarque → naviera → ruta → mercado → cliente. Cada caja y su recorrido, en un grafo.">
            {grafo ? <GraphView grafo={grafo} /> : <div className="grafo-caja"><span className="grafo-caja__estado">sembrando…</span></div>}
          </Panel>
        </DashGrid>
      </DashSection>
    </div>
  );
}
