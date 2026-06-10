/**
 * Pod — proof of delivery / collection (POD/POB). Source: spec §6 (verbatim shape).
 *
 *   pod = { type:'POD'|'POB', via:'Manual'|'CX API', by, at, name, sig:Boolean, photos:Number }
 *
 * The Manual-vs-CX-API distinction (`via`) is first-class and surfaced everywhere a
 * proof is shown.
 */

/** Delivery proof vs collection proof. */
export type PodType = 'POD' | 'POB'

/** How the proof was captured — drives the source tag. */
export type PodVia = 'Manual' | 'CX API'

export interface Pod {
  type: PodType
  via: PodVia
  /** User / system that added it. */
  by: string
  /** Capture timestamp, 'dd-mm-yyyy HH:MM'. */
  at: string
  /** Signatory name. */
  name: string
  /** Whether a signature was captured. */
  sig: boolean
  /** Count of attached images. */
  photos: number
}
