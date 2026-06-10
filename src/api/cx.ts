/**
 * Courier Exchange posting API (handover §1 CX notes, §5: buildCXNotes() output ->
 * POST body to the CX API; keep the cxDirty/cxPosted freeze).
 *
 * The notes TEXT is produced by src/lib/buildCxNotes (byte-for-byte from the prototype);
 * this seam only posts it and reports the result. Posting is what flips cxPosted true and
 * freezes the note.
 */

export interface CxPostInput {
  jobId: string
  /** The generated note text from buildCxNotes(). */
  notes: string
  /** Posting price / rate, if set on the job. */
  price?: number
  // TODO(prototype): confirm the full CX POST body (vehicle, dates, contact, ...).
}

export interface CxPostResult {
  /** CX-side posting id. */
  postingId: string
}

export interface CxApi {
  /** Post the job to Courier Exchange. On success the caller freezes cxPosted. */
  post(input: CxPostInput): Promise<CxPostResult>
}
