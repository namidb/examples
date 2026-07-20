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
  arr,
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

const PROVEEDOR_INICIAL = "Agroindustrial del Pacífico";

const Q = {
  venta: `MATCH (t:Tienda)-[v:VENDE]->(p:Producto)
RETURN round(sum(v.venta_sem)) AS venta_semana,
       count(DISTINCT p) AS skus, count(DISTINCT t) AS tiendas`,

  critico: `MATCH (pr:Proveedor)-[:SUMINISTRA]->(p:Producto)
MATCH (t:Tienda)-[v:VENDE]->(p)
RETURN pr.nombre AS proveedor, pr.tipo AS tipo,
       count(DISTINCT p) AS skus, count(DISTINCT t) AS tiendas,
       round(sum(v.venta_sem)) AS ingreso_en_riesgo
ORDER BY ingreso_en_riesgo DESC`,

  unico: `MATCH (p:Producto)<-[:SUMINISTRA]-(pr:Proveedor)
WITH p, count(DISTINCT pr) AS nprov, collect(DISTINCT pr.nombre) AS provs
WHERE nprov = 1
MATCH (t:Tienda)-[v:VENDE]->(p)
RETURN p.nombre AS sku, p.categoria AS categoria, provs[0] AS proveedor,
       count(DISTINCT t) AS tiendas, round(sum(v.venta_sem)) AS ingreso_expuesto
ORDER BY ingreso_expuesto DESC`,

  quiebres: `MATCH (q:Quiebre)-[:EN_TIENDA]->(t:Tienda)
MATCH (q)-[:DE_SKU]->(p:Producto)
RETURN t.nombre AS tienda, p.nombre AS sku, p.categoria AS categoria,
       q.dias AS dias, round(q.ventas_perdidas) AS ventas_perdidas
ORDER BY ventas_perdidas DESC`,

  causaRaiz: `MATCH (c:Cedi {nombre: 'CEDI Durán'})-[:ABASTECE]->(t:Tienda)
MATCH (t)-[v:VENDE]->(p:Producto)
RETURN t.nombre AS tienda, t.formato AS formato,
       count(DISTINCT p) AS skus_expuestos,
       round(sum(v.venta_sem)) AS venta_expuesta
ORDER BY venta_expuesta DESC`,

  sistemico: `CALL algo.pagerank({labels: ['Proveedor', 'Cedi', 'Tienda', 'Producto'],
                    edge_types: ['SUMINISTRA', 'ENTREGA_EN', 'ABASTECE', 'VENDE']})
YIELD node_id, score
WITH node_id AS nn, score
MATCH (x) WHERE id(x) = id(nn)
RETURN labels(x)[0] AS tipo, coalesce(x.nombre, x.sku) AS nodo,
       round(score * 10000) / 10000 AS pagerank
ORDER BY pagerank DESC LIMIT 12`,

  merma: `MATCH (l:Lote)-[:ES_SKU]->(p:Producto)
MATCH (l)-[:EN_TIENDA]->(t:Tienda)
WHERE l.vence <= '2026-07-22'
RETURN t.nombre AS tienda, p.nombre AS sku, l.vence AS vence,
       l.unidades AS unidades, round(l.unidades * p.precio) AS valor_en_riesgo
ORDER BY valor_en_riesgo DESC`,

  redistribucion: `MATCH (l:Lote)-[:ES_SKU]->(p:Producto)
MATCH (l)-[:EN_TIENDA]->(origen:Tienda)
WHERE l.vence <= '2026-07-22'
MATCH (q:Quiebre)-[:DE_SKU]->(p)
MATCH (q)-[:EN_TIENDA]->(destino:Tienda)
RETURN l.codigo AS lote, p.nombre AS sku, origen.nombre AS desde,
       destino.nombre AS hacia, l.unidades AS unidades, l.vence AS vence,
       round(q.ventas_perdidas) AS demanda_destino,
       round(l.unidades * p.precio) AS venta_rescatable
ORDER BY venta_rescatable DESC, demanda_destino DESC`,

  sustitucion: `MATCH (q:Quiebre)-[:EN_TIENDA]->(t:Tienda)
MATCH (q)-[:DE_SKU]->(p:Producto)
RETURN t.nombre AS tienda, p.nombre AS agotado,
       [(p)<-[:SUSTITUYE_A]-(s:Producto) | s.nombre] AS sustitutos,
       round(q.ventas_perdidas) AS ventas_perdidas
ORDER BY ventas_perdidas DESC`,

  formato: `MATCH (t:Tienda)-[v:VENDE]->(p:Producto)
RETURN t.formato AS formato, count(DISTINCT t) AS tiendas,
       round(sum(v.venta_sem)) AS venta_semana
ORDER BY venta_semana DESC`,

  // ── drill por proveedor (con $prov) ──
  detalleProv: `MATCH (pr:Proveedor {nombre: $prov})-[:SUMINISTRA]->(p:Producto)
MATCH (p)<-[:SUMINISTRA]-(otro:Proveedor)
WITH p, count(DISTINCT otro) AS nprov
OPTIONAL MATCH (p)<-[v:VENDE]-(t:Tienda)
WITH p, nprov, count(DISTINCT t) AS tiendas, round(sum(v.venta_sem)) AS ingreso
RETURN p.nombre AS sku, p.categoria AS categoria,
       CASE WHEN nprov = 1 THEN 'único' ELSE 'multi' END AS fuente,
       tiendas, ingreso
ORDER BY ingreso DESC`,

  cedisProv: `MATCH (pr:Proveedor {nombre: $prov})-[:ENTREGA_EN]->(c:Cedi)
RETURN c.nombre AS cedi, c.ciudad AS ciudad
ORDER BY cedi`,
};

