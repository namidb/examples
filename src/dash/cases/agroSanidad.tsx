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
  num,
  str,
  useGrafo,
  usePanels,
  type Column,
} from "../kit";
import type { DashProps } from "../dashProps";

const FINCA_INICIAL = "Hacienda El Guabo";

const Q = {
  totalFincas: `MATCH (f:Finca) RETURN count(f) AS n`,

  contactos: `MATCH ()-[c:CONTACTO]->() RETURN count(c) AS n`,

  panorama: `MATCH (f:Finca)
RETURN f.estado AS estado, count(*) AS fincas, sum(f.hectareas) AS hectareas
ORDER BY fincas DESC`,

  focos: `MATCH (d:Deteccion {resultado: 'positivo'})-[:EN_FINCA]->(f:Finca)
MATCH (d)-[:DE_PATOGENO]->(p:Patogeno)
RETURN d.codigo AS deteccion, f.nombre AS finca, f.zona AS zona,
       f.estado AS estado, p.nombre AS patogeno, p.peligro AS peligro,
       d.metodo AS metodo, d.fecha AS fecha
ORDER BY p.peligro, d.fecha`,

  superpropagadores: `CALL algo.betweenness({labels: ['Finca', 'Cuadrilla', 'Maquina', 'Vivero', 'FuenteAgua'],
                       edge_types: ['CONECTA', 'VECINA_DE']})
YIELD node_id, score
WITH node_id AS nn, score
MATCH (x) WHERE id(x) = id(nn)
RETURN labels(x)[0] AS tipo_nodo,
       coalesce(x.codigo, x.nombre) AS recurso,
       coalesce(x.tipo, x.estado) AS detalle,
       round(score * 100) / 100 AS betweenness
ORDER BY betweenness DESC
LIMIT 10`,

  comunidades: `CALL algo.louvain({labels: ['Finca'], edge_types: ['CONTACTO']})
YIELD node_id, community
WITH node_id AS nn, community
MATCH (f:Finca) WHERE id(f) = id(nn)
WITH community, count(*) AS fincas,
     sum(CASE WHEN f.estado = 'foco' THEN 1 ELSE 0 END) AS focos,
     sum(CASE WHEN f.estado = 'sospecha' THEN 1 ELSE 0 END) AS sospechas,
     collect(f.nombre) AS nombres
RETURN community, fincas, focos, sospechas, nombres[0..4] AS fincas_ejemplo
ORDER BY focos DESC, sospechas DESC, fincas DESC`,

  zonas: `CALL algo.wcc({labels: ['Finca'], edge_types: ['CONTACTO']})
YIELD node_id, component
WITH node_id AS nn, component
MATCH (f:Finca) WHERE id(f) = id(nn)
WITH component, count(*) AS fincas,
     sum(CASE WHEN f.estado IN ['foco', 'sospecha'] THEN 1 ELSE 0 END) AS afectadas,
     collect(f.nombre) AS nombres
RETURN component, fincas, afectadas, nombres[0..5] AS fincas_ejemplo
ORDER BY afectadas DESC, fincas DESC`,

  cuadrillas: `MATCH (cu:Cuadrilla)-[:TRABAJO_EN]->(fc:Finca)
WHERE fc.estado IN ['foco', 'sospecha']
WITH cu, count(DISTINCT fc) AS contaminadas
MATCH (cu)-[:TRABAJO_EN]->(fs:Finca)
WITH cu, contaminadas,
     count(DISTINCT CASE WHEN fs.estado IN ['sano', 'vigilancia'] THEN fs END) AS sanas
RETURN cu.codigo AS cuadrilla, cu.tipo AS tipo, cu.bioseguridad AS bioseguridad,
       contaminadas, sanas
ORDER BY contaminadas DESC, sanas DESC`,

  cadena: `MATCH path = (foco:Finca {nombre: 'Hacienda El Guabo'})-[:CONTACTO*1..2]->(otra:Finca)
WHERE otra.nombre <> 'Hacienda El Guabo'
WITH otra, min(length(path)) AS saltos,
     collect(DISTINCT relationships(path)[0].via) AS vias
RETURN otra.nombre AS finca, otra.estado AS estado, saltos,
       vias AS vias_primer_salto
ORDER BY saltos, estado, finca`,

  perimetro: `MATCH (foco:Finca {estado: 'foco'})-[v:VECINA_DE]->(vec:Finca)
RETURN foco.nombre AS foco, vec.nombre AS vecina,
       vec.estado AS estado_vecina, v.km AS km
ORDER BY v.km`,

  recurso: `MATCH (foco:Finca {estado: 'foco'})<-[e]-(r)
WHERE type(e) IN ['TRABAJO_EN', 'OPERO_EN', 'ABASTECIO', 'RIEGA']
MATCH (r)-[e2]->(otra:Finca)
WHERE type(e2) IN ['TRABAJO_EN', 'OPERO_EN', 'ABASTECIO', 'RIEGA']
RETURN labels(r)[0] AS tipo_recurso,
       coalesce(r.codigo, r.nombre) AS recurso,
       type(e) AS via,
       count(DISTINCT otra) AS fincas_alcanzadas
ORDER BY fincas_alcanzadas DESC, recurso`,

  fincas: `MATCH (f:Finca)
RETURN f.nombre AS finca, f.zona AS zona, f.estado AS estado, f.hectareas AS hectareas
ORDER BY CASE f.estado WHEN 'foco' THEN 0 WHEN 'sospecha' THEN 1
                       WHEN 'vigilancia' THEN 2 ELSE 3 END, f.nombre`,

  // ── drill (con $finca) ──────────────────────────────────────────────
  fichaRecursos: `MATCH (r)-[e]->(f:Finca {nombre: $finca})
WHERE type(e) IN ['TRABAJO_EN', 'OPERO_EN', 'ABASTECIO', 'RIEGA']
RETURN labels(r)[0] AS tipo, coalesce(r.codigo, r.nombre) AS recurso,
       type(e) AS via, coalesce(r.bioseguridad, r.tipo, '') AS detalle
ORDER BY via, recurso`,

  fichaDetecciones: `MATCH (d:Deteccion)-[:EN_FINCA]->(f:Finca {nombre: $finca})
MATCH (d)-[:DE_PATOGENO]->(p:Patogeno)
RETURN d.codigo AS deteccion, p.nombre AS patogeno, p.peligro AS peligro,
       d.resultado AS resultado, d.metodo AS metodo, d.fecha AS fecha
ORDER BY d.fecha`,

  fichaVecinos: `MATCH (f:Finca {nombre: $finca})-[v:VECINA_DE]->(vec:Finca)
RETURN vec.nombre AS vecina, vec.estado AS estado, v.km AS km
ORDER BY v.km`,
};

