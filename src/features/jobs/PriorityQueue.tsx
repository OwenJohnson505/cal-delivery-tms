/**
 * PriorityQueue — the "Admins" saved view as a dense single TABLE.
 * Two density modes:
 *   Compact  (6 cols): Status+Due · Customer · COL · DEL · Driver+Vehicle · Actions
 *   Expanded (10 cols): Due · Status · Job · COL PC · COL ETA · DEL PC · DEL ETA · Vehicle · Driver · Actions
 */
import React, { Fragment, useEffect, useRef, useState, type ReactNode } from 'react'
import { Icon } from '@/app/Icon.tsx'
import { StatusPill } from '@/app/StatusPill.tsx'
import { useJobsStore, type SavedJob } from '@/store/jobsStore.ts'
import { useCustomersStore, type Customer } from '@/store/customersStore.ts'
import { usePriorityStore } from '@/store/priorityStore.ts'
import { useBookingStore } from '@/store/bookingStore.ts'
import { useViewStore } from '@/store/viewStore.ts'
import type { Stop } from '@/types/index.ts'

// ── Time helpers ──────────────────────────────────────────────────────────────
function timeOf(dt: string): string {
  const s = (dt || '').trim()
  if (/^\d{1,2}:\d{2}$/.test(s)) return s
  const parts = s.split(' ')
  return parts.length === 2 ? parts[1] : ''
}
function hhmmMin(t: string): number | null {
  const m = (t || '').match(/^(\d{1,2}):(\d{2})$/)
  return m ? parseInt(m[1]) * 60 + parseInt(m[2]) : null
}
const fmtTime = (min: number): string =>
  `${String(Math.floor(((min % 1440) + 1440) % 1440 / 60)).padStart(2, '0')}:${String(((min % 60) + 60) % 60).padStart(2, '0')}`
const hashRef = (s: string): number => { let h = 0; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0; return h }
const BASE_NOW = 9 * 60 + 20

// ── Priority config ───────────────────────────────────────────────────────────
const MISSING_ETA_RANK = 999
const BAND_NODRIVER   = -100000
const BAND_OV_COLLECT =  -10000
const BAND_OV_DELIVER =   -5000
const BAND_STALLED    =   -2000

const DELIVER_STAGES = new Set(['Collected', 'Part COL', 'En route DEL', 'On site DEL', 'Part DEL'])
function stageOf(progress: string): 'collect' | 'deliver' | 'done' {
  if (progress === 'Delivered' || progress === 'Failed') return 'done'
  if (DELIVER_STAGES.has(progress)) return 'deliver'
  return 'collect'
}

type Role = 'danger' | 'warning' | 'neutral'
type KebabMode = 'menu' | 'note'

interface QItem {
  job: SavedJob; cust?: Customer
  stage: 'collect' | 'deliver'; verb: 'Collect' | 'Deliver'
  delta: number
  collPc: string; collBookedTime: string; collDue: string
  delPc: string; delBookedTime: string; delDue: string
  driverCollEta: string; driverDelEta: string
  collStop?: Stop; delStop?: Stop
  noDriver: boolean; isOnSite: boolean; onSiteMin: number
  role: Role; legIcon: string; pill: string; cue?: string
  num: string; qual: string; sortKey: number
}

