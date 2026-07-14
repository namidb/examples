import { useState } from "react";

import {
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
  fmtMoney,
  fmtMoneyExact,
  firstRow,
  flags,
  num,
  serie,
  str,
  useGrafo,
  usePanels,
  type Column,
} from "../kit";
import type { DashProps } from "../dashProps";

// Vector de la búsqueda de Andrea, precomputado y offline (determinista).
// En producción vendría de tu proveedor de embeddings.
const VEC = "[0.0, 0.0, -0.00525, 0.0, -0.49703, 0.0, -0.42767, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.43923, -0.44869, 0.0, 0.0, 0.0, -0.41927]";

const Q = {
  productos: `MATCH (p:Producto) RETURN count(p) AS n`,

  clientes: `MATCH (c:Cliente) RETURN count(c) AS n`,

  ventas: `MATCH (:Cliente)-[:COMPRO]->(p:Producto)
RETURN count(*) AS compras, sum(p.precio) AS gmv`,

  segmentosNum: `CALL algo.label_propagation({edge_types: ['COMPRO']})
YIELD node_id, community
WITH node_id AS n, community
MATCH (c:Cliente) WHERE id(c) = id(n)
WITH community, count(DISTINCT c) AS clientes
WHERE clientes > 2
RETURN count(*) AS segmentos`,

  devEvitable: `MATCH (dueno:Cliente)-[:COMPRO]->(cam:Producto {sku: 'FOT-CAM-Z50'})
MATCH (dueno)-[:COMPRO]->(cand:Producto)
WHERE cand.sku <> 'FOT-CAM-Z50'
MATCH (dev:Devolucion {motivo: 'incompatibilidad'})-[:DE_PRODUCTO]->(cand)
OPTIONAL MATCH (cand)-[compat:COMPATIBLE_CON]->(cam)
WITH cand, dev, compat
WHERE compat IS NULL
WITH cand, count(DISTINCT dev) AS devoluciones
RETURN sum(devoluciones) AS devoluciones, sum(devoluciones * cand.precio) AS costo`,

  siguiente: `MATCH (a:Cliente {nombre: 'Andrea Villamar'})-[:COMPRO]->(mio:Producto)
MATCH (par:Cliente)-[:COMPRO]->(mio)
MATCH (par)-[:COMPRO]->(rec:Producto)
WHERE par.nombre <> 'Andrea Villamar'
OPTIONAL MATCH (rec)<-[ya:COMPRO]-(a)
OPTIONAL MATCH (rec)<-[:DE_PRODUCTO]-(dev_inc:Devolucion {motivo: 'incompatibilidad'})
WITH rec, par, ya, dev_inc
WHERE ya IS NULL AND dev_inc IS NULL
WITH rec, count(DISTINCT par) AS clientes_similares
MATCH (rec)-[:DE_CATEGORIA]->(cat:Categoria)
RETURN rec.nombre AS recomendacion, cat.nombre AS categoria,
       rec.precio AS precio, clientes_similares
ORDER BY clientes_similares DESC
LIMIT 6`,

  explicable: `MATCH (a:Cliente {nombre: 'Andrea Villamar'})-[:COMPRO]->(mio:Producto)
MATCH (par:Cliente)-[:COMPRO]->(mio)
MATCH (par)-[:COMPRO]->(rec:Producto)
MATCH (rec)-[:COMPLEMENTA]->(mio)
WHERE par.nombre <> 'Andrea Villamar'
OPTIONAL MATCH (rec)<-[ya:COMPRO]-(a)
WITH rec, mio, par, ya
WHERE ya IS NULL
MATCH (rec)-[:DE_MARCA]->(marca:Marca)
RETURN rec.nombre AS recomendado,
       mio.nombre AS complementa_a,
       count(DISTINCT par) AS clientes_similares,
       marca.nombre AS marca
ORDER BY clientes_similares DESC
LIMIT 6`,

  evitar: `MATCH (dueno:Cliente)-[:COMPRO]->(cam:Producto {sku: 'FOT-CAM-Z50'})
MATCH (dueno)-[:COMPRO]->(cand:Producto)
WHERE cand.sku <> 'FOT-CAM-Z50'
MATCH (dev:Devolucion {motivo: 'incompatibilidad'})-[:DE_PRODUCTO]->(cand)
OPTIONAL MATCH (cand)-[compat:COMPATIBLE_CON]->(cam)
WITH cand, dueno, dev, compat
WHERE compat IS NULL
WITH cand, count(DISTINCT dueno) AS compradores, count(DISTINCT dev) AS devoluciones
RETURN cand.nombre AS producto,
       compradores AS lo_compraron_con_la_camara,
       devoluciones AS devoluciones_por_incompatibilidad,
       devoluciones * cand.precio AS costo_evitado
ORDER BY devoluciones_por_incompatibilidad DESC`,

  segmentos: `CALL algo.label_propagation({edge_types: ['COMPRO']})
YIELD node_id, community
WITH node_id AS n, community
MATCH (c:Cliente) WHERE id(c) = id(n)
MATCH (c)-[:COMPRO]->(p:Producto)-[:DE_CATEGORIA]->(cat:Categoria)
WITH community, cat.nombre AS categoria, count(*) AS compras, count(DISTINCT c) AS cl
WITH community, categoria, compras, cl ORDER BY compras DESC
WITH community, collect(categoria)[0] AS top_categoria,
     sum(compras) AS compras_totales, max(cl) AS clientes
WHERE clientes > 2
RETURN community AS segmento, top_categoria, clientes, compras_totales
ORDER BY clientes DESC`,

  gmvCategoria: `MATCH (:Cliente)-[:COMPRO]->(p:Producto)-[:DE_CATEGORIA]->(cat:Categoria)
RETURN cat.nombre AS categoria, count(*) AS compras, sum(p.precio) AS gmv
ORDER BY gmv DESC`,

  busqueda: `CALL search.hybrid({label: 'Producto', text_property: 'nombre',
                    query_text: 'mochila para llevar cámara bajo lluvia',
                    vector_property: 'emb',
                    query_vector: ${VEC},
                    k: 5})
YIELD node, score
RETURN node.nombre AS producto, node.precio AS precio,
       round(score * 10000) / 10000 AS score
ORDER BY score DESC`,

  drill: `MATCH (base:Producto {nombre: $producto})<-[:COMPRO]-(cl:Cliente)-[:COMPRO]->(otro:Producto)
WHERE otro.nombre <> $producto
MATCH (otro)-[:DE_CATEGORIA]->(cat:Categoria)
RETURN otro.nombre AS producto, cat.nombre AS categoria,
       otro.precio AS precio, count(DISTINCT cl) AS co_compradores
ORDER BY co_compradores DESC
LIMIT 8`,
};

