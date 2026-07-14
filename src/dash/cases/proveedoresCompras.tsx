import { useState } from "react";

import {
  ColumnChart,
  DashGrid,
  DashSection,
  DataTable,
  GraphView,
  KpiCard,
  KpiRow,
  Panel,
  RankList,
  accent,
  arr,
  fmtInt,
  fmtMoney,
  fmtMoneyExact,
  fmtPct,
  firstRow,
  flags,
  num,
  str,
  useGrafo,
  usePanels,
  type Column,
} from "../kit";
import type { DashProps } from "../dashProps";

const ACEROS_RUC = "1790012345001";

const Q = {
  // ── KPIs ────────────────────────────────────────────────────────────
  logicos: `MATCH (p:Proveedor)
RETURN count(DISTINCT p.ruc) AS logicos, count(p) AS registros`,

  gasto: `MATCH (oc:OrdenCompra)
RETURN sum(oc.monto) AS gasto, count(oc) AS ordenes`,

  duplicados: `MATCH (p:Proveedor)
WITH p.ruc AS ruc, count(*) AS c
WHERE c > 1
RETURN count(ruc) AS grupos, sum(c) AS registros_dup`,

  concentracion: `MATCH (oc:OrdenCompra)-[:EMITIDA_A]->(p:Proveedor)
WITH p.ruc AS ruc, sum(oc.monto) AS g
WITH max(g) AS top, sum(g) AS total
RETURN top, total, round(top * 1000.0 / total) / 10 AS pct`,

  fuera: `MATCH (oc:OrdenCompra)-[:EMITIDA_A]->(p:Proveedor)-[:CON_CONTRATO]->(ct:Contrato)
WHERE oc.fecha > ct.vence
RETURN count(oc) AS n, sum(oc.monto) AS monto`,

  // ── Paneles ─────────────────────────────────────────────────────────
  consolidado: `MATCH (oc:OrdenCompra)-[:EMITIDA_A]->(p:Proveedor)
WITH p.ruc AS ruc, sum(oc.monto) AS gasto_total, count(oc) AS ordenes,
     collect(DISTINCT p.nombre) AS visto_como,
     collect(DISTINCT p.sistema) AS sistemas
RETURN ruc, gasto_total, ordenes, sistemas, visto_como
ORDER BY gasto_total DESC
LIMIT 8`,

  drill: `MATCH (oc:OrdenCompra)-[:EMITIDA_A]->(p:Proveedor {ruc:$ruc})
WITH p.sistema AS sistema, p.nombre AS nombre,
     sum(oc.monto) AS gasto, count(oc) AS ordenes
RETURN sistema, nombre, gasto, ordenes
ORDER BY gasto DESC`,

  duplicadosTabla: `MATCH (p:Proveedor)
WITH p.ruc AS ruc, collect(DISTINCT p.nombre) AS nombres,
     collect(DISTINCT p.sistema) AS sistemas, count(*) AS registros
WHERE registros > 1
RETURN ruc, registros, sistemas, nombres
ORDER BY registros DESC`,

  dependencia: `MATCH (m:MateriaPrima {critica: true})<-[:POR_MATERIA]-(oc:OrdenCompra)-[:EMITIDA_A]->(p:Proveedor)
WITH m.nombre AS materia, count(DISTINCT p.ruc) AS proveedores_reales,
     collect(DISTINCT p.nombre) AS registrados_como, sum(oc.monto) AS gasto
WHERE proveedores_reales = 1
RETURN materia, proveedores_reales, gasto, registrados_como`,

  contrato: `MATCH (oc:OrdenCompra)-[:EMITIDA_A]->(p:Proveedor)-[:CON_CONTRATO]->(ct:Contrato)
WHERE oc.fecha > ct.vence
RETURN p.nombre AS proveedor, p.sistema AS sistema, ct.codigo AS contrato,
       ct.vence AS vencio, oc.numero AS orden, oc.fecha AS emitida,
       oc.monto AS monto
ORDER BY oc.fecha`,

  alternativa: `MATCH (ocx:OrdenCompra)-[:EMITIDA_A]->(px:Proveedor)
WITH collect(DISTINCT px.codigo_erp) AS con_ordenes
MATCH (m:MateriaPrima {critica: true})<-[:POR_MATERIA]-(oc:OrdenCompra)-[:EMITIDA_A]->(actual:Proveedor)
MATCH (m)<-[sa:SUMINISTRA]-(actual)
WITH con_ordenes, m.nombre AS materia, max(sa.precio_unitario) AS precio_actual
MATCH (m2:MateriaPrima {nombre: materia})<-[salt:SUMINISTRA]-(alt:Proveedor)
MATCH (alt)-[:CON_CERTIFICADO]->(c:Certificado)
WHERE c.vence > '2026-07-13' AND NOT alt.codigo_erp IN con_ordenes
RETURN materia, alt.nombre AS alternativa, c.tipo AS certificado,
       c.vence AS certificado_vigente_hasta,
       salt.precio_unitario AS precio_alternativa, precio_actual,
       round((precio_actual - salt.precio_unitario) * 100) / 100 AS ahorro_unitario`,
};

