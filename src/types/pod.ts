/**
 * Pod — proof of delivery / proof of collection (POD/POB) capture for a stop.
 *
 * Source: handover §1 (per-stop POD/POB viewer, Manual vs CX-API) / spec §2 & §8.
 *
 * The prototype distinguishes a Manual capture source from a CX-API source.
 * Exact field set is not fully enumerated in the handover text — model the known
 * shape and confirm against the prototype.
 */

export type PodSource = 'Manual' | 'CX-API'

export interface Pod {
  /** How the proof was captured. */
  source: PodSource
  /** Name of the person who signed / received. */
  signedBy?: string
  /** Capture timestamp ('dd-mm-yyyy HH:MM' in the prototype). */
  at?: string
  /** Captured signature image (data URL / ref). */
  signature?: string
  /** Photo proof image refs/URLs. */
  photos?: string[]
  /** Free-text note recorded at proof time. */
  note?: string
  // TODO(prototype): confirm the full pod shape (fields + optionality) from
  // reference/booking-form-modern.html before relying on this.
}
