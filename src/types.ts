export interface QueryMeta {
  id: string;
  titulo: string;
  descripcion: string;
  cypher: string;
}

export interface CasoMeta {
  numero: number;
  slug: string;
  industria: string;
  titulo: string;
  problema: string;
  conecta: string[];
  revela: string[];
  indicadores: string[];
  referencia: string;
  queries: QueryMeta[];
}

export interface ResultadoCypher {
  columns: string[];
  rows: Record<string, unknown>[];
  ms: number;
  truncated: boolean;
  error?: string;
}

export interface GrafoNodo {
  id: string;
  label: string;
  caption: string;
  props: Record<string, unknown>;
}

export interface GrafoLink {
  source: string;
  target: string;
  type: string;
}

export interface Grafo {
  case: string;
  labels: string[];
  nodes: GrafoNodo[];
  links: GrafoLink[];
  leyenda: Record<string, string>;
}
