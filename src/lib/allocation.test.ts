import { describe, it, expect } from 'vitest'
import {
  goodsUnits,
  availableUnitsFor,
  deliverItems,
  collectItems,
  syncAssign,
  stopIndex,
} from './allocation.ts'
import { makeStop } from '@/test/fixtures.ts'
import type { AssignMap } from '@/types/index.ts'

describe('goodsUnits', () => {
  it('explodes a qty:N line into N units with sequential global idx and labels', () => {
    const stops = [makeStop({ id: 1, type: 'Collection', goods: '2 pallets, 1 box' })]
    const units = goodsUnits(stops)
    expect(units).toEqual([
      { idx: 0, collId: 1, unitName: 'Pallet', label: 'Pallet 1 of 2', wt: '', dim: '' },
      { idx: 1, collId: 1, unitName: 'Pallet', label: 'Pallet 2 of 2', wt: '', dim: '' },
      { idx: 2, collId: 1, unitName: 'Box', label: 'Box', wt: '', dim: '' },
    ])
  })

  it('emits a single "Item" unit (raw label) for unrecognised lines', () => {
    const units = goodsUnits([makeStop({ id: 1, goods: 'loose engine block' })])
    expect(units).toEqual([
      { idx: 0, collId: 1, unitName: 'Item', label: 'loose engine block', wt: '', dim: '' },
    ])
  })

  it('ignores delivery stops and collections without goods', () => {
    const stops = [
      makeStop({ id: 1, type: 'Delivery', goods: '9 pallets' }),
      makeStop({ id: 2, type: 'Collection', goods: '' }),
    ]
    expect(goodsUnits(stops)).toEqual([])
  })
})

describe('availableUnitsFor — route-order gating (spec §4.3)', () => {
  // Collect A(1) -> Deliver(2) -> Collect B(3) -> Deliver(4)
  const stops = [
    makeStop({ id: 1, type: 'Collection', goods: '1 pallet' }),
    makeStop({ id: 2, type: 'Delivery' }),
    makeStop({ id: 3, type: 'Collection', goods: '1 box' }),
    makeStop({ id: 4, type: 'Delivery' }),
  ]

  it('first delivery only sees units collected before it (A)', () => {
    const avail = availableUnitsFor(stops[1], stops)
    expect(avail.map((u) => u.unitName)).toEqual(['Pallet'])
  })

  it('second delivery sees units from both A and B', () => {
    const avail = availableUnitsFor(stops[3], stops)
    expect(avail.map((u) => u.unitName)).toEqual(['Pallet', 'Box'])
  })
})

describe('syncAssign', () => {
  it('auto-assigns all available units to the sole delivery when untouched', () => {
    const stops = [
      makeStop({ id: 1, type: 'Collection', goods: '2 pallets' }),
      makeStop({ id: 2, type: 'Delivery' }),
    ]
    const next = syncAssign(stops, {}, false)
    expect(next).toEqual({ 0: 2, 1: 2 })
  })

  it('does nothing once the operator has intervened', () => {
    const stops = [
      makeStop({ id: 1, type: 'Collection', goods: '2 pallets' }),
      makeStop({ id: 2, type: 'Delivery' }),
    ]
    expect(syncAssign(stops, {}, true)).toEqual({})
  })

  it('does nothing with more than one delivery', () => {
    const stops = [
      makeStop({ id: 1, type: 'Collection', goods: '2 pallets' }),
      makeStop({ id: 2, type: 'Delivery' }),
      makeStop({ id: 3, type: 'Delivery' }),
    ]
    expect(syncAssign(stops, {}, false)).toEqual({})
  })
})

describe('collectItems / deliverItems (uppercased, grouped)', () => {
  it('collectItems gives uppercased pluralised counts', () => {
    expect(collectItems(makeStop({ goods: '2 pallets, 1 box' }))).toBe('2 PALLETS, 1 BOX')
  })

  it('deliverItems groups the units a stop owns via ASSIGN', () => {
    const stops = [
      makeStop({ id: 1, type: 'Collection', goods: '2 pallets, 1 box' }),
      makeStop({ id: 2, type: 'Delivery' }),
    ]
    const assign: AssignMap = { 0: 2, 1: 2, 2: 2 } // both pallets + the box -> stop 2
    expect(deliverItems(stops[1], stops, assign)).toBe('2 PALLETS, 1 BOX')
  })

  it('deliverItems reflects partial ownership', () => {
    const stops = [
      makeStop({ id: 1, type: 'Collection', goods: '2 pallets' }),
      makeStop({ id: 2, type: 'Delivery' }),
    ]
    expect(deliverItems(stops[1], stops, { 0: 2 })).toBe('1 PALLET')
  })
})

describe('stopIndex', () => {
  it('returns route position or -1', () => {
    const stops = [makeStop({ id: 7 }), makeStop({ id: 9 })]
    expect(stopIndex(stops, 9)).toBe(1)
    expect(stopIndex(stops, 99)).toBe(-1)
  })
})
