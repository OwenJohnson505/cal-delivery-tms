/**
 * Persistence (handover §1 footer, §5: Draft/Quote/Booking -> persistence endpoints;
 * jobStatus drives footer actions).
 *
 * The booking snapshot shape is the serialised store state; modelled loosely here until
 * the store + prototype confirm the exact persisted shape.
 */
import type { JobStatus } from '@/types/index.ts'

/** Serialised job snapshot persisted to the backend. */
export interface JobSnapshot {
  id: string
  status: JobStatus
  // TODO(prototype/store): the full serialised booking (stops, book, ms/tar/eq,
  // allocatedDriver, assign, cxNotes). Tighten once the store shape is final.
  [key: string]: unknown
}

export interface PersistenceApi {
  load(jobId: string): Promise<JobSnapshot>
  /** Persist as Draft. */
  saveDraft(snapshot: JobSnapshot): Promise<JobSnapshot>
  /** Persist as Quote. */
  saveQuote(snapshot: JobSnapshot): Promise<JobSnapshot>
  /** Persist as confirmed Booking. */
  saveBooking(snapshot: JobSnapshot): Promise<JobSnapshot>
}
