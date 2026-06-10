/**
 * Courier Exchange (CX) posting notes.
 *
 * Source: handover §1 (CX notes — auto-generated, driver-readable posting text that
 * stays live until posted, then freezes) and §6 (format is business-critical:
 * separators, uppercase, outcodes, the STANDARD defaults line — port character-for-
 * character and snapshot-test).
 *
 * The generated text is one of the four byte-identical output formats. buildCxNotes()
 * in src/lib must reproduce the prototype's output exactly.
 */

export interface CxNotesState {
  /** The current generated/posted note text. */
  text: string
  /**
   * True while the note is still being regenerated live from the booking. Prototype
   * global `cxDirty`. Once posted, the note freezes and dirty stops mattering.
   */
  dirty: boolean
  /**
   * True once the note has been posted to CX; freezes the text. Prototype global
   * `cxPosted`.
   */
  posted: boolean
}
