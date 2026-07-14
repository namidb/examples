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
  colorFor,
  firstRow,
  flags,
  fmtInt,
  fmtPct,
  num,
  serie,
  str,
  useGrafo,
  usePanels,
  type Column,
} from "../kit";
import type { DashProps } from "../dashProps";

const ADR_012 = "ADR-012: Migración de PostgreSQL a NamiDB para el grafo de clientes";

/* Vector de la pregunta "por qué migramos el grafo de clientes" — el mismo
   embedding determinista que siembra el caso. Va inline para que el toggle de
   Cypher muestre exactamente el llamado que hace un agente vía MCP. */
const QVEC =
  "[0.0, 0.0, 0.0, 0.0, 0.42482, 0.16488, 0.13666, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.48275, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.73527]";

const Q = {
  docs: `MATCH (n:Nota) RETURN count(n) AS n`,

  wikilinks: `MATCH ()-[l:LINKS_TO]->() RETURN count(l) AS n`,

  cobertura: `MATCH (n:Nota) WITH count(n) AS total
MATCH (m:Nota) WHERE EXISTS { (m)<-[:LINKS_TO]-(:Nota) }
RETURN total, count(DISTINCT m) AS enlazadas,
       round(count(DISTINCT m) * 1000.0 / total) / 10 AS pct`,

  obsoletas: `MATCH (n:Nota) WHERE n.vigente = false RETURN count(n) AS n`,

  huerfanasN: `MATCH (n:Nota)
WHERE NOT EXISTS { (n)<-[:LINKS_TO]-(:Nota) }
  AND NOT EXISTS { (n)<-[:REEMPLAZA]-(:Nota) }
RETURN count(n) AS n`,

  hibrida: `CALL search.hybrid({label: 'Nota', text_property: 'titulo',
                    query_text: 'por qué migramos el grafo de clientes',
                    vector_property: 'emb',
                    query_vector: ${QVEC},
                    k: 5})
YIELD node, score
RETURN node.titulo AS nota, node.tipo AS tipo, node.vigente AS vigente,
       round(score * 10000) / 10000 AS score`,

  contexto: `MATCH (n:Nota {titulo: $titulo})
OPTIONAL MATCH (n)<-[:AUTOR_DE]-(autor:Persona)
WITH n, collect(DISTINCT autor.nombre) AS autores
OPTIONAL MATCH (n)-[:SOBRE]->(s:Sistema)
WITH n, autores, collect(DISTINCT s.nombre) AS sistemas
OPTIONAL MATCH (n)-[:DECIDE_SOBRE]->(pr:Proyecto)
WITH n, autores, sistemas, collect(DISTINCT pr.nombre) AS proyectos
OPTIONAL MATCH (n)-[:TAGGED]->(tg:Tag)
WITH n, autores, sistemas, proyectos, collect(DISTINCT tg.nombre) AS tags
OPTIONAL MATCH (n)-[:LINKS_TO]->(sale:Nota)
WITH n, autores, sistemas, proyectos, tags, collect(DISTINCT sale.titulo) AS enlaza_a
OPTIONAL MATCH (n)<-[:LINKS_TO]-(entra:Nota)
RETURN n.titulo AS nota, n.tipo AS tipo, n.fecha AS fecha, n.vigente AS vigente,
       autores, sistemas, proyectos, tags, enlaza_a,
       collect(DISTINCT entra.titulo) AS enlazada_desde`,

  hubs: `CALL algo.pagerank({labels: ['Nota'], edge_types: ['LINKS_TO']})
YIELD node_id, score
WITH node_id AS nb, score
MATCH (n:Nota) WHERE id(n) = id(nb)
RETURN DISTINCT n.titulo AS nota, n.tipo AS tipo,
       round(score * 10000) / 10000 AS score
ORDER BY score DESC
LIMIT 8`,

  tipos: `MATCH (n:Nota) RETURN n.tipo AS tipo, count(*) AS notas ORDER BY notas DESC`,

  sistemas: `MATCH (n:Nota)-[:SOBRE]->(s:Sistema)
RETURN s.nombre AS sistema, count(DISTINCT n) AS notas
ORDER BY notas DESC`,

  expertos: `MATCH (p:Persona)-[:AUTOR_DE]->(n:Nota)-[:SOBRE]->(s:Sistema)
WITH s.nombre AS sistema, p.nombre AS experto, count(DISTINCT n) AS notas
WHERE notas >= 2
RETURN sistema, experto, notas
ORDER BY sistema, notas DESC`,

  reemplaza: `MATCH (nueva:Nota)-[:REEMPLAZA]->(vieja:Nota)
RETURN vieja.titulo AS obsoleta, nueva.titulo AS usar_en_su_lugar,
       nueva.fecha AS desde
ORDER BY desde DESC`,

  huerfanas: `MATCH (n:Nota)
WHERE NOT EXISTS { (n)<-[:LINKS_TO]-(:Nota) }
  AND NOT EXISTS { (n)<-[:REEMPLAZA]-(:Nota) }
RETURN n.titulo AS nota, n.tipo AS tipo, n.fecha AS fecha
ORDER BY fecha`,
};

