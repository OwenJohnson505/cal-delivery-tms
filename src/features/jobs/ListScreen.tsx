/**
 * ListScreen — the Bookings / Quotes / Drafts tables. Tabbed, searchable, with row
 * actions (open in the wizard, delete) and an "Add new booking" button that opens a
 * fresh wizard. Basic data-table version; filtering is by tab + search for now.
 */
import { useEffect, useMemo, useState } from 'react'
import { Icon } from '@/app/Icon.tsx'
import { StatusPill } from '@/app/StatusPill.tsx'
import { useJobsStore, type SavedJob } from '@/store/jobsStore.ts'
import { useViewStore, type ListTab } from '@/store/viewStore.ts'
import { useBookingStore } from '@/store/bookingStore.ts'
import { useUsersStore } from '@/store/usersStore.ts'
import { useOrgStore, userScope } from '@/store/orgStore.ts'
import { useCustomersStore, type Customer } from '@/store/customersStore.ts'
import { useViewsStore, COLUMNS, type ColumnKey } from '@/store/viewsStore.ts'
import { ColumnsMenu } from './ColumnsMenu.tsx'
import { outcode } from '@/lib/index.ts'
import type { JobStatus, Stop } from '@/types/index.ts'
import type { ReactNode } from 'react'

const COL_LABEL = Object.fromEntries(COLUMNS.map((c) => [c.key, c.label])) as Record<ColumnKey, string>
const NUM_COLS = new Set<ColumnKey>(['revenue', 'cost', 'margin'])
const NOWRAP_COLS = new Set<ColumnKey>(['collection', 'delivery', 'collectionEta', 'deliveryEta', 'actor', 'supplier'])

/** Small ASAP / AT / BY tag next to a time ('between' shows nothing — implied by a range). */
function TimeTag({ mode }: { mode: string }) {
  if (mode === 'between') return null
  const label = mode === 'asap' ? 'ASAP' : mode === 'by' ? 'BY' : mode === 'at' ? 'AT' : ''
  if (!label) return null
  return <span className={'tt tt-' + mode}>{label}</span>
}

/** Is the customer ref accepted? fixed PO must match; else an accepted prefix; else any
 * ref if one is required; else fine. */
function refOk(custRef: string, cust?: Customer): boolean {
  const inv = cust?.invoicing
  if (!inv) return true
  const ref = (custRef || '').trim()
  if (inv.fixedPo?.trim()) return ref.toUpperCase() === inv.fixedPo.trim().toUpperCase()
  if (inv.poPrefixes?.length) return !!ref && inv.poPrefixes.some((p) => ref.toUpperCase().startsWith(p.toUpperCase()))
  if (inv.poRequired) return !!ref
  return true
}

const TAB_STATUSES: Record<ListTab, JobStatus[]> = {
  bookings: ['Booking'],
  quotes: ['Quote', 'Quick Quote'],
  drafts: ['Draft'],
}
const TAB_LABEL: Record<ListTab, string> = { bookings: 'Bookings', quotes: 'Quotes', drafts: 'Drafts' }
/** Column header for "who actioned it", which depends on the job's stage. */
function actionLabel(tab: ListTab): string {
  return tab === 'bookings' ? 'Booked by' : tab === 'quotes' ? 'Quoted by' : 'Drafted by'
}

