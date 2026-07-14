import { useMemo, useState, type ReactNode } from "react";

import type { Row } from "./format";
import { tone as toneColor, type ToneKey } from "./palette";

export interface Column {
  key: string;
  label?: string;
  align?: "left" | "right" | "center";
  render?: (value: unknown, row: Row) => ReactNode;
  format?: (n: number) => string;
  width?: string;
  mono?: boolean;
}

function defaultCell(value: unknown): ReactNode {
  if (value === null || value === undefined) return <span className="dt-null">∅</span>;
  if (typeof value === "boolean") return value ? "✓" : "·";
  if (Array.isArray(value)) return value.map((v) => String(v)).join(", ");
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

export function DataTable({
  columns,
  rows,
  onRowClick,
  activeIndex,
  maxHeight = 360,
  rowTone,
  sortable = true,
}: {
  columns?: Column[];
  rows: Row[];
  onRowClick?: (row: Row, i: number) => void;
  activeIndex?: number;
  maxHeight?: number;
  rowTone?: (row: Row) => ToneKey | undefined;
  sortable?: boolean;
}) {
  const cols: Column[] = useMemo(() => {
    if (columns && columns.length) return columns;
    const keys = rows[0] ? Object.keys(rows[0]) : [];
    return keys.map((k) => ({ key: k }));
  }, [columns, rows]);

  const [sortKey, setSortKey] = useState<string | null>(null);
  const [dir, setDir] = useState<1 | -1>(-1);

  const sorted = useMemo(() => {
    if (!sortKey) return rows;
    const copy = [...rows];
    copy.sort((a, b) => {
      const av = a[sortKey];
      const bv = b[sortKey];
      if (typeof av === "number" && typeof bv === "number") return (av - bv) * dir;
      return String(av ?? "").localeCompare(String(bv ?? "")) * dir;
    });
    return copy;
  }, [rows, sortKey, dir]);

  function toggleSort(k: string) {
    if (!sortable) return;
    if (sortKey === k) setDir((d) => (d === 1 ? -1 : 1));
    else {
      setSortKey(k);
      setDir(-1);
    }
  }

  return (
    <div className="dt-wrap" style={{ maxHeight }}>
      <table className="dt">
        <thead>
          <tr>
            {cols.map((c) => (
              <th
                key={c.key}
                className={`${sortable ? "sortable" : ""} ${sortKey === c.key ? "sorted" : ""}`}
                style={{ textAlign: c.align ?? "left", width: c.width }}
                onClick={() => toggleSort(c.key)}
              >
                {c.label ?? c.key}
                {sortKey === c.key && <span className="dt-arrow">{dir === 1 ? " ▴" : " ▾"}</span>}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sorted.map((row, i) => {
            const t = rowTone?.(row);
            return (
              <tr
                key={i}
                className={`${onRowClick ? "clickable" : ""} ${activeIndex === i ? "activa" : ""}`}
                onClick={onRowClick ? () => onRowClick(row, i) : undefined}
                style={t ? { boxShadow: `inset 3px 0 0 ${toneColor(t)}` } : undefined}
              >
                {cols.map((c) => {
                  const v = row[c.key];
                  let content: ReactNode;
                  if (c.render) content = c.render(v, row);
                  else if (c.format && typeof v === "number") content = c.format(v);
                  else content = defaultCell(v);
                  return (
                    <td key={c.key} style={{ textAlign: c.align ?? "left" }} className={c.mono ? "mono" : undefined}>
                      {content}
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
