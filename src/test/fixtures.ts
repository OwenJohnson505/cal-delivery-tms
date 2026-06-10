/**
 * Test fixtures — minimal factories for building domain objects in unit tests.
 * Not shipped in the app bundle (only imported from *.test.ts).
 */
import type { Address, Stop } from '@/types/index.ts'

export function makeAddr(partial: Partial<Address> = {}): Address {
  return {
    co: '',
    address: '',
    city: '',
    pc: '',
    country: 'England',
    src: 'Entered manually',
    cls: 'manual',
    ...partial,
  }
}

let nextId = 1

/** makeStop accepts a partial Address for `addr` (filled by makeAddr). */
type StopOverrides = Partial<Omit<Stop, 'addr'>> & { addr?: Partial<Address> }

export function makeStop(partial: StopOverrides = {}): Stop {
  const { addr, ...rest } = partial
  return {
    id: nextId++,
    type: 'Collection',
    q: '',
    contact: null,
    time: { mode: 'asap' },
    reference: '',
    note: '',
    goods: '',
    goodsTouched: false,
    alloc: [],
    allocTouched: false,
    svc: {},
    status: 'booked',
    eta: '',
    pod: null,
    ...rest,
    addr: makeAddr(addr),
  }
}
