/**
 * ListScreen — the Bookings / Quotes / Drafts tables. Tabbed, searchable, with row
 * actions (open in the wizard, delete) and an "Add new booking" button that opens a
 * fresh wizard. Basic data-table version; filtering is by tab + search for now.
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import { Icon } from '@/app/Icon.tsx'
import { StatusPill } from '@/app/StatusPill.tsx'
import { useJobsStore, type SavedJob } from '@/store/jobsStore.ts'
import { useViewStore, type ListTab } from '@/store/viewStore.ts'
import { useBookingStore } from '@/store/bookingStore.ts'
import { useUsersStore } from '@/store/usersStore.ts'
import { useOrgStore, userScope } from '@/store/orgStore.ts'
import { useCustomersStore, type Customer } from '@/store/customersStore.ts'
import { useViewsStore, COLUMNS, type ColumnKey } from '@/store/viewsStore.ts'
import { useEmailsStore } from '@/store/emailsStore.ts'
import { useUiStore } from '@/store/uiStore.ts'
import { ColumnsMenu } from './ColumnsMenu.tsx'
import { PriorityQueue } from './PriorityQueue.tsx'
import { outcode } from '@/lib/index.ts'
import type { JobStatus, Stop } from '@/types/index.ts'
import type { ReactNode } from 'react'

const COL_LABEL = Object.fromEntries(COLUMNS.map((c) => [c.key, c.label])) as Record<ColumnKey, string>
const NUM_COLS = new Set<ColumnKey>(['revenue', 'cost', 'margin'])
const NOWRAP_COLS = new Set<ColumnKey>(['collection', 'delivery', 'collectionEta', 'deliveryEta', 'actor', 'supplier'])
/** Columns that hug their content (width:1%) so flexible ones absorb the slack —
 * anything whose data length barely varies (dates, times, postcodes, icons). */
const FIT_COLS = new Set<ColumnKey>(['collection', 'delivery', 'collectionEta', 'deliveryEta', 'route', 'vehicle', 'refAccepted', 'notes'])

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const fmtDate = (d: string) => { const m = /^(\d{2})-(\d{2})/.exec(d); return m ? `${+m[1]} ${MONTHS[+m[2] - 1]}` : d }
const toMin = (t: string) => { const m = /^(\d{2}):(\d{2})/.exec(t); return m ? +m[1] * 60 + +m[2] : null }

/** Compare the booked time with the ETA/actual and produce a coloured delta — the
 * "Live jobs board" treatment: green early/on-time, amber a little late, red very late. */
function deltaInfo(booked: string, eta: string, failed?: boolean): { actual: string; label: string; cls: string } {
  if (failed) return { actual: eta || '– –', label: 'failed', cls: 'd-red' }
  if (!eta) return { actual: '– –', label: booked ? `due ${booked}` : '', cls: 'd-pending' }
  const bm = toMin(booked), em = toMin(eta)
  if (bm == null || em == null) return { actual: eta, label: '', cls: 'd-pending' }
  const delta = em - bm
  if (delta <= 0) return { actual: eta, label: delta === 0 ? 'on time' : `${-delta}m early`, cls: 'd-green' }
  if (delta <= 30) return { actual: eta, label: `${delta}m late`, cls: 'd-amber' }
  return { actual: eta, label: `${delta}m late`, cls: 'd-red' }
}

