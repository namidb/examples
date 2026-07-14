import { useEffect, useState } from "react";
import { Link, Route, Routes, useLocation } from "react-router-dom";

import { fetchMeta } from "./api";
import Caso from "./pages/Caso";
import Landing from "./pages/Landing";
import type { CasoMeta } from "./types";

export default function App() {
  const [casos, setCasos] = useState<CasoMeta[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { pathname } = useLocation();

  useEffect(() => {
    fetchMeta().then(setCasos).catch((e) => setError(String(e)));
  }, []);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);

  return (
    <>
      <header className="topbar">
        <Link to="/" className="topbar__marca">
          Nami<em>DB</em> · Ejemplos
        </Link>
        <nav className="topbar__links">
          <a href="https://github.com/namidb/examples" target="_blank" rel="noreferrer">GitHub</a>
          <a href="https://docs.namidb.com" target="_blank" rel="noreferrer">Docs</a>
          <a href="https://namidb.com" target="_blank" rel="noreferrer">namidb.com</a>
        </nav>
      </header>

      <Routes>
        <Route path="/" element={<Landing casos={casos} error={error} />} />
        <Route path="/caso/:slug" element={<Caso casos={casos} />} />
      </Routes>

      <footer className="pie">
        <small>NamiDB · Inteligencia relacional · © 2026</small>
        <small>
          Motor real: <a href="https://pypi.org/project/namidb/" target="_blank" rel="noreferrer">pip install namidb</a>
          {" · "}
          <a href="https://hub.docker.com/r/namidb/namidb-server" target="_blank" rel="noreferrer">docker pull namidb/namidb-server</a>
        </small>
      </footer>
    </>
  );
}
