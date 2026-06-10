/**
 * ListScreen — the Bookings / Quotes / Drafts tables. Tabbed, searchable, with row
 * actions (open in the wizard, delete) and an "Add new booking" button that opens a
 * fresh wizard. Basic data-table version; filtering is by tab + search for now.
 */
import { useMemo, useState } from 'react'
import { Icon } from '@/app/Icon.tsx'
import { useJobsStore, type SavedJob } from '@/store/jobsStore.ts'
import { useViewStore, type ListTab } from '@/store/viewStore.ts'
import { useBookingStore } from '@/store/bookingStore.ts'
import type { JobStatus } from '@/types/index.ts'

const TAB_STATUSES: Record<ListTab, JobStatus[]> = {
  bookings: ['Booking'],
  quotes: ['Quote', 'Quick Quote'],
  drafts: ['Draft'],
}
const TAB_LABEL: Record<ListTab, string> = { bookings: 'Bookings', quotes: 'Quotes', drafts: 'Drafts' }

export function ListScreen() {
  const jobs = useJobsStore((s) => s.jobs)
  const deleteJob = useJobsStore((s) => s.deleteJob)
  const tab = useViewStore((s) => s.listTab)
  const setListTab = useViewStore((s) => s.setListTab)
  const openWizard = useViewStore((s) => s.openWizard)
  const newBooking = useBookingStore((s) => s.newBooking)
  const loadSnapshot = useBookingStore((s) => s.loadSnapshot)

  const [query, setQuery] = useState('')

  const counts = useMemo(() => {
    const c: Record<ListTab, number> = { bookings: 0, quotes: 0, drafts: 0 }
    jobs.forEach((j) => {
      ;(Object.keys(TAB_STATUSES) as ListTab[]).forEach((t) => {
        if (TAB_STATUSES[t].includes(j.status)) c[t]++
      })
    })
    return c
  }, [jobs])

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase()
    return jobs
      .filter((j) => TAB_STATUSES[tab].includes(j.status))
      .filter((j) => !q || `${j.ref} ${j.customer} ${j.route} ${j.vehicle}`.toLowerCase().includes(q))
  }, [jobs, tab, query])

  function addNew() {
    newBooking()
    openWizard(null)
  }
  function open(job: SavedJob) {
    loadSnapshot(job.snapshot)
    openWizard(job.id)
  }

  return (
    <div className="list-app">
      <div className="list-work">
        <div className="list-head">
          <h1>{TAB_LABEL[tab]}</h1>
          <button className="btn primary" onClick={addNew}>
            <Icon name="plus" size={15} /> Add new booking
          </button>
        </div>

        <div className="list-tabs">
          {(Object.keys(TAB_LABEL) as ListTab[]).map((t) => (
            <button
              key={t}
              className={'list-tab' + (t === tab ? ' on' : '')}
              onClick={() => setListTab(t)}
            >
              {TAB_LABEL[t]} <span className="list-tab-n">{counts[t]}</span>
            </button>
          ))}
        </div>

        <div className="list-toolbar">
          <div className="ac" style={{ maxWidth: 320 }}>
            <input
              type="text"
              placeholder="Search ref, customer, route or vehicle…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          <span className="list-count">{rows.length} {rows.length === 1 ? 'item' : 'items'}</span>
        </div>

        <div className="list-tablewrap">
          <table className="list-table">
            <thead>
              <tr>
                <th>Ref</th>
                <th>Customer</th>
                <th>Route</th>
                <th>Vehicle</th>
                <th>Status</th>
                <th className="num">Revenue</th>
                <th>Created</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((j) => (
                <tr key={j.id} onDoubleClick={() => open(j)}>
                  <td><b>{j.ref}</b></td>
                  <td>{j.customer}</td>
                  <td>{j.route}</td>
                  <td>{j.vehicle}</td>
                  <td><span className="itag">{j.status}</span></td>
                  <td className="num">£{j.revenue.toFixed(2)}</td>
                  <td>{j.createdAt}</td>
                  <td className="list-actions">
                    <button className="btn sm" onClick={() => open(j)} title="Open">
                      <Icon name="edit" size={14} /> Open
                    </button>
                    <button
                      className="btn sm iconbtn"
                      title="Delete"
                      onClick={() => {
                        if (confirm(`Delete ${j.ref}?`)) deleteJob(j.id)
                      }}
                    >
                      <Icon name="trash" size={14} />
                    </button>
                  </td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td className="empty" colSpan={8}>
                    No {TAB_LABEL[tab].toLowerCase()} {query ? 'match your search' : 'yet'}.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
