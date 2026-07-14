import { useEffect, useState } from "react";

import { fetchGrafo, runCypher } from "../api";
import GraphView from "../components/GraphView";
import ResultTable from "../components/ResultTable";
import type { CasoMeta, Grafo, ResultadoCypher } from "../types";

/** Consola cruda: el grafo vivo + las consultas del caso + editor de Cypher
    libre. Es la cara "para desarrolladores" — copia, edita y vuelve a correr. */
export default function ExploreConsole({ slug, meta }: { slug: string; meta: CasoMeta }) {
  const [grafo, setGrafo] = useState<Grafo | null>(null);
  const [grafoError, setGrafoError] = useState<string | null>(null);
  const [cypher, setCypher] = useState(meta.queries[0]?.cypher ?? "");
  const [activa, setActiva] = useState<string | null>(meta.queries[0]?.id ?? null);
  const [resultado, setResultado] = useState<ResultadoCypher | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [corriendo, setCorriendo] = useState(false);

  useEffect(() => {
    setGrafo(null);
    setGrafoError(null);
    fetchGrafo(slug)
      .then(setGrafo)
      .catch((e) => setGrafoError(String(e.message ?? e)));
    // corre la primera consulta para no mostrar tabla vacía
    void ejecutar(meta.queries[0]?.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug]);

  async function ejecutar(queryId?: string, freeCypher?: string) {
    setCorriendo(true);
    setError(null);
    try {
      const query = queryId ? meta.queries.find((q) => q.id === queryId) : null;
      const res = await runCypher(slug, query ? { queryId } : { cypher: freeCypher ?? cypher });
      setResultado(res);
    } catch (e: any) {
      setResultado(null);
      setError(String(e.message ?? e));
    } finally {
      setCorriendo(false);
    }
  }

  async function reset() {
    setCorriendo(true);
    setError(null);
    try {
      await runCypher(slug, { cypher: "RETURN 1 AS ok", reset: true });
      const g = await fetchGrafo(slug);
      setGrafo(g);
      setResultado(null);
    } catch (e: any) {
      setError(String(e.message ?? e));
    } finally {
      setCorriendo(false);
    }
  }

  return (
    <div className="explora__grid">
      <aside className="explora__queries">
        <span className="eyebrow eyebrow--gris" style={{ padding: "0.2rem 0 0.4rem" }}>
          Consultas del caso — clic para correr
        </span>
        {meta.queries.map((query, i) => (
          <button
            key={query.id}
            className={`query-btn ${activa === query.id ? "activa" : ""}`}
            onClick={() => {
              setActiva(query.id);
              setCypher(query.cypher);
              void ejecutar(query.id);
            }}
          >
            <span className="query-btn__num">Q{i + 1}</span>
            <span className="query-btn__titulo">{query.titulo}</span>
            <span className="query-btn__desc">{query.descripcion}</span>
          </button>
        ))}
        <p className="nota-efimera" style={{ marginTop: "0.6rem" }}>
          Dataset sintético y efímero (memory://). Escribe tu propio Cypher — incluso CREATE/MERGE — y{" "}
          <a onClick={reset} style={{ color: "var(--rosa)", cursor: "pointer" }}>
            resiembra
          </a>{" "}
          cuando quieras.
        </p>
      </aside>

      <div className="explora__panel">
        {grafoError && <div className="error-caja">grafo: {grafoError}</div>}
        {grafo ? (
          <GraphView grafo={grafo} />
        ) : (
          !grafoError && (
            <div className="grafo-caja">
              <span className="grafo-caja__estado">sembrando el grafo…</span>
            </div>
          )
        )}

        <div className="editor">
          <div className="editor__cab">
            <span className="eyebrow">Cypher · edítalo y vuelve a correr</span>
            <div style={{ display: "flex", gap: "0.6rem" }}>
              <button className="boton boton--fantasma" onClick={reset} disabled={corriendo}>
                Resembrar
              </button>
              <button className="boton" onClick={() => void ejecutar()} disabled={corriendo}>
                {corriendo ? "Ejecutando…" : "Ejecutar"}
              </button>
            </div>
          </div>
          <textarea
            value={cypher}
            spellCheck={false}
            onChange={(e) => {
              setCypher(e.target.value);
              setActiva(null);
            }}
            placeholder="MATCH (n) RETURN labels(n)[0] AS tipo, count(*) AS n ORDER BY n DESC"
          />
        </div>

        {error && <div className="error-caja">{error}</div>}
        {resultado && <ResultTable resultado={resultado} />}
      </div>
    </div>
  );
}
