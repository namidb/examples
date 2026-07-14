import type { ResultadoCypher } from "../types";

function celda(valor: unknown): string {
  if (valor === null || valor === undefined) return "∅";
  if (typeof valor === "object") return JSON.stringify(valor, null, 0);
  return String(valor);
}

export default function ResultTable({ resultado }: { resultado: ResultadoCypher }) {
  return (
    <div className="resultado">
      <div className="resultado__cab">
        <span>{resultado.rows.length} filas{resultado.truncated ? " (truncado a 500)" : ""}</span>
        <span className="ms">{resultado.ms} ms</span>
        <span className="motor">motor real · namidb 2.0.0 · memory://</span>
      </div>
      <div className="resultado__scroll">
        {resultado.rows.length === 0 ? (
          <p style={{ padding: "1.2rem", color: "var(--gris-2)", fontFamily: "var(--mono)", fontSize: "0.78rem" }}>
            (sin filas)
          </p>
        ) : (
          <table className="tabla">
            <thead>
              <tr>
                {resultado.columns.map((col) => (
                  <th key={col}>{col}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {resultado.rows.map((fila, i) => (
                <tr key={i}>
                  {resultado.columns.map((col) => (
                    <td key={col}>{celda(fila[col])}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
