import type { CasoMeta } from "../types";

/** Props que recibe cada dashboard bespoke de un caso. */
export interface DashProps {
  slug: string;
  meta: CasoMeta;
}
