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
import { useCustomersStore } from '@/store/customersStore.ts'
import { useViewsStore, COLUMNS, type ColumnKey } from '@/store/viewsStore.ts'
import { ColumnsMenu } from './ColumnsMenu.tsx'
import type { JobStatus } from '@/types/index.ts'

const COL_LABEL = Object.fromEntries(COLUMNS.map((c) => [c.key, c.label])) as Record<ColumnKey, string>
const NUM_COLS = new Set<ColumnKey>(['revenue', 'cost', 'margin'])
const NOWRAP_COLS = new Set<ColumnKey>(['collection', 'delivery', 'actor', 'driver'])

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

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase()
    return scoped
      .filter((j) => TAB_STATUSES[tab].includes(j.status))
      .filter((j) => !q || `${j.ref} ${j.customer} ${j.route} ${j.vehicle}`.toLowerCase().includes(q))
  }, [scoped, tab, query])

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
    switch (key) {
      case 'ref': return <b>{j.ref}</b>
      case 'customer': return j.customer
      case 'progress': return j.progress ? <StatusPill status={j.progress} /> : <span className="muted">—</span>
      case 'status': return <StatusPill status={j.status} />
      case 'route': return j.route
      case 'vehicle': return j.vehicle || '—'
      case 'collection': return j.collectAt
      case 'delivery': return j.deliverAt
      case 'revenue': return `£${j.revenue.toFixed(0)}`
      case 'cost': return `£${j.cost.toFixed(0)}`
      case 'margin': return <b style={{ color: 'var(--ok)' }}>£{(j.revenue - j.cost).toFixed(0)}</b>
      case 'actor': return <>{j.actorName}<div className="cell-sub">{j.createdAt}</div></>
      case 'driver': return j.driverName ? <>{j.driverName}<div className="cell-sub">{j.driverId}</div></> : <span className="muted">Unassigned</span>
      default: return null
    }
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
                    <button className="btn sm" onClick={() => open(j)} title="Open">
                      <Icon name="edit" size={14} /> Open
                    </button>
                    <button
                      className="btn sm iconbtn danger"
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
                  <td className="empty" colSpan={visibleCols.length + 1}>
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
