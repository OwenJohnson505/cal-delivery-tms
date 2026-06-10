/**
 * API configuration seam.
 *
 * THIS PROJECT IS A DESIGN REFERENCE. It ships a fully-working MOCK that mimics every
 * API/webhook with dummy data (see src/api/mock/). No real external calls are made.
 *
 * To go live, a developer does NOT rewrite the UI: they implement the interfaces in
 * src/api/*.ts against real services and pass them here, or fill in the endpoint URLs
 * below and back them with `fetch`. The UI only ever depends on the `Api` interface, so
 * mock and real are swappable.
 *
 *   import { createApi } from '@/api/createApi.ts'
 *   const api = createApi()                      // mock (default)
 *   const api = createApi({ endpoints: {...} })  // mock, but point named seams at real URLs
 *   const api = createApi({ impl: myRealApi })   // fully custom Api implementation
 */

/** Real endpoint / webhook URLs a developer fills in when going live. */
export interface ApiEndpoints {
  /** CRM/accounts service base URL. */
  customers?: string
  /** Internal saved-address service. */
  savedAddresses?: string
  /** Google Places (Autocomplete + Place Details) proxy. */
  places?: string
  /** Postcode -> address provider (Loqate / getAddress.io / PAF). */
  postcode?: string
  /** Driver availability + CX bid feed (poll/websocket). */
  driverFeed?: string
  /** Courier Exchange posting API. */
  cxPost?: string
  /** Inbound driver-app webhook (status/ETA/POD) subscription URL. */
  stopUpdates?: string
  /** Document storage service. */
  documents?: string
  /** Server-side audit event log. */
  audit?: string
  /** Booking persistence (Draft/Quote/Booking). */
  persistence?: string
}

/** Tuning for the mock's simulated latency (ms), matching the prototype's feel. */
export interface MockLatency {
  /** Internal DB is free/instant. */
  internal: number
  /** Google Places predictions (prototype ~400ms). */
  places: number
  /** Postcode lookup (prototype ~450ms). */
  postcode: number
  /** CRM / generic request. */
  generic: number
  /**
   * Delay before the mock emits a simulated incoming CX bid via subscribeBids.
   * 0 disables the simulation (use 0 in tests).
   */
  bidSimulationMs: number
}

export const DEFAULT_LATENCY: MockLatency = {
  internal: 0,
  places: 400,
  postcode: 450,
  generic: 250,
  bidSimulationMs: 8000,
}

/** No-latency profile for tests. */
export const TEST_LATENCY: MockLatency = {
  internal: 0,
  places: 0,
  postcode: 0,
  generic: 0,
  bidSimulationMs: 0,
}