export default function ProveedoresCompras({ slug }: DashProps) {
  const acc = accent(slug);
  const [sel, setSel] = useState(ACEROS_RUC);

  const { panels } = usePanels(slug, {
    logicos: { cypher: Q.logicos },
    gasto: { cypher: Q.gasto },
    duplicados: { cypher: Q.duplicados },
    concentracion: { cypher: Q.concentracion },
    fuera: { cypher: Q.fuera },
    consolidado: { cypher: Q.consolidado },
    duplicadosTabla: { cypher: Q.duplicadosTabla },
    dependencia: { cypher: Q.dependencia },
    contrato: { cypher: Q.contrato },
    alternativa: { cypher: Q.alternativa },
  });
  const { panels: drillP } = usePanels(slug, {
    drill: { cypher: Q.drill, params: { ruc: sel } },
  });
  const { grafo } = useGrafo(slug);

  const logicos = firstRow(panels.logicos);
  const gasto = firstRow(panels.gasto);
  const duplicados = firstRow(panels.duplicados);
  const concentracion = firstRow(panels.concentracion);
  const fuera = firstRow(panels.fuera);
  const alt = firstRow(panels.alternativa);

  const consolidado = panels.consolidado?.rows ?? [];
  const nombreDe = (ruc: string) => {
    const row = consolidado.find((r) => str(r, "ruc") === ruc);
    const vistos = row ? arr(row, "visto_como") : [];
    return vistos.length ? String(vistos[0]) : ruc;
  };
  const selNombre = nombreDe(sel);
  const selIdx = consolidado.findIndex((r) => str(r, "ruc") === sel);
  const selRegistros = arr(consolidado.find((r) => str(r, "ruc") === sel), "sistemas").length;

  const drillRows = drillP.drill?.rows ?? [];
  const drillData = drillRows.map((r) => ({
    label: str(r, "sistema"),
    value: num(r, "gasto"),
    color: acc,
  }));
  const drillTotal = drillRows.reduce((a, r) => a + num(r, "gasto"), 0);

  const consolidadoData = consolidado.map((r) => {
    const vistos = arr(r, "visto_como");
    const nombre = vistos.length ? String(vistos[0]) : str(r, "ruc");
    const multi = arr(r, "sistemas").length > 1;
    return {
      label: multi ? `${nombre} +${arr(r, "sistemas").length - 1} ERP` : nombre,
      value: num(r, "gasto_total"),
      sub: `${fmtInt(num(r, "ordenes"))} órdenes`,
      color: str(r, "ruc") === sel ? "var(--error)" : multi ? acc : "var(--gris)",
    };
  });

  const duplicadosCols: Column[] = [
    { key: "ruc", label: "RUC (identidad real)", mono: true },
    { key: "registros", label: "Registros", align: "right", format: fmtInt },
    { key: "sistemas", label: "ERP" },
    { key: "nombres", label: "Nombres en cada sistema" },
  ];

  const contratoCols: Column[] = [
    { key: "proveedor", label: "Proveedor" },
    { key: "contrato", label: "Contrato", mono: true },
    { key: "vencio", label: "Venció", mono: true },
    { key: "emitida", label: "OC emitida", mono: true },
    { key: "monto", label: "Monto", align: "right", format: (n) => fmtMoneyExact(n) },
  ];

  return (
    <div>
      <KpiRow>
        <KpiCard
          label="Proveedores lógicos"
          value={fmtInt(num(logicos, "logicos"))}
          tone="info"
          loading={panels.logicos?.loading}
          sub={`${fmtInt(num(logicos, "registros"))} registros en los ERP · la identidad real es el RUC`}
        />
        <KpiCard
          label="Proveedores duplicados"
          value={fmtInt(num(duplicados, "grupos"))}
          tone="warn"
          loading={panels.duplicados?.loading}
          sub={`${fmtInt(num(duplicados, "registros_dup"))} registros son en realidad la misma empresa`}
        />
        <KpiCard
          label="Gasto total consolidado"
          value={fmtMoney(num(gasto, "gasto"))}
          loading={panels.gasto?.loading}
          sub={`${fmtInt(num(gasto, "ordenes"))} órdenes de compra en 3 sistemas`}
        />
        <KpiCard
          label="Dependencia máxima"
          value={fmtPct(num(concentracion, "pct"), 1)}
          tone="bad"
          loading={panels.concentracion?.loading}
          sub={`${fmtMoney(num(concentracion, "top"))} en un solo proveedor real · single point of failure`}
        />
        <KpiCard
          label="Compras fuera de contrato"
          value={fmtMoney(num(fuera, "monto"))}
          tone="bad"
          loading={panels.fuera?.loading}
          sub={`${fmtInt(num(fuera, "n"))} órdenes tras vencer el contrato marco`}
        />
      </KpiRow>

      <DashSection
        eyebrow="Lo que ningún ERP ve por sí solo"
        title="El proveedor #1 real, oculto en tres sistemas"
      >
        <DashGrid min={400}>
          <Panel
            title="Gasto consolidado por proveedor lógico"
            subtitle="Agrupado por RUC. El líder aparece por encima del top aparente de cualquier ERP aislado. Clic para desglosar."
            cypher={Q.consolidado}
            accent={acc}
            {...flags(panels.consolidado)}
          >
            <RankList
              data={consolidadoData}
              format={(n) => fmtMoney(n)}
              onClick={(_, i) => setSel(str(consolidado[i], "ruc"))}
              activeLabel={selIdx >= 0 ? consolidadoData[selIdx]?.label : undefined}
            />
            <p className="dash-note">
              Las barras <b style={{ color: acc }}>en color</b> son proveedores registrados en más de un ERP:
              su gasto real solo se ve al consolidar por RUC.
            </p>
          </Panel>

          <Panel
            title={`Radiografía por ERP — ${selNombre}`}
            subtitle={
              selRegistros > 1
                ? `Un mismo proveedor fragmentado en ${selRegistros} sistemas. Ningún ERP ve el total de ${fmtMoney(drillTotal)}.`
                : `Proveedor con registro único. Gasto total ${fmtMoney(drillTotal)}.`
            }
            cypher={Q.drill}
            accent="var(--error)"
            {...flags(drillP.drill)}
            emptyLabel="sin órdenes para este proveedor"
          >
            <ColumnChart data={drillData} format={(n) => fmtMoney(n)} accent={acc} />
            <div style={{ display: "flex", flexDirection: "column", gap: "0.3rem", marginTop: "0.6rem" }}>
              {drillRows.map((r, i) => (
                <div
                  key={i}
                  style={{ display: "grid", gridTemplateColumns: "auto 1fr auto", gap: "0.6rem", alignItems: "baseline", fontSize: "0.78rem" }}
                >
                  <span className="mono" style={{ color: "var(--hueso)" }}>{str(r, "sistema")}</span>
                  <span style={{ color: "var(--gris)" }}>{str(r, "nombre")}</span>
                  <span className="mono">{fmtInt(num(r, "ordenes"))} OC · {fmtMoneyExact(num(r, "gasto"))}</span>
                </div>
              ))}
            </div>
          </Panel>
        </DashGrid>
      </DashSection>

      <DashSection
        eyebrow="Una identidad, muchos registros"
        title="Duplicados y dependencia crítica"
      >
        <DashGrid min={380}>
          <Panel
            title="Mismo RUC, distintos registros"
            subtitle="El proveedor real registrado con nombres y códigos distintos en cada sistema ERP."
            cypher={Q.duplicadosTabla}
            accent="#ffb020"
            {...flags(panels.duplicadosTabla)}
          >
            <DataTable
              rows={panels.duplicadosTabla?.rows ?? []}
              columns={duplicadosCols}
              maxHeight={260}
              rowTone={(r) => (num(r, "registros") >= 3 ? "bad" : "warn")}
            />
          </Panel>

          <Panel
            title="Materia crítica, proveedor único"
            subtitle="Insumos críticos cuyas compras van a un solo proveedor real — aunque en los ERP parezcan varios."
            cypher={Q.dependencia}
            accent="var(--error)"
            {...flags(panels.dependencia)}
          >
            {(() => {
              const d = firstRow(panels.dependencia);
              const registrados = arr(d, "registrados_como");
              return (
                <div>
                  <div style={{ display: "flex", alignItems: "baseline", gap: "0.6rem", marginBottom: "0.5rem" }}>
                    <span className="display" style={{ fontSize: "1.7rem", color: "var(--error)" }}>
                      {fmtMoney(num(d, "gasto"))}
                    </span>
                    <span style={{ color: "var(--gris)", fontSize: "0.82rem" }}>
                      en <b style={{ color: "var(--hueso)" }}>{str(d, "materia")}</b>
                    </span>
                  </div>
                  <p className="dash-note" style={{ marginTop: 0 }}>
                    100 % del gasto va a <b>1</b> proveedor real, registrado como{" "}
                    {registrados.map((n, i) => (
                      <b key={i} style={{ color: "var(--hueso)" }}>
                        {String(n)}
                        {i < registrados.length - 1 ? " · " : ""}
                      </b>
                    ))}
                    . Si ese proveedor falla, la línea se detiene.
                  </p>
                </div>
              );
            })()}
          </Panel>
        </DashGrid>
      </DashSection>

      <DashSection
        eyebrow="Riesgo y palanca de negociación"
        title="Contratos vencidos, alternativas y el mapa de la red"
      >
        <DashGrid min={360}>
          <Panel
            title="Compras después del vencimiento"
            subtitle="Órdenes emitidas cuando el contrato marco ya había caducado: riesgo jurídico y de precio que nadie veía."
            cypher={Q.contrato}
            accent="var(--error)"
            {...flags(panels.contrato)}
          >
            <DataTable
              rows={panels.contrato?.rows ?? []}
              columns={contratoCols}
              maxHeight={220}
              rowTone={() => "bad"}
            />
          </Panel>

          <Panel
            title="Alternativa certificada para negociar"
            subtitle="Un proveedor calificado y con certificado vigente, aún sin órdenes: la palanca para renegociar el insumo crítico."
            cypher={Q.alternativa}
            accent="var(--ok)"
            {...flags(panels.alternativa)}
          >
            {alt && (
              <div>
                <p className="dash-note" style={{ marginTop: 0 }}>
                  Para <b style={{ color: "var(--hueso)" }}>{str(alt, "materia")}</b> hoy pagamos hasta{" "}
                  <b>{fmtMoneyExact(num(alt, "precio_actual"))}</b>/unidad.
                </p>
                <div
                  style={{ display: "grid", gridTemplateColumns: "1fr auto 1fr", gap: "0.7rem", alignItems: "center", margin: "0.7rem 0" }}
                >
                  <div>
                    <span className="dash-kpi__label">Precio actual</span>
                    <div className="display" style={{ fontSize: "1.4rem" }}>{fmtMoneyExact(num(alt, "precio_actual"))}</div>
                  </div>
                  <span style={{ color: "var(--ok)", fontSize: "1.2rem" }}>→</span>
                  <div>
                    <span className="dash-kpi__label">{str(alt, "alternativa")}</span>
                    <div className="display" style={{ fontSize: "1.4rem", color: "var(--ok)" }}>
                      {fmtMoneyExact(num(alt, "precio_alternativa"))}
                    </div>
                  </div>
                </div>
                <p className="dash-note" style={{ marginBottom: 0 }}>
                  Ahorro de <b style={{ color: "var(--ok)" }}>{fmtMoneyExact(num(alt, "ahorro_unitario"))}</b> por unidad ·
                  certificado <b>{str(alt, "certificado")}</b> vigente hasta {str(alt, "certificado_vigente_hasta")}.
                </p>
              </div>
            )}
          </Panel>

          <Panel
            title="Mapa de identidades unificadas"
            span={2}
            accent={acc}
            subtitle="Proveedores, órdenes, materias, contratos y riesgos. La verdad de un proveedor vive en sus conexiones, no en un registro aislado."
          >
            {grafo ? (
              <GraphView grafo={grafo} />
            ) : (
              <div className="grafo-caja">
                <span className="grafo-caja__estado">sembrando…</span>
              </div>
            )}
          </Panel>
        </DashGrid>
      </DashSection>
    </div>
  );
}
