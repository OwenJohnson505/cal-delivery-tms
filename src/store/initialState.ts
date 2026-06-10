/**
 * Initial booking state — a fresh, empty booking (jobStatus 'Draft').
 *
 * TODO(prototype): the prototype seeds an initial stop list and defaults; mirror those
 * once the prototype is on disk if the app should open with a default route.
 */
import type { BookingState } from './types.ts'

export function createInitialState(): BookingState {
  return {
    stops: [],
    book: {},
    ms: { equip: {}, service: {} },
    tariff: null,
    eq: {},
    allocatedDriver: null,
    cx: { text: '', dirty: false, posted: false },
    assign: {},
    jobStatus: 'Draft',
  }
}
