/* Formateadores y lectores de filas seguros para los dashboards. */

const INT = new Intl.NumberFormat("es-EC", { maximumFractionDigits: 0 });
const DEC = new Intl.NumberFormat("es-EC", { minimumFractionDigits: 1, maximumFractionDigits: 1 });

export type Row = Record<string, unknown>;

/** Lee un número de una fila con fallback; tolera strings numéricos. */
export function num(row: Row | undefined, key: string, fallback = 0): number {
  if (!row) return fallback;
  const v = row[key];
  if (typeof v === "number") return v;
  if (typeof v === "string") {
    const n = Number(v);
    if (!Number.isNaN(n)) return n;
  }
  return fallback;
}

/** Lee un string de una fila con fallback. */
export function str(row: Row | undefined, key: string, fallback = ""): string {
  if (!row) return fallback;
  const v = row[key];
  if (v === null || v === undefined) return fallback;
  return typeof v === "string" ? v : String(v);
}

/** Lee un arreglo (p.ej. collect(...)) de una fila. */
export function arr(row: Row | undefined, key: string): unknown[] {
  const v = row?.[key];
  return Array.isArray(v) ? v : [];
}

export function fmtInt(n: number): string {
  return INT.format(Math.round(n));
}

export function fmtDec(n: number): string {
  return DEC.format(n);
}

/** 12.3K, 1.2M, 3.4B — compacto para KPIs. */
export function fmtCompact(n: number): string {
  const abs = Math.abs(n);
  if (abs >= 1e9) return (n / 1e9).toFixed(abs >= 1e10 ? 0 : 1) + "B";
  if (abs >= 1e6) return (n / 1e6).toFixed(abs >= 1e7 ? 0 : 1) + "M";
  if (abs >= 1e3) return (n / 1e3).toFixed(abs >= 1e4 ? 0 : 1) + "K";
  return fmtInt(n);
}

/** Moneda compacta: $1.2M, $890K, $340. */
export function fmtMoney(n: number, symbol = "$"): string {
  const abs = Math.abs(n);
  if (abs >= 1e3) return symbol + fmtCompact(n);
  return symbol + fmtInt(n);
}

/** Moneda exacta con separadores. */
export function fmtMoneyExact(n: number, symbol = "$"): string {
  return symbol + fmtInt(n);
}

export function fmtPct(n: number, decimals = 0): string {
  return n.toFixed(decimals) + "%";
}

export function fmtMs(ms: number): string {
  if (ms < 1) return "<1 ms";
  if (ms >= 1000) return (ms / 1000).toFixed(2) + " s";
  return Math.round(ms) + " ms";
}

/** Recorta un texto largo con elipsis. */
export function truncate(s: string, max = 42): string {
  return s.length > max ? s.slice(0, max - 1) + "…" : s;
}

/** Convierte filas en data de charts {label, value}. */
export function toData(
  rows: Row[],
  labelKey: string,
  valueKey: string,
  opts: { color?: (i: number, row: Row) => string; sub?: (row: Row) => string } = {},
): { label: string; value: number; color?: string; sub?: string }[] {
  return rows.map((r, i) => ({
    label: str(r, labelKey),
    value: num(r, valueKey),
    color: opts.color?.(i, r),
    sub: opts.sub?.(r),
  }));
}
