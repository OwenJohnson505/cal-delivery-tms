import { describe, it, expect } from 'vitest'
import { etaToClock } from './etaToClock.ts'
import { NotPortedYet } from './notPorted.ts'

describe('etaToClock', () => {
  it('is not ported yet (remove this guard once ported)', () => {
    expect(() => etaToClock(45, new Date('2026-06-10T09:00:00'))).toThrow(NotPortedYet)
  })

  // --- Behaviour to port from reference/booking-form-modern.html ---
  it.todo('resolves an ETA to an absolute HH:MM against the injected "now"')
  it.todo('is pure — same inputs always produce the same clock time')
  it.todo('does NOT drift like ASAP (which is relative); ETA is frozen once set')
})
