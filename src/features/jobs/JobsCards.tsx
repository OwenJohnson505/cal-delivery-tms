/**
 * JobsCards — the bookings list rendered as compact cards while the email panel is
 * open (the table needs more width than we have). Always visible (never collapsed).
 * Keeps the table's key interactions: click the customer name for contact details,
 * click the supplier for driver details, and the collection/delivery ETAs are shown
 * on the card. Clicking a card opens the job in the wizard — which fills this same
 * area, so the email panel never moves.
 */
import { useMemo, useState, type ReactNode } from 'react'
import { Icon } from '@/app/Icon.tsx'
import { StatusPill } from '@/app/StatusPill.tsx'
import { useJobsStore, type SavedJob } from '@/store/jobsStore.ts'
import { useCustomersStore, type Customer } from '@/store/customersStore.ts'
import { useBookingStore } from '@/store/bookingStore.ts'
import { useViewStore, type ListTab } from '@/store/viewStore.ts'
import { outcode } from '@/lib/index.ts'
import type { JobStatus } from '@/types/index.ts'

const TAB_STATUSES: Record<ListTab, JobStatus[]> = {
  bookings: ['Booking'],
  quotes: ['Quote', 'Quick Quote'],
  drafts: ['Draft'],
}
const TAB_LABEL: Record<ListTab, string> = { bookings: 'Bookings', quotes: 'Quotes', drafts: 'Drafts' }

/** Is the customer ref accepted? mirrors the table's rule. */
function refOk(custRef: string, cust?: Customer): boolean {
  const inv = cust?.invoicing
  if (!inv) return true
  const ref = (custRef || '').trim()
  if (inv.fixedPo?.trim()) return ref.toUpperCase() === inv.fixedPo.trim().toUpperCase()
  if (inv.poPrefixes?.length) return !!ref && inv.poPrefixes.some((p) => ref.toUpperCase().startsWith(p.toUpperCase()))
  if (inv.poRequired) return !!ref
  return true
}