const DEFECTO = "Batería original Nakura BZ-1 para Z50";

export default function Recomendaciones({ slug }: DashProps) {
  const acc = accent(slug);
  const [sel, setSel] = useState(DEFECTO);

  const { panels } = usePanels(slug, {
    productos: { cypher: Q.productos },
    clientes: { cypher: Q.clientes },
    ventas: { cypher: Q.ventas },
    segmentosNum: { cypher: Q.segmentosNum },
    devEvitable: { cypher: Q.devEvitable },
    siguiente: { cypher: Q.siguiente },
    explicable: { cypher: Q.explicable },
    evitar: { cypher: Q.evitar },
    segmentos: { cypher: Q.segmentos },
    gmvCategoria: { cypher: Q.gmvCategoria },
    busqueda: { cypher: Q.busqueda },
  });
  const { panels: drillP } = usePanels(slug, { drill: { cypher: Q.drill, params: { producto: sel } } });
  const { grafo } = useGrafo(slug);

  const ventas = firstRow(panels.ventas);
  const dev = firstRow(panels.devEvitable);

  const siguiente = panels.siguiente?.rows ?? [];
  const segRows = panels.segmentos?.rows ?? [];

  const siguienteData = siguiente.map((r) => ({
    label: str(r, "recomendacion"),
    value: num(r, "clientes_similares"),
    sub: `${fmtMoneyExact(num(r, "precio"))} · ${str(r, "categoria")}`,
    color: str(r, "recomendacion") === sel ? acc : "var(--info)",
  }));

  const segData = segRows.map((r, i) => ({
    label: str(r, "top_categoria"),
    value: num(r, "clientes"),
    color: serie(i),
  }));

  const gmvData = (panels.gmvCategoria?.rows ?? []).map((r) => ({
    label: str(r, "categoria"),
    value: num(r, "gmv"),
    color: acc,
  }));

  const explicableCols: Column[] = [
    { key: "recomendado", label: "Se recomienda" },
    { key: "complementa_a", label: "Porque complementa" },
    { key: "clientes_similares", label: "Clientes iguales", align: "right", format: fmtInt },
    { key: "marca", label: "Marca" },
  ];

  const evitarCols: Column[] = [
    { key: "producto", label: "Producto (no compatible)" },
    { key: "lo_compraron_con_la_camara", label: "Co-comprado con la Z50", align: "right", format: fmtInt },
    { key: "devoluciones_por_incompatibilidad", label: "Devoluciones", align: "right", format: fmtInt },
    { key: "costo_evitado", label: "Costo evitado", align: "right", format: (n) => fmtMoneyExact(n) },
  ];

  const busquedaCols: Column[] = [
    { key: "producto", label: "Resultado" },
    { key: "precio", label: "Precio", align: "right", format: (n) => fmtMoneyExact(n) },
    { key: "score", label: "Score híbrido", align: "right", format: (n) => n.toFixed(4) },
  ];

  const drillCols: Column[] = [
    { key: "producto", label: "También compran" },
    { key: "categoria", label: "Categoría" },
    { key: "precio", label: "Precio", align: "right", format: (n) => fmtMoneyExact(n) },
    { key: "co_compradores", label: "Co-compradores", align: "right", format: fmtInt },
  ];

  return (
    <div>
      <KpiRow>
        <KpiCard label="Productos en catálogo" value={fmtInt(num(firstRow(panels.productos), "n"))}
          loading={panels.productos?.loading} sub="5 categorías · 5 marcas, todos con embedding" />
        <KpiCard label="Clientes con historial" value={fmtInt(num(firstRow(panels.clientes), "n"))}
          tone="info" loading={panels.clientes?.loading}
          sub={`${fmtInt(num(ventas, "compras"))} compras · ${fmtMoney(num(ventas, "gmv"))} en ventas`} />
        <KpiCard label="Segmentos de comportamiento" value={fmtInt(num(firstRow(panels.segmentosNum), "segmentos"))}
          tone="rosa" loading={panels.segmentosNum?.loading}
          sub="fotografía, audio, gaming… emergen sin definirlos a mano" />
        <KpiCard label="Devoluciones evitables" value={fmtInt(num(dev, "devoluciones"))}
          tone="bad" loading={panels.devEvitable?.loading}
          sub={`${fmtMoneyExact(num(dev, "costo"))} en la batería incompatible que el motor deja de sugerir`} />
      </KpiRow>

      <DashSection eyebrow="Contexto, no coincidencia" title="La siguiente mejor oferta para Andrea">
        <DashGrid min={380}>
          <Panel title="Siguiente mejor oferta por co-compra"
            subtitle="Qué compran los dueños de la misma cámara — sin lo que Andrea ya tiene ni lo que da devoluciones. Clic para desglosar."
            cypher={Q.siguiente} accent={acc} {...flags(panels.siguiente)}>
            <RankList
              data={siguienteData}
              onClick={(_, i) => setSel(str(siguiente[i], "recomendacion"))}
              activeLabel={sel}
            />
          </Panel>

          <Panel title={`Co-compra de “${sel}”`}
            subtitle="Qué más llevan quienes compran el producto seleccionado — el vecindario de co-compra que sostiene la recomendación."
            cypher={Q.drill} accent="var(--info)" {...flags(drillP.drill)}
            emptyLabel="este producto aún no tiene co-compras">
            <DataTable rows={drillP.drill?.rows ?? []} columns={drillCols} maxHeight={320} />
          </Panel>

          <Panel title="Por qué se recomienda (explicable)" span={2}
            subtitle="Cada sugerencia con su evidencia: complementa algo que Andrea ya tiene y cuántos clientes iguales lo compraron. Nada de caja negra."
            cypher={Q.explicable} accent={acc} {...flags(panels.explicable)}>
            <DataTable rows={panels.explicable?.rows ?? []} columns={explicableCols} maxHeight={260} />
          </Panel>
        </DashGrid>
      </DashSection>

      <DashSection eyebrow="Lo que la popularidad nunca ve" title="Devoluciones evitadas y búsqueda con intención">
        <DashGrid min={360}>
          <Panel title="Incompatibilidades que cuestan devoluciones"
            subtitle="Se co-compra con la Z50, no es compatible y ya acumula devoluciones. Un recomendador por popularidad la seguiría sugiriendo; el grafo la excluye."
            cypher={Q.evitar} accent="var(--error)" {...flags(panels.evitar)}>
            <DataTable rows={panels.evitar?.rows ?? []} columns={evitarCols} maxHeight={200}
              rowTone={() => "bad"} />
            <p className="dash-note">
              La <b style={{ color: "var(--error)" }}>batería genérica BAT-X200</b> pasa el filtro de “más vendidos”,
              pero no encaja en la Z50: el grafo la retira y cuantifica el costo evitado.
            </p>
          </Panel>

          <Panel title="Búsqueda híbrida: texto + significado"
            subtitle="“mochila para llevar cámara bajo lluvia” no coincide con ningún nombre del catálogo. BM25 + vectores encuentra la mochila fotográfica impermeable."
            cypher={Q.busqueda} accent="var(--info)" {...flags(panels.busqueda)}>
            <DataTable rows={panels.busqueda?.rows ?? []} columns={busquedaCols} maxHeight={240}
              rowTone={(r) => (str(r, "producto").includes("Mochila") ? "ok" : undefined)} />
          </Panel>

          <Panel title="Segmentos por comportamiento conectado"
            subtitle="Comunidades reales en la red de co-compra (label propagation). Nombradas por su categoría dominante — nadie las definió a mano."
            cypher={Q.segmentos} accent={acc} {...flags(panels.segmentos)}>
            <DonutChart data={segData}
              centerValue={fmtInt(segData.reduce((a, d) => a + d.value, 0))}
              centerLabel="clientes" />
          </Panel>

          <Panel title="Ventas por categoría"
            subtitle="Dónde se concentra el valor del catálogo: fotografía manda, y ahí es donde el recomendador rinde."
            cypher={Q.gmvCategoria} accent={acc} {...flags(panels.gmvCategoria)}>
            <ColumnChart data={gmvData} accent={acc} format={(n) => fmtMoney(n)} labelRotate />
          </Panel>
        </DashGrid>
      </DashSection>

      <DashSection eyebrow="El fraude de la relevancia vive en las conexiones" title="Mapa de la red de co-compra">
        <DashGrid min={360}>
          <Panel title="Clientes, productos, categorías, marcas y devoluciones" span="full" accent={acc}
            subtitle="Todo el grafo en memoria: cada recomendación explicable es un camino que puedes recorrer con el ojo.">
            {grafo ? <GraphView grafo={grafo} /> : <div className="grafo-caja"><span className="grafo-caja__estado">sembrando…</span></div>}
          </Panel>
        </DashGrid>
      </DashSection>
    </div>
  );
}
