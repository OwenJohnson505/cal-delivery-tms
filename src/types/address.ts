/**
 * Address — the normalised shape written when a user selects from any of the three
 * address-find providers. Source: spec §2.1 (stop.addr) + §3.5/§3.6.
 *
 * `src` is a human-readable provenance LABEL (e.g. 'Saved · internal', 'Google Places',
 * 'Postcode lookup', 'Entered manually'). `cls` is the provenance CLASS (closed set).
 * The picker contract (`dataAttrs`) normalises every provider response into
 * co/address/city/pc/country (spec §3.5).
 */

/** Provenance class — closed set (spec §2.1: 'internal' | 'places' | 'postcode'). */
export type AddressClass = 'internal' | 'places' | 'postcode' | 'manual'

/** UK constituent country (spec §2.1). */
export type Country = 'England' | 'Scotland' | 'Wales' | 'N. Ireland' | string

export interface Address {
  /** Company / premises name. */
  co: string
  /** Street line. */
  address: string
  city: string
  /** Postcode. */
  pc: string
  country: Country
  /** Human-readable provenance label, e.g. 'Saved · internal'. */
  src: string
  /** Provenance class. */
  cls: AddressClass
}
