/**
 * buildCxNotes — Courier Exchange posting text. Ported verbatim from the prototype
 * (spec §8). Source lines: collectItems/deliverItems (1284-1285), noteText (1286),
 * stopDetail (1287-1291), pushBlock (1292-1296), buildCXNotes (1297-1327).
 *
 * GUARDRAIL (spec §8/§9): byte-identical output — separators ` -- ` / ` //`, uppercase,
 * outcodes, and the always-appended STANDARD defaults line. Covered by a golden snapshot.
 *
 * Reads booking state via a parameter (the prototype read module globals). EQ casing
 * FIX (spec §5.3) is applied via eqHas(): product equipment rolls up whether stored
 * capitalised ('Straps') or lowercase ('straps').
 */
import type { AssignMap, MultiSelectState, ProductEquipment, Stop, Tariff } from '@/types/index.ts'
import { parseGoods } from './parseGoods.ts'
import { collectItems, deliverItems, isColl } from './allocation.ts'
import { outcode, collTime, delTime, tphrase } from './time.ts'

export interface CxBookingState {
  stops: Stop[]
  ms: MultiSelectState
  tariff: Tariff
  eq: ProductEquipment
  assign: AssignMap
}

const PRODUCT_EQUIP = ['Straps', 'Blanket']

/** §5.3 fix: case-insensitive product-equipment read. */
function eqHas(e: Record<string, boolean> | undefined, k: string): boolean {
  if (!e) return false
  return !!(e[k] || e[k.toLowerCase()])
}

/** Uppercased free-text note, or '' (prototype noteText). */
function noteText(s: Stop): string {
  return s.note && s.note.trim() ? s.note.trim().toUpperCase() : ''
}

/** One stop's action+items line (prototype stopDetail). */
function stopDetail(s: Stop, stops: Stop[], assign: AssignMap): string {
  if (s.type === 'Collection') {
    const c = collectItems(s)
    return collTime(s.time) + ' -- ' + (c || 'ITEMS TBC')
  }
  if (s.type === 'Delivery') {
    const d = deliverItems(s, stops, assign)
    return delTime(s.time) + ' -- ' + (d ? 'DELIVERING ' + d : 'ITEMS TBC')
  }
  const d2 = deliverItems(s, stops, assign)
  const c2 = collectItems(s)
  const ia: string[] = []
  if (d2) ia.push('DELIVERING ' + d2)
  if (c2) ia.push('COLLECTING ' + c2)
  return delTime(s.time) + ' -- ' + (ia.length ? ia.join(', ') : 'ITEMS TBC')
}

/** Append a stop block (prototype pushBlock). */
function pushBlock(L: string[], label: string, s: Stop, stops: Stop[], assign: AssignMap): void {
  L.push(label + ' / ' + (outcode((s.addr && s.addr.pc) || '') || '?'))
  L.push(stopDetail(s, stops, assign))
  const n = noteText(s)
  if (n) L.push('(' + n + ')')
}

/** Generate the CX posting text (prototype buildCXNotes). */
export function buildCxNotes(state: CxBookingState): string {
  const { stops, ms, tariff, eq, assign } = state
  const L: string[] = []
  const fc = stops.filter(isColl)[0]
  L.push('COLLECTION //')
  if (fc) pushBlock(L, 'COLLECTION', fc, stops, assign)
  else L.push('NONE')
  const rest = stops.filter((s) => s !== fc)
  L.push('')
  L.push('STOPS (' + rest.length + ') //')
  if (rest.length)
    rest.forEach((s, i) => {
      if (i) L.push('')
      const label =
        s.type === 'Delivery' ? 'DELIVERY' : s.type === 'Both' ? 'COLLECT & DELIVER' : 'COLLECTION'
      pushBlock(L, label, s, stops, assign)
    })
  else L.push('NONE')

  const veh: string[] = []
  if (tariff.q) veh.push(tariff.q.toUpperCase())
  ms.body.sel.forEach((b) => veh.push(b.toUpperCase()))

  const svc: string[] = []
  if (ms.service.sel.indexOf('Dedicated') >= 0) svc.push('DEDICATED DELIVERY')
  if (ms.service.sel.indexOf('ADR') >= 0) svc.push('ADR - CERTIFIED DRIVER')
  const tm = stops.filter((x) => x.svc && x.svc.twoman)
  if (tm.length)
    svc.push(
      tm.length === stops.length
        ? 'TWO MAN'
        : 'TWO MAN (' + tm.map((x) => 'STOP ' + (stops.indexOf(x) + 1)).join(', ') + ')',
    )

  const eqLine: string[] = []
  if (ms.equip.sel.indexOf('Tail lift') >= 0) eqLine.push('TAIL LIFT')
  if (ms.equip.sel.indexOf('Pump truck') >= 0) eqLine.push('PUMP TRUCK')
  const pe: Record<string, boolean> = {}
  PRODUCT_EQUIP.forEach((k) => {
    stops.forEach((st) => {
      if (!isColl(st) || !st.goods) return
      parseGoods(st.goods).forEach((_it, ix) => {
        const e = eq[st.id + ':' + ix]
        if (eqHas(e, k)) pe[k] = true
      })
    })
  })
  if (pe['Straps'] && pe['Blanket']) eqLine.push('STRAPS & BLANKETS')
  else if (pe['Straps']) eqLine.push('STRAPS')
  else if (pe['Blanket']) eqLine.push('BLANKETS')

  if (veh.length || svc.length || eqLine.length) {
    L.push('')
    if (veh.length) L.push('VEHICLE -- ' + veh.join(' -- ') + ' //')
    if (svc.length) L.push('SERVICE -- ' + svc.join(' -- ') + ' //')
    if (eqLine.length) L.push('EQUIPMENT -- ' + eqLine.join(' -- ') + ' //')
  }
  L.push('')
  L.push(
    'STANDARD -- NO CO-LOADING -- HI VIS & SAFETY BOOTS -- UPLOAD & RETAIN SIGNED CUSTOMER PAPERWORK -- ONLINE QUOTES ONLY //',
  )
  return L.join('\n')
}

// Re-exported for tests/UI that need the same phrasing helper.
export { tphrase }
