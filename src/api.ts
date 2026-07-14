import type { CasoMeta, Grafo, ResultadoCypher } from "./types";

let metaCache: CasoMeta[] | null = null;

export async function fetchMeta(): Promise<CasoMeta[]> {
  if (metaCache) return metaCache;
  const res = await fetch("/api/meta");
  if (!res.ok) throw new Error(`meta: HTTP ${res.status}`);
  const data = await res.json();
  metaCache = data.casos as CasoMeta[];
  return metaCache;
}

export async function fetchGrafo(slug: string): Promise<Grafo> {
  const res = await fetch(`/api/graph?case=${encodeURIComponent(slug)}`);
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? `graph: HTTP ${res.status}`);
  return data as Grafo;
}

export async function runCypher(
  slug: string,
  body: { queryId?: string; cypher?: string; params?: Record<string, unknown>; reset?: boolean },
): Promise<ResultadoCypher> {
  const res = await fetch("/api/cypher", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ case: slug, ...body }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? `cypher: HTTP ${res.status}`);
  return data as ResultadoCypher;
}
