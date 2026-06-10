import { describe, it, expect } from 'vitest'
import { goodsUnits, availableUnitsFor } from './allocation.ts'
import { NotPortedYet } from './notPorted.ts'

describe('allocation', () => {
  it('goodsUnits is not ported yet (remove this guard once ported)', () => {
    expect(() => goodsUnits([])).toThrow(NotPortedYet)
  })

  it('availableUnitsFor is not ported yet (remove this guard once ported)', () => {
    expect(() => availableUnitsFor('stop-1', [], {})).toThrow(NotPortedYet)
  })

  // --- Behaviour to port from reference/booking-form-modern.html ---
  it.todo('goodsUnits expands every stop\'s parsed goods into per-unit entries')
  it.todo('availableUnitsFor only offers units collected EARLIER in the route order')
  it.todo('availableUnitsFor excludes units already exclusively assigned')
  // FIX-ON-PORT (handover §6): durable identity.
  it.todo('allocation survives goods-text / stop-order changes via durable UnitIdentity')
})
