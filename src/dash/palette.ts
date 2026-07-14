/* Paleta del sistema de dashboards — el deck hecho datos.
   Rosa neón protagonista + familia categórica que respira sobre negro ciruela. */

export const BRAND = "#ff2d78";

/* Serie categórica para barras/donas/líneas (rosa primero, luego apoyos). */
export const SERIES = [
  "#ff2d78", // rosa neón
  "#38e8ff", // cian
  "#b6ff3d", // lima
  "#ffb020", // ámbar
  "#a56bff", // violeta
  "#ff7d6b", // coral
  "#6fe3a5", // menta
  "#f4c1d8", // rosa humo
  "#7c9cff", // azul
  "#ffd23a", // oro
];

export function serie(i: number): string {
  return SERIES[((i % SERIES.length) + SERIES.length) % SERIES.length];
}

/* Semáforo de riesgo/estado — usado por Gauge, KPI tone y badges. */
export const TONE = {
  rosa: "#ff2d78",
  ok: "#6fe3a5",
  warn: "#ffb020",
  bad: "#ff5a5f",
  info: "#38e8ff",
  plain: "#f4eef1",
  muted: "#9b8a93",
} as const;

export type ToneKey = keyof typeof TONE;

export function tone(key?: ToneKey): string {
  return TONE[key ?? "plain"];
}

/* Acento secundario por caso: cada dashboard mantiene la marca rosa pero
   gana un color propio para KPIs destacados, así ninguno se siente igual. */
export const CASE_ACCENT: Record<string, string> = {
  "banca-aml": "#ff2d78",
  "grupos-economicos": "#a56bff",
  "seguros-siniestros": "#38e8ff",
  "contratacion-publica": "#ffb020",
  "subsidios": "#6fe3a5",
  "salud-paciente": "#ff7d6b",
  "agro-trazabilidad": "#b6ff3d",
  "agro-cumplimiento": "#ffd23a",
  "energia-activos": "#7c9cff",
  "proveedores-compras": "#f4c1d8",
  "recomendaciones": "#ff2d78",
  "telecom-causa-raiz": "#38e8ff",
  "ciberseguridad": "#ff5a5f",
  "agentes-conocimiento": "#a56bff",
};

export function accent(slug: string): string {
  return CASE_ACCENT[slug] ?? BRAND;
}

/* Color estable por etiqueta de texto (para segmentos, categorías, estados). */
export function colorFor(label: string, i?: number): string {
  if (typeof i === "number") return serie(i);
  let h = 0;
  for (let k = 0; k < label.length; k++) h = (h * 31 + label.charCodeAt(k)) >>> 0;
  return serie(h);
}

/* Interpola de verde→ámbar→rojo según t∈[0,1]; para heatmaps de riesgo. */
export function riskColor(t: number): string {
  const c = Math.max(0, Math.min(1, t));
  const stops = [
    [0.0, [111, 227, 165]], // menta
    [0.5, [255, 176, 32]], // ámbar
    [1.0, [255, 90, 95]], // rojo
  ] as const;
  for (let i = 0; i < stops.length - 1; i++) {
    const [a, ca] = stops[i];
    const [b, cb] = stops[i + 1];
    if (c >= a && c <= b) {
      const k = (c - a) / (b - a || 1);
      const rgb = ca.map((v, j) => Math.round(v + (cb[j] - v) * k));
      return `rgb(${rgb[0]}, ${rgb[1]}, ${rgb[2]})`;
    }
  }
  return "#ff5a5f";
}
