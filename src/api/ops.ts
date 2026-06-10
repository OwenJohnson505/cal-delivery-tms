/**
 * Ops seams: POD/status/ETA inbound, documents, and the audit log.
 * (handover §1 ops extras, §5: pod/status/eta -> driver-app webhooks run through
 * etaToClock; DOCS/AUDIT -> file storage / server-side event log.)
 */
import type { ClockTime, Pod, StopStatus } from '@/types/index.ts'

/** A status/ETA/POD update arriving from a driver-app webhook for a stop. */
export interface StopUpdate {
  stopId: number
  status?: StopStatus
  /** Incoming ETA — resolve to absolute ClockTime via src/lib/etaToClock. */
  eta?: ClockTime
  pod?: Pod
}

export interface OpsStatusApi {
  /** Subscribe to inbound stop updates (webhook fan-in). Returns unsubscribe. */
  subscribeStopUpdates(jobId: string, onUpdate: (u: StopUpdate) => void): () => void
}

/** A booking document, global to the job or attached to a specific stop. */
export interface BookingDocument {
  id: string
  name: string
  mime: string
  /** Stop id if per-stop, else undefined for job-global. */
  stopId?: number
  url: string
}

export interface DocumentsApi {
  list(jobId: string): Promise<BookingDocument[]>
  upload(
    jobId: string,
    file: File,
    opts?: { stopId?: number },
  ): Promise<BookingDocument>
  remove(jobId: string, documentId: string): Promise<void>
}

/** An entry in the Docket audit timeline. */
export interface AuditEntry {
  id: string
  /** ISO timestamp. */
  at: string
  actor: string
  /** Human-readable event description. */
  event: string
  meta?: Record<string, unknown>
}

export interface AuditApi {
  list(jobId: string): Promise<AuditEntry[]>
  append(jobId: string, entry: Omit<AuditEntry, 'id'>): Promise<AuditEntry>
}
