/**
 * Initial booking state. MS/TAR defaults mirror the prototype globals (spec §5):
 * BODY_TYPES/EQUIPMENT/SERVICE_TYPES option lists with the prototype's default
 * selections, so the app opens in the same state the reference build does.
 */
import type { BookingState } from './types.ts'

const BODY_TYPES = ['Curtain side', 'Box', 'Flatbed', 'Low loader']
const EQUIPMENT = ['Tail lift', 'Pump truck']
const SERVICE_TYPES = ['Dedicated', 'ADR']

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
  }
}
