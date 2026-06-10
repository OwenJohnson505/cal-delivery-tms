/**
 * etaToClock — convert an incoming relative/elapsed ETA into an ABSOLUTE frozen clock
 * time 'HH:MM'.
 *
 * Behavioural source of truth: reference/booking-form-modern.html (function `etaToClock`).
 * Handover §1, §6.
 *
 * IMPORTANT (handover §6): ETA is absolute and frozen once set; ASAP timing is relative
 * (now + 45 min, recomputed at display). Do not conflate the two. The "now" reference
 * is injected (not read from a global clock) so the function is pure and testable.
 */
import type { ClockTime } from '@/types/index.ts'
import { NotPortedYet } from './notPorted.ts'

/**
 * @param _eta   incoming ETA as the prototype expresses it (e.g. minutes-from-now or a
 *               provider string) — confirm exact input form on port.
 * @param _now   reference instant used to resolve the absolute clock time (inject for
 *               purity/testability).
 */
export function etaToClock(_eta: unknown, _now: Date): ClockTime {
  // TODO(prototype): port etaToClock verbatim. Confirm the input form and rounding.
  throw new NotPortedYet('etaToClock')
}
