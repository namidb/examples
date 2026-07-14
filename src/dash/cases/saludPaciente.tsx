import { useState } from "react";

import {
  Chip,
  ColumnChart,
  DashGrid,
  DashSection,
  DataTable,
  DonutChart,
  GraphView,
  KpiCard,
  KpiRow,
  Panel,
  RankList,
  accent,
  colorFor,
  fmtInt,
  firstRow,
  flags,
  num,
  str,
  useGrafo,
  usePanels,
  type Column,
} from "../kit";
import type { DashProps } from "../dashProps";

const PACIENTE_ESTRELLA = "Marta Quishpe";

const Q = {
  pacientes: `MATCH (p:Paciente) RETURN count(p) AS n`,

  diagnosticos: `MATCH (:Consulta)-[r:DIAGNOSTICA]->(:Diagnostico) RETURN count(r) AS n`,

  cohorteDiabetes: `MATCH (p:Paciente)-[:TUVO]->(c:Consulta)-[:DIAGNOSTICA]->(d:Diagnostico {cie10:'E11'})
RETURN count(DISTINCT p) AS n`,

  topDiag: `MATCH (p:Paciente)-[:TUVO]->(c:Consulta)-[:DIAGNOSTICA]->(d:Diagnostico)
RETURN d.nombre AS diagnostico, d.cie10 AS cie10,
       count(DISTINCT p) AS pacientes, count(c) AS consultas
ORDER BY pacientes DESC, consultas DESC`,

  clinicas: `MATCH (c:Consulta)-[:EN_CLINICA]->(cl:Clinica)
RETURN cl.nombre AS clinica, count(c) AS consultas
ORDER BY consultas DESC`,

  comorbilidades: `MATCH (p:Paciente)-[:TUVO]->(c1:Consulta)-[:DIAGNOSTICA]->(d1:Diagnostico),
      (p)-[:TUVO]->(c2:Consulta)-[:DIAGNOSTICA]->(d2:Diagnostico)
WHERE d1.cie10 < d2.cie10
RETURN d1.nombre AS diag_a, d2.nombre AS diag_b, count(DISTINCT p) AS pacientes
ORDER BY pacientes DESC
LIMIT 8`,

  interacciones: `MATCH (p:Paciente)-[:TUVO]->(c1:Consulta)-[:PRESCRIBE]->(m1:Medicamento),
      (p)-[:TUVO]->(c2:Consulta)-[:PRESCRIBE]->(m2:Medicamento)
MATCH (m1)-[i:INTERACTUA_CON]->(m2)
RETURN p.nombre AS paciente, m1.nombre AS medicamento_a,
       m2.nombre AS medicamento_b, i.severidad AS severidad, i.nivel AS nivel
ORDER BY nivel`,

  contraindicaciones: `MATCH (p:Paciente)-[:ALERGICO_A]->(a:Alergia)<-[:CONTRAINDICADO_PARA]-(m:Medicamento)
MATCH (p)-[:TUVO]->(c:Consulta)-[:PRESCRIBE]->(m)
MATCH (c)-[:EN_CLINICA]->(cl:Clinica)
RETURN p.nombre AS paciente, m.nombre AS medicamento,
       a.sustancia AS alergia, c.fecha AS fecha, cl.nombre AS clinica`,

  duplicadas: `MATCH (p:Paciente)-[:TUVO]->(c1:Consulta)-[:SOLICITA]->(t1:Prueba),
      (p)-[:TUVO]->(c2:Consulta)-[:SOLICITA]->(t2:Prueba)
WHERE t1.tipo = t2.tipo AND t1.codigo < t2.codigo
  AND t2.dia - t1.dia < 60 AND t1.dia - t2.dia < 60
MATCH (c1)-[:EN_CLINICA]->(cl1:Clinica), (c2)-[:EN_CLINICA]->(cl2:Clinica)
WHERE cl1.nombre <> cl2.nombre
RETURN p.nombre AS paciente, t1.tipo AS prueba,
       t1.fecha AS fecha_1, cl1.nombre AS clinica_1,
       t2.fecha AS fecha_2, cl2.nombre AS clinica_2`,

  guias: `MATCH (p:Paciente)-[:TUVO]->(c0:Consulta)-[:DIAGNOSTICA]->(d:Diagnostico)
MATCH (g:Guia)-[:APLICA_A]->(d)
MATCH (g)-[:RECOMIENDA]->(t:Prueba)
WHERE NOT EXISTS { (t)<-[:SOLICITA]-(:Consulta) }
RETURN DISTINCT p.nombre AS paciente, g.nombre AS guia,
       d.nombre AS diagnostico, t.tipo AS pendiente`,

  fragmentacion: `MATCH (p:Paciente)-[:TUVO]->(c:Consulta)-[:EN_CLINICA]->(cl:Clinica)
WITH p, count(DISTINCT cl) AS clinicas, count(DISTINCT c) AS consultas
RETURN p.nombre AS paciente, clinicas, consultas
ORDER BY clinicas DESC, consultas DESC
LIMIT 12`,

  historial: `MATCH (p:Paciente {nombre:$paciente})-[:TUVO]->(c:Consulta)
MATCH (c)-[:EN_CLINICA]->(cl:Clinica)
OPTIONAL MATCH (c)-[:DIAGNOSTICA]->(d:Diagnostico)
OPTIONAL MATCH (c)-[:PRESCRIBE]->(m:Medicamento)
OPTIONAL MATCH (c)-[:SOLICITA]->(t:Prueba)
RETURN c.fecha AS fecha, cl.nombre AS clinica, c.motivo AS motivo,
       collect(DISTINCT d.nombre) AS diagnosticos,
       collect(DISTINCT m.nombre) AS medicamentos,
       collect(DISTINCT t.tipo) AS pruebas
ORDER BY fecha`,
};

