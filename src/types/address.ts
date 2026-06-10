/**
 * Address — the normalised shape written when a user selects from any of the
 * three address-find providers (internal/saved DB, Google Places, postcode lookup).
 *
 * Source: handover §4 (stop.addr) / spec §2.
 *
 * NOTE: field set is taken verbatim from the handover's stop.addr example:
 *   addr:{co,address,city,pc,country,src,cls}
 * Confirm the exact semantics of `src` and `cls` against the prototype when it lands.
 */

/** Which provider produced this address (provenance). */
export type AddressSource =
  | 'internal' // frequent/saved DB
  | 'places' // Google Places prediction + Place Details
  | 'postcode' // full-postcode address lookup
  | 'manual' // hand-typed
  | string // TODO(prototype): confirm the closed set of `src` values

/** Address classification (e.g. residential/commercial/depot). */
// TODO(prototype): confirm the closed set of `cls` values from the prototype.
export type AddressClass = string

export interface Address {
  /** Company / care-of name. */
  co: string
  /** Street address line(s). */
  address: string
  city: string
  /** Postcode. */
  pc: string
  country: string
  /** Provenance of the selection. */
  src: AddressSource
  /** Classification. */
  cls: AddressClass
}
