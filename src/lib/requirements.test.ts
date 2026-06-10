import { describe, it, expect } from 'vitest'
import { rollupRequirements } from './requirements.ts'
import { NotPortedYet } from './notPorted.ts'

describe('rollupRequirements', () => {
  it('is not ported yet (remove this guard once ported)', () => {
    expect(() =>
      rollupRequirements({
        ms: { equip: {}, service: {} },
        stops: [],
        eq: {},
      }),
    ).toThrow(NotPortedYet)
  })

  // --- Behaviour to port from reference/booking-form-modern.html (renderReqs) ---
  it.todo('rolls up job-scope MS.equip / MS.service')
  it.todo('rolls up stop-scope stop.svc flags')
  it.todo('rolls up product-scope EQ[stopId:itemIndex]')
  it.todo('deduplicates a requirement contributed by multiple scopes')
  // KNOWN BUG (handover §6 / spec §5.3) — regression test for the fix:
  it.todo('REGRESSION: product-scope equipment (e.g. straps) appears despite EQ casing')
})