export default function SaludPaciente({ slug }: DashProps) {
  const acc = accent(slug);
  const [sel, setSel] = useState(PACIENTE_ESTRELLA);

  const { panels } = usePanels(slug, {
    pacientes: { cypher: Q.pacientes },
    diagnosticos: { cypher: Q.diagnosticos },
    cohorteDiabetes: { cypher: Q.cohorteDiabetes },
    topDiag: { cypher: Q.topDiag },
    clinicas: { cypher: Q.clinicas },
    comorbilidades: { cypher: Q.comorbilidades },
    interacciones: { cypher: Q.interacciones },
    contraindicaciones: { cypher: Q.contraindicaciones },
    duplicadas: { cypher: Q.duplicadas },
    guias: { cypher: Q.guias },
    fragmentacion: { cypher: Q.fragmentacion },
  });
  const { panels: drillP } = usePanels(slug, {
    historial: { cypher: Q.historial, params: { paciente: sel } },
  });
  const { grafo } = useGrafo(slug);

  const interRows = panels.interacciones?.rows ?? [];
  const contraRows = panels.contraindicaciones?.rows ?? [];
  const alertasSeguridad = interRows.length + contraRows.length;
  const alertasLoading = panels.interacciones?.loading || panels.contraindicaciones?.loading;

  const topDiag = panels.topDiag?.rows ?? [];
  const diagData = topDiag.slice(0, 8).map((r) => ({
    label: str(r, "diagnostico"),
    value: num(r, "pacientes"),
    sub: str(r, "cie10"),
    color: str(r, "cie10") === "E11" ? "var(--warn)" : acc,
  }));

  const clinicaData = (panels.clinicas?.rows ?? []).map((r) => ({
    label: str(r, "clinica"),
    value: num(r, "consultas"),
    color: colorFor(str(r, "clinica")),
  }));
  const totalConsultas = clinicaData.reduce((s, d) => s + d.value, 0);

  const fragRows = panels.fragmentacion?.rows ?? [];
  const selRow = fragRows.find((r) => str(r, "paciente") === sel);

  const comorbCols: Column[] = [
    { key: "diag_a", label: "Diagnóstico A" },
    { key: "diag_b", label: "Diagnóstico B" },
    { key: "pacientes", label: "Pacientes", align: "right", format: fmtInt },
  ];

  const interCols: Column[] = [
    { key: "paciente", label: "Paciente" },
    { key: "medicamento_a", label: "Fármaco A", mono: true },
    { key: "medicamento_b", label: "Fármaco B", mono: true },
    {
      key: "severidad",
      label: "Severidad",
      render: (v) => <Chip tone={v === "alta" ? "bad" : "warn"}>{String(v)}</Chip>,
    },
  ];

  const contraCols: Column[] = [
    { key: "paciente", label: "Paciente" },
    { key: "medicamento", label: "Receta", mono: true },
    { key: "alergia", label: "Alergia declarada", mono: true },
    { key: "clinica", label: "Clínica emisora" },
    { key: "fecha", label: "Fecha", mono: true },
  ];

  const dupCols: Column[] = [
    { key: "paciente", label: "Paciente" },
    { key: "prueba", label: "Examen" },
    { key: "clinica_1", label: "Clínica 1" },
    { key: "fecha_1", label: "Fecha 1", mono: true },
    { key: "clinica_2", label: "Clínica 2" },
    { key: "fecha_2", label: "Fecha 2", mono: true },
  ];

  const guiaCols: Column[] = [
    { key: "paciente", label: "Paciente" },
    { key: "diagnostico", label: "Diagnóstico" },
    { key: "guia", label: "Guía / protocolo" },
    { key: "pendiente", label: "Recomendación pendiente" },
  ];

  const historialCols: Column[] = [
    { key: "fecha", label: "Fecha", mono: true },
    { key: "clinica", label: "Clínica" },
    { key: "motivo", label: "Motivo" },
    { key: "diagnosticos", label: "Diagnósticos" },
    { key: "medicamentos", label: "Medicamentos" },
    { key: "pruebas", label: "Pruebas" },
  ];

  return (
    <div>
      <KpiRow>
        <KpiCard label="Pacientes en la red" value={fmtInt(num(firstRow(panels.pacientes), "n"))}
          loading={panels.pacientes?.loading} sub="historia unificada, todas las clínicas" />
        <KpiCard label="Diagnósticos registrados" value={fmtInt(num(firstRow(panels.diagnosticos), "n"))}
          tone="info" loading={panels.diagnosticos?.loading} sub="CIE-10 a través de cuatro sistemas" />
        <KpiCard label="Alertas de seguridad" value={fmtInt(alertasSeguridad)}
          tone="bad" loading={alertasLoading}
          sub="interacciones y recetas contra alergias — invisibles por separado" />
        <KpiCard label="Cohorte diabetes tipo 2" value={fmtInt(num(firstRow(panels.cohorteDiabetes), "n"))}
          tone="warn" loading={panels.cohorteDiabetes?.loading}
          sub="candidatos a control según Protocolo ADA" />
      </KpiRow>

      <DashSection eyebrow="Población y carga clínica" title="Qué trata la red, y dónde">
        <DashGrid min={360}>
          <Panel title="Diagnósticos más frecuentes"
            subtitle="Pacientes distintos por diagnóstico CIE-10. La diabetes (E11) ancla la cohorte destacada."
            cypher={Q.topDiag} accent={acc} {...flags(panels.topDiag)}>
            <ColumnChart data={diagData} accent={acc} labelRotate />
          </Panel>

          <Panel title="Carga por clínica"
            subtitle="Volumen de consultas por establecimiento — el paciente cruza fronteras que los sistemas no."
            cypher={Q.clinicas} accent={acc} {...flags(panels.clinicas)}>
            <DonutChart data={clinicaData} centerValue={fmtInt(totalConsultas)} centerLabel="consultas" />
          </Panel>

          <Panel title="Comorbilidades conectadas"
            subtitle="Pares de diagnósticos que conviven en un mismo paciente — el grafo los une aunque vengan de consultas distintas."
            cypher={Q.comorbilidades} accent={acc} {...flags(panels.comorbilidades)}>
            <DataTable rows={panels.comorbilidades?.rows ?? []} columns={comorbCols} maxHeight={300} />
          </Panel>
        </DashGrid>
      </DashSection>

      <DashSection eyebrow="Seguridad del paciente" title="Lo que un sistema aislado nunca ve">
        <DashGrid min={380}>
          <Panel title="Interacciones medicamentosas activas"
            subtitle="Recetas emitidas en clínicas distintas que interactúan entre sí. Severidad alta = riesgo clínico inmediato."
            cypher={Q.interacciones} accent="var(--error)" {...flags(panels.interacciones)}>
            <DataTable rows={interRows} columns={interCols} maxHeight={220}
              rowTone={(r) => (str(r, "severidad") === "alta" ? "bad" : "warn")} />
            <p className="dash-note">
              El <b style={{ color: "var(--error)" }}>trimetoprim-sulfametoxazol</b> recetado en una tercera
              clínica choca con el enalapril vigente de Marta: ningún sistema lo ve solo.
            </p>
          </Panel>

          <Panel title="Recetas contra alergias declaradas"
            subtitle="Información contradictoria reconciliada: una alergia registrada en un sistema, una receta incompatible en otro."
            cypher={Q.contraindicaciones} accent="var(--error)" {...flags(panels.contraindicaciones)}
            emptyLabel="sin contradicciones detectadas">
            <DataTable rows={contraRows} columns={contraCols} maxHeight={220} rowTone={() => "bad"} />
          </Panel>

          <Panel title="Pruebas duplicadas entre clínicas"
            subtitle="El mismo examen repetido en menos de 60 días por clínicas que no se ven: costo evitable y molestia al paciente."
            cypher={Q.duplicadas} accent="var(--warn)" {...flags(panels.duplicadas)}
            emptyLabel="sin duplicados en la ventana">
            <DataTable rows={panels.duplicadas?.rows ?? []} columns={dupCols} maxHeight={220}
              rowTone={() => "warn"} />
          </Panel>

          <Panel title="Guías: recomendaciones pendientes"
            subtitle="Protocolos ligados al diagnóstico del paciente cuya prueba recomendada nadie ha solicitado aún."
            cypher={Q.guias} accent="var(--warn)" {...flags(panels.guias)}>
            <DataTable rows={panels.guias?.rows ?? []} columns={guiaCols} maxHeight={220}
              rowTone={() => "info"} />
          </Panel>
        </DashGrid>
      </DashSection>

      <DashSection eyebrow="Vista 360 del paciente" title="Historia unificada y mapa de la red">
        <DashGrid min={380}>
          <Panel title="Historial fragmentado"
            subtitle="Pacientes por número de clínicas distintas. Marta cruza cuatro — clic para reconstruir su historia."
            cypher={Q.fragmentacion} accent={acc} {...flags(panels.fragmentacion)}>
            <RankList
              data={fragRows.map((r) => ({
                label: str(r, "paciente"),
                value: num(r, "clinicas"),
                sub: `${num(r, "consultas")} consultas`,
                color: str(r, "paciente") === sel ? "var(--error)" : num(r, "clinicas") >= 3 ? "var(--warn)" : acc,
              }))}
              format={fmtInt}
              onClick={(_, i) => setSel(str(fragRows[i], "paciente"))}
              activeLabel={selRow ? str(selRow, "paciente") : undefined}
            />
          </Panel>

          <Panel title={`Historia unificada — ${sel}`}
            subtitle={selRow
              ? `${num(selRow, "clinicas")} clínicas · ${num(selRow, "consultas")} consultas reunidas en una sola vista`
              : "Todo el historial del paciente seleccionado, ordenado por fecha"}
            cypher={Q.historial} accent="var(--error)" {...flags(drillP.historial)}
            emptyLabel="sin consultas registradas">
            <DataTable rows={drillP.historial?.rows ?? []} columns={historialCols} maxHeight={300} />
          </Panel>

          <Panel title="Mapa de la red clínica" span="full" accent={acc}
            subtitle="Pacientes, consultas, diagnósticos, fármacos, alergias, pruebas y guías — la señal vive en las conexiones.">
            {grafo ? <GraphView grafo={grafo} /> : <div className="grafo-caja"><span className="grafo-caja__estado">sembrando…</span></div>}
          </Panel>
        </DashGrid>
      </DashSection>
    </div>
  );
}
