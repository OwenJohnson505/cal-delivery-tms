/**
 * Footer (prototype lines 553-559): booked-by / our-ref meta, total revenue, and the
 * contextual Draft/Quote/Booking actions. jobStatus drives which actions show (spec §10).
 */
import { useBookingStore } from '@/store/bookingStore.ts'
import type { JobStatus } from '@/types/index.ts'

const NEXT: Record<JobStatus, { label: string; to: JobStatus } | null> = {
  Draft: { label: 'Save as quote', to: 'Quote' },
  Quote: { label: 'Confirm booking', to: 'Booking' },
  Booking: null,
}

export function Footer() {
  const jobStatus = useBookingStore((s) => s.jobStatus)
  const setJobStatus = useBookingStore((s) => s.setJobStatus)
  const next = NEXT[jobStatus]

  return (
    <div className="footer">
      <div className="foot-meta">
        <div className="foot-field">
          <span className="foot-lbl">Booked by</span>
          <span className="foot-val">Owen Johnson · 06-06-26 18:53</span>
        </div>
        <div className="foot-field">
          <span className="foot-lbl">Our ref</span>
          <span className="foot-val cpx" title="Click to copy">BK-2026-100482</span>
        </div>
      </div>
      <div className="foot-actions">
        <div className="foot-rev">
          <span className="foot-lbl">Total revenue</span>
          <span className="foot-amt">£0.00</span>
        </div>
        <div id="footActions" className="saveas">
          <span className="foot-lbl" style={{ marginRight: 8 }}>Status: {jobStatus}</span>
          {jobStatus !== 'Draft' && (
            <button className="btn sm" onClick={() => setJobStatus('Draft')}>Back to draft</button>
          )}
          <button className="btn">Save draft</button>
          {next && (
            <button className="btn primary" onClick={() => setJobStatus(next.to)}>
              {next.label}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