export function JobsCards() {
  const jobs = useJobsStore((s) => s.jobs)
  const customers = useCustomersStore((s) => s.customers)
  const openWizard = useViewStore((s) => s.openWizard)
  const newBooking = useBookingStore((s) => s.newBooking)
  const loadSnapshot = useBookingStore((s) => s.loadSnapshot)

  const [tab, setTab] = useState<ListTab>('bookings')
  const [q, setQ] = useState('')
  const [pop, setPop] = useState<{ x: number; y: number; node: ReactNode } | null>(null)

  const custById = useMemo(() => Object.fromEntries(customers.map((c) => [c.id, c])), [customers])
  const displayName = (j: SavedJob) => custById[j.snapshot.book.cust ?? '']?.displayName || j.customer

  const openPop = (e: React.MouseEvent, node: ReactNode) => {
    e.stopPropagation()
    const r = (e.currentTarget as HTMLElement).getBoundingClientRect()
    setPop({ x: Math.min(r.left, window.innerWidth - 290), y: r.bottom + 6, node })
  }

  const counts = (t: ListTab) => jobs.filter((j) => TAB_STATUSES[t].includes(j.status)).length

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

  // popover builders (reuse the table's .cp-card chrome)
  const contactNode = (j: SavedJob) => {
    const cust = custById[j.snapshot.book.cust ?? '']
    const booked = j.snapshot.book.contact
    const main = cust?.contacts.find((c) => c.isMain) ?? cust?.contacts[0]
    const c = booked ?? (main ? { name: main.name, email: main.email, tel: main.phone } : null)
    return (
      <div className="cp-card">
        <div className="cp-h">{cust?.displayName || j.customer} · contact</div>
        {c ? (
          <>
            <div className="cp-row"><span className="cp-k">Name</span><span>{c.name || '—'}</span></div>
            {c.email
              ? <a className="cp-link" href={`mailto:${c.email}`}><Icon name="mail" size={13} /> {c.email}</a>
              : <div className="cp-row"><span className="cp-k">Email</span><span>—</span></div>}
            {c.tel
              ? <a className="cp-link" href={`tel:${c.tel}`}><Icon name="phone" size={13} /> {c.tel}</a>
              : <div className="cp-row"><span className="cp-k">Phone</span><span>—</span></div>}
            {!booked && <div className="cp-audit">Account main contact (none picked on the job).</div>}
          </>
        ) : (
          <div className="cp-row"><span className="cp-k">Contact</span><span>—</span></div>
        )}
      </div>
    )
  }
  const supplierNode = (j: SavedJob) => (
    <div className="cp-card">
      <div className="cp-h">{j.supplierName} · driver</div>
      {j.supplierPhone
        ? <a className="cp-link" href={`tel:${j.supplierPhone}`}><Icon name="phone" size={13} /> {j.supplierPhone}</a>
        : <div className="cp-row"><span className="cp-k">Phone</span><span>—</span></div>}
      {j.supplierEmail
        ? <a className="cp-link" href={`mailto:${j.supplierEmail}`}><Icon name="mail" size={13} /> {j.supplierEmail}</a>
        : <div className="cp-row"><span className="cp-k">Email</span><span>—</span></div>}
      {(j.supplierAssignedBy || j.supplierAssignedAt) && (
        <div className="cp-audit">Assigned by {j.supplierAssignedBy || '—'} · {j.supplierAssignedAt}</div>
      )}
    </div>
  )

  const route = (j: SavedJob) => {
    const pts = j.snapshot.stops.filter((s) => s.addr.pc).map((s) => outcode(s.addr.pc))
    return pts.length ? pts.join(' → ') : j.route
  }

  return (
    <div className="email-jobs">
      <div className="ej-head">
        <div className="ej-tabs">
          {(Object.keys(TAB_LABEL) as ListTab[]).map((t) => (
            <button key={t} className={'ep-view' + (t === tab ? ' on' : '')} onClick={() => setTab(t)}>
              {TAB_LABEL[t]} <i>{counts(t)}</i>
            </button>
          ))}
        </div>
        <span className="db-spacer" />
        <input className="ep-search ej-search" placeholder="Search jobs…" value={q} onChange={(e) => setQ(e.target.value)} />
        <button className="btn sm primary" onClick={addNew}><Icon name="plus" size={14} /> New</button>
      </div>

      <div className="ej-grid">
        {rows.map((j) => {
          const cust = custById[j.snapshot.book.cust ?? '']
          const needRef = !!(j.custRef || cust?.invoicing?.poRequired || cust?.invoicing?.poPrefixes?.length)
          const ok = refOk(j.custRef, cust)
          return (
            <div key={j.id} className="jcard" onClick={() => openJob(j)}>
              <div className="jcard-top">
                <button className="cell-link jcard-cust" onClick={(e) => openPop(e, contactNode(j))} title="Contact details">
                  {displayName(j)}
                </button>
                {j.progress && <StatusPill status={j.progress} />}
              </div>
              <div className="jcard-times">
                <span className="jcard-leg"><i>COL</i> {j.collectAt || '—'}{j.collectEta && <em> · ETA {j.collectEta}</em>}</span>
                <span className="jcard-leg"><i>DEL</i> {j.deliverAt || '—'}{j.deliverEta && <em> · ETA {j.deliverEta}</em>}</span>
              </div>
              <div className="jcard-foot">
                <span className="jcard-route">{route(j)} · {j.vehicle || '—'}</span>
                <span className="db-spacer" />
                {needRef && <span className={ok ? 'ref-ok' : 'ref-bad'} title={j.custRef || 'No PO'}>{ok ? '✓' : '✕'}</span>}
                {j.supplierName
                  ? <button className="cell-link jcard-sup" onClick={(e) => openPop(e, supplierNode(j))} title="Driver details">🚚 {j.supplierName}</button>
                  : <span className="muted jcard-sup">Unassigned</span>}
              </div>
            </div>
          )
        })}
        {!rows.length && <div className="ep-empty">No {TAB_LABEL[tab].toLowerCase()}.</div>}
      </div>

      {pop && (
        <>
          <div className="cc-pop-scrim" onClick={() => setPop(null)} />
          <div className="cell-pop" style={{ left: pop.x, top: pop.y }}>{pop.node}</div>
        </>
      )}
    </div>
  )
}
