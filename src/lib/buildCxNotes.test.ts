import { describe, it, expect } from 'vitest'
import { buildCxNotes } from './buildCxNotes.ts'
import { NotPortedYet } from './notPorted.ts'

describe('buildCxNotes', () => {
  it('is not ported yet (remove this guard once ported)', () => {
    expect(() => buildCxNotes({ stops: [], book: {} })).toThrow(NotPortedYet)
  })

  // --- Behaviour to port from reference/booking-form-modern.html (buildCXNotes) ---
  // GUARDRAIL (handover §6, §9): byte-identical output. The golden file MUST be the
  // prototype's current output, captured by running the prototype with a known booking.
  it.todo('matches the prototype output byte-for-byte (golden snapshot)')
  it.todo('uppercases the right fields')
  it.todo('renders UK outcodes correctly')
  it.todo('includes the STANDARD defaults line')
  it.todo('uses the exact separators the prototype uses')
  it.todo('freezes once posted (cxPosted) — verified at the state layer, not here')
})
