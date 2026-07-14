import { useState, type ReactNode } from "react";

import { fmtMs } from "./format";
import { tone as toneColor, type ToneKey } from "./palette";

/* ── Layout ─────────────────────────────────────────────────────────── */

export function KpiRow({ children }: { children: ReactNode }) {
  return <div className="dash-kpirow">{children}</div>;
}

export function DashGrid({ children, min = 340 }: { children: ReactNode; min?: number }) {
  return (
    <div className="dash-grid" style={{ ["--min" as string]: `${min}px` }}>
      {children}
    </div>
  );
}

export function DashSection({
  eyebrow,
  title,
  actions,
  children,
}: {
  eyebrow?: string;
  title?: string;
  actions?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="dash-section">
      {(eyebrow || title || actions) && (
        <header className="dash-section__head">
          <div>
            {eyebrow && <span className="eyebrow">{eyebrow}</span>}
            {title && <h2 className="dash-section__title display">{title}</h2>}
          </div>
          {actions && <div className="dash-section__actions">{actions}</div>}
        </header>
      )}
      {children}
    </section>
  );
}

/* ── KPI ────────────────────────────────────────────────────────────── */

export function KpiCard({
  label,
  value,
  sub,
  delta,
  tone = "plain",
  loading,
  hint,
}: {
  label: string;
  value: ReactNode;
  sub?: ReactNode;
  delta?: { value: number; dir?: "up" | "down"; good?: boolean };
  tone?: ToneKey;
  loading?: boolean;
  hint?: string;
}) {
  const accent = toneColor(tone);
  return (
    <div className="dash-kpi" style={{ ["--accent" as string]: accent }} title={hint}>
      <span className="dash-kpi__label">{label}</span>
      {loading ? (
        <span className="dash-kpi__value dash-kpi__value--skeleton">·····</span>
      ) : (
        <span className="dash-kpi__value display">{value}</span>
      )}
      <div className="dash-kpi__foot">
        {delta && (
          <span className={`dash-delta ${delta.good ?? (delta.dir === "up") ? "dash-delta--good" : "dash-delta--bad"}`}>
            {(delta.dir === "down" ? "▾" : "▴")} {Math.abs(delta.value)}
          </span>
        )}
        {sub && <span className="dash-kpi__sub">{sub}</span>}
      </div>
    </div>
  );
}

/* ── Chips / badges ─────────────────────────────────────────────────── */

export function Chip({ children, tone = "muted" }: { children: ReactNode; tone?: ToneKey }) {
  const c = toneColor(tone);
  return (
    <span className="dash-chip" style={{ color: c, borderColor: `color-mix(in srgb, ${c} 45%, transparent)` }}>
      {children}
    </span>
  );
}

export function Dot({ color }: { color: string }) {
  return <i className="dash-dot" style={{ background: color, boxShadow: `0 0 8px ${color}` }} />;
}

/* ── Panel (tarjeta con toggle de Cypher) ───────────────────────────── */

export function Panel({
  title,
  subtitle,
  cypher,
  ms,
  loading,
  error,
  empty,
  emptyLabel = "sin coincidencias en el grafo",
  actions,
  span,
  accent,
  children,
  footer,
}: {
  title?: string;
  subtitle?: string;
  cypher?: string;
  ms?: number;
  loading?: boolean;
  error?: string | null;
  empty?: boolean;
  emptyLabel?: string;
  actions?: ReactNode;
  span?: 1 | 2 | 3 | "full";
  accent?: string;
  children?: ReactNode;
  footer?: ReactNode;
}) {
  const [showCode, setShowCode] = useState(false);
  const gridColumn = span === "full" ? "1 / -1" : span ? `span ${span}` : undefined;

  return (
    <div className="dash-panel" style={{ gridColumn, ["--panel-accent" as string]: accent ?? "var(--rosa)" }}>
      {(title || cypher || actions) && (
        <header className="dash-panel__head">
          <div className="dash-panel__titles">
            {title && <h3 className="dash-panel__title">{title}</h3>}
            {subtitle && <p className="dash-panel__sub">{subtitle}</p>}
          </div>
          <div className="dash-panel__tools">
            {actions}
            {cypher && (
              <button
                className={`dash-codebtn ${showCode ? "activo" : ""}`}
                onClick={() => setShowCode((s) => !s)}
                title="Ver el Cypher que alimenta este panel"
              >
                ‹/› Cypher
              </button>
            )}
          </div>
        </header>
      )}

      {showCode && cypher && (
        <div className="dash-code">
          <div className="dash-code__bar">
            <span>motor real · namidb 2.0.0 · memory://</span>
            {typeof ms === "number" && <span className="dash-code__ms">{fmtMs(ms)}</span>}
          </div>
          <pre>{cypher}</pre>
        </div>
      )}

      <div className="dash-panel__body">
        {loading ? (
          <Loading />
        ) : error ? (
          <div className="dash-panel__error">motor: {error}</div>
        ) : empty ? (
          <div className="dash-panel__empty">{emptyLabel}</div>
        ) : (
          children
        )}
      </div>

      {footer && !loading && !error && <footer className="dash-panel__foot">{footer}</footer>}
    </div>
  );
}

export function Loading({ lines = 4 }: { lines?: number }) {
  return (
    <div className="dash-loading">
      {Array.from({ length: lines }).map((_, i) => (
        <span key={i} className="dash-loading__bar" style={{ width: `${90 - i * 12}%` }} />
      ))}
    </div>
  );
}