/** A collection/delivery cell: date · booked → actual · coloured delta. */
function TimeCell({ at, eta, failed }: { at: string; eta: string; failed?: boolean }) {
  if (!at) return <span className="muted">—</span>
  const [date, time] = at.split(' ')
  const info = deltaInfo(time, eta, failed)
  return (
    <div className="tcell">
      <span className="tcell-date">{fmtDate(date)}</span>
      <span className="tcell-row">
        <span className="tcell-booked">{time}</span>
        <span className="tcell-arrow">→</span>
        <span className={'tcell-actual ' + info.cls}>{info.actual}</span>
      </span>
      {info.label && <span className={'tcell-delta ' + info.cls}>{info.label}</span>}
    </div>
  )
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

/** Small self-contained editor for the ETA popover (own state, saves via the store). */
function EtaEditor({ initial, label, onSave }: { initial: string; label: string; onSave: (v: string) => void }) {
  const [v, setV] = useState(initial)
  const valid = /^\d{2}:\d{2}$/.test(v)
  return (
    <div className="cp-card">
      <div className="cp-h">Change {label} ETA</div>
      <input
        className="eta-input"
        placeholder="HH:MM"
        autoFocus
        value={v}
        onChange={(e) => setV(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter' && valid) onSave(v) }}
      />
      <div className="cp-actions">
        <button className="btn sm primary" disabled={!valid} onClick={() => onSave(v)}>Save ETA</button>
      </div>
    </div>
  )
}

export function ListScreen() {
  const jobs = useJobsStore((s) => s.jobs)
  const deleteJob = useJobsStore((s) => s.deleteJob)
  const setEta = useJobsStore((s) => s.setEta)
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
  const isPriorityView = useViewsStore((s) => s.getView(s.activeViewId)?.layout === 'priority')

  const [query, setQuery] = useState('')
  const [notesJob, setNotesJob] = useState<SavedJob | null>(null)
  // Immersive (full) email → compact job cards; collapsed email (list/mini) → the table.
  const emailFull = useEmailsStore((s) => s.panelState === 'full')
  const density = useUiStore((s) => s.tableDensity)
  const setTableDensity = useUiStore((s) => s.setTableDensity)
  // Click-to-open detail popover (address contact/ref, supplier, ETA audit/edit…).
  const [pop, setPop] = useState<{ x: number; y: number; node: ReactNode } | null>(null)
  const openPop = (e: React.MouseEvent, node: ReactNode) => {
    e.stopPropagation()
    const r = (e.currentTarget as HTMLElement).getBoundingClientRect()
    setPop({ x: Math.min(r.left, window.innerWidth - 280), y: r.bottom + 6, node })
  }
  // ETA cells: single click = audit, double click = edit. Delay the single-click
  // popover briefly so a double-click goes straight to the editor.
  const etaClickTimer = useRef<number | null>(null)

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

  const searched = useMemo(() => {
    const q = query.trim().toLowerCase()
    return scoped
      .filter((j) => TAB_STATUSES[tab].includes(j.status))
      .filter((j) => !q || haystack(j).includes(q))
  }, [scoped, tab, query]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── per-column sorting & filtering ──────────────────────────────────────────
  // Each column declares its sortable fields and filterable facets. Merged columns
  // (Customer/Status; date+time) expose ONE facet per underlying field, so a stacked
  // column can still be sorted/filtered by either field. All from the header menu.
  type SortField = { id: string; label: string; get: (j: SavedJob) => string | number }
  type Facet = { id: string; label: string; get: (j: SavedJob) => string }

  const displayNameOf = (j: SavedJob) => custById[j.snapshot.book.cust ?? '']?.displayName || j.customer
  // 'DD-MM-YY HH:MM' → 'YY-MM-DD HH:MM' so string compare is chronological; empties last.
  const dtKey = (s: string) => (s ? `${s.slice(6, 8)}-${s.slice(3, 5)}-${s.slice(0, 2)} ${s.slice(9)}` : '￿')
  const last = (s: string) => s || '￿'
  const refState = (j: SavedJob) => {
    const cust = custById[j.snapshot.book.cust ?? '']
    if (!j.custRef && !(cust?.invoicing?.poRequired || cust?.invoicing?.poPrefixes?.length)) return '—'
    return refOk(j.custRef, cust) ? 'Accepted' : 'Not accepted'
  }

  const colMeta: Partial<Record<ColumnKey, { sorts: SortField[]; facets: Facet[] }>> = {
    customer: {
      sorts: [
        { id: 'cust', label: 'Customer', get: displayNameOf },
        { id: 'status', label: 'Status', get: (j) => last(j.progress) },
      ],
      facets: [
        { id: 'cust', label: 'Customer', get: displayNameOf },
        { id: 'status', label: 'Status', get: (j) => j.progress || '—' },
      ],
    },
    collection: {
      sorts: [{ id: 'coll', label: 'Date & time', get: (j) => dtKey(j.collectAt) }],
      facets: [{ id: 'collDate', label: 'Date', get: (j) => (j.collectAt ? j.collectAt.split(' ')[0] : '—') }],
    },
    delivery: {
      sorts: [{ id: 'del', label: 'Date & time', get: (j) => dtKey(j.deliverAt) }],
      facets: [{ id: 'delDate', label: 'Date', get: (j) => (j.deliverAt ? j.deliverAt.split(' ')[0] : '—') }],
    },
    collectionEta: { sorts: [{ id: 'collEta', label: 'ETA', get: (j) => last(j.collectEta) }], facets: [] },
    deliveryEta: { sorts: [{ id: 'delEta', label: 'ETA', get: (j) => last(j.deliverEta) }], facets: [] },
    route: {
      sorts: [{ id: 'route', label: 'Route', get: (j) => last(j.route) }],
      facets: [{ id: 'route', label: 'Route', get: (j) => j.route || '—' }],
    },
    vehicle: {
      sorts: [{ id: 'vehicle', label: 'Vehicle', get: (j) => last(j.vehicle) }],
      facets: [{ id: 'vehicle', label: 'Vehicle', get: (j) => j.vehicle || '—' }],
    },
    supplier: {
      sorts: [{ id: 'supplier', label: 'Supplier', get: (j) => last(j.supplierName) }],
      facets: [{ id: 'supplier', label: 'Supplier', get: (j) => j.supplierName || 'Unassigned' }],
    },
    refAccepted: {
      sorts: [{ id: 'refok', label: 'Ref state', get: refState }],
      facets: [{ id: 'refok', label: 'Ref state', get: refState }],
    },
    revenue: { sorts: [{ id: 'revenue', label: 'Revenue', get: (j) => j.revenue }], facets: [] },
    cost: { sorts: [{ id: 'cost', label: 'Cost', get: (j) => j.cost }], facets: [] },
    margin: { sorts: [{ id: 'margin', label: 'Margin', get: (j) => j.revenue - j.cost }], facets: [] },
    actor: {
      sorts: [{ id: 'actor', label: actionLabel(tab), get: (j) => last(j.actorName) }],
      facets: [{ id: 'actor', label: actionLabel(tab), get: (j) => j.actorName || '—' }],
    },
    notes: {
      sorts: [{ id: 'notes', label: 'Notes', get: (j) => (j.snapshot.jobNotes?.trim() ? 0 : 1) }],
      facets: [{ id: 'notes', label: 'Notes', get: (j) => (j.snapshot.jobNotes?.trim() ? 'Has notes' : 'No notes') }],
    },
  }
  const facetById = useMemo(() => {
    const m: Record<string, Facet> = {}
    Object.values(colMeta).forEach((c) => c?.facets.forEach((f) => { m[f.id] = f }))
    return m
  }, [colMeta]) // eslint-disable-line react-hooks/exhaustive-deps

  // Temporary (in-memory) — like other one-off tweaks, reset on reload.
  const [sort, setSort] = useState<{ col: ColumnKey; sortId: string; dir: 'asc' | 'desc' } | null>(null)
  const [colFilters, setColFilters] = useState<Record<string, string[]>>({})
  const [headerMenu, setHeaderMenu] = useState<{ key: ColumnKey; x: number; y: number } | null>(null)

  const toggleFacetValue = (facetId: string, val: string) =>
    setColFilters((p) => {
      const cur = new Set(p[facetId] ?? [])
      if (cur.has(val)) cur.delete(val)
      else cur.add(val)
      const next = { ...p, [facetId]: [...cur] }
      if (!cur.size) delete next[facetId]
      return next
    })

  const rows = useMemo(() => {
    let out = searched.filter((j) =>
      Object.entries(colFilters).every(([fid, vals]) => !vals.length || !facetById[fid] || vals.includes(facetById[fid].get(j))),
    )
    if (sort) {
      const def = colMeta[sort.col]?.sorts.find((s) => s.id === sort.sortId)
      if (def) {
        out = [...out].sort((a, b) => {
          const av = def.get(a)
          const bv = def.get(b)
          const c = typeof av === 'number' && typeof bv === 'number' ? av - bv : String(av).localeCompare(String(bv))
          return sort.dir === 'asc' ? c : -c
        })
      }
    }
    return out
  }, [searched, colFilters, sort, facetById]) // eslint-disable-line react-hooks/exhaustive-deps

  const colIsFiltered = (key: ColumnKey) => (colMeta[key]?.facets ?? []).some((f) => colFilters[f.id]?.length)
  const anyColFilter = Object.keys(colFilters).length > 0

  // ── per-customer custom-field columns ───────────────────────────────────────
  // Available ONLY while the list is filtered to ONE customer (otherwise the column
  // catalogue would explode across every customer's fields). Ephemeral: cleared when
  // the single-customer filter changes/clears, and never saved into a view.
  const singleCustomerName = colFilters['cust']?.length === 1 ? colFilters['cust'][0] : null
  const singleCustomer = useMemo(
    () => (singleCustomerName ? customers.find((c) => (c.displayName || c.companyName) === singleCustomerName) : undefined),
    [singleCustomerName, customers],
  )
  const cfColumns = useMemo(
    () => (singleCustomer?.customFields ?? []).map((f) => ({ key: `cf:${f.scope}:${f.id}`, label: `${f.label}${f.scope === 'stop' ? ' (stop)' : ''}` })),
    [singleCustomer],
  )
  const cfLabel = useMemo(() => Object.fromEntries(cfColumns.map((c) => [c.key, c.label])), [cfColumns])
  const [activeCf, setActiveCf] = useState<string[]>([])
  // reset the chosen custom columns whenever the filtered customer changes/clears
  useEffect(() => { setActiveCf([]) }, [singleCustomer?.id])
  const validActiveCf = activeCf.filter((k) => cfColumns.some((c) => c.key === k))
  const toggleCf = (key: string) => setActiveCf((p) => (p.includes(key) ? p.filter((x) => x !== key) : [...p, key]))
  // standard visible columns + any active custom-field columns (appended)
  const renderCols = [...visibleCols, ...validActiveCf]

  function addNew() {
    newBooking()
    openWizard(null)
  }
  function open(job: SavedJob) {
    loadSnapshot(job.snapshot)
    openWizard(job.id)
  }

  const headerFor = (key: ColumnKey) =>
    key.startsWith('cf:') ? (cfLabel[key] ?? 'Custom') : key === 'actor' ? actionLabel(tab) : COL_LABEL[key]
  // collection = first collection/both stop; delivery = last delivery/both stop
  const firstColl = (j: SavedJob) => j.snapshot.stops.find((s) => s.type === 'Collection' || s.type === 'Both')
  const lastDel = (j: SavedJob) => [...j.snapshot.stops].reverse().find((s) => s.type === 'Delivery' || s.type === 'Both')
  const txt = (v?: string | null) => (v && String(v).trim() ? <>{v}</> : <span className="muted">—</span>)

  /** Value for a per-customer custom-field column key: cf:job:<id> or cf:stop:<id>. */
  const cfCell = (j: SavedJob, key: string) => {
    const [, scope, id] = key.split(':')
    if (scope === 'job') return txt(j.snapshot.customJob?.[id])
    const vals = j.snapshot.stops.map((s) => s.custom?.[id]).filter(Boolean)
    return txt(vals.length ? [...new Set(vals)].join(', ') : '')
  }

  /** Plain (non-interactive) data-point columns. */
  const simpleCell = (key: ColumnKey, j: SavedJob, cust?: Customer): ReactNode => {
    const c = firstColl(j)
    const d = lastDel(j)
    switch (key) {
      case 'progress': return j.progress ? <StatusPill status={j.progress} /> : txt('')
      case 'ourRef': return txt(j.ref)
      case 'custRef': return txt(j.custRef)
      case 'accountCode': return txt(cust?.accountCode)
      case 'stopCount': return <>{j.snapshot.stops.length}</>
      case 'collCompany': return txt(c?.addr.co)
      case 'collContact': return txt(c?.contact?.name)
      case 'collPhone': return txt(c?.contact?.tel)
      case 'collRef': return txt(c?.reference)
      case 'collPostcode': return c?.addr.pc ? <span className="pc">{c.addr.pc}</span> : txt('')
      case 'collCity': return txt(c?.addr.city)
      case 'delCompany': return txt(d?.addr.co)
      case 'delContact': return txt(d?.contact?.name)
      case 'delPhone': return txt(d?.contact?.tel)
      case 'delRef': return txt(d?.reference)
      case 'delPostcode': return d?.addr.pc ? <span className="pc">{d.addr.pc}</span> : txt('')
      case 'delCity': return txt(d?.addr.city)
      case 'goods': return txt(j.snapshot.stops.map((s) => s.goods).filter(Boolean).join('; '))
      case 'bodyType': return txt(j.snapshot.ms.body.sel.join(', '))
      case 'equipment': return txt(j.snapshot.ms.equip.sel.join(', '))
      case 'serviceType': return txt(j.snapshot.ms.service.sel.join(', '))
      case 'supplierPhone': return txt(j.supplierPhone)
      case 'supplierEmail': return txt(j.supplierEmail)
      case 'created': return txt(j.createdAt)
      default: return null
    }
  }

  function cell(key: ColumnKey, j: SavedJob) {
    if (key.startsWith('cf:')) return cfCell(j, key)
    const cust = custById[j.snapshot.book.cust ?? '']
    const dash = <span className="muted">—</span>
    switch (key) {
      case 'customer':
        return (
          <button className="cell-link cust-name" onClick={(e) => openPop(e, contactNode(j))}>
            {cust?.displayName || j.customer}
          </button>
        )
      case 'collection': {
        if (!j.collectAt) return dash
        const [d, t] = j.collectAt.split(' ')
        return <div className="dt-stack"><span>{fmtDate(d)}</span><span className="dtt">{t}</span></div>
      }
      case 'delivery': {
        if (!j.deliverAt) return dash
        const [d, t] = j.deliverAt.split(' ')
        return <div className="dt-stack"><span>{fmtDate(d)}</span><span className="dtt">{t}</span></div>
      }
      case 'collectionEta': return etaCell(j, 'collect')
      case 'deliveryEta': return etaCell(j, 'deliver')
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
          <button className={'notes-icon' + (has ? ' has' : '')} onClick={(e) => { e.stopPropagation(); setNotesJob(j) }} title={has ? 'View notes' : 'No notes'}>
            <Icon name="note" size={15} />
            {has && <span className="notes-dot" />}
          </button>
        )
      }
      default: return simpleCell(key, j, cust)
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
      {(j.supplierAssignedBy || j.supplierAssignedAt) && (
        <div className="cp-audit">Assigned by {j.supplierAssignedBy || '—'} · {j.supplierAssignedAt}</div>
      )}
    </div>
  )

  // Customer contact: the contact booked on the job, falling back to the account's
  // main contact.
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

  // ETA audit popover: source (CX feed or staff member), when, and the prior ETA.
  const etaAuditNode = (j: SavedJob, which: 'collect' | 'deliver') => {
    const eta = which === 'collect' ? j.collectEta : j.deliverEta
    const info = which === 'collect' ? j.collectEtaInfo : j.deliverEtaInfo
    return (
      <div className="cp-card">
        <div className="cp-h">{which === 'collect' ? 'Collection' : 'Delivery'} ETA · {eta || '—'}</div>
        {info ? (
          <>
            <div className="cp-row"><span className="cp-k">Source</span><span>{info.source}</span></div>
            {info.source === 'Staff' && <div className="cp-row"><span className="cp-k">Set by</span><span>{info.by || '—'}</span></div>}
            <div className="cp-row"><span className="cp-k">When</span><span>{info.at}</span></div>
            {info.previous && <div className="cp-row"><span className="cp-k">Previous ETA</span><span>{info.previous}</span></div>}
          </>
        ) : (
          <div className="cp-row"><span className="cp-k">Source</span><span>No ETA recorded yet</span></div>
        )}
        <div className="cp-audit">Double-click the cell to change the ETA.</div>
      </div>
    )
  }

  /** ETA cell interactions, shared by the expanded ETA column and the compact time cells:
   * single click = ETA audit popover (debounced), double-click = inline ETA editor — so a
   * missing ETA can be added straight from the list without opening the job. */
  const etaProps = (j: SavedJob, which: 'collect' | 'deliver') => ({
    title: 'Click: ETA audit · double-click: change ETA',
    onClick: (e: React.MouseEvent) => {
      e.stopPropagation()
      const r = (e.currentTarget as HTMLElement).getBoundingClientRect()
      if (etaClickTimer.current) window.clearTimeout(etaClickTimer.current)
      etaClickTimer.current = window.setTimeout(() => {
        setPop({ x: Math.min(r.left, window.innerWidth - 280), y: r.bottom + 6, node: etaAuditNode(j, which) })
      }, 220)
    },
    onDoubleClick: (e: React.MouseEvent) => {
      e.stopPropagation()
      if (etaClickTimer.current) window.clearTimeout(etaClickTimer.current)
      const r = (e.currentTarget as HTMLElement).getBoundingClientRect()
      setPop({
        x: Math.min(r.left, window.innerWidth - 280), y: r.bottom + 6,
        node: (
          <EtaEditor
            initial={which === 'collect' ? j.collectEta : j.deliverEta}
            label={which === 'collect' ? 'collection' : 'delivery'}
            onSave={(v) => { setEta(j.id, which, v); setPop(null) }}
          />
        ),
      })
    },
  })

  const etaCell = (j: SavedJob, which: 'collect' | 'deliver') => {
    const eta = which === 'collect' ? j.collectEta : j.deliverEta
    const booked = ((which === 'collect' ? j.collectAt : j.deliverAt).split(' ')[1]) || ''
    const failed = which === 'deliver' && j.progress === 'Failed'
    const info = eta ? deltaInfo(booked, eta) : null
    return (
      <button className="cell-link eta-cell" {...etaProps(j, which)}>
        <span className={'eta-val' + (info ? ' ' + info.cls : '')}>{failed ? 'failed' : (eta || '—')}</span>
        {info && info.label && <span className={'eta-delta ' + info.cls}>{info.label}</span>}
      </button>
    )
  }

  /** Compact (dense) row: Customer (name/ref/status stacked) · COL · DEL · Vehicle+Driver.
   * Each cell is a real <td> (no flex on the td → columns stay aligned). The COL/DEL
   * headers carry the labels, so the cells are just postcode + a (double-clickable) time. */
  const compactStop = (j: SavedJob, which: 'collect' | 'deliver') => {
    const s = which === 'collect' ? firstColl(j) : lastDel(j)
    const at = which === 'collect' ? j.collectAt : j.deliverAt
    const eta = which === 'collect' ? j.collectEta : j.deliverEta
    const failed = which === 'deliver' && j.progress === 'Failed'
    return (
      <td className="cmp cmp-stop">
        {s && s.addr.pc ? <button className="route-pt pc" onClick={(e) => openPop(e, addressNode(s))}>{s.addr.pc}</button> : <span className="pc muted">—</span>}
        <button className="cmp-time" {...etaProps(j, which)}><TimeCell at={at} eta={eta} failed={failed} /></button>
      </td>
    )
  }
  const compactCells = (j: SavedJob) => {
    const cust = custById[j.snapshot.book.cust ?? '']
    return (
      <>
        <td className="cmp cmp-cust">
          <button className="cell-link cmp-co" onClick={(e) => openPop(e, contactNode(j))}>{cust?.displayName || j.customer}</button>
          <div className="cmp-ref">{j.ref}</div>
          {j.progress && <div className="cmp-status"><StatusPill status={j.progress} /></div>}
        </td>
        {compactStop(j, 'collect')}
        {compactStop(j, 'deliver')}
        <td className="cmp cmp-vd">
          <div className="cmp-veh">{j.vehicle || '—'}</div>
          {j.supplierName
            ? <button className="cell-link cmp-sup" onClick={(e) => openPop(e, supplierNode(j))}>{j.supplierName}</button>
            : <span className="muted cmp-sup">Unassigned</span>}
        </td>
      </>
    )
  }

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

  // One table for everything (Compact or Expanded). Beside an open email it sits in the
  // job column; the compact table is dense enough to fit there without cards.
  return (
    <div className={'list-app' + (emailFull ? ' email-jobs-app board-table' : '')}>
      <div className="list-work wide bookings-main">
        {/* row 1: tabs + add (no page title — the active tab says where you are) */}
        <div className="bk-tabsrow">
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
          <span className="db-spacer" />
          <button className="btn primary" onClick={addNew}>
            <Icon name="plus" size={15} /> Add new booking
          </button>
        </div>

        {/* row 2: search + data filters */}
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
          {anyColFilter && (
            <button className="cm-link" onClick={() => setColFilters({})}>Clear filters</button>
          )}
        </div>

        {/* row 3: view configuration — the saved-view switcher is always visible; the
            density toggle + column picker only apply to the table layouts. */}
        <div className="list-toolbar bk-viewrow">
          <ColumnsMenu
            showColumns={!isPriorityView && density === 'expanded'}
            extraTitle={singleCustomer ? `Custom fields · ${singleCustomer.displayName || singleCustomer.companyName}` : undefined}
            extraColumns={cfColumns}
            activeExtra={validActiveCf}
            onToggleExtra={toggleCf}
            extraHint="Filter the Customer column to a single customer to add their custom fields as columns."
          />
          {!isPriorityView && (
            <div className="viewtoggle" role="group" aria-label="Table density">
              <button className={'vt-btn vt-wide' + (density === 'compact' ? ' on' : '')} onClick={() => setTableDensity('compact')} title="Compact — related data grouped into a few columns">Compact</button>
              <button className={'vt-btn vt-wide' + (density === 'expanded' ? ' on' : '')} onClick={() => setTableDensity('expanded')} title="Expanded — every data point in its own column">Expanded</button>
            </div>
          )}
        </div>

        {isPriorityView ? (
          // Admin oversight: the priority queue spans every active booking, not just the
          // signed-in user's team scope.
          <PriorityQueue jobs={jobs.filter((j) => j.status === 'Booking')} />
        ) : (
        <div className="list-tablewrap">
          <table className={'list-table jobs-table' + (density === 'compact' ? ' compact' : '')}>
            <thead>
              <tr>
                {density === 'compact' ? (
                  <>
                    <th>Customer</th>
                    <th>COL</th>
                    <th>DEL</th>
                    <th>Vehicle / Driver</th>
                  </>
                ) : renderCols.map((key) => (
                  <th
                    key={key}
                    className={(NUM_COLS.has(key) ? 'num ' : '') + (FIT_COLS.has(key) ? 'fit ' : '') + (key.startsWith('cf:') ? 'cf-col ' : 'th-sortable')}
                    onClick={(e) => {
                      if (key.startsWith('cf:')) return
                      const r = (e.currentTarget as HTMLElement).getBoundingClientRect()
                      setHeaderMenu({ key, x: Math.min(r.left, window.innerWidth - 260), y: r.bottom + 4 })
                    }}
                  >
                    <span className="th-lab">
                      {headerFor(key)}
                      {sort?.col === key && <span className="th-arrow">{sort.dir === 'asc' ? '▲' : '▼'}</span>}
                      {colIsFiltered(key) && <span className="th-dot" title="Filtered" />}
                    </span>
                  </th>
                ))}
                <th></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((j) => (
                <tr key={j.id} onDoubleClick={() => open(j)}>
                  {density === 'compact' ? compactCells(j) : renderCols.map((key) => (
                    <td key={key} className={(NUM_COLS.has(key) ? 'num ' : '') + (FIT_COLS.has(key) ? 'fit ' : '') + (NOWRAP_COLS.has(key) ? 'nowrap' : '')}>
                      {cell(key, j)}
                    </td>
                  ))}
                  <td className="list-actions">
                    <button className="kebab" title="Quick actions" onClick={(e) => openRowMenu(e, j)}>⋮</button>
                  </td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td className="empty" colSpan={density === 'compact' ? 5 : renderCols.length + 1}>
                    No {TAB_LABEL[tab].toLowerCase()} {query ? 'match your search' : 'yet'}.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        )}
      </div>

      {pop && (
        <>
          <div className="cc-pop-scrim" onClick={() => setPop(null)} />
          <div className="cell-pop" style={{ left: pop.x, top: pop.y }}>{pop.node}</div>
        </>
      )}

      {headerMenu && (() => {
        const meta = colMeta[headerMenu.key]
        if (!meta) return null
        const clearCol = () => {
          setColFilters((p) => {
            const next = { ...p }
            meta.facets.forEach((f) => delete next[f.id])
            return next
          })
          if (sort?.col === headerMenu.key) setSort(null)
        }
        return (
          <>
            <div className="cc-pop-scrim" onClick={() => setHeaderMenu(null)} />
            <div className="hm" style={{ left: headerMenu.x, top: headerMenu.y }}>
              <div className="hm-sec-h">Sort</div>
              {meta.sorts.map((s) => (
                <div className="hm-sortrow" key={s.id}>
                  <span>{s.label}</span>
                  <span className="hm-dirs">
                    {(['asc', 'desc'] as const).map((dir) => {
                      const on = sort?.col === headerMenu.key && sort.sortId === s.id && sort.dir === dir
                      return (
                        <button
                          key={dir}
                          className={'hm-dir' + (on ? ' on' : '')}
                          title={dir === 'asc' ? 'Ascending' : 'Descending'}
                          onClick={() => setSort(on ? null : { col: headerMenu.key, sortId: s.id, dir })}
                        >
                          {dir === 'asc' ? '↑' : '↓'}
                        </button>
                      )
                    })}
                  </span>
                </div>
              ))}
              {meta.facets.map((f) => {
                const opts = [...new Set(searched.map(f.get))].sort()
                const sel = colFilters[f.id] ?? []
                return (
                  <div key={f.id}>
                    <div className="hm-sec-h">Filter · {f.label}</div>
                    <div className="hm-list">
                      {opts.map((v) => (
                        <label className="hm-chk" key={v}>
                          <input type="checkbox" checked={sel.includes(v)} onChange={() => toggleFacetValue(f.id, v)} />
                          {v}
                        </label>
                      ))}
                      {!opts.length && <div className="hm-empty">Nothing to filter.</div>}
                    </div>
                  </div>
                )
              })}
              <div className="hm-foot">
                <button className="cm-link" onClick={clearCol}>Clear column</button>
                <button className="cm-link" onClick={() => setHeaderMenu(null)}>Done</button>
              </div>
            </div>
          </>
        )
      })()}

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
