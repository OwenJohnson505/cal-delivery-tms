/**
 * buildCxNotes — generate the Courier Exchange driver-readable posting text.
 *
 * Behavioural source of truth: reference/booking-form-modern.html (function
 * `buildCXNotes`). Handover §1, §6, §9.
 *
 * GUARDRAIL (handover §6): the format is business-critical — separators, uppercase,
 * outcodes, and the STANDARD defaults line. Port CHARACTER-FOR-CHARACTER and cover with
 * a snapshot test whose golden file is the prototype's current output
 * (buildCxNotes.test.ts).
 *
 * The input shape below is a placeholder; the prototype reads from the live booking
 * (stops, goods, service, etc.). Finalise the parameter shape when porting.
 */
import type { Book, Stop } from '@/types/index.ts'
import { NotPortedYet } from './notPorted.ts'

export interface BuildCxNotesInput {
  stops: Stop[]
  book: Book
  // TODO(prototype): expand to whatever buildCXNotes actually reads in the prototype.
}

export function buildCxNotes(_input: BuildCxNotesInput): string {
  // TODO(prototype): port buildCXNotes verbatim. Snapshot against the golden output.
  throw new NotPortedYet('buildCxNotes')
}
