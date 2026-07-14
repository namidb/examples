import { useEffect, useRef, useState, type ReactNode } from "react";

import { fmtInt } from "./format";
import { riskColor, serie } from "./palette";

export interface Datum {
  label: string;
  value: number;
  color?: string;
  sub?: string;
}

type Fmt = (n: number) => string;

/* Mide el ancho disponible para dibujar SVG a resolución de píxel (nítido). */
function useMeasure(): [React.RefObject<HTMLDivElement>, number] {
  const ref = useRef<HTMLDivElement>(null);
  const [w, setW] = useState(560);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setW(Math.max(200, el.clientWidth)));
    ro.observe(el);
    setW(Math.max(200, el.clientWidth));
    return () => ro.disconnect();
  }, []);
  return [ref, w];
}

/* ── Barras horizontales (rankings, categorías con etiqueta larga) ──── */

export function BarChart({
  data,
  format = fmtInt,
  max,
  accent = "var(--rosa)",
  showRank = false,
  onClick,
  activeLabel,
}: {
  data: Datum[];
  format?: Fmt;
  max?: number;
  accent?: string;
  showRank?: boolean;
  onClick?: (d: Datum, i: number) => void;
  activeLabel?: string;
}) {
  const top = max ?? Math.max(1, ...data.map((d) => d.value));
  return (
    <div className={`chart-bars ${showRank ? "chart-bars--ranked" : ""}`}>
      {data.map((d, i) => (
        <div
          key={`${d.label}-${i}`}
          className={`chart-bars__row ${onClick ? "clickable" : ""} ${activeLabel === d.label ? "activa" : ""}`}
          onClick={onClick ? () => onClick(d, i) : undefined}
        >
          {showRank && <span className="chart-bars__rank">{i + 1}</span>}
          <span className="chart-bars__label" title={d.label}>
            {d.label}
          </span>
          <span className="chart-bars__track">
            <span
              className="chart-bars__fill"
              style={{ width: `${Math.max(1.5, (d.value / top) * 100)}%`, background: d.color ?? accent }}
            />
          </span>
          <span className="chart-bars__val">{format(d.value)}</span>
          {d.sub !== undefined && <span className="chart-bars__sub">{d.sub}</span>}
        </div>
      ))}
    </div>
  );
}

/** Lista ranqueada: barras con número de posición. */
export function RankList(props: Omit<Parameters<typeof BarChart>[0], "showRank">) {
  return <BarChart {...props} showRank />;
}

/* ── Columnas verticales (series categóricas / temporales cortas) ───── */

