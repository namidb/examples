import { useState } from "react";

import {
  BarChart,
  Chip,
  ColumnChart,
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
  fmtMs,
  fmtPct,
  num,
  str,
  useGrafo,
  usePanels,
  type Column,
} from "../kit";
import type { DashProps } from "../dashProps";

const PARCELA_INICIAL = "PC-018";
const CONSULTA_INICIAL = "clorosis suelo alcalino";
const SUGERENCIAS = ["clorosis suelo alcalino", "sigatoka banano", "riego goteo", "poda cacao monilia"];

const Q = {
  panorama: `MATCH (p:Parcela)
RETURN count(p) AS parcelas,
       round(avg(p.rend_potencial - p.rend_actual) * 100) / 100 AS brecha_promedio_tha,
       round(sum((p.rend_potencial - p.rend_actual) * p.hectareas) * 10) / 10 AS ton_recuperables,
       sum(CASE WHEN p.rend_actual < 0.6 * p.rend_potencial THEN 1 ELSE 0 END) AS bajo_60_pct`,

  oportunidad: `MATCH (p:Parcela)
RETURN p.codigo AS parcela, p.cultivo AS cultivo, p.zona AS zona,
       p.manejo AS manejo, p.rend_actual AS actual_tha,
       p.rend_potencial AS potencial_tha,
       round((p.rend_potencial - p.rend_actual) * 100) / 100 AS brecha_tha,
       round((p.rend_potencial - p.rend_actual) * p.hectareas * 10) / 10 AS ton_recuperables
ORDER BY ton_recuperables DESC
LIMIT 12`,

  tramos: `MATCH (p:Parcela)
WITH CASE WHEN p.rend_actual < 0.5 * p.rend_potencial THEN 'bajo 50 %'
          WHEN p.rend_actual < 0.6 * p.rend_potencial THEN '50-60 %'
          WHEN p.rend_actual < 0.8 * p.rend_potencial THEN '60-80 %'
          ELSE 'sobre 80 %' END AS tramo
RETURN tramo, count(*) AS parcelas`,

  cooperativa: `MATCH (p:Parcela)-[:PERTENECE_A]->(c:Cooperativa)
RETURN c.nombre AS cooperativa, count(p) AS parcelas,
       round(sum((p.rend_potencial - p.rend_actual) * p.hectareas) * 10) / 10 AS ton_recuperables
ORDER BY ton_recuperables DESC`,

  impacto: `MATCH (p:Parcela {cultivo: 'cacao'})-[:APLICA]->(pr:Practica {nombre: 'poda-sanitaria'})
WITH collect(DISTINCT p.codigo) AS con_poda
MATCH (q:Parcela {cultivo: 'cacao'})
WITH q, CASE WHEN q.codigo IN con_poda
             THEN 'con poda-sanitaria' ELSE 'sin poda-sanitaria' END AS grupo
RETURN grupo, count(q) AS parcelas,
       round(avg(q.rend_actual) * 100) / 100 AS rend_promedio_tha
ORDER BY rend_promedio_tha DESC`,

  variedades: `MATCH (p:Parcela)-[:CULTIVA]->(v:Variedad)
WITH p.cultivo AS cultivo, p.zona AS zona, v.nombre AS variedad,
     count(p) AS parcelas, round(avg(p.rend_actual) * 100) / 100 AS rend_promedio_tha
RETURN cultivo, zona, variedad, parcelas, rend_promedio_tha
ORDER BY cultivo, rend_promedio_tha DESC`,

  transferencia: `MATCH (s:Parcela)-[g:GEMELA]->(t:Parcela)
WHERE g.sim >= 0.9
  AND s.rend_actual < 0.6 * s.rend_potencial
  AND t.rend_actual > 0.8 * t.rend_potencial
MATCH (t)-[:CULTIVA]->(v:Variedad)
RETURN s.codigo AS parcela, s.cultivo AS cultivo, s.rend_actual AS actual_tha,
       t.codigo AS gemela, t.rend_actual AS gemela_tha, v.nombre AS variedad_probada,
       round((t.rend_actual - s.rend_actual) / s.rend_actual * 100) AS uplift_pct,
       round((t.rend_actual - s.rend_actual) * s.hectareas * 10) / 10 AS ton_en_juego
ORDER BY uplift_pct DESC
LIMIT 15`,

  tecnicos: `MATCH (t:Tecnico)-[:ATIENDE]->(p:Parcela)
RETURN t.nombre AS tecnico, t.especialidad AS especialidad,
       count(p) AS parcelas,
       round(sum((p.rend_potencial - p.rend_actual) * p.hectareas) * 10) / 10 AS ton_recuperables
ORDER BY ton_recuperables DESC`,

  perfil: `MATCH (p:Parcela {codigo: $sel})
RETURN p.codigo AS codigo, p.cultivo AS cultivo, p.zona AS zona, p.suelo AS suelo,
       p.clima AS clima, p.altitud AS altitud, p.manejo AS manejo,
       p.hectareas AS hectareas, p.rend_actual AS actual, p.rend_potencial AS potencial,
       p.perfil AS perfil, p.emb AS emb`,

  vivo: `CALL search.vector({label: 'Parcela', property: 'emb', query: $vec, k: 7})
YIELD node, score
WITH node, score
WHERE node.codigo <> $sel
RETURN node.codigo AS parcela, node.zona AS zona, node.manejo AS manejo,
       node.rend_actual AS rend_actual, node.rend_potencial AS rend_potencial,
       round(score * 1000) / 1000 AS similitud
ORDER BY similitud DESC
LIMIT 6`,

  reco: `MATCH (s:Parcela {codigo: $sel})-[g:GEMELA]->(t:Parcela)
WHERE t.rend_actual > s.rend_actual
MATCH (t)-[:CULTIVA]->(v:Variedad)
OPTIONAL MATCH (t)-[:APLICA]->(pr:Practica)
WITH s, t, g, v, collect(DISTINCT pr.nombre) AS practicas
RETURN t.codigo AS gemela, round(g.sim * 1000) / 1000 AS similitud, t.manejo AS manejo,
       v.nombre AS variedad, practicas,
       round((t.rend_actual - s.rend_actual) * 100) / 100 AS uplift_tha
ORDER BY uplift_tha DESC
LIMIT 3`,

  bm25: `CALL search.bm25({label: 'Ficha', text_property: 'texto', query: $q, k: 5})
YIELD node, score
RETURN node.codigo AS ficha, node.titulo AS titulo, node.tema AS tema,
       node.cultivo AS cultivo, round(score * 1000) / 1000 AS score
ORDER BY score DESC`,
};