export function ListScreen() {
  const jobs = useJobsStore((s) => s.jobs)
  const deleteJob = useJobsStore((s) => s.deleteJob)
  const tab = useViewStore((s) => s.listTab)
  const setListTab = useViewStore((s) => s.setListTab)
  const openWizard = useViewStore((s) => s.openWizard)
  const newBooking = useBookingStore((s) => s.newBooking)
  const loadSnapshot = useBookingStore((s) => s.loadSnapshot)

  // Team/department view — defaults to the signed-in user's team (team-level) or
  // department (department-level); "all" otherwise. Switchable via "Viewing as".
  const currentUserId = useUsersStore((s) => s.currentUserId)
  const departments = useOrgStore((s) => s.departments)
  const teams = useOrgStore((s) => s.teams)
  const customers = useCustomersStore((s) => s.customers)
  const columnCfg = useViewsStore((s) => s.columns)
  const visibleCols = useMemo(() => columnCfg.filter((c) => c.visible).map((c) => c.key), [columnCfg])

  const [query, setQuery] = useState('')
  const [notesJob, setNotesJob] = useState<SavedJob | null>(null)
  // Click-to-open detail popover (address contact/ref, or supplier contact).
  const [pop, setPop] = useState<{ x: number; y: number; node: ReactNode } | null>(null)
  const openPop = (e: React.MouseEvent, node: ReactNode) => {
    e.stopPropagation()
    const r = (e.currentTarget as HTMLElement).getBoundingClientRect()
    setPop({ x: Math.min(r.left, window.innerWidth - 280), y: r.bottom + 6, node })
  }

  const custById = useMemo(() => Object.fromEntries(customers.map((c) => [c.id, c])), [customers])
  const scope = useMemo(() => userScope(currentUserId, departments, teams), [currentUserId, departments, teams])
  const defaultKey = scope.level === 'team' ? `team:${scope.teamId}` : scope.level === 'department' ? `dep:${scope.departmentId}` : 'all'
  const [filterKey, setFilterKey] = useState(defaultKey)
  // Re-apply the default whenever the signed-in user (and so their scope) changes.
  useEffect(() => { setFilterKey(defaultKey) }, [defaultKey])

  const matchesScope = (j: SavedJob) => {
    if (filterKey === 'all') return true
    const c = custById[j.snapshot.book.cust ?? '']
    if (!c) return false
    if (filterKey.startsWith('team:')) return c.teamId === filterKey.slice(5)
    if (filterKey.startsWith('dep:')) return c.departmentId === filterKey.slice(4)
    return true
  }

  const scoped = useMemo(() => jobs.filter(matchesScope), [jobs, filterKey, custById]) // eslint-disable-line react-hooks/exhaustive-deps

  const counts = useMemo(() => {
    const c: Record<ListTab, number> = { bookings: 0, quotes: 0, drafts: 0 }
    scoped.forEach((j) => {
      ;(Object.keys(TAB_STATUSES) as ListTab[]).forEach((t) => {
        if (TAB_STATUSES[t].includes(j.status)) c[t]++
      })
    })
    return c
  }, [scoped])

  // Search looks inside the job, not just the visible table: ref, names, route,
  // vehicle, supplier, status, custom ref, every stop's address/ref/contact, and notes.
  const haystack = (j: SavedJob) => {
    const cust = custById[j.snapshot.book.cust ?? '']
    const parts: string[] = [
      j.ref, j.customer, cust?.displayName ?? '', ...(cust?.altNames ?? []),
      j.route, j.vehicle, j.supplierName, j.progress, j.status, j.custRef,
      j.snapshot.jobNotes ?? '',
    ]
    j.snapshot.stops.forEach((s) => {
      parts.push(s.addr.co, s.addr.pc, s.addr.address, s.addr.city, s.reference,
        s.contact?.name ?? '', s.contact?.email ?? '', s.contact?.tel ?? '')
    })
    return parts.filter(Boolean).join(' ').toLowerCase()
  }

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase()
    return scoped
      .filter((j) => TAB_STATUSES[tab].includes(j.status))
      .filter((j) => !q || haystack(j).includes(q))
  }, [scoped, tab, query]) // eslint-disable-line react-hooks/exhaustive-deps

  function addNew() {
    newBooking()
    openWizard(null)
  }
  function open(job: SavedJob) {
    loadSnapshot(job.snapshot)
    openWizard(job.id)
  }

  const headerFor = (key: ColumnKey) => (key === 'actor' ? actionLabel(tab) : COL_LABEL[key])
  function cell(key: ColumnKey, j: SavedJob) {
    const cust = custById[j.snapshot.book.cust ?? '']
    const dash = <span className="muted">—</span>
    switch (key) {
      case 'customer': return cust?.displayName || j.customer
      case 'status': return j.progress ? <StatusPill status={j.progress} /> : dash
      case 'collection': return j.collectAt ? <span className="dt-cell"><span>{j.collectAt}</span><TimeTag mode={j.collectMode} /></span> : dash
      case 'delivery': return j.deliverAt ? <span className="dt-cell"><span>{j.deliverAt}</span><TimeTag mode={j.deliverMode} /></span> : dash
      case 'collectionEta': return j.collectEta || dash
      case 'deliveryEta': return j.deliverEta || dash
      case 'refAccepted':
        if (!j.custRef && !(cust?.invoicing?.poRequired || cust?.invoicing?.poPrefixes?.length)) return dash
        return refOk(j.custRef, cust)
          ? <span className="ref-ok" title={j.custRef ? `Accepted: ${j.custRef}` : 'Accepted'}>✓</span>
          : <span className="ref-bad" title={j.custRef ? `Not accepted: ${j.custRef}` : 'Missing PO'}>✕</span>
      case 'route': {
        const pts = j.snapshot.stops.filter((s) => s.addr.pc)
        if (!pts.length) return dash
        return (
          <span className="route-cell">
            {pts.map((s, idx) => (
              <span key={s.id}>
                {idx > 0 && <span className="route-arrow">→</span>}
                <button className="route-pt" onClick={(e) => openPop(e, addressNode(s))}>{outcode(s.addr.pc)}</button>
              </span>
            ))}
          </span>
        )
      }
      case 'vehicle': return j.vehicle || '—'
      case 'supplier':
        return j.supplierName
          ? <button className="cell-link" onClick={(e) => openPop(e, supplierNode(j))}>{j.supplierName}</button>
          : <span className="muted">Unassigned</span>
      case 'revenue': return `£${j.revenue.toFixed(0)}`
      case 'cost': return `£${j.cost.toFixed(0)}`
      case 'margin': return <b style={{ color: 'var(--ok)' }}>£{(j.revenue - j.cost).toFixed(0)}</b>
      case 'actor': return <>{j.actorName}<div className="cell-sub">{j.createdAt}</div></>
      case 'notes': {
        const has = !!j.snapshot.jobNotes?.trim()
        return (
          <button className={'notes-btn' + (has ? ' has' : '')} onClick={(e) => { e.stopPropagation(); setNotesJob(j) }} title={has ? 'View notes' : 'No notes'}>
            <Icon name="note" size={13} /> Notes{has && <span className="notes-dot" />}
          </button>
        )
      }
      default: return null
    }
  }

  // popover content builders
  const addressNode = (s: Stop) => (
    <div className="cp-card">
      <div className="cp-h">{s.type} · {s.addr.co || s.addr.pc}</div>
      <div className="cp-row"><span className="cp-k">Postcode</span><span>{s.addr.pc || '—'}</span></div>
      <div className="cp-row"><span className="cp-k">Reference</span><span>{s.reference || '—'}</span></div>
      <div className="cp-row"><span className="cp-k">Contact</span><span>{s.contact?.name || '—'}</span></div>
      {s.contact?.tel && <a className="cp-link" href={`tel:${s.contact.tel}`}><Icon name="phone" size={13} /> {s.contact.tel}</a>}
      {s.contact?.email && <a className="cp-link" href={`mailto:${s.contact.email}`}><Icon name="mail" size={13} /> {s.contact.email}</a>}
    </div>
  )
  const supplierNode = (j: SavedJob) => (
    <div className="cp-card">
      <div className="cp-h">{j.supplierName}</div>
      {j.supplierPhone
        ? <a className="cp-link" href={`tel:${j.supplierPhone}`}><Icon name="phone" size={13} /> {j.supplierPhone}</a>
        : <div className="cp-row"><span className="cp-k">Phone</span><span>—</span></div>}
      {j.supplierEmail
        ? <a className="cp-link" href={`mailto:${j.supplierEmail}`}><Icon name="mail" size={13} /> {j.supplierEmail}</a>
        : <div className="cp-row"><span className="cp-k">Email</span><span>—</span></div>}
    </div>
  )

  // Per-row quick-actions menu (kebab). Just Delete for now.
  const openRowMenu = (e: React.MouseEvent, j: SavedJob) => {
    e.stopPropagation()
    const r = (e.currentTarget as HTMLElement).getBoundingClientRect()
    const node = (
      <div className="rowmenu">
        <button className="rowmenu-item danger" onClick={() => { setPop(null); if (confirm(`Delete ${j.ref}?`)) deleteJob(j.id) }}>
          <Icon name="trash" size={14} /> Delete
        </button>
      </div>
    )
    setPop({ x: Math.max(8, r.right - 150), y: r.bottom + 4, node })
  }

  return (
    <div className="list-app">
      <div className="list-work wide">
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
          <div className="tb-search">
            <Icon name="search" size={15} />
            <input
              type="text"
              placeholder="Search ref, customer, route or vehicle…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          <label className="tb-field">
            <span>Team / dept</span>
            <select className="tb-select" value={filterKey} onChange={(e) => setFilterKey(e.target.value)}>
              <option value="all">All bookings</option>
              {departments.map((dep) => (
                <optgroup key={dep.id} label={dep.name}>
                  <option value={`dep:${dep.id}`}>All of {dep.name}</option>
                  {teams.filter((t) => t.departmentId === dep.id).map((t) => (
                    <option key={t.id} value={`team:${t.id}`}>{t.name}</option>
                  ))}
                </optgroup>
              ))}
            </select>
          </label>
          <span className="list-count">{rows.length} {rows.length === 1 ? 'item' : 'items'}</span>
          <span className="db-spacer" />
          <ColumnsMenu />
        </div>

        <div className="list-tablewrap">
          <table className="list-table jobs-table">
            <thead>
              <tr>
                {visibleCols.map((key) => (
                  <th key={key} className={NUM_COLS.has(key) ? 'num' : ''}>{headerFor(key)}</th>
                ))}
                <th></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((j) => (
                <tr key={j.id} onDoubleClick={() => open(j)}>
                  {visibleCols.map((key) => (
                    <td key={key} className={(NUM_COLS.has(key) ? 'num ' : '') + (NOWRAP_COLS.has(key) ? 'nowrap' : '')}>
                      {cell(key, j)}
                    </td>
                  ))}
                  <td className="list-actions">
                    <button className="kebab" title="Quick actions" onClick={(e) => openRowMenu(e, j)}>⋯</button>
                  </td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td className="empty" colSpan={visibleCols.length + 1}>
                    No {TAB_LABEL[tab].toLowerCase()} {query ? 'match your search' : 'yet'}.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {pop && (
        <>
          <div className="cc-pop-scrim" onClick={() => setPop(null)} />
          <div className="cell-pop" style={{ left: pop.x, top: pop.y }}>{pop.node}</div>
        </>
      )}

      {notesJob && (
        <div className="modal-overlay open" onClick={(e) => e.target === e.currentTarget && setNotesJob(null)}>
          <div className="modal">
            <div className="modal-h"><b>Notes · {notesJob.ref}</b><span className="x" style={{ marginLeft: 'auto', cursor: 'pointer' }} onClick={() => setNotesJob(null)}>✕</span></div>
            <div className="modal-b">
              {notesJob.snapshot.jobNotes?.trim()
                ? <div className="notes-text">{notesJob.snapshot.jobNotes}</div>
                : <div className="hint">No notes on this job.</div>}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
