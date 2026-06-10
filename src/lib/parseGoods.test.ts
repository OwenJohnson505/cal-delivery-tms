import { describe, it, expect } from 'vitest'
import { parseGoods } from './parseGoods.ts'
import { NotPortedYet } from './notPorted.ts'

describe('parseGoods', () => {
  it('is not ported yet (remove this guard once ported)', () => {
    expect(() => parseGoods('2 pallets 500kg')).toThrow(NotPortedYet)
  })

  // --- Behaviour to port from reference/booking-form-modern.html ---
  it.todo('extracts qty + unit (e.g. "2 pallets")')
  it.todo('extracts weight (e.g. "500kg", "0.5t")')
  it.todo('extracts dimensions (e.g. "120x100x150cm")')
  it.todo('handles multiple goods lines in one entry')
  it.todo('handles free text with no parseable quantities')
  // GUARDRAIL: byte-identical preview.
  it.todo('produces a "reads as" preview byte-identical to the prototype (snapshot)')
})
