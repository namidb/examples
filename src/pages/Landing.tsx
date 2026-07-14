import { Link } from "react-router-dom";

import type { CasoMeta } from "../types";

export default function Landing({ casos, error }: { casos: CasoMeta[] | null; error: string | null }) {
  return (
    <main className="shell">
      <section className="hero">
        <span className="eyebrow">NamiDB presenta · ejemplos ejecutables</span>
        <h1 className="display">
          Catorce casos <span className="rosa">de uso.</span>
        </h1>
        <p className="hero__baja">
          Un problema de gerencia por industria — y su solución corriendo contra el{" "}
          <strong>motor real de NamiDB</strong>, con datos sintéticos y las consultas Cypher
          a la vista. Cada módulo es la base para tu propio desarrollo:{" "}
          <strong>detecte redes, no eventos aislados.</strong>
        </p>
        <div className="hero__pie">
          <code><b>$</b> pip install namidb</code>
          <code><b>$</b> python cases/run.py banca-aml</code>
        </div>
      </section>

      <section className="indice">
        <div className="indice__cabecera">
          <span className="eyebrow eyebrow--gris">grafos · vectores · texto · algoritmos · agentes IA · su nube</span>
        </div>

        {error && <div className="error-caja">No pude cargar los casos: {error}</div>}
        {!casos && !error && <div className="skeleton">cargando los catorce casos…</div>}

        {casos?.map((caso) => (
          <Link key={caso.slug} to={`/caso/${caso.slug}`} className="caso-fila">
            <span className="caso-fila__num">{String(caso.numero).padStart(2, "0")}</span>
            <span>
              <span className="eyebrow caso-fila__industria">{caso.industria}</span>
              <span className="caso-fila__titulo">{caso.titulo}</span>
              <span className="caso-fila__problema">{caso.problema}</span>
            </span>
            <span className="caso-fila__flecha">ver el mapa →</span>
          </Link>
        ))}
      </section>
    </main>
  );
}