const ESTADO_LABEL: Record<string, string> = {
  foco: "Foco confirmado",
  sospecha: "En sospecha",
  vigilancia: "En vigilancia",
  sano: "Sano",
};

type Tone = "ok" | "warn" | "bad" | "info" | "muted";

function estadoTone(e: string): Tone {
  if (e === "foco") return "bad";
  if (e === "sospecha") return "warn";
  if (e === "vigilancia") return "info";
  return "ok";
}

function estadoTexto(e: string): string {
  return ESTADO_LABEL[e] ?? e;
}

const VIA_LABEL: Record<string, string> = {
  cuadrilla: "cuadrilla",
  maquina: "maquinaria",
  vivero: "vivero",
  agua: "agua de riego",
  vecindad: "vecindad",
  TRABAJO_EN: "cuadrilla",
  OPERO_EN: "maquinaria",
  ABASTECIO: "vivero",
  RIEGA: "agua de riego",
};

export default function AgroSanidad({ slug }: DashProps) {
  const acc = accent(slug);
  const [sel, setSel] = useState(FINCA_INICIAL);

  const { panels } = usePanels(slug, {
    totalFincas: { cypher: Q.totalFincas },
    contactos: { cypher: Q.contactos },
    panorama: { cypher: Q.panorama },
    focos: { cypher: Q.focos },
    superpropagadores: { cypher: Q.superpropagadores },
    comunidades: { cypher: Q.comunidades },
    zonas: { cypher: Q.zonas },
    cuadrillas: { cypher: Q.cuadrillas },
    cadena: { cypher: Q.cadena },
    perimetro: { cypher: Q.perimetro },
    recurso: { cypher: Q.recurso },
    fincas: { cypher: Q.fincas },
  });
  const { panels: drillP } = usePanels(slug, {
    recursos: { cypher: Q.fichaRecursos, params: { finca: sel } },
    detecciones: { cypher: Q.fichaDetecciones, params: { finca: sel } },
    vecinos: { cypher: Q.fichaVecinos, params: { finca: sel } },
  });
  const { grafo } = useGrafo(slug);

  const panorama = panels.panorama?.rows ?? [];
  const nFocos = num(panorama.find((r) => str(r, "estado") === "foco"), "fincas");
  const nSospecha = num(panorama.find((r) => str(r, "estado") === "sospecha"), "fincas");

  const superRows = panels.superpropagadores?.rows ?? [];
  const superTop = superRows[0];
  const zonas = panels.zonas?.rows ?? [];

  // RankList de betweenness: la cola de cuarentena.
  const superData = superRows.map((r) => {
    const rec = str(r, "recurso");
    const esFoco = str(r, "tipo_nodo") === "Finca" && str(r, "detalle") === "foco";
    return {
      label: rec,
      value: num(r, "betweenness"),
      sub: `${str(r, "tipo_nodo")} · ${str(r, "detalle")}`,
      color: rec === "CU-07" ? "var(--error)" : esFoco ? "var(--warn)" : acc,
    };
  });

  // Donut de comunidades louvain: la del foco se resalta.
  const comunidadesData = (panels.comunidades?.rows ?? []).map((r) => {
    const ej = arr(r, "fincas_ejemplo").map(String);
    const focos = num(r, "focos");
    const sospechas = num(r, "sospechas");
    const nombre = focos > 0 ? "Comunidad del foco"
      : sospechas > 0 ? "Comunidad en sospecha"
      : `Comunidad ${str(r, "community")}`;
    return {
      label: `${nombre} · ${ej[0] ?? ""}`,
      value: num(r, "fincas"),
      color: focos > 0 ? "var(--error)" : sospechas > 0 ? "var(--warn)" : acc,
    };
  });

  const fincas = panels.fincas?.rows ?? [];
  const selIdx = fincas.findIndex((r) => str(r, "finca") === sel);
  const selRow = selIdx >= 0 ? fincas[selIdx] : undefined;

  const focosCols: Column[] = [
    { key: "finca", label: "Finca" },
    { key: "zona", label: "Zona" },
    { key: "patogeno", label: "Patógeno", render: (v) => (
      <Chip tone={String(v) === "Foc R4T" ? "bad" : "muted"}>{String(v)}</Chip>
    ) },
    { key: "peligro", label: "Peligro", render: (v) => (
      <Chip tone={String(v) === "cuarentenario" ? "bad" : String(v) === "alto" ? "warn" : "muted"}>{String(v)}</Chip>
    ) },
    { key: "metodo", label: "Método", mono: true },
    { key: "fecha", label: "Fecha", mono: true },
  ];

  const cuadrillasCols: Column[] = [
    { key: "cuadrilla", label: "Cuadrilla", mono: true },
    { key: "tipo", label: "Tipo" },
    { key: "bioseguridad", label: "Bioseguridad", render: (v) => (
      <Chip tone={String(v) === "nula" ? "bad" : String(v) === "parcial" ? "warn" : "ok"}>{String(v)}</Chip>
    ) },
    { key: "contaminadas", label: "Foco/sospecha", align: "right", format: fmtInt },
    { key: "sanas", label: "Aún sanas", align: "right", format: fmtInt },
  ];

  const cadenaCols: Column[] = [
    { key: "finca", label: "Finca alcanzada" },
    { key: "estado", label: "Estado", render: (v) => (
      <Chip tone={estadoTone(String(v))}>{estadoTexto(String(v))}</Chip>
    ) },
    { key: "saltos", label: "Saltos", align: "right", format: fmtInt },
    { key: "vias_primer_salto", label: "Vía", render: (v) => (
      <span style={{ display: "flex", flexWrap: "wrap", gap: "0.3rem" }}>
        {(v as unknown[]).map((c, i) => (
          <Chip key={i} tone={String(c) === "cuadrilla" ? "bad" : "muted"}>{VIA_LABEL[String(c)] ?? String(c)}</Chip>
        ))}
      </span>
    ) },
  ];

  const perimetroCols: Column[] = [
    { key: "vecina", label: "Finca vecina" },
    { key: "estado_vecina", label: "Estado", render: (v) => (
      <Chip tone={estadoTone(String(v))}>{estadoTexto(String(v))}</Chip>
    ) },
    { key: "km", label: "Distancia", align: "right", format: (n) => `${n.toFixed(1)} km` },
  ];

  const zonasCols: Column[] = [
    { key: "component", label: "Zona", mono: true, render: (v) => `Z-${v}` },
    { key: "fincas", label: "Fincas", align: "right", format: fmtInt },
    { key: "afectadas", label: "Afectadas", align: "right", format: fmtInt },
    { key: "fincas_ejemplo", label: "Ejemplo", render: (v) => (
      <span style={{ fontSize: "0.78rem", color: "var(--hueso)" }}>{(v as unknown[]).map(String).join(", ")}</span>
    ) },
  ];

  const fincasCols: Column[] = [
    { key: "finca", label: "Finca" },
    { key: "zona", label: "Zona" },
    { key: "estado", label: "Estado", render: (v) => (
      <Chip tone={estadoTone(String(v))}>{estadoTexto(String(v))}</Chip>
    ) },
    { key: "hectareas", label: "Ha", align: "right", format: fmtInt },
  ];

  const recursosCols: Column[] = [
    { key: "recurso", label: "Recurso", mono: true },
    { key: "tipo", label: "Tipo" },
    { key: "via", label: "Vía de contacto", render: (v) => VIA_LABEL[String(v)] ?? String(v) },
    { key: "detalle", label: "Detalle", render: (v) => (
      String(v) === "nula" ? <Chip tone="bad">bioseguridad nula</Chip> : String(v)
    ) },
  ];

  const deteccionesCols: Column[] = [
    { key: "deteccion", label: "Análisis", mono: true },
    { key: "patogeno", label: "Patógeno", render: (v) => (
      <Chip tone={String(v) === "Foc R4T" ? "bad" : "muted"}>{String(v)}</Chip>
    ) },
    { key: "resultado", label: "Resultado", render: (v) => (
      <Chip tone={String(v) === "positivo" ? "bad" : "ok"}>{String(v)}</Chip>
    ) },
    { key: "metodo", label: "Método", mono: true },
    { key: "fecha", label: "Fecha", mono: true },
  ];

  return (
    <div>
      <KpiRow>
        <KpiCard label="Fincas monitoreadas" value={fmtInt(num(firstRow(panels.totalFincas), "n"))}
          loading={panels.totalFincas?.loading} tone="info"
          sub="banano en una sola red de contacto de transmisión" />
        <KpiCard label="Focos confirmados" value={fmtInt(nFocos)}
          loading={panels.panorama?.loading} tone="bad"
          sub="Foc R4T (cuarentenario) por PCR en Hacienda El Guabo" />
        <KpiCard label="Fincas en sospecha" value={fmtInt(nSospecha)}
          loading={panels.panorama?.loading} tone="warn"
          sub="antes sanas: la cuadrilla CU-07 pasó por todas" />
        <KpiCard label="Súper-propagador" value={superTop ? str(superTop, "recurso") : "—"}
          loading={panels.superpropagadores?.loading} tone="bad"
          sub="mayor betweenness del grafo: el objetivo #1 de cuarentena" />
        <KpiCard label="Zonas de contención" value={fmtInt(zonas.length)}
          loading={panels.zonas?.loading} tone="ok"
          sub="componentes desconectados: sólo una tiene el brote" />
      </KpiRow>

      <DashSection eyebrow="del laboratorio al mapa" title="El brote en curso">
        <DashGrid min={360}>
          <Panel title="Focos y detecciones confirmadas"
            subtitle="Cada análisis positivo con su patógeno y peligro. El Foc R4T no tiene cura: cada positivo es una decisión de cuarentena."
            cypher={Q.focos} accent="var(--error)" {...flags(panels.focos)}>
            <DataTable rows={panels.focos?.rows ?? []} columns={focosCols} maxHeight={300}
              rowTone={(r) => (str(r, "patogeno") === "Foc R4T" ? "bad" : undefined)} />
          </Panel>

          <Panel title="Súper-propagadores: la cola de cuarentena"
            subtitle="Betweenness sobre la red de contacto: el nodo PUENTE por el que pasan más rutas de contagio. Aíslas eso, no la zona entera."
            cypher={Q.superpropagadores} accent="var(--error)" {...flags(panels.superpropagadores)}>
            <RankList data={superData} format={(n) => n.toFixed(0)} accent={acc} />
            <p className="dash-note">
              La cuadrilla <b style={{ color: "var(--error)" }}>CU-07</b> encabeza — por encima incluso del
              foco. El <b>Vivero San Carlos</b> tiene el mismo grado (5 fincas) pero betweenness 30× menor:
              <b> grado ≠ riesgo</b>, lo que importa es ser puente hacia el foco.
            </p>
          </Panel>

          <Panel title="Comunidades de contagio (louvain)"
            subtitle="Louvain agrupa las fincas por cómo se conectan de verdad: revela la comunidad del foco separada del resto."
            cypher={Q.comunidades} accent={acc} {...flags(panels.comunidades)}>
            <DonutChart data={comunidadesData}
              centerValue={fmtInt(comunidadesData.length)} centerLabel="comunidades" />
          </Panel>
        </DashGrid>
      </DashSection>

      <DashSection eyebrow="cortar la transmisión" title="El puente que hay que aislar">
        <DashGrid min={360}>
          <Panel title="Cuadrillas como vector de transmisión"
            subtitle="Cuadrillas que tocaron una finca foco/sospecha y cuántas otras visitaron: el riesgo de que muevan el hongo entre fincas."
            cypher={Q.cuadrillas} accent="var(--error)" {...flags(panels.cuadrillas)}>
            <DataTable rows={panels.cuadrillas?.rows ?? []} columns={cuadrillasCols} maxHeight={240}
              rowTone={(r) => (str(r, "cuadrilla") === "CU-07" ? "bad" : undefined)} />
          </Panel>

          <Panel title="Cadena de contagio desde el foco"
            subtitle="Desde Hacienda El Guabo, qué fincas alcanza la red en 1 o 2 saltos y por qué vía. Las 4 sospechas están a un solo salto por CU-07."
            cypher={Q.cadena} accent="var(--warn)" {...flags(panels.cadena)}>
            <DataTable rows={panels.cadena?.rows ?? []} columns={cadenaCols} maxHeight={280}
              rowTone={(r) => (str(r, "estado") === "sospecha" ? "warn" : undefined)} />
          </Panel>

          <Panel title="Perímetro de vecindad del foco"
            subtitle="Fincas físicamente vecinas del foco: el anillo donde el hongo salta por escorrentía o maquinaria."
            cypher={Q.perimetro} accent={acc} {...flags(panels.perimetro)}>
            <DataTable rows={panels.perimetro?.rows ?? []} columns={perimetroCols} maxHeight={200} />
          </Panel>

          <Panel title="Recursos que tocan el foco"
            subtitle="Cada recurso que estuvo en el foco y a cuántas fincas más llega: su alcance de propagación. CU-07 lidera."
            cypher={Q.recurso} accent="var(--error)" {...flags(panels.recurso)}>
            <RankList
              data={(panels.recurso?.rows ?? []).map((r) => ({
                label: str(r, "recurso"),
                value: num(r, "fincas_alcanzadas"),
                sub: `${str(r, "tipo_recurso")} · ${VIA_LABEL[str(r, "via")] ?? str(r, "via")}`,
                color: str(r, "recurso") === "CU-07" ? "var(--error)" : acc,
              }))}
              format={(n) => `${n} finca${n === 1 ? "" : "s"}`}
              accent={acc}
            />
          </Panel>
        </DashGrid>
      </DashSection>

      <DashSection eyebrow="contención selectiva" title="Zonas de contención, ficha por finca y mapa de la red">
        <DashGrid min={360}>
          <Panel title="Zonas de contención (componentes / wcc)"
            subtitle="WCC parte la red en zonas desconectadas. Sólo la zona del foco tiene fincas afectadas; las demás quedan naturalmente aisladas."
            cypher={Q.zonas} accent={acc} {...flags(panels.zonas)}>
            <DataTable rows={zonas} columns={zonasCols} maxHeight={220}
              rowTone={(r) => (num(r, "afectadas") > 0 ? "bad" : undefined)} />
          </Panel>

          <Panel title="Fincas monitoreadas"
            subtitle="Clic en una finca para abrir su ficha: recursos que la tocaron, detecciones y vecinos."
            cypher={Q.fincas} accent={acc} {...flags(panels.fincas)}>
            <DataTable rows={fincas} columns={fincasCols} maxHeight={320}
              onRowClick={(r) => setSel(str(r, "finca"))}
              activeIndex={selIdx >= 0 ? selIdx : undefined}
              rowTone={(r) => {
                const e = str(r, "estado");
                return e === "foco" ? "bad" : e === "sospecha" ? "warn" : undefined;
              }} />
          </Panel>

          <Panel title={`Ficha de finca — ${sel}`}
            subtitle={selRow
              ? `${str(selRow, "zona")} · ${fmtInt(num(selRow, "hectareas"))} ha · ${estadoTexto(str(selRow, "estado"))} — cómo pudo llegar (o salir) el hongo`
              : "Recursos, detecciones y vecinos de la finca seleccionada"}
            cypher={Q.fichaRecursos}
            accent={selRow && str(selRow, "estado") === "foco" ? "var(--error)" : acc}
            {...flags(drillP.recursos)}
            emptyLabel="esta finca no tiene recursos registrados">
            <p className="dash-note" style={{ marginTop: 0 }}>Recursos que la tocaron</p>
            <DataTable rows={drillP.recursos?.rows ?? []} columns={recursosCols} maxHeight={180}
              rowTone={(r) => (str(r, "detalle") === "nula" ? "bad" : undefined)} />
            <p className="dash-note">Detecciones de laboratorio</p>
            <DataTable rows={drillP.detecciones?.rows ?? []} columns={deteccionesCols} maxHeight={180}
              rowTone={(r) => (str(r, "resultado") === "positivo" ? "bad" : undefined)} />
            <p className="dash-note">
              Vecinos:{" "}
              {(drillP.vecinos?.rows ?? []).length === 0
                ? <span style={{ color: "var(--hueso)" }}>sin vecinos registrados</span>
                : (
                  <span style={{ display: "inline-flex", flexWrap: "wrap", gap: "0.3rem" }}>
                    {(drillP.vecinos?.rows ?? []).map((r, i) => (
                      <Chip key={i} tone={estadoTone(str(r, "estado"))}>
                        {str(r, "vecina")} · {num(r, "km").toFixed(1)} km
                      </Chip>
                    ))}
                  </span>
                )}
            </p>
          </Panel>

          <Panel title="Mapa de la red de contagio" span={2} accent={acc}
            subtitle="Fincas, cuadrillas, maquinaria, viveros y agua — el brote vive en las conexiones. El puente correcto es un nodo, no una zona.">
            {grafo ? <GraphView grafo={grafo} /> : <div className="grafo-caja"><span className="grafo-caja__estado">sembrando…</span></div>}
          </Panel>
        </DashGrid>
      </DashSection>
    </div>
  );
}
