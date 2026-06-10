/**
 * Stop — a collection / delivery / both point. Source: spec §2.1 (verbatim shape).
 *
 * Route order in stops[] is SIGNIFICANT — it gates goods allocation (spec §4.3): a
 * delivery can only receive units collected earlier in the route.
 */
import type { Address } from './address.ts'
import type { Contact } from './contact.ts'
import type { TimeSpec } from './time.ts'
import type { Pod } from './pod.ts'

export type StopType = 'Collection' | 'Delivery' | 'Both'

/** Stop-scoped service flags (spec §5: STOP_SVC; svcKey maps label -> flag). */
export interface StopService {
  twoman?: boolean
  wait?: boolean
}

/** Lifecycle status (spec §7). */
export type StopStatus =
  | 'booked'
  | 'enroute'
  | 'arrived'
  | 'collected'
  | 'delivered'

/** Absolute, frozen clock time 'HH:MM' (spec §7 — never a countdown). */
export type ClockTime = string

export interface Stop {
  /** Stable per-booking id; new = max(ids)+1. */
  id: number
  type: StopType
  /** Raw text currently in the address-find search box. */
  q: string
  addr: Address
  contact: Contact | null
  time: TimeSpec
  /** Customer/consignment ref for this stop. */
  reference: string
  /** Free-text instruction (shown to driver / on CX). */
  note: string
  /** Free-text goods description (Collection/Both only) — see lib/parseGoods. */
  goods: string
  goodsTouched: boolean
  /** Legacy per-stop allocation; live allocation is the ASSIGN map (spec §4.3). */
  alloc: number[]
  allocTouched: boolean
  svc: StopService
  status: StopStatus
  /** Absolute frozen ETA, 'HH:MM'. */
  eta: ClockTime
  pod: Pod | null
  /** Set on an auto-generated wait-&-return leg (spec §5.2). */
  isReturn?: boolean
}
