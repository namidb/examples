import { Suspense, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";

import ErrorBoundary from "../dash/ErrorBoundary";
import ExploreConsole from "../dash/ExploreConsole";
import GenericDashboard from "../dash/GenericDashboard";
import { accent } from "../dash/palette";
import { Loading } from "../dash/primitives";
import { getDashboard } from "../dash/registry";
import type { CasoMeta } from "../types";

type Tab = "panel" | "explorar";

export default function Caso({ casos }: { casos: CasoMeta[] | null }) {
  const { slug = "" } = useParams();
  const caso = useMemo(() => casos?.find((c) => c.slug === slug) ?? null, [casos, slug]);
  const [tab, setTab] = useState<Tab>("panel");

  if (!casos) return <main className="shell"><div className="skeleton">cargando…</div></main>;
  if (!caso) {
    return (
      <main className="shell">
        <section className="dash-head">
          <h1 className="display">Caso no encontrado.</h1>
          <p style={{ marginTop: "1rem" }}>
            <Link to="/" style={{ color: "var(--rosa)" }}>← volver al índice</Link>
          </p>
        </section>
      </main>
    );
  }

  const Dashboard = getDashboard(slug);
  const previo = casos.find((c) => c.numero === caso.numero - 1);
  const siguiente = casos.find((c) => c.numero === caso.numero + 1);

  return (
    <main className="shell dash-main" style={{ ["--case-accent" as string]: accent(slug) }}>
      <header className="dash-head">
        <span className="eyebrow dash-head__industria">{caso.industria}</span>
        <div className="dash-head__top">
          <span className="dash-head__num">{String(caso.numero).padStart(2, "0")}</span>
          <h1>{caso.titulo}</h1>
        </div>
        <p className="dash-head__problema">{caso.problema}</p>
        <div style={{ display: "flex", gap: "1.4rem", alignItems: "center", flexWrap: "wrap" }}>
          <span className="dash-live"><i /> datos en vivo · motor real namidb 2.0.0</span>
        </div>
        {caso.referencia && <p className="dash-head__ref">REFERENCIA REAL — {caso.referencia}</p>}
      </header>

      <div className="dash-tabs">
        <button className={`dash-tab ${tab === "panel" ? "activo" : ""}`} onClick={() => setTab("panel")}>
          Panel de control
        </button>
        <button className={`dash-tab ${tab === "explorar" ? "activo" : ""}`} onClick={() => setTab("explorar")}>
          Explorar datos · Cypher
        </button>
      </div>

      {tab === "panel" ? (
        <Suspense fallback={<Loading lines={6} />}>
          {Dashboard ? (
            <ErrorBoundary fallback={<GenericDashboard slug={slug} meta={caso} />}>
              <Dashboard slug={slug} meta={caso} />
            </ErrorBoundary>
          ) : (
            <GenericDashboard slug={slug} meta={caso} />
          )}
        </Suspense>
      ) : (
        <section className="explora" style={{ borderTop: 0, marginTop: 0, paddingTop: 0 }}>
          <ExploreConsole slug={slug} meta={caso} />
        </section>
      )}

      <nav className="caso-nav">
        {previo ? (
          <Link to={`/caso/${previo.slug}`}>← {String(previo.numero).padStart(2, "0")} {previo.titulo}</Link>
        ) : (
          <span />
        )}
        {siguiente ? (
          <Link to={`/caso/${siguiente.slug}`}>{String(siguiente.numero).padStart(2, "0")} {siguiente.titulo} →</Link>
        ) : (
          <span />
        )}
      </nav>
    </main>
  );
}
