import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";

import { fetchGrafo, runCypher } from "../api";
import GraphView from "../components/GraphView";
import ResultTable from "../components/ResultTable";
import type { CasoMeta, Grafo, ResultadoCypher } from "../types";

export default function Caso({ casos }: { casos: CasoMeta[] | null }) {
  const { slug = "" } = useParams();
  const caso = useMemo(() => casos?.find((c) => c.slug === slug) ?? null, [casos, slug]);

  const [grafo, setGrafo] = useState<Grafo | null>(null);
  const [grafoError, setGrafoError] = useState<string | null>(null);
  const [cypher, setCypher] = useState("");
  const [activa, setActiva] = useState<string | null>(null);
  const [resultado, setResultado] = useState<ResultadoCypher | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [corriendo, setCorriendo] = useState(false);

  useEffect(() => {
    setGrafo(null);
    setGrafoError(null);
    setResultado(null);
    setError(null);
    setActiva(null);
    setCypher("");
    if (!slug) return;
    fetchGrafo(slug).then(setGrafo).catch((e) => setGrafoError(String(e.message ?? e)));
  }, [slug]);

  // Al abrir un caso, selecciona y ejecuta su primera consulta para que el
  // visitante vea resultados de inmediato (no una tabla vacía).
  useEffect(() => {
    if (caso && caso.queries.length > 0 && !activa) {
      const primera = caso.queries[0];
      setActiva(primera.id);
      setCypher(primera.cypher);
      void ejecutar(primera.id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [caso]);

  async function ejecutar(queryId?: string) {
    if (!slug) return;
    setCorriendo(true);
    setError(null);
    try {
      const query = queryId ? caso?.queries.find((q) => q.id === queryId) : null;
      const res = await runCypher(slug, query ? { queryId } : { cypher });
      setResultado(res);
    } catch (e: any) {
      setResultado(null);
      setError(String(e.message ?? e));
    } finally {
      setCorriendo(false);
    }
  }

  async function reset() {
    if (!slug) return;
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

  if (!casos) return <main className="shell"><div className="skeleton">cargando…</div></main>;
  if (!caso) {
    return (
      <main className="shell">
        <section className="caso-hero">
          <h1 className="display">Caso no encontrado.</h1>
          <p style={{ marginTop: "1rem" }}><Link to="/" style={{ color: "var(--rosa)" }}>← volver al índice</Link></p>
        </section>
      </main>
    );
  }

  const previo = casos.find((c) => c.numero === caso.numero - 1);
  const siguiente = casos.find((c) => c.numero === caso.numero + 1);

  return (
    <main className="shell">
      <section className="caso-hero">
        <div className="caso-hero__num display">{String(caso.numero).padStart(2, "0")}</div>
        <span className="eyebrow">{caso.industria}</span>
        <h1 className="display">{caso.titulo}</h1>
      </section>

      <hr className="regla regla--rosa" />

      <section className="caso-cols">
        <div>
          <h3>El problema de gerencia</h3>
          <p>{caso.problema}</p>
          <h3 style={{ marginTop: "1.6rem" }}>Qué conecta NamiDB</h3>
          <div>
            {caso.conecta.map((item) => (
              <span key={item} className="chip">{item}</span>
            ))}
          </div>
        </div>
        <div>
          <h3>Qué revela el mapa</h3>
          <ul>
            {caso.revela.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
        <div>
          <h3>Indicadores del piloto</h3>
          <ul>
            {caso.indicadores.map((item) => (
              <li key={item} className="indicador">{item}</li>
            ))}
          </ul>
        </div>
      </section>

      {caso.referencia && <p className="referencia">REFERENCIA REAL — {caso.referencia}</p>}

      <section className="lab">
        <aside className="lab__queries">
          <span className="eyebrow eyebrow--gris" style={{ padding: "0.4rem 0" }}>
            Consultas del caso — clic para ejecutar
          </span>
          {caso.queries.map((query, i) => (
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
            El dataset es sintético y efímero (memory://). Puedes escribir tu propio
            Cypher — incluso CREATE/MERGE — y{" "}
            <a onClick={reset} style={{ color: "var(--rosa)", cursor: "pointer" }}>resembrar</a>{" "}
            cuando quieras.
          </p>
        </aside>

        <div className="lab__panel">
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
      </section>

      <nav className="caso-nav">
        {previo ? (
          <Link to={`/caso/${previo.slug}`}>← {String(previo.numero).padStart(2, "0")} {previo.titulo}</Link>
        ) : <span />}
        {siguiente ? (
          <Link to={`/caso/${siguiente.slug}`}>{String(siguiente.numero).padStart(2, "0")} {siguiente.titulo} →</Link>
        ) : <span />}
      </nav>
    </main>
  );
}
