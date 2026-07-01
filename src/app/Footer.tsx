/**
 * Footer — booked-by, customer reference, total revenue + save actions. Matches the
 * redesign reference order: Booked-by line, full-width customer-ref input, then the
 * total revenue on the same row as Cancel / save actions. (Our ref lives in the header.)
 */
import { useState } from 'react'
import { useBookingStore } from '@/store/bookingStore.ts'
import { useJobsStore, captureSnapshot } from '@/store/jobsStore.ts'
import { useEmailsStore } from '@/store/emailsStore.ts'
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
  const revenue = useBookingStore((s) => s.charges.reduce((t, c) => t + (c.rate || 0), 0))
  const [custRef, setCustRef] = useState('')

  function save(status: JobStatus) {
    const snapshot = captureSnapshot()
    const job = saveJob({ id: editingJobId, status, snapshot, createdAt: stamp() })
    useEmailsStore.getState().commitPendingJobLink(job.ref)
    goToList(tabFor(status))
  }

  const isBooked = editingJobId != null && jobStatus === 'Booking'

  let actions
  if (isBooked) {
    actions = (
      <>
        <button className="btn ghost" onClick={() => goToList()}>Cancel</button>
        <button className="btn primary" onClick={() => save('Booking')}>Update</button>
      </>
    )
  } else if (quickQuote) {
    actions = (
      <>
        <button className="btn ghost" onClick={() => save('Draft')}>Draft</button>
        <button className="btn primary" onClick={() => save('Quick Quote')}>Save quote</button>
      </>
    )
  } else {
    actions = (
      <>
        <button className="btn ghost" onClick={() => save('Draft')}>Draft</button>
        <button className="btn ghost" onClick={() => save('Quote')}>Quote</button>
        <button className="btn primary" onClick={() => save('Booking')}>Save</button>
      </>
    )
  }

  return (
    <div className="footer bk-footer">
      <div className="booked">Booked by <b>Owen Johnson</b> · 6 Jun 2026, 18:53</div>
      <div className="custref">
        <input
          placeholder="Customer reference / PO number…"
          value={custRef}
          onChange={(e) => setCustRef(e.target.value)}
        />
      </div>
      <div className="pay">
        <div className="foot-meta">
          <span className="lbl">Total revenue</span>
          <span className="total">£{revenue.toFixed(2)}</span>
        </div>
        <div className="db-spacer" />
        {actions}
      </div>
    </div>
  )
}