function buildItem(job: SavedJob, cust: Customer | undefined, nowMin: number, cfg: ReturnType<typeof usePriorityStore.getState>['config']): QItem {
  const stage = stageOf(job.progress) as 'collect' | 'deliver'
  const verb = stage === 'collect' ? 'Collect' : 'Deliver'
  const stops = job.snapshot.stops

  const collStop = stops.find(s => s.type === 'Collection' || s.type === 'Both')
  const delStop = [...stops].reverse().find(s => s.type === 'Delivery' || s.type === 'Both')
  const collPc = collStop?.addr.pc || '—'
  const delPc = delStop?.addr.pc || '—'

  const collBookedTime = timeOf(job.collectAt)
  const delBookedTime = timeOf(job.deliverAt)
  const collDueMin = hhmmMin(collBookedTime) ?? BASE_NOW + ((hashRef(job.ref + 'collect') % 190) - 90)
  const delDueMin = hhmmMin(delBookedTime) ?? BASE_NOW + ((hashRef(job.ref + 'deliver') % 190) - 90)
  const collDue = collBookedTime || fmtTime(collDueMin)
  const delDue = delBookedTime || fmtTime(delDueMin)

  const driverCollEta = job.collectEta || ''
  const driverDelEta = job.deliverEta || ''

  const dueMin = stage === 'collect' ? collDueMin : delDueMin
  const delta = dueMin - nowMin

  const onSite = (stage === 'collect' && job.progress === 'On site COL') ||
                 (stage === 'deliver' && job.progress === 'On site DEL')
  const onSiteMinVal = onSite ? 22 + (hashRef(job.ref) % 30) : 0
  const noDriver = !job.supplierName
  const stalled = onSite && onSiteMinVal >= cfg.stallMin
  const legIcon = stage === 'collect' ? 'arrow-up-right' : 'flag'
  const tie = (stage === 'deliver' && cfg.collectionsFirst) ? 0.4 : 0

  let role: Role, pill: string, num: string, qual: string, sortKey: number
  let cue: string | undefined
  const driverEta = stage === 'collect' ? driverCollEta : driverDelEta

  if (noDriver && cfg.unassignedDanger) {
    const absMin = Math.abs(delta)
    role = 'danger'; pill = 'No driver'
    cue = delta < 0
      ? `${verb} was due ${fmtTime(dueMin)} · ${absMin} min ago`
      : `${verb} due ${fmtTime(dueMin)} · in ${absMin} min`
    num = `${absMin}m`; qual = delta < 0 ? 'overdue' : 'to collect'
    sortKey = BAND_NODRIVER + delta
  } else if (delta < 0 && stage === 'collect') {
    role = 'danger'; pill = 'Collect overdue'
    cue = `Due ${fmtTime(dueMin)} · ${-delta} min ago` + (driverEta ? ` · Driver ETA ${driverEta}` : ' · No ETA set')
    num = `${-delta}m`; qual = 'late'; sortKey = BAND_OV_COLLECT + delta
  } else if (delta < 0) {
    role = 'danger'; pill = 'Deliver overdue'
    cue = `Due ${fmtTime(dueMin)} · ${-delta} min ago` + (driverEta ? ` · Driver ETA ${driverEta}` : ' · No ETA set')
    num = `${-delta}m`; qual = 'late'; sortKey = BAND_OV_DELIVER + delta
  } else if (stalled) {
    const arrivedAt = fmtTime(BASE_NOW - onSiteMinVal)
    role = 'danger'; pill = 'Stalled on site'
    cue = `On site since ${arrivedAt} · ${onSiteMinVal} min waiting`
    num = `${onSiteMinVal}m`; qual = 'on site'
    sortKey = BAND_STALLED - (cfg.longestStallFirst ? onSiteMinVal : 0)
  } else if (delta <= cfg.dueNowMin) {
    role = 'warning'; pill = `${verb} due now`
    cue = `Due ${fmtTime(dueMin)}` + (driverEta ? ` · Driver ETA ${driverEta}` : ' · No ETA set')
    num = `${delta}m`; qual = 'to go'; sortKey = delta + tie
  } else if (delta <= cfg.dueSoonMin) {
    role = 'warning'; pill = `${verb} due soon`
    cue = `Due ${fmtTime(dueMin)} · in ${delta} min` + (driverEta ? ` · ETA ${driverEta}` : '')
    num = `${delta}m`; qual = 'to go'; sortKey = delta + tie
  } else {
    role = 'neutral'; pill = 'Upcoming'
    num = `${delta}m`; qual = 'to go'
    sortKey = delta > 0 ? delta + tie : MISSING_ETA_RANK
  }

  return {
    job, cust, stage, verb, delta,
    collPc, collBookedTime, collDue,
    delPc, delBookedTime, delDue,
    driverCollEta, driverDelEta,
    collStop, delStop,
    noDriver, isOnSite: onSite, onSiteMin: onSiteMinVal,
    role, legIcon, pill, cue, num, qual, sortKey,
  }
}

