import { describe, it, expect } from 'vitest'
import { internalRank } from './internalRank.ts'
import { NotPortedYet } from './notPorted.ts'

describe('internalRank', () => {
  it('is not ported yet (remove this guard once ported)', () => {
    expect(() => internalRank('lon', [])).toThrow(NotPortedYet)
  })

  // --- Behaviour to port from reference/booking-form-modern.html ---
  it.todo('type-ahead matches saved addresses by query')
  it.todo('ranks results by persisted usage frequency (count)')
  it.todo('breaks ties the same way the prototype does')
})
