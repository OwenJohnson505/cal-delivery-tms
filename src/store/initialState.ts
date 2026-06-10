/**
 * Initial booking state. MS/TAR defaults mirror the prototype globals (spec §5):
 * BODY_TYPES/EQUIPMENT/SERVICE_TYPES option lists with the prototype's default
 * selections, so the app opens in the same state the reference build does.
 */
import type { BookingState } from './types.ts'
import { seedStops, seedEq } from './seed.ts'

const BODY_TYPES = ['Curtain side', 'Box', 'Flatbed', 'Low loader']
const EQUIPMENT = ['Tail lift', 'Pump truck']
const SERVICE_TYPES = ['Dedicated', 'ADR']

/** A fresh blank booking for "Add new booking": one collection + one delivery. */
export function createNewBooking(): BookingState {
  const blankAddr = { co: '', address: '', city: '', pc: '', country: 'England', src: '', cls: 'manual' as const }
  const base = createInitialState()
  return {
    ...base,
    stops: [
      { id: 1, type: 'Collection', q: '', addr: { ...blankAddr }, contact: null, time: { mode: 'asap' }, reference: '', note: '', goods: '', goodsTouched: false, alloc: [], allocTouched: false, svc: {}, status: 'booked', eta: '', pod: null },
      { id: 2, type: 'Delivery', q: '', addr: { ...blankAddr }, contact: null, time: { mode: 'asap' }, reference: '', note: '', goods: '', goodsTouched: false, alloc: [], allocTouched: false, svc: {}, status: 'booked', eta: '', pod: null },
    ],
  }
}

/** The demo booking the app opens with (prototype seed). */
export function createSeededState(): BookingState {
  return {
    ...createInitialState(),
    stops: seedStops(),
    eq: seedEq(),
    book: { cust: 'brightway', contact: { name: 'Sarah Doyle', email: 's.doyle@brightway.co.uk', tel: '0113 555 0148' } },
  }
}

export function createInitialState(): BookingState {
  return {
    stops: [],
    book: { cust: null, contact: null },
    ms: {
      body: { o: BODY_TYPES, sel: ['Curtain side'], ph: 'Select body type(s)' },
      equip: { o: EQUIPMENT, sel: ['Tail lift', 'Pump truck'], ph: 'Vehicle equipment' },
      service: { o: SERVICE_TYPES, sel: ['Dedicated', 'ADR'], ph: 'Job-wide service' },
    },
    tariff: { q: '' },
    eq: {},
    assignTouched: false,
    allocatedDriver: null,
    cx: { text: '', dirty: false, posted: false },
    assign: {},
    jobStatus: 'Draft',
    quickQuote: false,
    jobNotes: '',
    charges: [],
    customJob: {},
  }
}