export function ColumnChart({
  data,
  format = fmtInt,
  height = 190,
  accent = "var(--rosa)",
  labelRotate = false,
}: {
  data: Datum[];
  format?: Fmt;
  height?: number;
  accent?: string;
  labelRotate?: boolean;
}) {
  const [ref, w] = useMeasure();
  const padL = 6;
  const padR = 6;
  const padTop = 16;
  const padBot = labelRotate ? 52 : 30;
  const top = Math.max(1, ...data.map((d) => d.value));
  const innerW = Math.max(1, w - padL - padR);
  const innerH = Math.max(1, height - padTop - padBot);
  const n = Math.max(1, data.length);
  const slot = innerW / n;
  const bw = Math.min(46, slot * 0.62);

  return (
    <div className="chart-svg" ref={ref}>
      <svg width={w} height={height} role="img">
        {[0.25, 0.5, 0.75, 1].map((g) => (
          <line
            key={g}
            x1={padL}
            x2={w - padR}
            y1={padTop + innerH * (1 - g)}
            y2={padTop + innerH * (1 - g)}
            stroke="rgba(244,238,241,0.07)"
          />
        ))}
        {data.map((d, i) => {
          const h = (d.value / top) * innerH;
          const x = padL + slot * i + (slot - bw) / 2;
          const y = padTop + innerH - h;
          return (
            <g key={`${d.label}-${i}`}>
              <rect x={x} y={y} width={bw} height={Math.max(0, h)} rx={2} fill={d.color ?? accent}>
                <title>{`${d.label}: ${format(d.value)}`}</title>
              </rect>
              <text x={x + bw / 2} y={y - 5} className="chart-svg__val" textAnchor="middle">
                {format(d.value)}
              </text>
              <text
                x={x + bw / 2}
                y={height - padBot + 14}
                className="chart-svg__xlabel"
                textAnchor={labelRotate ? "end" : "middle"}
                transform={labelRotate ? `rotate(-32 ${x + bw / 2} ${height - padBot + 14})` : undefined}
              >
                {d.label.length > 14 ? d.label.slice(0, 13) + "…" : d.label}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

/* ── Líneas / área (tendencias) ─────────────────────────────────────── */

export interface Serie {
  name: string;
  color?: string;
  points: { x: string | number; y: number }[];
}

export function LineChart({
  series,
  format = fmtInt,
  height = 210,
  area = false,
  legend = true,
}: {
  series: Serie[];
  format?: Fmt;
  height?: number;
  area?: boolean;
  legend?: boolean;
}) {
  const [ref, w] = useMeasure();
  const padL = 44;
  const padR = 14;
  const padTop = 14;
  const padBot = 28;
  const innerW = Math.max(1, w - padL - padR);
  const innerH = Math.max(1, height - padTop - padBot);
  const len = Math.max(1, ...series.map((s) => s.points.length));
  const maxY = Math.max(1, ...series.flatMap((s) => s.points.map((p) => p.y)));
  const xLabels = series[0]?.points.map((p) => String(p.x)) ?? [];

  const xAt = (i: number) => padL + (len === 1 ? innerW / 2 : (i / (len - 1)) * innerW);
  const yAt = (v: number) => padTop + innerH - (v / maxY) * innerH;
  const step = Math.ceil(len / 8);

  return (
    <div className="chart-svg" ref={ref}>
      <svg width={w} height={height} role="img">
        {[0, 0.5, 1].map((g) => {
          const y = padTop + innerH * (1 - g);
          return (
            <g key={g}>
              <line x1={padL} x2={w - padR} y1={y} y2={y} stroke="rgba(244,238,241,0.07)" />
              <text x={padL - 8} y={y + 3} className="chart-svg__ylabel" textAnchor="end">
                {format(maxY * g)}
              </text>
            </g>
          );
        })}
        {series.map((s, si) => {
          const color = s.color ?? serie(si);
          const pts = s.points.map((p, i) => `${xAt(i)},${yAt(p.y)}`).join(" ");
          const areaPts = `${padL},${padTop + innerH} ${pts} ${xAt(s.points.length - 1)},${padTop + innerH}`;
          return (
            <g key={s.name}>
              {area && <polygon points={areaPts} fill={color} opacity={0.1} />}
              <polyline points={pts} fill="none" stroke={color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
              {s.points.map((p, i) => (
                <circle key={i} cx={xAt(i)} cy={yAt(p.y)} r={2.4} fill={color}>
                  <title>{`${s.name} · ${p.x}: ${format(p.y)}`}</title>
                </circle>
              ))}
            </g>
          );
        })}
        {xLabels.map((lab, i) =>
          i % step === 0 || i === xLabels.length - 1 ? (
            <text key={i} x={xAt(i)} y={height - 8} className="chart-svg__xlabel" textAnchor="middle">
              {lab.length > 8 ? lab.slice(5) : lab}
            </text>
          ) : null,
        )}
      </svg>
      {legend && series.length > 1 && (
        <div className="chart-legend">
          {series.map((s, si) => (
            <span key={s.name}>
              <i style={{ background: s.color ?? serie(si) }} />
              {s.name}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

/* ── Dona (distribución) ────────────────────────────────────────────── */

function polar(cx: number, cy: number, r: number, deg: number): [number, number] {
  const a = ((deg - 90) * Math.PI) / 180;
  return [cx + r * Math.cos(a), cy + r * Math.sin(a)];
}

function arc(cx: number, cy: number, r: number, start: number, end: number): string {
  const [sx, sy] = polar(cx, cy, r, end);
  const [ex, ey] = polar(cx, cy, r, start);
  const large = end - start <= 180 ? 0 : 1;
  return `M ${sx} ${sy} A ${r} ${r} 0 ${large} 0 ${ex} ${ey}`;
}

export function DonutChart({
  data,
  size = 168,
  thickness = 22,
  centerValue,
  centerLabel,
  format = fmtInt,
  legend = true,
}: {
  data: Datum[];
  size?: number;
  thickness?: number;
  centerValue?: ReactNode;
  centerLabel?: string;
  format?: Fmt;
  legend?: boolean;
}) {
  const total = data.reduce((a, d) => a + d.value, 0) || 1;
  const r = (size - thickness) / 2;
  const cx = size / 2;
  const cy = size / 2;
  let cursor = 0;

  return (
    <div className="chart-donut">
      <svg width={size} height={size} role="img">
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="rgba(244,238,241,0.07)" strokeWidth={thickness} />
        {data.map((d, i) => {
          const frac = d.value / total;
          const start = cursor * 360;
          const end = (cursor + frac) * 360;
          cursor += frac;
          const color = d.color ?? serie(i);
          if (frac <= 0) return null;
          return (
            <path
              key={`${d.label}-${i}`}
              d={arc(cx, cy, r, start, Math.min(end, start + 359.999))}
              fill="none"
              stroke={color}
              strokeWidth={thickness}
              strokeLinecap="butt"
            >
              <title>{`${d.label}: ${format(d.value)}`}</title>
            </path>
          );
        })}
        {centerValue !== undefined && (
          <text x={cx} y={cy - 2} className="chart-donut__val display" textAnchor="middle">
            {centerValue}
          </text>
        )}
        {centerLabel && (
          <text x={cx} y={cy + 16} className="chart-donut__lab" textAnchor="middle">
            {centerLabel}
          </text>
        )}
      </svg>
      {legend && (
        <div className="chart-donut__legend">
          {data.map((d, i) => (
            <span key={`${d.label}-${i}`}>
              <i style={{ background: d.color ?? serie(i) }} />
              <span className="chart-donut__legname">{d.label}</span>
              <b>{format(d.value)}</b>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

/* ── Gauge semicircular (riesgo / cumplimiento) ─────────────────────── */

export function Gauge({
  value,
  max,
  label,
  format = fmtInt,
  color,
  size = 200,
}: {
  value: number;
  max: number;
  label?: string;
  format?: Fmt;
  color?: string;
  size?: number;
}) {
  const frac = Math.max(0, Math.min(1, value / (max || 1)));
  const r = size / 2 - 16;
  const cx = size / 2;
  const cy = size / 2 + 8;
  const c = color ?? riskColor(frac);
  // Semicírculo superior: 180° (izq) → 360° (der).
  const end = 180 + frac * 180;
  return (
    <div className="chart-gauge">
      <svg width={size} height={size / 2 + 34} role="img">
        <path d={arc(cx, cy, r, 180, 360)} fill="none" stroke="rgba(244,238,241,0.08)" strokeWidth={16} strokeLinecap="round" />
        <path d={arc(cx, cy, r, 180, end)} fill="none" stroke={c} strokeWidth={16} strokeLinecap="round" />
        <text x={cx} y={cy - 4} className="chart-gauge__val display" textAnchor="middle" style={{ fill: c }}>
          {format(value)}
        </text>
        {label && (
          <text x={cx} y={cy + 18} className="chart-gauge__lab" textAnchor="middle">
            {label}
          </text>
        )}
      </svg>
    </div>
  );
}

/* ── Sparkline ──────────────────────────────────────────────────────── */

export function Sparkline({
  points,
  color = "var(--rosa)",
  width = 120,
  height = 30,
}: {
  points: number[];
  color?: string;
  width?: number;
  height?: number;
}) {
  if (points.length === 0) return null;
  const max = Math.max(1, ...points);
  const min = Math.min(0, ...points);
  const span = max - min || 1;
  const dx = width / Math.max(1, points.length - 1);
  const path = points.map((p, i) => `${i * dx},${height - ((p - min) / span) * height}`).join(" ");
  return (
    <svg width={width} height={height} className="chart-spark">
      <polyline points={path} fill="none" stroke={color} strokeWidth={1.6} strokeLinejoin="round" />
    </svg>
  );
}
