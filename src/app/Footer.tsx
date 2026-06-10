/**
 * Footer — booked-by / our-ref meta, total revenue, and the save actions. Saving persists
 * the current booking to the jobs list (as Draft / Quote / Quick Quote / Booking) and
 * returns to the matching list screen. In a full booking all three saves are available;
 * Quick Quote offers Draft / Quick Quote only.
 */
import { RefHistory } from '@/features/customer/RefHistory.tsx'
import { StatusPill } from '@/app/StatusPill.tsx'
import { useBookingStore } from '@/store/bookingStore.ts'
import { useJobsStore, captureSnapshot } from '@/store/jobsStore.ts'
import { useViewStore, type ListTab } from '@/store/viewStore.ts'
import type { JobStatus } from '@/types/index.ts'

function tabFor(status: JobStatus): ListTab {
  if (status === 'Booking') return 'bookings'
  if (status === 'Draft') return 'drafts'
  return 'quotes'
}

function stamp(): string {
  const d = new Date()
  const p = (n: number) => ('0' + n).slice(-2)
  return `${p(d.getDate())}-${p(d.getMonth() + 1)}-${d.getFullYear()} ${p(d.getHours())}:${p(d.getMinutes())}`
}

export function Footer() {
  const jobStatus = useBookingStore((s) => s.jobStatus)
  const quickQuote = useBookingStore((s) => s.quickQuote)
  const saveJob = useJobsStore((s) => s.saveJob)
  const editingJobId = useViewStore((s) => s.editingJobId)
  const goToList = useViewStore((s) => s.goToList)

  function save(status: JobStatus) {
    const snapshot = captureSnapshot()
    saveJob({ id: editingJobId, status, snapshot, createdAt: stamp() })
    goToList(tabFor(status))
  }

  const revenue = useBookingStore((s) => s.charges.reduce((t, c) => t + (c.rate || 0), 0))

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
          <span className="foot-amt">£{revenue.toFixed(2)}</span>
        </div>
        <RefHistory />
        <div id="footActions" className="saveas">
          <span className="foot-lbl" style={{ marginRight: 8 }}>Status</span>
          <StatusPill status={jobStatus} />
          <span style={{ width: 8 }} />
          {quickQuote ? (
            <>
              <button className="btn" onClick={() => save('Draft')}>Save as draft</button>
              <button className="btn primary" onClick={() => save('Quick Quote')}>Save as Quick Quote</button>
            </>
          ) : (
            <>
              <button className="btn" onClick={() => save('Draft')}>Save draft</button>
              <button className="btn" onClick={() => save('Quote')}>Save as quote</button>
              <button className="btn primary" onClick={() => save('Booking')}>Save as booking</button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