const TRAMO_ORDEN = ["bajo 50 %", "50-60 %", "60-80 %", "sobre 80 %"];

const MANEJO_TONE: Record<string, "ok" | "warn" | "info"> = {
  tecnificado: "ok",
  organico: "info",
  convencional: "warn",
};

function manejoChip(v: unknown) {
  const m = String(v);
  return <Chip tone={MANEJO_TONE[m] ?? "muted"}>{m}</Chip>;
}

export default function AgroRendimiento({ slug }: DashProps) {
  const acc = accent(slug);
  const [sel, setSel] = useState(PARCELA_INICIAL);
  const [texto, setTexto] = useState(CONSULTA_INICIAL);
  const [consulta, setConsulta] = useState(CONSULTA_INICIAL);

  const { panels } = usePanels(slug, {
    panorama: { cypher: Q.panorama },
    oportunidad: { cypher: Q.oportunidad },
    tramos: { cypher: Q.tramos },
    cooperativa: { cypher: Q.cooperativa },
    impacto: { cypher: Q.impacto },
    variedades: { cypher: Q.variedades },
    transferencia: { cypher: Q.transferencia },
    tecnicos: { cypher: Q.tecnicos },
  });

  // Drill de la parcela seleccionada: perfil (con su vector) + recomendación.
  const { panels: drillP } = usePanels(slug, {
    perfil: { cypher: Q.perfil, params: { sel } },
    reco: { cypher: Q.reco, params: { sel } },
  });

  // Cadena vectorial: cuando llega el emb de la parcela, se dispara
  // search.vector con ese vector como query — búsqueda vectorial REAL en vivo.
  const perfilRow = firstRow(drillP.perfil);
  const emb = perfilRow ? (arr(perfilRow, "emb") as number[]) : [];
  const { panels: vivoP } = usePanels(
    slug,
    emb.length ? { vivo: { cypher: Q.vivo, params: { vec: emb, sel } } } : {},
  );

  // Búsqueda BM25 de fichas técnicas (texto libre del usuario).
  const { panels: fichasP } = usePanels(slug, {
    bm25: { cypher: Q.bm25, params: { q: consulta } },
  });
  const { grafo } = useGrafo(slug);

  const pano = firstRow(panels.panorama);
  const nParcelas = num(pano, "parcelas");
  const bajo60 = num(pano, "bajo_60_pct");

  const tramosData = TRAMO_ORDEN.map((tramo) => {
    const row = panels.tramos?.rows.find((r) => str(r, "tramo") === tramo);
    return {
      label: tramo,
      value: row ? num(row, "parcelas") : 0,
      color: tramo === "bajo 50 %" ? "var(--error)" : tramo === "50-60 %" ? "#ffb020" : acc,
    };
  });

  const coopData = (panels.cooperativa?.rows ?? []).map((r) => ({
    label: str(r, "cooperativa"),
    value: num(r, "ton_recuperables"),
    sub: `${num(r, "parcelas")} parcelas`,
  }));

  const impactoData = (panels.impacto?.rows ?? []).map((r) => ({
    label: str(r, "grupo"),
    value: num(r, "rend_promedio_tha"),
    sub: `${num(r, "parcelas")} parcelas de cacao`,
    color: str(r, "grupo").startsWith("con") ? "var(--ok)" : "var(--error)",
  }));

  const oportunidad = panels.oportunidad?.rows ?? [];
  const selIdx = oportunidad.findIndex((r) => str(r, "parcela") === sel);
  const vivoRows = vivoP.vivo?.rows ?? [];
  const recoRows = drillP.reco?.rows ?? [];
  const mejorReco = recoRows[0];
  const fichas = fichasP.bm25?.rows ?? [];
  const mejorScore = fichas.length ? num(fichas[0], "score") : 0;

  const fmtTha = (n: number) => n.toFixed(2);

  const oportunidadCols: Column[] = [
    { key: "parcela", label: "Parcela", mono: true },
    { key: "cultivo", label: "Cultivo" },
    { key: "manejo", label: "Manejo", render: manejoChip },
    { key: "actual_tha", label: "Actual t/ha", align: "right", format: fmtTha },
    { key: "potencial_tha", label: "Potencial t/ha", align: "right", format: fmtTha },
    { key: "ton_recuperables", label: "Ton recuperables", align: "right", format: (n) => n.toFixed(1) },
  ];

  const vivoCols: Column[] = [
    { key: "parcela", label: "Parcela", mono: true },
    { key: "zona", label: "Zona" },
    { key: "manejo", label: "Manejo", render: manejoChip },
    { key: "rend_actual", label: "Rinde t/ha", align: "right", format: fmtTha },
    { key: "similitud", label: "Similitud", align: "right", format: (n) => n.toFixed(3) },
  ];

  const recoCols: Column[] = [
    { key: "gemela", label: "Gemela", mono: true },
    { key: "variedad", label: "Variedad" },
    {
      key: "practicas",
      label: "Prácticas que aplica",
      render: (v) => (
        <span style={{ display: "flex", flexWrap: "wrap", gap: "0.3rem" }}>
          {(v as unknown[]).length
            ? (v as unknown[]).map((p, i) => <Chip key={i} tone="ok">{String(p)}</Chip>)
            : <Chip tone="muted">ninguna</Chip>}
        </span>
      ),
    },
    { key: "similitud", label: "Similitud", align: "right", format: (n) => n.toFixed(3) },
    { key: "uplift_tha", label: "Uplift t/ha", align: "right", format: (n) => `+${n.toFixed(2)}` },
  ];

  const transferCols: Column[] = [
    { key: "parcela", label: "Parcela crítica", mono: true },
    { key: "cultivo", label: "Cultivo" },
    { key: "actual_tha", label: "Rinde", align: "right", format: fmtTha },
    { key: "gemela", label: "Gemela probada", mono: true },
    { key: "gemela_tha", label: "Rinde gemela", align: "right", format: fmtTha },
    { key: "variedad_probada", label: "Variedad" },
    { key: "uplift_pct", label: "Uplift", align: "right", format: (n) => `+${n.toFixed(0)} %` },
    { key: "ton_en_juego", label: "Ton en juego", align: "right", format: (n) => n.toFixed(1) },
  ];

  const tecnicoCols: Column[] = [
    { key: "tecnico", label: "Técnico" },
    { key: "especialidad", label: "Especialidad" },
    { key: "parcelas", label: "Parcelas", align: "right", format: fmtInt },
    { key: "ton_recuperables", label: "Ton recuperables", align: "right", format: (n) => n.toFixed(1) },
  ];

  const variedadCols: Column[] = [
    { key: "cultivo", label: "Cultivo" },
    { key: "zona", label: "Zona" },
    { key: "variedad", label: "Variedad" },
    { key: "parcelas", label: "Parcelas", align: "right", format: fmtInt },
    { key: "rend_promedio_tha", label: "Rinde prom. t/ha", align: "right", format: fmtTha },
  ];

  const fichaCols: Column[] = [
    { key: "ficha", label: "Ficha", mono: true },
    { key: "titulo", label: "Título" },
    { key: "tema", label: "Tema", render: (v) => <Chip tone="muted">{String(v)}</Chip> },
    { key: "cultivo", label: "Cultivo" },
    { key: "score", label: "Score BM25", align: "right", format: (n) => n.toFixed(3) },
  ];

  return (
    <div>
      <KpiRow>
        <KpiCard label="Parcelas monitoreadas" value={fmtInt(nParcelas)}
          loading={panels.panorama?.loading} tone="info"
          sub="cada una con su perfil agronómico vectorizado" />
        <KpiCard label="Brecha promedio" value={`${num(pano, "brecha_promedio_tha").toFixed(2)} t/ha`}
          loading={panels.panorama?.loading} tone="warn"
          sub="rendimiento actual vs potencial agronómico" />
        <KpiCard label="Toneladas recuperables" value={`${fmtInt(num(pano, "ton_recuperables"))} t`}
          loading={panels.panorama?.loading} tone="bad"
          sub="lo que la red deja de cosechar cada campaña" />
        <KpiCard label="Bajo el 60 % del potencial" value={fmtPct(nParcelas ? (bajo60 / nParcelas) * 100 : 0)}
          loading={panels.panorama?.loading} tone="warn"
          sub={`${fmtInt(bajo60)} parcelas críticas en cola de asistencia`} />
        <KpiCard label="Gemelas encontradas en" value={vivoP.vivo ? fmtMs(vivoP.vivo.ms) : "—"}
          loading={vivoP.vivo?.loading ?? true} tone="ok"
          sub="search.vector sobre el perfil, en vivo desde el navegador" />
      </KpiRow>

      <DashSection eyebrow="dónde están las toneladas perdidas" title="La brecha de rendimiento">
        <DashGrid min={360}>
          <Panel title="Cola de prioridad por toneladas recuperables" span={2}
            subtitle="(potencial − actual) × hectáreas: la asistencia técnica se asigna por toneladas, no por visitas. Clic en una parcela para buscar su gemela."
            cypher={Q.oportunidad} accent={acc} {...flags(panels.oportunidad)}>
            <DataTable rows={oportunidad} columns={oportunidadCols} maxHeight={320}
              onRowClick={(r) => setSel(str(r, "parcela"))}
              activeIndex={selIdx >= 0 ? selIdx : undefined}
              rowTone={(r) => (num(r, "actual_tha") < 0.6 * num(r, "potencial_tha") ? "warn" : undefined)} />
          </Panel>

          <Panel title="Parcelas por % de su potencial"
            subtitle="Casi la mitad de la red opera por debajo del 60 % de lo que su suelo y clima permiten."
            cypher={Q.tramos} accent="var(--error)" {...flags(panels.tramos)}>
            <ColumnChart data={tramosData} accent={acc} />
          </Panel>

          <Panel title="Toneladas recuperables por cooperativa"
            subtitle="Dónde concentrar el programa: cada cooperativa valorada por lo que dejaría de perder."
            cypher={Q.cooperativa} accent={acc} {...flags(panels.cooperativa)}>
            <RankList data={coopData} format={(n) => `${fmtInt(n)} t`} accent={acc} />
          </Panel>
        </DashGrid>
      </DashSection>

      <DashSection eyebrow="búsqueda vectorial en vivo (DiskANN)" title="La parcela gemela">
        <DashGrid min={340}>
          <Panel title={`Perfil agronómico — ${sel}`}
            subtitle="El perfil (cultivo, suelo, clima, altitud, zona, manejo) se vectoriza: ese vector es la consulta."
            cypher={Q.perfil} accent={acc} {...flags(drillP.perfil)}>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "0.35rem", marginBottom: "0.9rem" }}>
              <Chip tone="info">{str(perfilRow, "cultivo")}</Chip>
              <Chip tone="muted">suelo {str(perfilRow, "suelo")}</Chip>
              <Chip tone="muted">clima {str(perfilRow, "clima")}</Chip>
              <Chip tone="muted">altitud {str(perfilRow, "altitud")}</Chip>
              <Chip tone="muted">{str(perfilRow, "zona")}</Chip>
              {manejoChip(str(perfilRow, "manejo"))}
            </div>
            <Gauge value={num(perfilRow, "actual")} max={num(perfilRow, "potencial") || 1}
              label={`de ${num(perfilRow, "potencial").toFixed(2)} t/ha potenciales`}
              format={(n) => `${n.toFixed(2)} t/ha`}
              color={num(perfilRow, "actual") < 0.6 * num(perfilRow, "potencial") ? "var(--error)" : "var(--ok)"} />
            <p className="dash-note">
              {str(perfilRow, "hectareas")} ha · el vector <code>emb</code> de este perfil alimenta el panel de gemelas.
            </p>
          </Panel>

          <Panel title="Gemelas por similitud de coseno"
            subtitle="search.vector corre contra el motor con el vector de la parcela seleccionada: condiciones casi idénticas, resultados muy distintos. Clic para saltar a una gemela."
            cypher={Q.vivo} accent={acc} {...flags(vivoP.vivo)}
            emptyLabel="sin gemelas para este perfil">
            <DataTable rows={vivoRows} columns={vivoCols} maxHeight={300}
              onRowClick={(r) => setSel(str(r, "parcela"))}
              rowTone={(r) =>
                num(r, "rend_actual") > 0.8 * num(r, "rend_potencial") ? "ok" : undefined} />
            <p className="dash-note">
              Mismo perfil, distinto manejo: la diferencia de rendimiento entre gemelas <b>es</b> la oportunidad.
            </p>
          </Panel>

          <Panel title={`La receta de la gemela que sí rinde — ${sel}`}
            subtitle="Variedad y prácticas de las gemelas que superan a la parcela seleccionada, con el uplift esperado. Evidencia local, no manual genérico."
            cypher={Q.reco} accent="var(--ok)" {...flags(drillP.reco)}
            emptyLabel="ninguna gemela rinde más: esta parcela es la referencia de su grupo">
            {mejorReco && (
              <p className="dash-note" style={{ marginTop: 0 }}>
                Adoptar <b>{str(mejorReco, "variedad")}</b> y las prácticas de{" "}
                <b>{str(mejorReco, "gemela")}</b> cerraría ≈{" "}
                <b style={{ color: "var(--ok)" }}>+{num(mejorReco, "uplift_tha").toFixed(2)} t/ha</b>.
              </p>
            )}
            <DataTable rows={recoRows} columns={recoCols} maxHeight={280}
              rowTone={(r) => (mejorReco && str(r, "gemela") === str(mejorReco, "gemela") ? "ok" : undefined)} />
          </Panel>
        </DashGrid>
      </DashSection>

      <DashSection eyebrow="la evidencia que convence al productor" title="Prácticas y variedades que mueven la aguja">
        <DashGrid min={360}>
          <Panel title="La poda sanitaria mueve el rendimiento del cacao"
            subtitle="Parcelas de cacao con y sin poda sanitaria: +0.35 t/ha de diferencia promedio. La práctica se vende con datos."
            cypher={Q.impacto} accent="var(--ok)" {...flags(panels.impacto)}>
            <BarChart data={impactoData} format={(n) => `${n.toFixed(2)} t/ha`} accent={acc} />
          </Panel>

          <Panel title="Qué variedad gana en cada zona"
            subtitle="La genética correcta para cada condición sale de los datos de la propia red, no del catálogo."
            cypher={Q.variedades} accent={acc} {...flags(panels.variedades)}>
            <DataTable rows={panels.variedades?.rows ?? []} columns={variedadCols} maxHeight={300} />
          </Panel>

          <Panel title="Transferencias listas: crítica → gemela probada" span={2}
            subtitle="Cada parcela bajo el 60 % emparejada con una gemela (sim ≥ 0.9) que ya rinde sobre el 80 % del suyo, ordenadas por el salto relativo que habilitan — la transformación más grande primero, con las toneladas en juego."
            cypher={Q.transferencia} accent="#ffb020" {...flags(panels.transferencia)}>
            <DataTable rows={panels.transferencia?.rows ?? []} columns={transferCols} maxHeight={300}
              onRowClick={(r) => setSel(str(r, "parcela"))}
              rowTone={() => "warn"} />
          </Panel>
        </DashGrid>
      </DashSection>

      <DashSection eyebrow="conocimiento agronómico por texto libre (BM25)" title="La ficha técnica correcta, sin carpetas">
        <DashGrid min={380}>
          <Panel title="Buscar en las fichas técnicas"
            subtitle="El técnico escribe lo que ve en campo y search.bm25 recupera la ficha por relevancia textual — sin taxonomías ni carpetas."
            cypher={Q.bm25} accent={acc} {...flags(fichasP.bm25)}
            emptyLabel="ninguna ficha coincide — prueba otros términos">
            <form
              style={{ display: "flex", gap: "0.5rem", marginBottom: "0.8rem" }}
              onSubmit={(e) => {
                e.preventDefault();
                if (texto.trim()) setConsulta(texto.trim());
              }}>
              <input
                value={texto}
                onChange={(e) => setTexto(e.target.value)}
                placeholder="síntoma o práctica, p. ej. clorosis suelo alcalino"
                style={{
                  flex: 1, background: "var(--tinta-2)", color: "var(--hueso)",
                  border: "1px solid var(--linea)", borderRadius: "6px",
                  padding: "0.5rem 0.7rem", fontFamily: "var(--mono)", fontSize: "0.8rem",
                }} />
              <button type="submit" className="boton">Buscar</button>
            </form>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "0.35rem", marginBottom: "0.8rem" }}>
              {SUGERENCIAS.map((s) => (
                <span key={s} style={{ cursor: "pointer" }}
                  onClick={() => { setTexto(s); setConsulta(s); }}>
                  <Chip tone={s === consulta ? "rosa" : "muted"}>{s}</Chip>
                </span>
              ))}
            </div>
            <DataTable rows={fichas} columns={fichaCols} maxHeight={240}
              rowTone={(r) => (num(r, "score") === mejorScore ? "ok" : undefined)} />
          </Panel>

          <Panel title="Cartera de cada técnico, valorada en toneladas"
            subtitle="A quién asignar refuerzos se decide por toneladas recuperables en su cartera, no por número de visitas."
            cypher={Q.tecnicos} accent={acc} {...flags(panels.tecnicos)}>
            <DataTable rows={panels.tecnicos?.rows ?? []} columns={tecnicoCols} maxHeight={260} />
          </Panel>

          <Panel title="Mapa de parcelas gemelas" span={2} accent={acc}
            subtitle="Parcelas, variedades, prácticas, técnicos, cooperativas y la red GEMELA materializada — la recomendación vive en las conexiones.">
            {grafo ? <GraphView grafo={grafo} /> : <div className="grafo-caja"><span className="grafo-caja__estado">sembrando…</span></div>}
          </Panel>
        </DashGrid>
      </DashSection>
    </div>
  );
}
