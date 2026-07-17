import { lazy, type LazyExoticComponent, type ComponentType } from "react";

import type { DashProps } from "./dashProps";

/** Un dashboard bespoke por caso. Cada archivo hace `export default` de un
    componente ({ slug, meta }) => JSX. Los stubs re-exportan el genérico
    hasta que su caso recibe el panel a medida. */
const DASHBOARDS: Record<string, LazyExoticComponent<ComponentType<DashProps>>> = {
  "banca-aml": lazy(() => import("./cases/bancaAml")),
  "grupos-economicos": lazy(() => import("./cases/gruposEconomicos")),
  "seguros-siniestros": lazy(() => import("./cases/segurosSiniestros")),
  "contratacion-publica": lazy(() => import("./cases/contratacionPublica")),
  "subsidios": lazy(() => import("./cases/subsidios")),
  "salud-paciente": lazy(() => import("./cases/saludPaciente")),
  "agro-trazabilidad": lazy(() => import("./cases/agroTrazabilidad")),
  "agro-cumplimiento": lazy(() => import("./cases/agroCumplimiento")),
  "energia-activos": lazy(() => import("./cases/energiaActivos")),
  "proveedores-compras": lazy(() => import("./cases/proveedoresCompras")),
  "recomendaciones": lazy(() => import("./cases/recomendaciones")),
  "telecom-causa-raiz": lazy(() => import("./cases/telecomCausaRaiz")),
  "ciberseguridad": lazy(() => import("./cases/ciberseguridad")),
  "agentes-conocimiento": lazy(() => import("./cases/agentesConocimiento")),
  "agro-sanidad": lazy(() => import("./cases/agroSanidad")),
  "agro-riego": lazy(() => import("./cases/agroRiego")),
  "agro-rendimiento": lazy(() => import("./cases/agroRendimiento")),
};

export function getDashboard(slug: string): LazyExoticComponent<ComponentType<DashProps>> | null {
  return DASHBOARDS[slug] ?? null;
}
