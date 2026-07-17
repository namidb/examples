import { Link } from "react-router-dom";

import { accent } from "../dash/palette";
import type { CasoMeta } from "../types";

export default function Landing({ casos, error }: { casos: CasoMeta[] | null; error: string | null }) {
  return (
    <main className="shell">
      <section className="hero">
        <span className="eyebrow">NamiDB presenta · ejemplos ejecutables</span>
        <h1 className="display">
          Diecisiete casos <span className="rosa">de uso.</span>
        </h1>
        <p className="hero__baja">
          Un problema de gerencia por industria — y su solución como{" "}
          <strong>dashboard analítico en vivo</strong>, corriendo contra el{" "}
          <strong>motor real de NamiDB</strong> con el Cypher de cada panel a la vista.
          Cada módulo es una app completa y la base para tu propio desarrollo:{" "}
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
        {!casos && !error && <div className="skeleton">cargando los diecisiete casos…</div>}

        {casos?.map((caso) => (
          <Link
            key={caso.slug}
            to={`/caso/${caso.slug}`}
            className="caso-fila"
            style={{ ["--acc" as string]: accent(caso.slug) }}
          >
            <span className="caso-fila__num">{String(caso.numero).padStart(2, "0")}</span>
            <span>
              <span className="eyebrow caso-fila__industria">{caso.industria}</span>
              <span className="caso-fila__titulo">{caso.titulo}</span>
              <span className="caso-fila__problema">{caso.problema}</span>
            </span>
            <span className="caso-fila__flecha">abrir panel →</span>
          </Link>
        ))}
      </section>
    </main>
  );
}
