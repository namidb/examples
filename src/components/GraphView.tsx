import { useEffect, useMemo, useRef, useState } from "react";
import ForceGraph2D from "react-force-graph-2d";

import type { Grafo } from "../types";

/* Paleta de nodos: rosa protagonista + familia de apoyo del deck. */
const COLORES = [
  "#ff2d78", "#f4eef1", "#ffb03a", "#5ad7ff", "#b78bff",
  "#6fe3a5", "#ff7d6b", "#e6c8d4", "#8f9bff", "#ffd23a",
];

export default function GraphView({ grafo }: { grafo: Grafo }) {
  const cajaRef = useRef<HTMLDivElement>(null);
  const [dims, setDims] = useState({ w: 800, h: 440 });

  useEffect(() => {
    const caja = cajaRef.current;
    if (!caja) return;
    const observer = new ResizeObserver(() =>
      setDims({ w: caja.clientWidth, h: caja.clientHeight }),
    );
    observer.observe(caja);
    return () => observer.disconnect();
  }, []);

  const colorPorLabel = useMemo(() => {
    const mapa: Record<string, string> = {};
    grafo.labels.forEach((label, i) => {
      mapa[label] = COLORES[i % COLORES.length];
    });
    return mapa;
  }, [grafo.labels]);

  const datos = useMemo(
    () => ({
      nodes: grafo.nodes.map((n) => ({ ...n })),
      links: grafo.links.map((l) => ({ ...l })),
    }),
    [grafo],
  );

  return (
    <div className="grafo-caja" ref={cajaRef}>
      <ForceGraph2D
        width={dims.w}
        height={dims.h}
        graphData={datos}
        backgroundColor="rgba(0,0,0,0)"
        nodeRelSize={4}
        linkColor={() => "rgba(244,238,241,0.16)"}
        linkWidth={0.6}
        linkDirectionalArrowLength={2.6}
        linkDirectionalArrowRelPos={0.92}
        linkDirectionalArrowColor={() => "rgba(255,45,120,0.55)"}
        cooldownTicks={140}
        nodeLabel={(n: any) => `${n.label} · ${n.caption}`}
        nodeCanvasObject={(n: any, ctx, escala) => {
          const color = colorPorLabel[n.label] ?? "#f4eef1";
          const radio = n.label === grafo.labels[0] ? 4.5 : 3.5;
          ctx.shadowColor = color;
          ctx.shadowBlur = color === "#ff2d78" ? 14 : 7;
          ctx.beginPath();
          ctx.arc(n.x, n.y, radio, 0, 2 * Math.PI);
          ctx.fillStyle = color;
          ctx.fill();
          ctx.shadowBlur = 0;
          if (escala > 1.7) {
            ctx.font = `${Math.max(9 / escala, 1.6)}px "IBM Plex Mono", monospace`;
            ctx.fillStyle = "rgba(244,238,241,0.82)";
            ctx.textAlign = "center";
            ctx.fillText(String(n.caption).slice(0, 26), n.x, n.y + radio + 8 / escala);
          }
        }}
      />
      <div className="grafo-caja__leyenda">
        {grafo.labels.map((label) => (
          <span key={label}>
            <i style={{ background: colorPorLabel[label] }} />
            {label}
            {grafo.leyenda[label] ? ` — ${grafo.leyenda[label]}` : ""}
          </span>
        ))}
      </div>
    </div>
  );
}
