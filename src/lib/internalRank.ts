/**
 * internalRank — rank internal frequent/saved addresses for the smart address-find,
 * by persisted usage frequency (incremented on select).
 *
 * Behavioural source of truth: reference/booking-form-modern.html (function
 * `internalRank`, backed by the SAVED[] stub). Handover §1, §5.
 *
 * The input item shape is a placeholder (the prototype's saved-address record). Confirm
 * and tighten on port.
 */
import { NotPortedYet } from './notPorted.ts'

export interface SavedAddressRecord {
  /** Persisted usage count used for frequency ranking. */
  count: number
  // TODO(prototype): model the SAVED[] record shape (label, addr fields, ...).
  [key: string]: unknown
}

/** Rank/filter saved addresses for a type-ahead query. */
export function internalRank(
  _query: string,
  _saved: SavedAddressRecord[],
): SavedAddressRecord[] {
  // TODO(prototype): port internalRank verbatim (frequency-ranked type-ahead).
  throw new NotPortedYet('internalRank')
}
