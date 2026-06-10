/**
 * Goods allocation — per-unit explosion, route-order availability, and per-stop item
 * grouping. Ported from the prototype (spec §4.3). Source lines: goodsUnits (950-961),
 * stopIndex (962), availableUnitsFor (963), collectItems (1284), deliverItems (1285).
 *
 * The prototype reads module globals (stops, ASSIGN). These ports take them as
 * parameters so the logic is pure and testable. Behaviour is otherwise identical.
 *
 * Durability note (spec §4.3): `idx` is recomputed from text every call, stable only
 * while goods text + stop order are unchanged. Persist allocation against a durable
 * UnitIdentity (types/goods.ts) rather than `idx` when goods can be edited post-alloc.
 */
import type { AssignMap, GoodsUnit, Stop } from '@/types/index.ts'
import { parseGoods, plur } from './parseGoods.ts'

/** Collection or Both (prototype isColl). */
export function isColl(s: Stop): boolean {
  return s.type === 'Collection' || s.type === 'Both'
}

/** Delivery or Both (prototype isDel). */
export function isDel(s: Stop): boolean {
  return s.type === 'Delivery' || s.type === 'Both'
}

/** Index of a stop by id in route order, or -1 (prototype stopIndex). */
export function stopIndex(stops: Stop[], id: number): number {
  for (let i = 0; i < stops.length; i++) {
    if (stops[i].id === id) return i
  }
  return -1
}

/** Explode every collection's goods into individual units (prototype goodsUnits). */
export function goodsUnits(stops: Stop[]): GoodsUnit[] {
  const units: GoodsUnit[] = []
  let g = 0
  stops.forEach((st) => {
    if (!isColl(st) || !st.goods) return
    parseGoods(st.goods).forEach((it) => {
      if (!it.unit) {
        units.push({ idx: g++, collId: st.id, unitName: 'Item', label: it.raw, wt: '', dim: '' })
        return
      }
      const q = it.qty || 1
      for (let n = 1; n <= q; n++) {
        units.push({
          idx: g++,
          collId: st.id,
          unitName: it.unit,
          label: it.unit + (q > 1 ? ' ' + n + ' of ' + q : ''),
          wt: it.wt,
          dim: it.dim,
        })
      }
    })
  })
  return units
}

/**
 * Units a delivery may receive: only those collected EARLIER in the route
 * (prototype availableUnitsFor).
 */
export function availableUnitsFor(stop: Stop, stops: Stop[]): GoodsUnit[] {
  const d = stopIndex(stops, stop.id)
  return goodsUnits(stops).filter((u) => stopIndex(stops, u.collId) < d)
}

/** Deliveries in the route (prototype deliveries()). */
export function deliveries(stops: Stop[]): Stop[] {
  return stops.filter((x) => isDel(x))
}

/**
 * Auto-assign everything to the sole delivery when there's exactly one and the operator
 * hasn't intervened (prototype syncAssign). Returns the next assign map (does not mutate
 * the input).
 */
export function syncAssign(
  stops: Stop[],
  assign: AssignMap,
  assignTouched: boolean,
): AssignMap {
  const next: AssignMap = { ...assign }
  const ds = deliveries(stops)
  if (!assignTouched && ds.length === 1) {
    availableUnitsFor(ds[0], stops).forEach((u) => {
      next[u.idx] = ds[0].id
    })
  }
  return next
}

/** Uppercased, pluralised collected-item counts for a stop (prototype collectItems). */
export function collectItems(s: Stop): string {
  return parseGoods(s.goods)
    .map((it) =>
      it.unit
        ? it.qty +
          ' ' +
          (it.qty! > 1 ? plur(it.unit.toLowerCase()) : it.unit.toLowerCase()).toUpperCase()
        : it.raw.toUpperCase(),
    )
    .join(', ')
}

/** Uppercased, grouped delivered-item counts owned by a stop (prototype deliverItems). */
export function deliverItems(s: Stop, stops: Stop[], assign: AssignMap): string {
  const units = goodsUnits(stops).filter((u) => assign[u.idx] === s.id)
  const counts: Record<string, number> = {}
  const order: string[] = []
  units.forEach((u) => {
    if (counts[u.unitName] === undefined) {
      counts[u.unitName] = 0
      order.push(u.unitName)
    }
    counts[u.unitName]++
  })
  return order
    .map(
      (k) =>
        counts[k] +
        ' ' +
        (counts[k] > 1 ? plur(k.toLowerCase()) : k.toLowerCase()).toUpperCase(),
    )
    .join(', ')
}