const FORMATO_LABEL: Record<string, string> = {
  megamaxi: "Megamaxi",
  supermaxi: "Supermaxi",
  "gran-aki": "Gran Akí",
  aki: "Akí",
  tuti: "Tuti",
};

const TIPO_TONE: Record<string, "ok" | "warn" | "bad" | "info" | "muted" | "rosa"> = {
  agroindustrial: "warn",
  carnicos: "bad",
  lacteo: "info",
  importador: "rosa",
  "marca-nacional": "muted",
  "marca-propia": "ok",
};

export default function RetailAbastecimiento({ slug }: DashProps) {
  const acc = accent(slug);
  const [sel, setSel] = useState(PROVEEDOR_INICIAL);

  const { panels } = usePanels(slug, {
    venta: { cypher: Q.venta },
    critico: { cypher: Q.critico },
    unico: { cypher: Q.unico },
    quiebres: { cypher: Q.quiebres },
    causaRaiz: { cypher: Q.causaRaiz },
    sistemico: { cypher: Q.sistemico },
    merma: { cypher: Q.merma },
    redistribucion: { cypher: Q.redistribucion },
    sustitucion: { cypher: Q.sustitucion },
    formato: { cypher: Q.formato },
  });
  const { panels: drillP } = usePanels(slug, {
    detalle: { cypher: Q.detalleProv, params: { prov: sel } },
    cedis: { cypher: Q.cedisProv, params: { prov: sel } },
  });
  const { grafo } = useGrafo(slug);

  const venta = firstRow(panels.venta);
  const critico = panels.critico?.rows ?? [];
  const criticoTop = critico[0];
  const quiebres = panels.quiebres?.rows ?? [];
  const perdidaTotal = quiebres.reduce((a, r) => a + num(r, "ventas_perdidas"), 0);
  const unicoRows = panels.unico?.rows ?? [];
  const mermaRows = panels.merma?.rows ?? [];
  const mermaTotal = mermaRows.reduce((a, r) => a + num(r, "valor_en_riesgo"), 0);
  // El cruce lote×quiebre puede repetir un lote (un SKU con varios quiebres);
  // nos quedamos con el mejor destino por lote (el de mayor demanda, primero por
  // el ORDER BY) para no contar dos veces el mismo stock físico.
  const redistVistos = new Set<string>();
  const redistRows = (panels.redistribucion?.rows ?? []).filter((r) => {
    const k = str(r, "lote");
    if (redistVistos.has(k)) return false;
    redistVistos.add(k);
    return true;
  });
  const rescatableTotal = redistRows.reduce((a, r) => a + num(r, "venta_rescatable"), 0);

  const selIdx = critico.findIndex((r) => str(r, "proveedor") === sel);

  // RankList: ingreso en riesgo por proveedor (la cola de dependencia).
  const criticoData = critico.slice(0, 10).map((r) => ({
    label: str(r, "proveedor"),
    value: num(r, "ingreso_en_riesgo"),
    sub: `${num(r, "skus")} SKU · ${num(r, "tiendas")} tiendas`,
    color: str(r, "proveedor") === sel ? acc : undefined,
  }));

  // Causa raíz: venta expuesta por tienda si cae CEDI Durán.
  const causaData = (panels.causaRaiz?.rows ?? []).map((r) => ({
    label: str(r, "tienda"),
    value: num(r, "venta_expuesta"),
    sub: FORMATO_LABEL[str(r, "formato")] ?? str(r, "formato"),
  }));

  // Donut: venta por formato de tienda.
  const formatoData = (panels.formato?.rows ?? []).map((r) => ({
    label: FORMATO_LABEL[str(r, "formato")] ?? str(r, "formato"),
    value: num(r, "venta_semana"),
    sub: `${num(r, "tiendas")} tiendas`,
  }));

  const unicoCols: Column[] = [
    { key: "sku", label: "SKU sin plan B" },
    { key: "categoria", label: "Categoría", render: (v) => <Chip tone="muted">{String(v)}</Chip> },
    { key: "proveedor", label: "Único proveedor" },
    { key: "ingreso_expuesto", label: "Ingreso expuesto", align: "right", format: fmtMoneyExact },
  ];

  const quiebresCols: Column[] = [
    { key: "tienda", label: "Tienda" },
    { key: "sku", label: "Agotado" },
    { key: "dias", label: "Días", align: "right", format: fmtInt },
    { key: "ventas_perdidas", label: "Venta perdida", align: "right", format: fmtMoneyExact },
  ];

  const sustitucionCols: Column[] = [
    { key: "tienda", label: "Tienda" },
    { key: "agotado", label: "Agotado" },
    {
      key: "sustitutos",
      label: "Sustituto que rescata la venta",
      render: (v) => {
        const subs = (v as unknown[]).map(String);
        return subs.length ? (
          <span style={{ display: "flex", flexWrap: "wrap", gap: "0.3rem" }}>
            {subs.map((s, i) => <Chip key={i} tone="ok">{s}</Chip>)}
          </span>
        ) : (
          <Chip tone="bad">sin sustituto — venta perdida</Chip>
        );
      },
    },
    { key: "ventas_perdidas", label: "En juego", align: "right", format: fmtMoneyExact },
  ];

  const causaCols: Column[] = [
    { key: "tienda", label: "Tienda" },
    { key: "formato", label: "Formato", render: (v) => FORMATO_LABEL[String(v)] ?? String(v) },
    { key: "skus_expuestos", label: "SKU", align: "right", format: fmtInt },
    { key: "venta_expuesta", label: "Venta expuesta", align: "right", format: fmtMoneyExact },
  ];

  const mermaCols: Column[] = [
    { key: "tienda", label: "Tienda" },
    { key: "sku", label: "Perecedero" },
    { key: "vence", label: "Vence", mono: true },
    { key: "unidades", label: "Unid.", align: "right", format: fmtInt },
    { key: "valor_en_riesgo", label: "Valor en riesgo", align: "right", format: fmtMoneyExact },
  ];

  const redistCols: Column[] = [
    { key: "sku", label: "Perecedero" },
    { key: "desde", label: "Mover desde", render: (v) => <Chip tone="warn">{String(v)}</Chip> },
    { key: "hacia", label: "Hacia (en quiebre)", render: (v) => <Chip tone="ok">{String(v)}</Chip> },
    { key: "unidades", label: "Unid.", align: "right", format: fmtInt },
    { key: "venta_rescatable", label: "Rescatable", align: "right", format: fmtMoneyExact },
  ];

  const sistemicoCols: Column[] = [
    { key: "tipo", label: "Nodo", render: (v) => <Chip tone={String(v) === "Cedi" ? "rosa" : "muted"}>{String(v)}</Chip> },
    { key: "nodo", label: "Nombre" },
    { key: "pagerank", label: "PageRank", align: "right", format: (n) => n.toFixed(4) },
  ];

  const detalleCols: Column[] = [
    { key: "sku", label: "SKU" },
    {
      key: "fuente",
      label: "Fuente",
      render: (v) => <Chip tone={String(v) === "único" ? "bad" : "ok"}>{String(v)}</Chip>,
    },
    { key: "ingreso", label: "Ingreso semanal", align: "right", format: fmtMoneyExact },
  ];

  const cedisSel = drillP.cedis?.rows ?? [];

  return (
    <div>
      <KpiRow>
        <KpiCard label="Venta semanal de la red" value={fmtMoney(num(venta, "venta_semana"))}
          loading={panels.venta?.loading} tone="info"
          sub={`${fmtInt(num(venta, "skus"))} SKU en ${fmtInt(num(venta, "tiendas"))} tiendas`} />
        <KpiCard label="Quiebres activos" value={fmtInt(quiebres.length)}
          loading={panels.quiebres?.loading} tone="bad"
          sub={`${fmtMoneyExact(perdidaTotal)} en venta perdida`} />
        <KpiCard label="Ingreso en riesgo — proveedor #1" value={fmtMoney(num(criticoTop, "ingreso_en_riesgo"))}
          loading={panels.critico?.loading} tone="warn"
          sub={criticoTop ? str(criticoTop, "proveedor") : "—"} />
        <KpiCard label="SKU de proveedor único" value={fmtInt(unicoRows.length)}
          loading={panels.unico?.loading} tone="warn"
          sub="sin plan B si el proveedor falla" />
        <KpiCard label="Merma a 48 horas" value={fmtMoneyExact(mermaTotal)}
          loading={panels.merma?.loading} tone="bad"
          sub={`${fmtMoneyExact(rescatableTotal)} rescatable redistribuyendo`} />
      </KpiRow>

      <DashSection eyebrow="¿de quién dependemos?" title="Resiliencia de proveedores">
        <DashGrid min={360}>
          <Panel title="Ingreso semanal en riesgo por proveedor" span={2}
            subtitle="La venta de los SKU de cada proveedor sumada en todas las tiendas: su exposición si falla. Clic para ver su cartera."
            cypher={Q.critico} accent={acc} {...flags(panels.critico)}>
            <RankList data={criticoData} format={fmtMoneyExact} accent={acc}
              onClick={(_d, i) => setSel(str(critico[i], "proveedor"))}
              activeLabel={sel} />
            <p className="dash-note">
              El proveedor agroindustrial integrado <b style={{ color: acc }}>{criticoTop ? str(criticoTop, "proveedor") : ""}</b> encabeza:
              surte banano y lácteos de alta rotación en toda la red. Concentración = riesgo.
            </p>
          </Panel>

          <Panel title={`Cartera de ${sel}`}
            subtitle="Los SKU que suministra, su ingreso semanal y si dependemos de él como fuente única."
            cypher={Q.detalleProv} accent={acc} {...flags(drillP.detalle)}
            emptyLabel="proveedor sin SKU registrados">
            {cedisSel.length > 0 && (
              <p className="dash-note" style={{ marginTop: 0 }}>
                Entrega en:{" "}
                <span style={{ display: "inline-flex", flexWrap: "wrap", gap: "0.3rem" }}>
                  {cedisSel.map((r, i) => <Chip key={i} tone="rosa">{str(r, "cedi")}</Chip>)}
                </span>
              </p>
            )}
            <DataTable rows={drillP.detalle?.rows ?? []} columns={detalleCols} maxHeight={300}
              rowTone={(r) => (str(r, "fuente") === "único" ? "bad" : undefined)} />
          </Panel>

          <Panel title="SKU de proveedor único" span={2}
            subtitle="Un solo proveedor los fabrica: si falla, no hay reemplazo inmediato. Ordenados por ingreso expuesto."
            cypher={Q.unico} accent="var(--warn)" {...flags(panels.unico)}>
            <DataTable rows={unicoRows} columns={unicoCols} maxHeight={320} sortable
              rowTone={(r) => (num(r, "ingreso_expuesto") > 20000 ? "warn" : undefined)} />
          </Panel>

          <Panel title="Nodos sistémicos (PageRank)"
            subtitle="Los cuellos de botella por donde fluye la red. CEDI Durán encabeza — el mismo que más venta expone si se detiene."
            cypher={Q.sistemico} accent={acc} {...flags(panels.sistemico)}>
            <DataTable rows={panels.sistemico?.rows ?? []} columns={sistemicoCols} maxHeight={320}
              rowTone={(r) => (str(r, "tipo") === "Cedi" ? "bad" : undefined)} />
          </Panel>
        </DashGrid>
      </DashSection>

      <DashSection eyebrow="dónde se va la plata" title="Quiebres de stock en curso">
        <DashGrid min={360}>
          <Panel title="Quiebres activos"
            subtitle="Desabastos en curso con su venta perdida estimada: la fuga en tiempo real."
            cypher={Q.quiebres} accent="var(--error)" {...flags(panels.quiebres)}>
            <DataTable rows={quiebres} columns={quiebresCols} maxHeight={280} rowTone={() => "bad"} />
          </Panel>

          <Panel title="¿Se rescata con un sustituto?"
            subtitle="El grafo de sustitución dice qué quiebres se redirigen a otro producto — y cuáles no tienen plan B."
            cypher={Q.sustitucion} accent={acc} {...flags(panels.sustitucion)}>
            <DataTable rows={panels.sustitucion?.rows ?? []} columns={sustitucionCols} maxHeight={280}
              rowTone={(r) => (arr(r, "sustitutos").length === 0 ? "bad" : "ok")} />
          </Panel>

          <Panel title="Causa raíz: si se detiene CEDI Durán" span={2}
            subtitle="Ejercicio de resiliencia: las tiendas que abastece y la venta semanal expuesta. Un nodo, decenas de góndolas."
            cypher={Q.causaRaiz} accent="var(--warn)" {...flags(panels.causaRaiz)}>
            <BarChart data={causaData} format={fmtMoneyExact} accent={acc} />
            <DataTable rows={panels.causaRaiz?.rows ?? []} columns={causaCols} maxHeight={220} sortable />
          </Panel>
        </DashGrid>
      </DashSection>

      <DashSection eyebrow="perecederos: perder o rescatar" title="Merma, redistribución y demanda">
        <DashGrid min={360}>
          <Panel title="Merma por vencer en 48 horas"
            subtitle="Lotes que vencen ya, con el valor en góndola que se perdería si no se mueven o rematan hoy."
            cypher={Q.merma} accent="var(--error)" {...flags(panels.merma)}>
            <DataTable rows={mermaRows} columns={mermaCols} maxHeight={260} rowTone={() => "warn"} />
          </Panel>

          <Panel title="Redistribución antes de que venza"
            subtitle="El cruce que sólo un grafo hace fácil: mover el lote por vencer de una tienda de baja rotación a otra en quiebre del mismo SKU."
            cypher={Q.redistribucion} accent="var(--ok)" {...flags(panels.redistribucion)}>
            <DataTable rows={redistRows} columns={redistCols} maxHeight={260} />
            <p className="dash-note">
              <b style={{ color: "var(--ok)" }}>{fmtMoneyExact(rescatableTotal)}</b> en venta rescatable:
              el queso fresco que sobra en Tuti Loja es justo el que falta en Quito Norte.
            </p>
          </Panel>

          <Panel title="Venta por formato de tienda"
            subtitle="Cómo se reparte la venta semanal — dónde pesa el abastecimiento."
            cypher={Q.formato} accent={acc} {...flags(panels.formato)}>
            <DonutChart data={formatoData} centerValue={fmtMoney(num(venta, "venta_semana"))}
              centerLabel="semana" format={fmtMoneyExact} />
          </Panel>
        </DashGrid>
      </DashSection>

      <DashSection eyebrow="la cadena completa" title="Mapa de la red de abastecimiento">
        <DashGrid min={360}>
          <Panel title="Proveedor → CEDI → tienda → SKU" span="full" accent={acc}
            subtitle="Toda la cadena en un grafo: proveedores, centros de distribución, tiendas y productos. La resiliencia vive en las conexiones.">
            {grafo ? <GraphView grafo={grafo} /> : <div className="grafo-caja"><span className="grafo-caja__estado">sembrando…</span></div>}
          </Panel>
        </DashGrid>
      </DashSection>
    </div>
  );
}
