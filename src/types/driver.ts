/**
 * Driver & Bid — internal drivers and Courier Exchange (CX) bids.
 *
 * Source: handover §1 (Driver; Providers drawer with internal drivers + CX bids and
 * an unseen-count badge), §5 (DRIVERS / CXBIDS stubs -> driver availability + CX bid
 * feed via poll/websocket).
 *
 * Field sets are not fully enumerated in the handover text — model the known/implied
 * shape and confirm against the prototype.
 */

export interface Driver {
  id: string
  name: string
  /** Quoted rate for the job (currency-minor or display string — confirm on port). */
  rate?: number
  /**
   * ETA stored as an ABSOLUTE clock time 'HH:MM' (handover §1: "rate + ETA stored as
   * absolute clock time"). Run incoming ETAs through etaToClock() in src/lib.
   */
  eta?: string
  // TODO(prototype): confirm full driver shape (availability, vehicle, distance, ...).
}

/** A Courier Exchange bid in the Providers drawer. */
export interface Bid {
  id: string
  driverId?: string
  driverName: string
  rate: number
  eta?: string
  /** Whether the ops user has seen this bid (drives the unseen-count badge). */
  seen: boolean
  // TODO(prototype): confirm full bid shape.
}

/**
 * The allocated driver on a job (prototype global `allocatedDriver`), or null if none.
 */
export type AllocatedDriver = Driver | null
