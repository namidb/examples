/* Kit de dashboards NamiDB — un solo import para construir un caso.

   import * as K from "../dash/kit";
   const { panels } = K.usePanels(slug, { ... });
   <K.KpiRow>…</K.KpiRow>  <K.Panel …><K.BarChart …/></K.Panel>
*/
export * from "./format";
export * from "./palette";
export * from "./useCypher";
export * from "./primitives";
export * from "./charts";
export { DataTable } from "./DataTable";
export type { Column } from "./DataTable";
export type { CasoMeta } from "../types";
export { default as GraphView } from "../components/GraphView";
