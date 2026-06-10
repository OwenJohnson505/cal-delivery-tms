/**
 * Requirements rollup — combine job/stop/product-scope requirements into [label, scope]
 * rows. Ported from the prototype (spec §5). Source: renderReqs (919-928).
 *
 * GUARDRAIL: the rollup is one of the four byte-identical outputs.
 *
 * §5.3 FIX: the prototype reads EQ with capitalised PRODUCT_EQUIP keys but the seed is
 * lowercase ({straps:true}), so product equipment never rolled up. eqHas() reads
 * case-insensitively so it now does — covered by a regression test.
 */
import type { MultiSelectState, ProductEquipment, RequirementRow, Stop } from '@/types/index.ts'
import { parseGoods, itemShort } from './parseGoods.ts'
import { isColl } from './allocation.ts'

const STOP_SVC = ['Two-man', 'Wait and return']
const PRODUCT_EQUIP = ['Straps', 'Blanket']

/** Map a STOP_SVC label to its stop.svc flag (prototype svcKey). */
function svcKey(k: string): 'twoman' | 'wait' {
  return k === 'Two-man' ? 'twoman' : 'wait'
}

/** §5.3 fix: case-insensitive product-equipment read. */
function eqHas(e: Record<string, boolean> | undefined, k: string): boolean {
  if (!e) return false
  return !!(e[k] || e[k.toLowerCase()])
}

export interface RequirementsInput {
  stops: Stop[]
  ms: MultiSelectState
  eq: ProductEquipment
}

export function rollupRequirements(input: RequirementsInput): RequirementRow[] {
  const { stops, ms, eq } = input
  const rows: RequirementRow[] = []

  // Job scope
  ms.equip.sel.forEach((k) => rows.push({ label: k, scope: 'whole job' }))
  ms.service.sel.forEach((k) => rows.push({ label: k, scope: 'whole job' }))

  // Stop scope
  STOP_SVC.forEach((k) => {
    const key = svcKey(k)
    const ss = stops.filter((x) => x.svc && x.svc[key])
    if (ss.length) {
      const scope =
        ss.length === stops.length
          ? 'all stops'
          : ss.map((x) => 'Stop ' + (stops.indexOf(x) + 1)).join(', ')
      rows.push({ label: k, scope })
    }
  })

  // Product scope
  PRODUCT_EQUIP.forEach((k) => {
    const its: string[] = []
    stops.forEach((st) => {
      if (!isColl(st) || !st.goods) return
      parseGoods(st.goods).forEach((it, ix) => {
        if (eqHas(eq[st.id + ':' + ix], k)) its.push(itemShort(it))
      })
    })
    if (its.length) rows.push({ label: k, scope: its.join(', ') })
  })

  return rows
}
