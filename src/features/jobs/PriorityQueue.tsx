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
type KebabMode = 'menu' | 'note' | 'arrival' | 'pod' | 'find-driver' | 'post-job'
type SnoozeDur = 5 | 10 | 30 | 'custom'

interface SnoozeEntry {
  until: number
  label?: string   // manual status label — if set, shows "Manual" pill instead of "Snoozed"
}

// Mock driver list — will be replaced with live DriverBase query
const MOCK_DRIVERS = [
  { id: 'd1', name: 'Alex Turner',  vehicle: 'LWB Van', distance: '1.2 mi', avail: true  },
  { id: 'd2', name: 'Maria Santos', vehicle: 'SWB Van', distance: '2.4 mi', avail: true  },
  { id: 'd3', name: 'James Hill',   vehicle: 'Luton',   distance: '3.8 mi', avail: true  },
  { id: 'd4', name: 'Priya Kapoor', vehicle: 'LWB Van', distance: '5.1 mi', avail: false },
  { id: 'd5', name: 'Tom Baker',    vehicle: 'Luton',   distance: '6.2 mi', avail: false },
]

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
  const [receipts, setReceipts] = useState<Record<string, string[]>>({})
  const [snoozed, setSnoozed] = useState<Record<string, SnoozeEntry>>({})

  // Kebab panel
  const [kebab, setKebab] = useState<string | null>(null)
  const [kebabMode, setKebabMode] = useState<KebabMode>('menu')

  // Note / snooze form state
  const [noteText, setNoteText] = useState('')
  const [snoozeDur, setSnoozeDur] = useState<SnoozeDur>(5)
  const [customSnoozeMins, setCustomSnoozeMins] = useState('')
  const [showManualLabel, setShowManualLabel] = useState(false)
  const [manualLabel, setManualLabel] = useState('')

  // On-site arrival form
  const [arrivalFormTime, setArrivalFormTime] = useState('')

  // Collection / delivery POD form
  const [podName, setPodName] = useState('')
  const [podTime, setPodTime] = useState('')

  // Post-job CX form
  const [postJobNotes, setPostJobNotes] = useState('')

  // ETA inline edit
  const [etaEdit, setEtaEdit] = useState<{ id: string; which: 'collect' | 'deliver' } | null>(null)
  const [etaEditVal, setEtaEditVal] = useState('')

  // Address / contact / notes popover
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
      const aSnEntry = snoozed[a.job.id]
      const bSnEntry = snoozed[b.job.id]
      const aSn = !!(aSnEntry && nowMin < aSnEntry.until)
      const bSn = !!(bSnEntry && nowMin < bSnEntry.until)
      if (aSn !== bSn) return aSn ? 1 : -1
      return a.sortKey - b.sortKey
    })

  const addReceipt = (id: string, text: string) =>
    setReceipts(r => ({ ...r, [id]: [...(r[id] ?? []), text] }))

  // ── Kebab helpers ─────────────────────────────────────────────────────────
  const resetKebabForms = () => {
    setNoteText('')
    setSnoozeDur(5)
    setCustomSnoozeMins('')
    setShowManualLabel(false)
    setManualLabel('')
    setArrivalFormTime('')
    setPodName('')
    setPodTime('')
    setPostJobNotes('')
  }

  const closeKebab = () => {
    setKebab(null)
    setKebabMode('menu')
    resetKebabForms()
  }

  const openKebab = (id: string) => {
    if (kebab === id && kebabMode === 'menu') { closeKebab(); return }
    setKebab(id)
    setKebabMode('menu')
    resetKebabForms()
  }

  // ── Action openers (primary/secondary button clicks) ──────────────────────
  const onSiteClick = (it: QItem) => {
    setKebab(it.job.id)
    setKebabMode('arrival')
    setArrivalFormTime(fmtTime(nowMin))
  }

  const podClick = (it: QItem) => {
    setKebab(it.job.id)
    setKebabMode('pod')
    setPodName('')
    setPodTime(fmtTime(nowMin))
  }

  const findDriverClick = (id: string) => {
    setKebab(id)
    setKebabMode('find-driver')
    resetKebabForms()
  }

  const postJobClick = (it: QItem) => {
    setKebab(it.job.id)
    setKebabMode('post-job')
    setPostJobNotes(it.job.snapshot.cx.text || '')
  }

  // ── Action confirmations ──────────────────────────────────────────────────
  const confirmArrival = (it: QItem) => {
    const time = arrivalFormTime || fmtTime(nowMin)
    setProgress(it.job.id, it.stage === 'collect' ? 'On site COL' : 'On site DEL')
    addReceipt(it.job.id, `Arrived on site at ${time}`)
    closeKebab()
  }

  const confirmPod = (it: QItem) => {
    const time = podTime || fmtTime(nowMin)
    const action = it.stage === 'collect' ? 'Collected' : 'Delivered'
    setProgress(it.job.id, action)
    const note = podName
      ? `${action} · signed by ${podName} at ${time}`
      : `${action} at ${time}`
    addReceipt(it.job.id, note)
    closeKebab()
  }

  const postJobToCx = (it: QItem) => {
    addReceipt(it.job.id, `Posted to CX${postJobNotes ? ` — "${postJobNotes.slice(0, 60)}${postJobNotes.length > 60 ? '…' : ''}"` : ''}`)
    console.log('[TODO] Post to CX platform', it.job.ref, postJobNotes)
    closeKebab()
  }

  const assignDriver = (jobId: string, driverName: string) => {
    addReceipt(jobId, `Driver booked: ${driverName}`)
    console.log('[TODO] Assign driver to job', driverName, jobId)
    closeKebab()
  }

  const handleSnooze = (id: string) => {
    const mins: number = snoozeDur === 'custom'
      ? Math.max(1, parseInt(customSnoozeMins || '5') || 5)
      : snoozeDur
    const label = showManualLabel ? manualLabel.trim() : undefined
    if (noteText.trim()) addReceipt(id, noteText.trim())
    const msg = label
      ? `Manual: "${label}" · until ${fmtTime(nowMin + mins)}`
      : `Snoozed ${mins} min · retry ${fmtTime(nowMin + mins)}`
    addReceipt(id, msg)
    setSnoozed(s => ({ ...s, [id]: { until: nowMin + mins, label: label || undefined } }))
    closeKebab()
  }

  // ── ETA inline edit ───────────────────────────────────────────────────────
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

  const noteListNode = (id: string) => {
    const notes = receipts[id] ?? []
    return (
      <div className="cp-card">
        <div className="cp-h">Activity · {notes.length}</div>
        {notes.map((n, i) => (
          <div key={i} className="cp-row"><span style={{ fontSize: 12 }}>{n}</span></div>
        ))}
      </div>
    )
  }

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
              const snEntry = snoozed[id]
              const isSnoozeActive = !!(snEntry && nowMin < snEntry.until)
              const isManual = isSnoozeActive && !!snEntry.label
              const rcpts = receipts[id] ?? []
              const driver = it.job.supplierName || null
              const vehicle = it.job.vehicle || ''
              const isAlert = it.role !== 'neutral'

              const rowClass = [
                isSnoozeActive ? 'pqt-snoozed' : '',
                !isSnoozeActive && isAlert ? `alert role-${it.role}` : '',
              ].filter(Boolean).join(' ')

              // Action grid labels / handlers
              const secondaryLabel = it.noDriver ? 'Find driver' : 'On site'
              const secondaryVisible = it.noDriver || !it.isOnSite
              const primaryLabel = it.noDriver ? 'Post job'
                : it.stage === 'collect' ? 'Mark collected' : 'Mark delivered'
              const secondaryAction = it.noDriver ? () => findDriverClick(id) : () => onSiteClick(it)
              const primaryAction = it.noDriver ? () => postJobClick(it) : () => podClick(it)

              // Priority pill — no nested ternaries
              let pillNode: ReactNode
              if (isManual) {
                pillNode = <span className="pqt-pill role-manual"><span className="pqt-dot" />Manual</span>
              } else if (isSnoozeActive) {
                pillNode = <span className="pqt-pill role-snoozed"><Icon name="clock" size={11} /> Snoozed · {fmtTime(snEntry.until)}</span>
              } else {
                pillNode = <span className={`pqt-pill role-${it.role}`}><span className="pqt-dot" />{it.pill}</span>
              }

              // Kebab panel content — function defined per-row, captures it/id in closure
              const renderKebab = (): ReactNode => {
                // ── Note + Snooze form ─────────────────────────────────────
                if (kebabMode === 'note') {
                  return (
                    <div className="pqt-kebab-form">
                      <textarea
                        ref={noteRef}
                        className="pqt-note-input"
                        placeholder="Note (optional)…"
                        rows={2}
                        value={noteText}
                        onChange={e => setNoteText(e.target.value)}
                        autoFocus
                      />
                      <div className="pq-manual-row">
                        <div className="pq-manual-row-text">
                          <span className="pq-manual-row-title">Manual status</span>
                          <span className="pq-manual-row-hint">Pins a visible label to the job while snoozed</span>
                        </div>
                        <label className="cm-toggle">
                          <input
                            type="checkbox"
                            checked={showManualLabel}
                            onChange={e => setShowManualLabel(e.target.checked)}
                          />
                          <span className="cm-track"><span className="cm-knob" /></span>
                        </label>
                      </div>
                      {showManualLabel && (
                        <input
                          type="text"
                          className="pqt-note-input"
                          placeholder="e.g. Customer callback pending"
                          value={manualLabel}
                          onChange={e => setManualLabel(e.target.value)}
                          autoFocus
                        />
                      )}
                      <div className="pqt-kebab-label">Snooze for</div>
                      <div className="pq-snooze-preset">
                        {([5, 10, 30] as const).map(n => (
                          <button
                            key={n}
                            className={`btn sm${snoozeDur === n ? ' primary' : ''}`}
                            onClick={() => setSnoozeDur(n)}
                          >
                            {n} min
                          </button>
                        ))}
                        <button
                          className={`btn sm${snoozeDur === 'custom' ? ' primary' : ''}`}
                          onClick={() => setSnoozeDur('custom')}
                        >
                          Custom
                        </button>
                      </div>
                      {snoozeDur === 'custom' && (
                        <div className="pq-snooze-custom">
                          <input
                            type="number"
                            className="pqt-eta-input"
                            placeholder="mins"
                            min="1"
                            max="480"
                            value={customSnoozeMins}
                            onChange={e => setCustomSnoozeMins(e.target.value)}
                            style={{ width: 80 }}
                          />
                          <span className="pqt-kebab-label">minutes</span>
                        </div>
                      )}
                      <div className="pqt-kebab-form-row">
                        <button className="btn primary sm" onClick={() => handleSnooze(id)}>
                          <Icon name="clock" size={13} /> Snooze
                        </button>
                        <button className="btn sm" onClick={() => { setKebabMode('menu'); resetKebabForms() }}>Cancel</button>
                      </div>
                    </div>
                  )
                }

                // ── On-site arrival form ───────────────────────────────────
                if (kebabMode === 'arrival') {
                  return (
                    <div className="pqt-kebab-form">
                      <div className="pqt-kebab-label">Mark as on site — confirm arrival time</div>
                      <div className="pq-form-row">
                        <span className="pq-form-label">Arrival time</span>
                        <input
                          type="time"
                          className="pqt-eta-input"
                          value={arrivalFormTime}
                          onChange={e => setArrivalFormTime(e.target.value)}
                          autoFocus
                        />
                      </div>
                      <div className="pqt-kebab-form-row">
                        <button className="btn primary sm" onClick={() => confirmArrival(it)}>
                          Confirm arrival
                        </button>
                        <button className="btn sm" onClick={() => setKebabMode('menu')}>Cancel</button>
                      </div>
                    </div>
                  )
                }

                // ── Collection / delivery POD form ────────────────────────
                if (kebabMode === 'pod') {
                  const podLabel = it.stage === 'collect' ? 'Confirm collection' : 'Confirm delivery'
                  const podBtn = it.stage === 'collect' ? 'Mark collected' : 'Mark delivered'
                  return (
                    <div className="pqt-kebab-form">
                      <div className="pqt-kebab-label">{podLabel}</div>
                      <div className="pq-pod-form">
                        <span className="pq-form-label">Received by</span>
                        <input
                          type="text"
                          className="pqt-note-input"
                          placeholder="Person's name (optional)"
                          value={podName}
                          onChange={e => setPodName(e.target.value)}
                          autoFocus
                        />
                        <span className="pq-form-label" style={{ marginTop: 4 }}>Time</span>
                        <input
                          type="time"
                          className="pqt-eta-input"
                          value={podTime}
                          onChange={e => setPodTime(e.target.value)}
                        />
                      </div>
                      <div className="pqt-kebab-form-row">
                        <button className="btn primary sm" onClick={() => confirmPod(it)}>{podBtn}</button>
                        <button className="btn sm" onClick={() => setKebabMode('menu')}>Cancel</button>
                      </div>
                    </div>
                  )
                }

                // ── Find / assign driver ───────────────────────────────────
                if (kebabMode === 'find-driver') {
                  return (
                    <div className="pqt-kebab-form pq-find-driver-form">
                      <div className="pqt-kebab-label">Available drivers{vehicle ? ` — ${vehicle}` : ''}</div>
                      <div className="pq-driver-list">
                        {MOCK_DRIVERS.map(d => (
                          <div key={d.id} className="pq-driver-row">
                            <div className="pq-driver-info">
                              <span className="pq-driver-name">{d.name}</span>
                              <span className="pq-driver-sub">{d.vehicle} · {d.distance}</span>
                            </div>
                            <span className={`pq-driver-badge${d.avail ? ' avail' : ''}`}>
                              {d.avail ? 'Available' : 'Finishing'}
                            </span>
                            <button
                              className="btn primary sm"
                              disabled={!d.avail}
                              onClick={() => assignDriver(id, d.name)}
                            >
                              Assign
                            </button>
                          </div>
                        ))}
                      </div>
                      <div className="pqt-kebab-form-row" style={{ marginTop: 4 }}>
                        <button className="btn sm" onClick={() => { openJob(it.job); closeKebab() }}>
                          Open in booking
                        </button>
                        <button className="btn sm" onClick={() => setKebabMode('menu')}>Cancel</button>
                      </div>
                    </div>
                  )
                }

                // ── Post to CX form ───────────────────────────────────────
                if (kebabMode === 'post-job') {
                  return (
                    <div className="pqt-kebab-form pq-post-job-form">
                      <div className="pqt-kebab-label">Post to CX platform</div>
                      <div className="pq-post-summary">
                        <div className="pq-post-row">
                          <span>Job</span>
                          <span>{it.job.ref} · {it.cust?.displayName || it.job.customer}</span>
                        </div>
                        <div className="pq-post-row">
                          <span>Collect</span>
                          <span>{it.collPc} · {it.collDue}</span>
                        </div>
                        <div className="pq-post-row">
                          <span>Deliver</span>
                          <span>{it.delPc} · {it.delDue}</span>
                        </div>
                        {vehicle && (
                          <div className="pq-post-row">
                            <span>Vehicle</span>
                            <span>{vehicle}</span>
                          </div>
                        )}
                      </div>
                      <div className="pqt-kebab-label" style={{ marginTop: 6 }}>Posting notes</div>
                      <textarea
                        className="pqt-note-input"
                        rows={4}
                        value={postJobNotes}
                        onChange={e => setPostJobNotes(e.target.value)}
                        placeholder="Notes for the courier exchange posting…"
                      />
                      <div className="pqt-kebab-form-row">
                        <button className="btn primary sm" onClick={() => postJobToCx(it)}>
                          <Icon name="arrow-up-right" size={13} /> Post to CX
                        </button>
                        <button className="btn sm" onClick={() => setKebabMode('menu')}>Cancel</button>
                      </div>
                    </div>
                  )
                }

                // ── Default: action menu ───────────────────────────────────
                if (it.noDriver) {
                  return (
                    <>
                      <KebabBtn icon="eye" label="Open job" onClick={() => { openJob(it.job); closeKebab() }} />
                      <KebabBtn icon="users" label="Find driver" onClick={() => { setKebabMode('find-driver'); resetKebabForms() }} />
                      <KebabBtn icon="arrow-up-right" label="Post job" onClick={() => { setKebabMode('post-job'); setPostJobNotes(it.job.snapshot.cx.text || '') }} />
                      <KebabBtn icon="mail" label="Update customer" onClick={() => { addReceipt(id, `Customer updated ${fmtTime(nowMin)}`); closeKebab() }} />
                      <KebabBtn icon="note" label="Add note & snooze" onClick={() => setKebabMode('note')} />
                    </>
                  )
                }
                return (
                  <>
                    <KebabBtn icon="eye" label="Open job" onClick={() => { openJob(it.job); closeKebab() }} />
                    {!it.isOnSite && (
                      <KebabBtn icon="pin" label="On site" onClick={() => { setKebabMode('arrival'); setArrivalFormTime(fmtTime(nowMin)) }} />
                    )}
                    <KebabBtn
                      icon={it.stage === 'collect' ? 'arrow-up-right' : 'flag'}
                      label={it.stage === 'collect' ? 'Mark collected' : 'Mark delivered'}
                      onClick={() => { setKebabMode('pod'); setPodName(''); setPodTime(fmtTime(nowMin)) }}
                    />
                    <KebabBtn icon="truck" label="Reassign driver" onClick={() => { setKebabMode('find-driver'); resetKebabForms() }} />
                    <KebabBtn icon="phone" label="Ring driver" onClick={() => { addReceipt(id, `Called ${fmtTime(nowMin)}`); closeKebab() }} />
                    <KebabBtn icon="mail" label="Update customer" onClick={() => { addReceipt(id, `Customer updated ${fmtTime(nowMin)}`); closeKebab() }} />
                    <KebabBtn icon="note" label="Add note & snooze" onClick={() => setKebabMode('note')} />
                  </>
                )
              }

              return (
                <Fragment key={id}>
                  <tr className={rowClass} onDoubleClick={() => openJob(it.job)} style={{ cursor: 'pointer' }}>

                    {isExpanded ? (
                      /* ── Expanded columns ─────────────────────────────── */
                      <>
                        <td className="pqt-due">
                          <b>{it.num}</b>
                          <span>{it.qual}</span>
                        </td>
                        <td className="pqt-status">
                          {pillNode}
                          {isManual && snEntry.label && (
                            <div className="pqt-manual-label">{snEntry.label}</div>
                          )}
                          {!isSnoozeActive && it.cue && <div className="pqt-cue">{it.cue}</div>}
                          {isSnoozeActive && (
                            <div className="pqt-cue"><Icon name="clock" size={11} /> Retry {fmtTime(snEntry.until)}</div>
                          )}
                          {it.isOnSite && !isSnoozeActive && (
                            <div className="pqt-onsite-dur"><Icon name="clock" size={11} /> {it.onSiteMin} min on site</div>
                          )}
                          {rcpts.length > 0 && <div className="pqt-rcpt">{rcpts[rcpts.length - 1]}</div>}
                          {rcpts.length > 0 && (
                            <button className="pq-note-badge" onClick={(e) => { e.stopPropagation(); openPop(e, noteListNode(id)) }}>
                              <Icon name="note" size={11} />{rcpts.length}
                            </button>
                          )}
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
                      /* ── Compact columns ──────────────────────────────── */
                      <>
                        {/* Col 1: combined priority + pill + cue + note badge */}
                        <td className="pqt-due-status">
                          <div className="pqt-due-num">
                            <b>{it.num}</b>
                            <span>{it.qual}</span>
                          </div>
                          {pillNode}
                          {isManual && snEntry.label && (
                            <div className="pqt-manual-label">{snEntry.label}</div>
                          )}
                          {!isSnoozeActive && it.cue && <div className="pqt-cue">{it.cue}</div>}
                          {isSnoozeActive && (
                            <div className="pqt-cue"><Icon name="clock" size={11} /> Retry {fmtTime(snEntry.until)}</div>
                          )}
                          {it.isOnSite && !isSnoozeActive && (
                            <div className="pqt-onsite-dur"><Icon name="clock" size={11} /> {it.onSiteMin} min on site</div>
                          )}
                          {rcpts.length > 0 && (
                            <button className="pq-note-badge" onClick={(e) => { e.stopPropagation(); openPop(e, noteListNode(id)) }}>
                              <Icon name="note" size={11} />{rcpts.length}
                            </button>
                          )}
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

                        {/* Col 3: COL stop */}
                        {stopTimeCell(it.collStop, it.collPc, it.collDue, it.driverCollEta, id, 'collect', it.stage === 'collect')}

                        {/* Col 4: DEL stop */}
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
                    </td>
                  </tr>

                  {/* Kebab panel */}
                  {kebab === id && (
                    <tr className="pqt-kebab-row">
                      <td colSpan={colSpan}>
                        <div className="pqt-kebab">
                          {renderKebab()}
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
