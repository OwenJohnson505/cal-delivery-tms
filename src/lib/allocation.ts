/**
 * Goods allocation — expand stops into per-unit lists and compute which units a given
 * delivery may receive, honouring route order (a delivery can only receive units
 * collected EARLIER in the route).
 *
 * Behavioural source of truth: reference/booking-form-modern.html (functions
 * `goodsUnits`, `availableUnitsFor`). Handover §1, §3, §4, §6.
 *
 * FIX-ON-PORT (handover §6): goodsUnits() in the prototype recomputes a transient
 * global `idx` from text every render. Persist allocation against the durable
 * UnitIdentity (types/goods.ts: collId + lineIndex + occurrence), not idx. Model both
 * here: expose idx for render parity, but key ASSIGN/ownership off identity.
 */
import type { AssignMap, GoodsUnit, Stop } from '@/types/index.ts'
import { NotPortedYet } from './notPorted.ts'

/** Expand all stops into the flat, globally-indexed unit list used for allocation. */
export function goodsUnits(_stops: Stop[]): GoodsUnit[] {
  // TODO(prototype): port goodsUnits verbatim; attach durable UnitIdentity per §6.
  throw new NotPortedYet('goodsUnits')
}

/**
 * Units available to be allocated to the given delivery stop, given current route
 * order and existing assignments (exclusive ownership).
 */
export function availableUnitsFor(
  _deliveryStopId: string,
  _stops: Stop[],
  _assign: AssignMap,
): GoodsUnit[] {
  // TODO(prototype): port availableUnitsFor verbatim (route-order gating).
  throw new NotPortedYet('availableUnitsFor')
}
