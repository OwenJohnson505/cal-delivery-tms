import { describe, it, expect } from 'vitest'
import { buildCxNotes } from './buildCxNotes.ts'
import { syncAssign } from './allocation.ts'
import { createInitialState } from '@/store/initialState.ts'
import { makeStop } from '@/test/fixtures.ts'
import type { ProductEquipment, Stop } from '@/types/index.ts'

/**
 * The prototype's seed booking (reference/booking-form-modern.html lines 615-628):
 *  - Stop 1 Collection LS9 0PX, goods "2 pallets at 400kg total, 1 box",
 *    time between 06-06-2026 18:54..19:39, note about loading bay.
 *  - Stop 2 Delivery WA2 7NE, time ASAP, two-man, note about gate ref.
 *  - EQ {'1:1':{straps:true}}  (lowercase — the §5.3 bug seed)
 *  - ASSIGN derived by syncAssign (sole delivery gets all earlier-collected units).
 */
function seedBooking() {
  const stops: Stop[] = [
    makeStop({
      id: 1,
      type: 'Collection',
      addr: { pc: 'LS9 0PX', co: 'Northgate Logistics' },
      time: { mode: 'between', from: '06-06-2026 18:54', to: '06-06-2026 19:39' },
      note: 'Goods in loading bay 3 - ask for Dave on arrival',
      goods: '2 pallets at 400kg total, 1 box',
    }),
    makeStop({
      id: 2,
      type: 'Delivery',
      addr: { pc: 'WA2 7NE', co: 'Tesco Extra' },
      time: { mode: 'asap' },
      note: 'Booking ref needed at gate - call site 30 mins before arrival',
      svc: { twoman: true },
    }),
  ]
  const eq: ProductEquipment = { '1:1': { straps: true } }
  const { ms, tariff } = createInitialState()
  const assign = syncAssign(stops, {}, false)
  return { stops, ms, tariff, eq, assign }
}

describe('buildCxNotes (golden — byte-identical guardrail, spec §8/§9)', () => {
  it('matches the prototype output for the seed booking', () => {
    expect(buildCxNotes(seedBooking())).toMatchInlineSnapshot(`
      "COLLECTION //
      COLLECTION / LS9
      SATURDAY 06/06, 18:54-19:39 -- 2 PALLETS, 1 BOX
      (GOODS IN LOADING BAY 3 - ASK FOR DAVE ON ARRIVAL)

      STOPS (1) //
      DELIVERY / WA2
      DIRECT -- DELIVERING 2 PALLETS, 1 BOX
      (BOOKING REF NEEDED AT GATE - CALL SITE 30 MINS BEFORE ARRIVAL)

      VEHICLE -- CURTAIN SIDE //
      SERVICE -- DEDICATED DELIVERY -- ADR - CERTIFIED DRIVER -- TWO MAN (STOP 2) //
      EQUIPMENT -- TAIL LIFT -- PUMP TRUCK -- STRAPS //

      STANDARD -- NO CO-LOADING -- HI VIS & SAFETY BOOTS -- UPLOAD & RETAIN SIGNED CUSTOMER PAPERWORK -- ONLINE QUOTES ONLY //"
    `)
  })

  it('REGRESSION (§5.3): product equipment rolls up despite lowercase EQ seed', () => {
    expect(buildCxNotes(seedBooking())).toContain('EQUIPMENT -- TAIL LIFT -- PUMP TRUCK -- STRAPS //')
  })

  it('uses DIRECT for an ASAP delivery and ASAP for an ASAP collection', () => {
    const stops: Stop[] = [
      makeStop({ id: 1, type: 'Collection', addr: { pc: 'LS9 0PX' }, time: { mode: 'asap' }, goods: '1 box' }),
      makeStop({ id: 2, type: 'Delivery', addr: { pc: 'WA2 7NE' }, time: { mode: 'asap' } }),
    ]
    const { ms, tariff } = createInitialState()
    const out = buildCxNotes({ stops, ms, tariff, eq: {}, assign: syncAssign(stops, {}, false) })
    expect(out).toContain('COLLECTION / LS9\nASAP -- 1 BOX')
    expect(out).toContain('DELIVERY / WA2\nDIRECT -- DELIVERING 1 BOX')
  })

  it('renders NONE when there is no collection / no other stops', () => {
    const stops: Stop[] = [makeStop({ id: 1, type: 'Delivery', addr: { pc: 'M1 1AA' } })]
    const { ms, tariff } = createInitialState()
    const out = buildCxNotes({ stops, ms, tariff, eq: {}, assign: {} })
    expect(out).toContain('COLLECTION //\nNONE')
  })
})
