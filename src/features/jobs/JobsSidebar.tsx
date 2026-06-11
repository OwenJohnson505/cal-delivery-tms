/**
 * JobsSidebar — replaces the bookings table while the email panel is open, freeing
 * the width for the email client. Collapsed by default to a thin strip; expands on
 * hover, or pin it open with the chevron. Jobs render as compact cards (click to
 * open in the wizard). Tabs + search + add-new live in the expanded header.
 */
import { useState } from 'react'
import { Icon } from '@/app/Icon.tsx'
import { StatusPill } from '@/app/StatusPill.tsx'
import { useJobsStore, type SavedJob } from '@/store/jobsStore.ts'
import { useCustomersStore } from '@/store/customersStore.ts'
import { useBookingStore } from '@/store/bookingStore.ts'
import { useViewStore, type ListTab } from '@/store/viewStore.ts'
import type { JobStatus } from '@/types/index.ts'

const TAB_STATUSES: Record<ListTab, JobStatus[]> = {
  bookings: ['Booking'],
  quotes: ['Quote', 'Quick Quote'],
  drafts: ['Draft'],
}
const TAB_LABEL: Record<ListTab, string> = { bookings: 'Bookings', quotes: 'Quotes', drafts: 'Drafts' }

export function JobsSidebar() {
  const jobs = useJobsStore((s) => s.jobs)
  const customers = useCustomersStore((s) => s.customers)
  const openWizard = useViewStore((s) => s.openWizard)
  const newBooking = useBookingStore((s) => s.newBooking)
  const loadSnapshot = useBookingStore((s) => s.loadSnapshot)

  const [pinned, setPinned] = useState(false)
  const [hover, setHover] = useState(false)
  const [tab, setTab] = useState<ListTab>('bookings')
  const [q, setQ] = useState('')
  const open = pinned || hover

  const displayName = (j: SavedJob) =>
    customers.find((c) => c.id === j.snapshot.book.cust)?.displayName || j.customer

  const rows = jobs
    .filter((j) => TAB_STATUSES[tab].includes(j.status))
    .filter((j) => {
      const needle = q.trim().toLowerCase()
      if (!needle) return true
      return `${j.ref} ${displayName(j)} ${j.route} ${j.vehicle} ${j.supplierName} ${j.custRef}`.toLowerCase().includes(needle)
    })

  const openJob = (j: SavedJob) => {
    loadSnapshot(j.snapshot)
    openWizard(j.id)
  }
  const addNew = () => {
    newBooking()
    openWizard(null)
  }
  const count = jobs.filter((j) => TAB_STATUSES.bookings.includes(j.status)).length

  return (
    <aside
      className={'jobs-side' + (open ? ' open' : '')}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      {!open ? (
        <div className="js-strip">
          <button className="js-expand" title="Expand jobs" onClick={() => setPinned(true)}>›</button>
          <span className="js-vlabel">Bookings · {count}</span>
          <button className="js-addmini" title="Add new booking" onClick={addNew}><Icon name="plus" size={14} /></button>
        </div>
      ) : (
        <div className="js-full">
          <div className="js-head">
            <div className="js-tabs">
              {(Object.keys(TAB_LABEL) as ListTab[]).map((t) => (
                <button key={t} className={'ep-view' + (t === tab ? ' on' : '')} onClick={() => setTab(t)}>
                  {TAB_LABEL[t]}
                </button>
              ))}
            </div>
            <button className="btn sm iconbtn" title="Add new booking" onClick={addNew}><Icon name="plus" size={15} /></button>
            <button className={'js-pin' + (pinned ? ' on' : '')} title={pinned ? 'Unpin (collapse on mouse-out)' : 'Pin open'} onClick={() => setPinned((o) => !o)}>
              {pinned ? '‹' : '📌'}
            </button>
          </div>
          <input className="ep-search js-search" placeholder="Search jobs…" value={q} onChange={(e) => setQ(e.target.value)} />
          <div className="js-cards">
            {rows.map((j) => (
              <button key={j.id} className="jcard" onClick={() => openJob(j)} title={`Open ${j.ref}`}>
                <span className="jcard-top">
                  <b>{displayName(j)}</b>
                  {j.progress && <StatusPill status={j.progress} />}
                </span>
                <span className="jcard-mid">
                  {j.collectAt ? j.collectAt : '—'} <i>→</i> {j.deliverAt ? j.deliverAt : '—'}
                </span>
                <span className="jcard-sub">
                  {j.route} · {j.vehicle || '—'} · {j.supplierName || 'Unassigned'}
                </span>
              </button>
            ))}
            {!rows.length && <div className="ep-empty">No {TAB_LABEL[tab].toLowerCase()}.</div>}
          </div>
        </div>
      )}
    </aside>
  )
}
