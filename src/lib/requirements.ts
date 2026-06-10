/**
 * requirements rollup — combine service/equipment requirements across the three scopes
 * (job: MS.equip/MS.service, stop: stop.svc, product: EQ['stopId:itemIndex']) into the
 * deduplicated requirements list shown in the UI and embedded in the CX notes.
 *
 * Behavioural source of truth: reference/booking-form-modern.html (function `renderReqs`
 * and the rollup it drives). Handover §1, §4, §6, §9.
 *
 * GUARDRAIL: the rollup output is one of the four byte-identical formats — match the
 * prototype exactly.
 *
 * FIX-ON-PORT (handover §6 / spec §5.3 — the KNOWN BUG): EQ stores lowercase flags
 * ({straps:true}) but the prototype reads capitalised keys (e['Straps']), so
 * product-scope equipment never surfaces. Normalise casing here so product equipment
 * correctly appears, and cover the fix with a regression test.
 */
import type {
  JobMultiSelect,
  ProductEquipment,
  Requirement,
  Stop,
} from '@/types/index.ts'
import { NotPortedYet } from './notPorted.ts'

export interface RequirementsInput {
  /** Job scope. */
  ms: JobMultiSelect
  /** Stop scope (svc flags live on each stop). */
  stops: Stop[]
  /** Product scope, keyed by 'stopId:itemIndex'. */
  eq: ProductEquipment
}

export function rollupRequirements(_input: RequirementsInput): Requirement[] {
  // TODO(prototype): port the rollup verbatim, THEN apply the casing fix (§6) and add a
  // regression test proving product-scope equipment (e.g. straps) now appears.
  throw new NotPortedYet('rollupRequirements')
}
