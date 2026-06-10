/**
 * Driver & Bid — internal drivers (DRIVERS[]) and Courier Exchange bids (CXBIDS[]).
 * Source: prototype dcard/bcard/allocateDriver, spec §9 (Providers).
 */

/** Internal driver in the Providers drawer. */
export interface Driver {
  id?: string
  name: string
  vehicle: string
  /** Location/summary line, e.g. 'Leeds · 310 jobs'. */
  loc: string
  /** ETA as the feed expresses it (e.g. '12 min', '14:25') — resolve via etaToClock. */
  eta?: string
  /** Whether the driver has flagged interest in this job. */
  interested?: boolean
}

/** A Courier Exchange bid. */
export interface Bid {
  id?: string
  name: string
  vehicle: string
  loc: string
  /** Display rating, e.g. '4.6'. */
  rating: string
  /** Display price, e.g. '£365'. */
  price: string
}

/**
 * The allocated driver card (prototype global `allocatedDriver`). `eta` is an ABSOLUTE
 * frozen clock time produced by etaToClock; `rate` is the numeric-ish string entered.
 */
export interface AllocatedDriverInfo {
  name: string
  vehicle: string
  id: string
  rate: string
  /** Absolute 'HH:MM' (via etaToClock), '' if none. */
  eta: string
}

export type AllocatedDriver = AllocatedDriverInfo | null
