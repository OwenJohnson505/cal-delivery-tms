import { describe, it, expect } from 'vitest'
import { rollupRequirements } from './requirements.ts'
import { createInitialState } from '@/store/initialState.ts'
import { makeStop } from '@/test/fixtures.ts'
import type { ProductEquipment, Stop } from '@/types/index.ts'

const ms = createInitialState().ms // equip ['Tail lift','Pump truck'], service ['Dedicated','ADR']

describe('rollupRequirements', () => {
  it('rolls up job-scope equipment and service as "whole job"', () => {
    const rows = rollupRequirements({ stops: [makeStop({})], ms, eq: {} })
    expect(rows).toEqual(
      expect.arrayContaining([
        { label: 'Tail lift', scope: 'whole job' },
        { label: 'Pump truck', scope: 'whole job' },
        { label: 'Dedicated', scope: 'whole job' },
        { label: 'ADR', scope: 'whole job' },
      ]),
    )
  })

  it('rolls up stop-scope two-man as "all stops" vs "Stop N"', () => {
    const all = [makeStop({ id: 1, svc: { twoman: true } }), makeStop({ id: 2, svc: { twoman: true } })]
    expect(rollupRequirements({ stops: all, ms, eq: {} })).toContainEqual({
      label: 'Two-man',
      scope: 'all stops',
    })

    const one = [makeStop({ id: 1 }), makeStop({ id: 2, svc: { twoman: true } })]
    expect(rollupRequirements({ stops: one, ms, eq: {} })).toContainEqual({
      label: 'Two-man',
      scope: 'Stop 2',
    })
  })

  it('REGRESSION (§5.3): product equipment rolls up despite lowercase EQ seed', () => {
    const stops: Stop[] = [makeStop({ id: 1, type: 'Collection', goods: '2 pallets, 1 box' })]
    const eq: ProductEquipment = { '1:1': { straps: true } } // lowercase seed (the bug)
    const rows = rollupRequirements({ stops, ms, eq })
    // item index 1 is the box -> "1 box"
    expect(rows).toContainEqual({ label: 'Straps', scope: '1 box' })
  })

  it('also honours correctly-cased EQ keys', () => {
    const stops: Stop[] = [makeStop({ id: 1, type: 'Collection', goods: '2 pallets' })]
    const eq: ProductEquipment = { '1:0': { Straps: true, Blanket: true } }
    const rows = rollupRequirements({ stops, ms, eq })
    expect(rows).toContainEqual({ label: 'Straps', scope: '2 pallets' })
    expect(rows).toContainEqual({ label: 'Blanket', scope: '2 pallets' })
  })
})