export function PriorityQueue({ jobs, density }: { jobs: SavedJob[]; density: 'compact' | 'expanded' }) {
  const customers = useCustomersStore(s => s.customers)
  const setProgress = useJobsStore(s => s.setProgress)
  const setEta = useJobsStore(s => s.setEta)
  const cfg = usePriorityStore(s => s.config)

  const [nowMin, setNowMin] = useState(BASE_NOW)
  const [pending, setPending] = useState<Record<string, string>>({})
  const [receipts, setReceipts] = useState<Record<string, string[]>>({})
  const [snoozed, setSnoozed] = useState<Record<string, number>>({})
  const [kebab, setKebab] = useState<string | null>(null)
  const [kebabMode, setKebabMode] = useState<KebabMode>('menu')
  const [noteText, setNoteText] = useState('')
  const [etaEdit, setEtaEdit] = useState<{ id: string; which: 'collect' | 'deliver' } | null>(null)
  const [etaEditVal, setEtaEditVal] = useState('')
  const [pop, setPop] = useState<{ x: number; y: number; node: ReactNode } | null>(null)
  const noteRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    const t = window.setInterval(() => setNowMin(n => n + 1), Math.max(5, cfg.refreshSec) * 1000)
    return () => window.clearInterval(t)
  }, [cfg.refreshSec])

  const custById = (id?: string | null) => customers.find(c => c.id === id)
  const active = jobs.filter(j => stageOf(j.progress) !== 'done')
  const done = jobs.filter(j => stageOf(j.progress) === 'done')

  const items = active
    .map(j => buildItem(j, custById(j.snapshot.book.cust), nowMin, cfg))
    .sort((a, b) => {
      const aSn = !!(snoozed[a.job.id] && nowMin < snoozed[a.job.id])
      const bSn = !!(snoozed[b.job.id] && nowMin < snoozed[b.job.id])
      if (aSn !== bSn) return aSn ? 1 : -1
      return a.sortKey - b.sortKey
    })

  const addReceipt = (id: string, text: string) => setReceipts(r => ({ ...r, [id]: [...(r[id] ?? []), text] }))
  const markActioned = (id: string) => setPending(p => ({ ...p, [id]: fmtTime(nowMin) }))
  const undo = (id: string) => setPending(p => { const n = { ...p }; delete n[id]; return n })
  const confirmAction = (it: QItem) => {
    undo(it.job.id)
    setProgress(it.job.id, it.stage === 'collect' ? 'Collected' : 'Delivered')
  }
  const markOnSite = (it: QItem) => {
    setProgress(it.job.id, it.stage === 'collect' ? 'On site COL' : 'On site DEL')
    addReceipt(it.job.id, `On site ${fmtTime(nowMin)}`)
  }

  const closeKebab = () => { setKebab(null); setKebabMode('menu'); setNoteText('') }
  const openKebab = (id: string) => {
    if (kebab === id) { closeKebab(); return }
    setKebab(id); setKebabMode('menu'); setNoteText('')
  }
  const snoozeJob = (id: string, note: string) => {
    if (note.trim()) addReceipt(id, note.trim())
    addReceipt(id, `Snoozed — retry ${fmtTime(nowMin + 5)}`)
    setSnoozed(s => ({ ...s, [id]: nowMin + 5 }))
    closeKebab()
  }

  const openInlineEta = (e: React.MouseEvent, id: string, which: 'collect' | 'deliver', current: string) => {
    e.stopPropagation()
    e.preventDefault()
    setEtaEdit({ id, which })
    setEtaEditVal(current)
  }
  const saveInlineEta = () => {
    if (etaEdit && etaEditVal) {
      setEta(etaEdit.id, etaEdit.which, etaEditVal)
      addReceipt(etaEdit.id, `ETA updated → ${etaEditVal}`)
    }
    setEtaEdit(null)
    setEtaEditVal('')
  }
  const cancelInlineEta = () => { setEtaEdit(null); setEtaEditVal('') }

  const isExpanded = density === 'expanded'
  // compact: 6 · expanded: 10
  const colSpan = isExpanded ? 10 : 6

  function openJob(job: SavedJob) {
    useBookingStore.getState().loadSnapshot(job.snapshot)
    useViewStore.getState().openWizard(job.id)
  }

  const openPop = (e: React.MouseEvent, node: ReactNode) => {
    e.stopPropagation()
    const r = (e.currentTarget as HTMLElement).getBoundingClientRect()
    setPop({ x: Math.min(r.left, window.innerWidth - 280), y: r.bottom + 6, node })
  }

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

  const contactNode = (it: QItem) => {
    const cust = it.cust
    const booked = it.job.snapshot.book.contact
    const main = cust?.contacts.find(c => c.isMain) ?? cust?.contacts[0]
    const c = booked ?? (main ? { name: main.name, email: main.email, tel: main.phone } : null)
    return (
      <div className="cp-card">
        <div className="cp-h">{cust?.displayName || it.job.customer} · contact</div>
        {c ? (
          <>
            <div className="cp-row"><span className="cp-k">Name</span><span>{c.name || '—'}</span></div>
            {c.email ? <a className="cp-link" href={`mailto:${c.email}`}><Icon name="mail" size={13} /> {c.email}</a>
              : <div className="cp-row"><span className="cp-k">Email</span><span>—</span></div>}
            {c.tel ? <a className="cp-link" href={`tel:${c.tel}`}><Icon name="phone" size={13} /> {c.tel}</a>
              : <div className="cp-row"><span className="cp-k">Phone</span><span>—</span></div>}
          </>
        ) : <div className="cp-row"><span>No contact on file</span></div>}
      </div>
    )
  }

  /**
   * Compact stop cell — postcode + Due row + ETA row (colour-coded + delta, double-click to edit).
   * isActive = this is the leg we are currently chasing (ETA field is editable + highlighted if missing).
   */
  const stopTimeCell = (
    stop: Stop | undefined,
    pc: string,
    bookedTime: string,
    driverEta: string,
    id: string,
    which: 'collect' | 'deliver',
    isActive: boolean,
  ) => {
    const isEditing = etaEdit?.id === id && etaEdit?.which === which

    // Colour-code ETA relative to booked time
    const etaMin = hhmmMin(driverEta)
    const dueMin = hhmmMin(bookedTime)
    const etaDelta = (etaMin != null && dueMin != null) ? etaMin - dueMin : null
    const deltaStr = etaDelta == null ? ''
      : etaDelta > 0 ? ` +${etaDelta}m`
      : etaDelta < 0 ? ` ${Math.abs(etaDelta)}m`
      : ''
    const etaDisplay = driverEta
      ? `${driverEta}${deltaStr}`
      : isActive ? '— set ETA' : '—'
    const etaClass = driverEta
      ? (etaDelta != null ? (etaDelta > 0 ? 'pq-eta-late' : etaDelta < 0 ? 'pq-eta-early' : '') : '')
      : isActive ? 'pq-eta-missing' : 'pq-eta-na'

    return (
      <td className="pq-cmp-stop">
        {stop
          ? <button className="route-pt pc" onClick={(e) => openPop(e, addressNode(stop))}>{pc}</button>
          : <span className="pc muted">{pc}</span>}
        <div className="pq-time-grid">
          <span className="pq-time-label">Due</span>
          <span className="pq-time-val">{bookedTime || 'ASAP'}</span>
          <span className="pq-time-label">ETA</span>
          {isEditing ? (
            <input
              type="time"
              className="pq-eta-input-inline"
              value={etaEditVal}
              autoFocus
              onChange={e => setEtaEditVal(e.target.value)}
              onBlur={saveInlineEta}
              onKeyDown={e => {
                if (e.key === 'Enter') saveInlineEta()
                if (e.key === 'Escape') cancelInlineEta()
                e.stopPropagation()
              }}
              onClick={e => e.stopPropagation()}
            />
          ) : (
            <span
              className={`pq-time-val pq-eta-val ${etaClass}`}
              title={isActive ? 'Double-click to update ETA' : undefined}
              onDoubleClick={isActive ? (e) => openInlineEta(e, id, which, driverEta) : undefined}
            >
              {etaDisplay}
            </span>
          )}
        </div>
      </td>
    )
  }

  return (
    <div className={`pq${isExpanded ? '' : ' pq-cmp'}`}>
      <div className="pqt-scroll">
        <table className={`pqt${isExpanded ? ' pqt-exp' : ' pqt-cmp'}`}>
          <thead>
            <tr>
              {isExpanded ? (
                <>
                  <th>Due</th>
                  <th>Status</th>
                  <th>Job</th>
                  <th><span className="pqt-th-col">COL</span> Postcode</th>
                  <th><span className="pqt-th-col">COL</span> ETA</th>
                  <th><span className="pqt-th-del">DEL</span> Postcode</th>
                  <th><span className="pqt-th-del">DEL</span> ETA</th>
                  <th>Vehicle</th>
                </>
              ) : (
                <>
                  <th>Status</th>
                  <th>Customer</th>
                  <th><span className="pqt-th-col">COL</span></th>
                  <th><span className="pqt-th-del">DEL</span></th>
                </>
              )}
              <th>Driver</th>
              <th className="pqt-th-act"></th>
            </tr>
          </thead>
          <tbody>
            {items.map(it => {
              const id = it.job.id
              const isPending = !!pending[id]
              const isSnoozed = !!(snoozed[id] && nowMin < snoozed[id])
              const rcpts = receipts[id] ?? []
              const driver = it.job.supplierName || null
              const vehicle = it.job.vehicle || ''
              const isAlert = it.role !== 'neutral'
              const rowClass = [
                isSnoozed ? 'pqt-snoozed' : '',
                !isSnoozed && (isPending ? 'pending' : isAlert ? `alert role-${it.role}` : ''),
              ].filter(Boolean).join(' ')

              const secondaryLabel = it.noDriver ? 'Find driver' : 'On site'
              const secondaryVisible = it.noDriver || !it.isOnSite
              const primaryLabel = it.noDriver ? 'Post job'
                : it.stage === 'collect' ? 'Mark collected' : 'Mark delivered'
              const primaryAction = it.noDriver
                ? () => { console.log('[TODO] Post job', id); addReceipt(id, 'Job posted') }
                : () => markActioned(id)
              const secondaryAction = it.noDriver
                ? () => { console.log('[TODO] Find driver', id) }
                : () => markOnSite(it)

              // Shared status content (used in both compact combined-cell and expanded separate cell)
              const pillNode = isSnoozed
                ? <span className="pqt-pill role-snoozed"><Icon name="clock" size={11} /> Snoozed · {fmtTime(snoozed[id])}</span>
                : isPending
                  ? <span className="pqt-pill role-pending"><span className="pqt-dot" />{it.stage === 'collect' ? 'Collected' : 'Delivered'} {pending[id]}</span>
                  : <span className={`pqt-pill role-${it.role}`}><span className="pqt-dot" />{it.pill}</span>

              return (
                <Fragment key={id}>
                  <tr className={rowClass} onDoubleClick={() => openJob(it.job)} style={{ cursor: 'pointer' }}>

                    {isExpanded ? (
                      /* Expanded: separate Due + Status + Job + stop columns */
                      <>
                        <td className="pqt-due">
                          <b>{it.num}</b>
                          <span>{it.qual}</span>
                        </td>
                        <td className="pqt-status">
                          {pillNode}
                          {!isPending && !isSnoozed && it.cue && <div className="pqt-cue">{it.cue}</div>}
                          {it.isOnSite && !isPending && (
                            <div className="pqt-onsite-dur"><Icon name="clock" size={11} /> {it.onSiteMin} min on site</div>
                          )}
                          {rcpts.length > 0 && <div className="pqt-rcpt">{rcpts[rcpts.length - 1]}</div>}
                        </td>
                        <td>
                          <div className="pqt-job">
                            <span className={`pqt-leg leg-${it.stage}`}><Icon name={it.legIcon} size={13} /></span>
                            <div className="pqt-job-main">
                              <button className="cell-link" onClick={(e) => openPop(e, contactNode(it))}>
                                {it.cust?.displayName || it.job.customer}
                              </button>
                              <span className="pqt-ref">{it.job.ref}</span>
                            </div>
                          </div>
                        </td>
                        <td className="pqt-stop">
                          {it.collStop
                            ? <button className="route-pt pc" onClick={(e) => openPop(e, addressNode(it.collStop!))}>{it.collPc}</button>
                            : <span className="pc muted">{it.collPc}</span>}
                        </td>
                        <td className="pqt-stop-time">
                          <b>{it.collDue}</b>
                          {it.driverCollEta && <div className="pqt-driver-eta">ETA {it.driverCollEta}</div>}
                        </td>
                        <td className="pqt-stop">
                          {it.delStop
                            ? <button className="route-pt pc" onClick={(e) => openPop(e, addressNode(it.delStop!))}>{it.delPc}</button>
                            : <span className="pc muted">{it.delPc}</span>}
                        </td>
                        <td className="pqt-stop-time">
                          <b>{it.delDue}</b>
                          {it.driverDelEta && <div className="pqt-driver-eta">ETA {it.driverDelEta}</div>}
                        </td>
                        <td className="pqt-veh">{vehicle || <span className="muted">—</span>}</td>
                      </>
                    ) : (
                      /* Compact: combined Status+Due · Customer · COL · DEL */
                      <>
                        {/* Col 1: combined priority number + pill + cue */}
                        <td className="pqt-due-status">
                          <div className="pqt-due-num">
                            <b>{it.num}</b>
                            <span>{it.qual}</span>
                          </div>
                          {pillNode}
                          {!isPending && !isSnoozed && it.cue && <div className="pqt-cue">{it.cue}</div>}
                          {it.isOnSite && !isPending && (
                            <div className="pqt-onsite-dur"><Icon name="clock" size={11} /> {it.onSiteMin} min on site</div>
                          )}
                          {rcpts.length > 0 && <div className="pqt-rcpt">{rcpts[rcpts.length - 1]}</div>}
                        </td>

                        {/* Col 2: customer + ref + progress */}
                        <td className="pq-cmp-cust">
                          <button className="cell-link cmp-co" onClick={(e) => openPop(e, contactNode(it))}>
                            {it.cust?.displayName || it.job.customer}
                          </button>
                          <div className="cmp-ref">{it.job.ref}</div>
                          <div className="cmp-status">
                            <span className={`pqt-leg leg-${it.stage} pq-leg-inline`}><Icon name={it.legIcon} size={11} /></span>
                            <StatusPill status={it.job.progress} />
                          </div>
                        </td>

                        {/* Col 3: COL stop — booked + ETA */}
                        {stopTimeCell(it.collStop, it.collPc, it.collDue, it.driverCollEta, id, 'collect', it.stage === 'collect')}

                        {/* Col 4: DEL stop — booked + ETA */}
                        {stopTimeCell(it.delStop, it.delPc, it.delDue, it.driverDelEta, id, 'deliver', it.stage === 'deliver')}
                      </>
                    )}

                    {/* Driver (+ vehicle in compact) */}
                    {isExpanded ? (
                      <td className={`pqt-driver${driver ? '' : ' muted'}`}>{driver ?? 'Unassigned'}</td>
                    ) : (
                      <td className="pqt-driver-veh">
                        <div className={driver ? '' : 'muted'}>{driver ?? 'Unassigned'}</div>
                        {vehicle && <div className="pqt-veh-sub">{vehicle}</div>}
                      </td>
                    )}

                    {/* Actions — 2×2 grid: [secondary][📞] / [primary][⋯] */}
                    <td className="pqt-act" onClick={e => e.stopPropagation()}>
                      {isPending ? (
                        <div className="pqt-act-pending">
                          <button className="btn primary sm" onClick={() => confirmAction(it)}>Confirm</button>
                          <button className="btn sm" onClick={() => undo(id)}>Undo</button>
                        </div>
                      ) : (
                        <div className="pqt-act-grid">
                          <button
                            className="btn sm pq-act-sec"
                            style={{ visibility: secondaryVisible ? 'visible' : 'hidden' }}
                            onClick={secondaryAction}
                          >
                            {secondaryLabel}
                          </button>
                          <button
                            className="pq-act-icon"
                            disabled={it.noDriver}
                            title={it.noDriver ? 'No driver assigned' : `Call ${driver}`}
                            onClick={() => { addReceipt(id, `Called ${fmtTime(nowMin)}`); console.log('[TODO] Aircall', driver) }}
                          >
                            <Icon name="phone" size={14} />
                          </button>
                          <button className="btn primary sm pq-act-primary" onClick={primaryAction}>
                            {primaryLabel}
                          </button>
                          <button
                            className="pq-act-icon"
                            title="More actions"
                            onClick={(e) => { e.stopPropagation(); openKebab(id) }}
                          >
                            <Icon name="more" size={14} />
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>

                  {/* Kebab panel */}
                  {kebab === id && !isPending && (
                    <tr className="pqt-kebab-row">
                      <td colSpan={colSpan}>
                        <div className="pqt-kebab">
                          {kebabMode === 'note' ? (
                            <div className="pqt-kebab-form">
                              <textarea
                                ref={noteRef}
                                className="pqt-note-input"
                                placeholder="Add a note before snoozing…"
                                rows={2}
                                value={noteText}
                                onChange={e => setNoteText(e.target.value)}
                                autoFocus
                              />
                              <div className="pqt-kebab-form-row">
                                <button className="btn primary sm" onClick={() => snoozeJob(id, noteText)}>
                                  <Icon name="clock" size={13} /> Snooze 5 min
                                </button>
                                <button className="btn sm" onClick={() => { setKebabMode('menu'); setNoteText('') }}>Cancel</button>
                              </div>
                            </div>
                          ) : it.noDriver ? (
                            <>
                              <KebabBtn icon="eye" label="Open job" onClick={() => { openJob(it.job); closeKebab() }} />
                              <KebabBtn icon="arrow-up-right" label="Post job" onClick={() => { addReceipt(id, 'Job posted'); closeKebab() }} />
                              <KebabBtn icon="users" label="Find driver" onClick={() => closeKebab()} />
                              <KebabBtn icon="mail" label="Update customer" onClick={() => { addReceipt(id, `Customer updated ${fmtTime(nowMin)}`); closeKebab() }} />
                              <KebabBtn icon="note" label="Add note & snooze" onClick={() => setKebabMode('note')} />
                            </>
                          ) : (
                            <>
                              <KebabBtn icon="eye" label="Open job" onClick={() => { openJob(it.job); closeKebab() }} />
                              {!it.isOnSite && <KebabBtn icon="pin" label="On site" onClick={() => { markOnSite(it); closeKebab() }} />}
                              <KebabBtn
                                icon={it.stage === 'collect' ? 'arrow-up-right' : 'flag'}
                                label={it.stage === 'collect' ? 'Mark collected' : 'Mark delivered'}
                                onClick={() => { markActioned(id); closeKebab() }}
                              />
                              <KebabBtn icon="phone" label="Ring driver" onClick={() => { addReceipt(id, `Called ${fmtTime(nowMin)}`); closeKebab() }} />
                              <KebabBtn icon="mail" label="Update customer" onClick={() => { addReceipt(id, `Customer updated ${fmtTime(nowMin)}`); closeKebab() }} />
                              <KebabBtn icon="truck" label="Reassign driver" onClick={() => closeKebab()} />
                              <KebabBtn icon="note" label="Add note & snooze" onClick={() => setKebabMode('note')} />
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              )
            })}
            {!items.length && (
              <tr><td className="pqt-empty" colSpan={colSpan}>Nothing outstanding — all jobs are on track.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Completed */}
      <div className="pq-done-wrap">
        <div className="pq-done-h"><Icon name="check" size={13} /> Completed — {done.length} job{done.length === 1 ? '' : 's'}</div>
        {done.map(j => (
          <div key={j.id} className="pq-done-row" onDoubleClick={() => openJob(j)} style={{ cursor: 'pointer' }}>
            <Icon name="check-circle" size={15} />
            <span className="pq-done-cust">{custById(j.snapshot.book.cust)?.displayName || j.customer}</span>
            <span className="pc pq-done-ref">{j.ref}</span>
            <span className="db-spacer" />
            <span className="pq-done-when">{j.progress === 'Failed' ? 'Failed' : `Delivered ${(j.deliverEta || j.deliverAt || '').split(' ').pop() || ''}`}</span>
          </div>
        ))}
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

function KebabBtn({ icon, label, onClick }: { icon: string; label: string; onClick: () => void }) {
  return (
    <button className="pq-kebab-btn" onClick={onClick}>
      <Icon name={icon} size={14} /> {label as ReactNode}
    </button>
  )
}
