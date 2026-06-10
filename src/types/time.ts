/**
 * TimeSpec — a stop's timing window.
 *
 * Source: handover §4 (stop.time) / spec §2.
 *   time:{mode:'asap'|'at'|'between'|'by', at,by,from,to}
 *
 * Datetime fields are strings in the prototype's 'dd-mm-yyyy HH:MM' format.
 *
 * IMPORTANT (handover §6): 'asap' is RELATIVE (now + 45 min, recomputed at display
 * time) and must NOT be conflated with a stop's ETA, which is an absolute frozen
 * 'HH:MM' clock value (see Stop.eta). Keep these distinct.
 */

/** Prototype datetime format: 'dd-mm-yyyy HH:MM'. */
export type DateTimeString = string

export type TimeMode = 'asap' | 'at' | 'between' | 'by'

export interface TimeSpec {
  mode: TimeMode
  /** Used when mode === 'at'. */
  at?: DateTimeString
  /** Used when mode === 'by'. */
  by?: DateTimeString
  /** Lower bound, used when mode === 'between'. */
  from?: DateTimeString
  /** Upper bound, used when mode === 'between'. */
  to?: DateTimeString
}
