/**
 * Stop — a collection / delivery / both point on the route.
 *
 * Source: handover §4 / spec §2. Verbatim shape from the handover:
 *
 *   stop = {
 *     id, type:'Collection'|'Delivery'|'Both', q,
 *     addr:{...}, contact:{...}|null,
 *     time:{...},
 *     reference, note, goods, goodsTouched, allocTouched,
 *     svc:{twoman?,wait?}, status, eta:'HH:MM', pod|null, isReturn?
 *   }
 *
 * IMPORTANT (handover §1, §3): the ORDER of stops in the route array is meaningful —
 * it gates goods allocation (a delivery can only receive units collected earlier in
 * the route). Preserve order semantics in the store.
 */
import type { Address } from './address.ts'
import type { Contact } from './contact.ts'
import type { TimeSpec } from './time.ts'
import type { Pod } from './pod.ts'

export type StopType = 'Collection' | 'Delivery' | 'Both'

/**
 * Per-stop service flags. Handover shows svc:{twoman?,wait?} ("two-man",
 * "wait & return"). Other service requirements roll up from job/product scopes —
 * see Requirement.
 */
export interface StopService {
  twoman?: boolean
  wait?: boolean
  // TODO(prototype): confirm the full closed set of stop-scope svc flags.
}

/** Stop lifecycle status. */
// TODO(prototype): confirm the closed set of status values from the prototype.
export type StopStatus = string

/** Absolute, frozen clock time 'HH:MM' (NOT relative — contrast TimeSpec 'asap'). */
export type ClockTime = string

export interface Stop {
  id: string
  type: StopType
  /** `q` — quantity/sequence marker per the handover shape. */
  q: number
  addr: Address
  contact: Contact | null
  time: TimeSpec
  reference: string
  note: string
  /** Free-text goods entry (parsed by parseGoods). */
  goods: string
  /** Whether the user has edited goods (gates re-parse/preview behaviour). */
  goodsTouched: boolean
  /** Whether the user has manually touched allocation. */
  allocTouched: boolean
  svc: StopService
  status: StopStatus
  /** Absolute frozen ETA, 'HH:MM'. See ClockTime. */
  eta: ClockTime
  pod: Pod | null
  /** Marks a return leg. */
  isReturn?: boolean
}