const TIPO_COLOR: Record<string, string> = {
  adr: serie(4),
  runbook: serie(1),
  postmortem: serie(3),
  wiki: serie(2),
};

export default function AgentesConocimiento({ slug }: DashProps) {
  const acc = accent(slug);
  const [sel, setSel] = useState(ADR_012);
  const { panels } = usePanels(slug, {
    docs: { cypher: Q.docs },
    wikilinks: { cypher: Q.wikilinks },
    cobertura: { cypher: Q.cobertura },
    obsoletas: { cypher: Q.obsoletas },
    huerfanasN: { cypher: Q.huerfanasN },
    hibrida: { cypher: Q.hibrida },
    hubs: { cypher: Q.hubs },
    tipos: { cypher: Q.tipos },
    sistemas: { cypher: Q.sistemas },
    expertos: { cypher: Q.expertos },
    reemplaza: { cypher: Q.reemplaza },
    huerfanas: { cypher: Q.huerfanas },
  });
  const { panels: ctxP } = usePanels(slug, { contexto: { cypher: Q.contexto, params: { titulo: sel } } });
  const { grafo } = useGrafo(slug);

  const cob = firstRow(panels.cobertura);
  const ctx = firstRow(ctxP.contexto);

  const hibridaRows = panels.hibrida?.rows ?? [];
  const hibridaCols: Column[] = [
    {
      key: "nota",
      label: "Fuente",
      render: (_v, r) => (
        <span>
          {str(r, "nota")}
          {num(r, "score") === num(hibridaRows[0], "score") && str(r, "nota") === str(hibridaRows[0], "nota") ? (
            <>
              {" "}
              <Chip tone="ok">cita</Chip>
            </>
          ) : null}
          {r.vigente === false ? (
            <>
              {" "}
              <Chip tone="bad">obsoleta</Chip>
            </>
          ) : null}
        </span>
      ),
    },
    { key: "tipo", label: "Tipo", mono: true },
    { key: "score", label: "Score", align: "right", format: (n) => n.toFixed(4) },
  ];

  const expertosRows = panels.expertos?.rows ?? [];
  const expertosCols: Column[] = [
    { key: "sistema", label: "Sistema", mono: true },
    { key: "experto", label: "Experto a quién escalar" },
    { key: "notas", label: "Notas", align: "right", format: fmtInt },
  ];

  const reemplazaCols: Column[] = [
    { key: "obsoleta", label: "No citar (obsoleta)" },
    { key: "usar_en_su_lugar", label: "Usar en su lugar" },
    { key: "desde", label: "Vigente desde", mono: true, align: "right" },
  ];

  const huerfanasCols: Column[] = [
    { key: "nota", label: "Sin un solo backlink" },
    { key: "tipo", label: "Tipo", mono: true },
    { key: "fecha", label: "Fecha", mono: true, align: "right" },
  ];

  return (
    <div>
      <KpiRow>
        <KpiCard label="Documentos en el grafo" value={fmtInt(num(firstRow(panels.docs), "n"))}
          loading={panels.docs?.loading} tone="info"
          sub="runbooks · postmortems · ADRs · wikis" />
        <KpiCard label="Wikilinks (aristas)" value={fmtInt(num(firstRow(panels.wikilinks), "n"))}
          loading={panels.wikilinks?.loading}
          sub="cada enlace es contexto que un agente puede seguir" />
        <KpiCard label="Cobertura del grafo" value={fmtPct(num(cob, "pct"), 0)}
          loading={panels.cobertura?.loading} tone="ok"
          sub={`${fmtInt(num(cob, "enlazadas"))} de ${fmtInt(num(cob, "total"))} notas con backlink`} />
        <KpiCard label="Versiones obsoletas" value={fmtInt(num(firstRow(panels.obsoletas), "n"))}
          loading={panels.obsoletas?.loading} tone="warn"
          sub="marcadas con REEMPLAZA · un agente no las cita" />
        <KpiCard label="Conocimiento huérfano" value={fmtInt(num(firstRow(panels.huerfanasN), "n"))}
          loading={panels.huerfanasN?.loading} tone="bad"
          sub="notas invisibles a la navegación y a los agentes" />
      </KpiRow>

      <DashSection eyebrow="Búsqueda híbrida + MCP" title="La respuesta de un agente, con fuente">
        <DashGrid min={380}>
          <Panel title="“¿Por qué migramos el grafo de clientes?”"
            subtitle="BM25 sobre títulos + similitud vectorial en un solo llamado. Clic en una fuente para cargar su contexto."
            cypher={Q.hibrida} accent={acc} {...flags(panels.hibrida)}>
            <DataTable
              rows={hibridaRows}
              columns={hibridaCols}
              maxHeight={280}
              sortable={false}
              onRowClick={(r) => setSel(str(r, "nota"))}
              rowTone={(r) =>
                str(r, "nota") === sel ? "rosa" : r.vigente === false ? "warn" : undefined
              }
            />
            <p className="dash-note">
              Gana <b style={{ color: acc }}>ADR-012</b>, la decisión vigente — no el
              documento obsoleto ni un fragmento suelto. El agente cita, no inventa.
            </p>
          </Panel>

          <Panel title="El contexto que cargaría por MCP"
            subtitle={`Alrededor de la fuente seleccionada: autoría, sistema, proyecto y enlaces conectados.`}
            cypher={Q.contexto} accent="var(--info)" {...flags(ctxP.contexto)}
            emptyLabel="selecciona una fuente en la tabla">
            {ctx && <Contexto ctx={ctx} acc={acc} />}
          </Panel>
        </DashGrid>
      </DashSection>

      <DashSection eyebrow="Lo que revela el grafo" title="El conocimiento organizacional, mapeado">
        <DashGrid min={340}>
          <Panel title="Los hubs del conocimiento (PageRank)"
            subtitle="Las notas más enlazadas de la red de wikilinks: lo que la organización de verdad consulta y mantiene vivo."
            cypher={Q.hubs} accent={acc} {...flags(panels.hubs)}>
            <RankList
              data={(panels.hubs?.rows ?? []).map((r) => ({
                label: str(r, "nota"),
                value: num(r, "score"),
                sub: str(r, "tipo"),
                color: TIPO_COLOR[str(r, "tipo")] ?? acc,
              }))}
              format={(n) => n.toFixed(4)}
            />
          </Panel>

          <Panel title="Cobertura por sistema"
            subtitle="Cuánto conocimiento conectado respalda cada plataforma interna."
            cypher={Q.sistemas} accent="var(--info)" {...flags(panels.sistemas)}>
            <ColumnChart
              data={(panels.sistemas?.rows ?? []).map((r) => ({
                label: str(r, "sistema"),
                value: num(r, "notas"),
                color: colorFor(str(r, "sistema")),
              }))}
              labelRotate
            />
          </Panel>

          <Panel title="Composición del corpus"
            subtitle="Qué tipo de documento predomina en la base de conocimiento."
            cypher={Q.tipos} accent={acc} {...flags(panels.tipos)}>
            <DonutChart
              data={(panels.tipos?.rows ?? []).map((r) => ({
                label: str(r, "tipo"),
                value: num(r, "notas"),
                color: TIPO_COLOR[str(r, "tipo")],
              }))}
              centerValue={fmtInt((panels.tipos?.rows ?? []).reduce((a, r) => a + num(r, "notas"), 0))}
              centerLabel="documentos"
            />
          </Panel>

          <Panel title="Quién sabe de qué (expertos reales)"
            subtitle="La autoría conectada por sistema revela a quién preguntar — o a quién debería escalar un agente."
            cypher={Q.expertos} accent="var(--info)" {...flags(panels.expertos)}>
            <DataTable rows={expertosRows} columns={expertosCols} maxHeight={280}
              rowTone={(r) => (str(r, "sistema") === "grafo-clientes" && num(r, "notas") >= 6 ? "rosa" : undefined)} />
          </Panel>
        </DashGrid>
      </DashSection>

      <DashSection eyebrow="Higiene del conocimiento" title="Lo que un agente debe evitar — y el mapa completo">
        <DashGrid min={360}>
          <Panel title="La versión vigente, no la obsoleta"
            subtitle="Cada REEMPLAZA le dice al agente qué documento ya no citar y cuál usar en su lugar."
            cypher={Q.reemplaza} accent="var(--warn)" {...flags(panels.reemplaza)}>
            <DataTable rows={panels.reemplaza?.rows ?? []} columns={reemplazaCols} maxHeight={220}
              rowTone={() => "warn"} />
          </Panel>

          <Panel title="Conocimiento huérfano que nadie enlaza"
            subtitle="Notas sin un solo backlink: invisibles para la navegación — y para los agentes — hasta que alguien las conecta."
            cypher={Q.huerfanas} accent="var(--error)" {...flags(panels.huerfanas)}>
            <DataTable rows={panels.huerfanas?.rows ?? []} columns={huerfanasCols} maxHeight={220}
              rowTone={(r) => (str(r, "nota").startsWith("Nota crítica") ? "bad" : "muted")} />
            <p className="dash-note">
              Una de ellas es <b style={{ color: "var(--error)" }}>crítica de seguridad</b>:
              rotación de credenciales del bucket de producción, que hoy nadie enlaza.
            </p>
          </Panel>

          <Panel title="Mapa del grafo de conocimiento" span={2} accent={acc}
            subtitle="Notas, tags, sistemas, proyectos y autoría — el contexto vive en las conexiones.">
            {grafo ? <GraphView grafo={grafo} /> : <div className="grafo-caja"><span className="grafo-caja__estado">sembrando…</span></div>}
          </Panel>
        </DashGrid>
      </DashSection>
    </div>
  );
}

