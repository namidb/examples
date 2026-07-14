import { useEffect, useState } from "react";

import { fetchGrafo, runCypher } from "../api";
import type { Grafo } from "../types";
import type { Row } from "./format";

export interface PanelState {
  rows: Row[];
  columns: string[];
  ms: number;
  loading: boolean;
  error: string | null;
  truncated?: boolean;
}

export interface Spec {
  cypher: string;
  params?: Record<string, unknown>;
}

const LOADING: PanelState = { rows: [], columns: [], ms: 0, loading: true, error: null };

function initial(specs: Record<string, Spec>): Record<string, PanelState> {
  const out: Record<string, PanelState> = {};
  for (const id of Object.keys(specs)) out[id] = { ...LOADING };
  return out;
}

/**
 * Corre un mapa de consultas nombradas contra el caso `slug` y devuelve un
 * panel por cada una. Cada panel se resuelve por su cuenta (carga progresiva),
 * de modo que la UI se va llenando conforme el motor responde.
 *
 * Las `specs` pueden recrearse en cada render sin problema: la clave de efecto
 * se deriva del contenido (Cypher + params), no de la identidad del objeto.
 */
export function usePanels(slug: string, specs: Record<string, Spec>) {
  const key = JSON.stringify({ slug, specs });
  const [panels, setPanels] = useState<Record<string, PanelState>>(() => initial(specs));
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    let alive = true;
    setPanels(initial(specs));
    for (const [id, spec] of Object.entries(specs)) {
      runCypher(slug, { cypher: spec.cypher, params: spec.params })
        .then((res) => {
          if (!alive) return;
          setPanels((p) => ({
            ...p,
            [id]: {
              rows: res.rows as Row[],
              columns: res.columns,
              ms: res.ms,
              truncated: res.truncated,
              loading: false,
              error: null,
            },
          }));
        })
        .catch((err) => {
          if (!alive) return;
          setPanels((p) => ({
            ...p,
            [id]: { rows: [], columns: [], ms: 0, loading: false, error: String(err?.message ?? err) },
          }));
        });
    }
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, nonce]);

  const refetchAll = () => setNonce((n) => n + 1);
  return { panels, refetchAll };
}

/** Una sola consulta. */
export function useCypher(slug: string, cypher: string, params?: Record<string, unknown>) {
  const { panels, refetchAll } = usePanels(slug, { q: { cypher, params } });
  return { ...panels.q, refetch: refetchAll };
}

/** Banderas listas para <Panel {...flags(p)} />. Marca vacío solo si no carga ni hay error. */
export function flags(p: PanelState | undefined, requireRows = true) {
  if (!p) return { loading: true, error: null, empty: false };
  return {
    loading: p.loading,
    error: p.error,
    empty: requireRows && !p.loading && !p.error && p.rows.length === 0,
    ms: p.ms,
  };
}

/** Primera fila de un panel (para KPIs de un solo valor). */
export function firstRow(p: PanelState | undefined): Row | undefined {
  return p?.rows[0];
}

/** Carga el grafo vivo del caso para pintarlo con <GraphView>. */
export function useGrafo(slug: string) {
  const [grafo, setGrafo] = useState<Grafo | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    setGrafo(null);
    setError(null);
    fetchGrafo(slug)
      .then((g) => alive && setGrafo(g))
      .catch((e) => alive && setError(String(e?.message ?? e)));
    return () => {
      alive = false;
    };
  }, [slug]);
  return { grafo, error };
}
