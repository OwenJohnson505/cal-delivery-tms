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
import type { JobStatus } from '@/types/index.ts'

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
  const users = useUsersStore((s) => s.users)
  const currentUserId = useUsersStore((s) => s.currentUserId)
  const setCurrentUser = useUsersStore((s) => s.setCurrentUser)
  const departments = useOrgStore((s) => s.departments)
  const teams = useOrgStore((s) => s.teams)
  const customers = useCustomersStore((s) => s.customers)

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
          <div className="ac" style={{ maxWidth: 280 }}>
            <input
              type="text"
              placeholder="Search ref, customer, route or vehicle…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          <select className="db-filter sm" value={filterKey} onChange={(e) => setFilterKey(e.target.value)} title="View by department / team">
            <option value="all">All bookings</option>
            {departments.map((dep) => (
              <optgroup key={dep.id} label={dep.name}>
                <option value={`dep:${dep.id}`}>{dep.name} — whole department</option>
                {teams.filter((t) => t.departmentId === dep.id).map((t) => (
                  <option key={t.id} value={`team:${t.id}`}>{t.name}</option>
                ))}
              </optgroup>
            ))}
          </select>
          <span className="list-count">{rows.length}</span>
          <span className="db-spacer" />
          <select className="db-asuser sm" value={currentUserId} onChange={(e) => setCurrentUser(e.target.value)} title="Viewing as (sets the default view)">
            {users.map((u) => <option key={u.id} value={u.id}>as {u.name}</option>)}
          </select>
        </div>

        <div className="list-tablewrap">
          <table className="list-table jobs-table">
            <thead>
              <tr>
                <th>Ref</th>
                <th>Customer</th>
                <th>Progress</th>
                <th>Status</th>
                <th>Route</th>
                <th>Vehicle</th>
                <th>Collection</th>
                <th>Delivery</th>
                <th className="num">Revenue</th>
                <th className="num">Cost</th>
                <th className="num">Margin</th>
                <th>{actionLabel(tab)}</th>
                <th>Driver</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((j) => (
                <tr key={j.id} onDoubleClick={() => open(j)}>
                  <td><b>{j.ref}</b></td>
                  <td>{j.customer}</td>
                  <td>{j.progress ? <StatusPill status={j.progress} /> : <span className="muted">—</span>}</td>
                  <td><StatusPill status={j.status} /></td>
                  <td>{j.route}</td>
                  <td>{j.vehicle || '—'}</td>
                  <td className="nowrap">{j.collectAt}</td>
                  <td className="nowrap">{j.deliverAt}</td>
                  <td className="num">£{j.revenue.toFixed(0)}</td>
                  <td className="num">£{j.cost.toFixed(0)}</td>
                  <td className="num"><b style={{ color: 'var(--ok)' }}>£{(j.revenue - j.cost).toFixed(0)}</b></td>
                  <td className="nowrap">
                    {j.actorName}
                    <div className="cell-sub">{j.createdAt}</div>
                  </td>
                  <td className="nowrap">
                    {j.driverName ? <>{j.driverName}<div className="cell-sub">{j.driverId}</div></> : <span className="muted">Unassigned</span>}
                  </td>
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