/* Contexto conectado que un agente MCP cargaría alrededor de una fuente. */
function Contexto({ ctx, acc }: { ctx: Record<string, unknown>; acc: string }) {
  const autores = arr(ctx, "autores");
  const sistemas = arr(ctx, "sistemas");
  const proyectos = arr(ctx, "proyectos");
  const tags = arr(ctx, "tags");
  const enlazaA = arr(ctx, "enlaza_a");
  const desde = arr(ctx, "enlazada_desde");
  const vigente = ctx.vigente !== false;

  const grupos: { titulo: string; items: unknown[]; tone: Parameters<typeof Chip>[0]["tone"] }[] = [
    { titulo: "Autoría", items: autores, tone: "info" },
    { titulo: "Sistemas", items: sistemas, tone: "ok" },
    { titulo: "Proyectos", items: proyectos, tone: "rosa" },
    { titulo: "Tags", items: tags, tone: "muted" },
  ];

  return (
    <div>
      <div style={{ display: "flex", alignItems: "baseline", flexWrap: "wrap", gap: "0.5rem", marginBottom: "0.7rem" }}>
        <span className="mono" style={{ fontSize: "0.8rem", color: acc, fontWeight: 600 }}>{str(ctx, "tipo")}</span>
        <span className="mono" style={{ fontSize: "0.75rem", color: "var(--hueso)" }}>{str(ctx, "fecha")}</span>
        <Chip tone={vigente ? "ok" : "bad"}>{vigente ? "vigente" : "obsoleta"}</Chip>
      </div>

      <div className="dash-kpirow" style={{ margin: "0 0 0.9rem" }}>
        <div className="dash-kpi" style={{ ["--accent" as string]: "var(--info)" }}>
          <span className="dash-kpi__label">Enlaza a</span>
          <span className="dash-kpi__value display">{enlazaA.length}</span>
        </div>
        <div className="dash-kpi" style={{ ["--accent" as string]: acc }}>
          <span className="dash-kpi__label">Enlazada desde</span>
          <span className="dash-kpi__value display">{desde.length}</span>
        </div>
      </div>

      {grupos
        .filter((g) => g.items.length > 0)
        .map((g) => (
          <div key={g.titulo} style={{ marginBottom: "0.55rem" }}>
            <p className="dash-note" style={{ margin: "0 0 0.3rem" }}>{g.titulo}</p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "0.35rem" }}>
              {g.items.map((it, i) => (
                <Chip key={i} tone={g.tone}>{String(it)}</Chip>
              ))}
            </div>
          </div>
        ))}
    </div>
  );
}
