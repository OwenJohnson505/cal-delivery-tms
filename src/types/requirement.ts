/**
 * Requirement — a service/equipment requirement in the rollup.
 *
 * Source: handover §1 (service & vehicle, requirements rollup) and §4:
 *   "Requirements come from three scopes: job (MS.equip/MS.service),
 *    stop (stop.svc), product (EQ['stopId:itemIndex'])."
 *
 * KNOWN BUG TO FIX ON PORT (handover §6, spec §5.3): EQ stores lowercase flags
 * ({straps:true}) but the rollup/CX code reads capitalised keys (e['Straps']), so
 * product-level equipment never appears. Normalise casing when porting the rollup
 * into src/lib/requirements.ts and cover with a test.
 */

/** Where a requirement originated. */
export type RequirementScope = 'job' | 'stop' | 'product'

export interface Requirement {
  /** Canonical (normalised-case) requirement key, e.g. 'straps', 'taillift'. */
  key: string
  /** Human-readable label, e.g. 'Straps', 'Tail lift'. */
  label: string
  /** Originating scope(s). A requirement may be contributed by more than one scope. */
  scopes: RequirementScope[]
}
