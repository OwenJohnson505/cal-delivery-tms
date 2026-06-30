/**
 * PriorityQueue — the "Admins" saved view as a dense single TABLE.
 * Two density modes:
 *   Compact  (7 cols): Due · Status · Customer · COL · DEL · Driver · Actions
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

// ── Config ───────────────────────────────────────────────────────────────────
const MISSING_ETA_RANK = 999
const BAND_NODRIVER   = -100000
const BAND_OV_COLLECT =  -10000
const BAND_OV_DELIVER =   -5000
const BAND_STALLED    =   -2000

const fmtTime = (min: number): string =>
  `${String(Math.floor(((min % 1440) + 1440) % 1440 / 60)).padStart(2, '0')}:${String(((min % 60) + 60) % 60).padStart(2, '0')}`
const hashRef = (s: string): number => { let h = 0; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0; return h }
const BASE_NOW = 9 * 60 + 20

const DELIVER_STAGES = new Set(['Collected', 'Part COL', 'En route DEL', 'On site DEL', 'Part DEL'])
function stageOf(progress: string): 'collect' | 'deliver' | 'done' {
  if (progress === 'Delivered' || progress === 'Failed') return 'done'
  if (DELIVER_STAGES.has(progress)) return 'deliver'
  return 'collect'
}

type Role = 'danger' | 'warning' | 'neutral'
type KebabMode = 'menu' | 'note' | 'eta'

interface QItem {
  job: SavedJob; cust?: Customer
  stage: 'collect' | 'deliver'; verb: 'Collect' | 'Deliver'
  due: string; delta: number; pc: string
  collPc: string; collDue: string
  delPc: string; delDue: string
  collStop?: Stop; delStop?: Stop
  noDriver: boolean; isOnSite: boolean
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
  const pc = stage === 'collect' ? collPc : delPc

  const collDueMin = BASE_NOW + ((hashRef(job.ref + 'collect') % 190) - 90)
  const delDueMin = BASE_NOW + ((hashRef(job.ref + 'deliver') % 190) - 90)
  const collDue = fmtTime(collDueMin)
  const delDue = fmtTime(delDueMin)
  const dueMin = stage === 'collect' ? collDueMin : delDueMin
  const due = stage === 'collect' ? collDue : delDue
  const delta = dueMin - nowMin

  const onSite = (stage === 'collect' && job.progress === 'On site COL') ||
                 (stage === 'deliver' && job.progress === 'On site DEL')
  const onSiteMin = onSite ? 22 + (hashRef(job.ref) % 30) : 0
  const noDriver = !job.supplierName
  const stalled = onSite && onSiteMin >= cfg.stallMin
  const legIcon = stage === 'collect' ? 'arrow-up-right' : 'flag'
  const tie = (stage === 'deliver' && cfg.collectionsFirst) ? 0.4 : 0

  let role: Role, pill: string, num: string, qual: string, sortKey: number
  let cue: string | undefined

  if (noDriver && cfg.unassignedDanger) {
    const absMin = Math.abs(delta)
    const timeDesc = delta < 0 ? `${absMin} min ago` : `in ${absMin} min`
    role = 'danger'; pill = 'No driver'
    cue = `${verb} due ${fmtTime(dueMin)} — ${timeDesc}`
    num = `${absMin}m`; qual = delta < 0 ? 'overdue' : 'to collect'
    sortKey = BAND_NODRIVER + delta
  } else if (delta < 0 && stage === 'collect') {
    role = 'danger'; pill = 'Collect overdue'
    cue = `Was due ${fmtTime(dueMin)} · ${-delta} min ago`
    num = `${-delta}m`; qual = 'late'; sortKey = BAND_OV_COLLECT + delta
  } else if (delta < 0) {
    role = 'danger'; pill = 'Deliver overdue'
    cue = `Was due ${fmtTime(dueMin)} · ${-delta} min ago`
    num = `${-delta}m`; qual = 'late'; sortKey = BAND_OV_DELIVER + delta
  } else if (stalled) {
    const arrivedAt = fmtTime(BASE_NOW - onSiteMin)
    role = 'danger'; pill = 'Stalled'
    cue = `Arrived ~${arrivedAt} · on site ${onSiteMin} min`
    num = `${onSiteMin}m`; qual = 'on site'
    sortKey = BAND_STALLED - (cfg.longestStallFirst ? onSiteMin : 0)
  } else if (delta <= cfg.dueNowMin) {
    role = 'warning'; pill = `${verb} due now`
    num = `${delta}m`; qual = 'to go'; sortKey = delta + tie
  } else if (delta <= cfg.dueSoonMin) {
    role = 'warning'; pill = `${verb} due soon`
    num = `${delta}m`; qual = 'to go'; sortKey = delta + tie
  } else {
    role = 'neutral'; pill = 'Upcoming'
    num = `${delta}m`; qual = 'to go'
    sortKey = delta > 0 ? delta + tie : MISSING_ETA_RANK
  }

  return {
    job, cust, stage, verb, due, delta, pc,
    collPc, collDue, delPc, delDue, collStop, delStop,
    noDriver, isOnSite: onSite,
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
  const [etaText, setEtaText] = useState('')
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
  const closeKebab = () => { setKebab(null); setKebabMode('menu'); setNoteText(''); setEtaText('') }
  const openKebab = (id: string) => {
    if (kebab === id) { closeKebab(); return }
    setKebab(id); setKebabMode('menu'); setNoteText(''); setEtaText('')
  }
  const snoozeJob = (id: string, note: string) => {
    if (note.trim()) addReceipt(id, note.trim())
    addReceipt(id, `Snoozed — retry ${fmtTime(nowMin + 5)}`)
    setSnoozed(s => ({ ...s, [id]: nowMin + 5 }))
    closeKebab()
  }
  const saveEta = (it: QItem, eta: string) => {
    if (eta) { setEta(it.job.id, it.stage, eta); addReceipt(it.job.id, `ETA → ${eta}`) }
    closeKebab()
  }

  const isExpanded = density === 'expanded'
  // compact: 7 cols · expanded: 10 cols
  const colSpan = isExpanded ? 10 : 7

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

  return (
    <div className={`pq${isExpanded ? '' : ' pq-cmp'}`}>
      <div className="pqt-scroll">
        <table className={`pqt${isExpanded ? ' pqt-exp' : ' pqt-cmp'}`}>
          <thead>
            <tr>
              <th>Due</th>
              <th>Status</th>
              {isExpanded ? (
                <>
                  <th>Job</th>
                  <th><span className="pqt-th-col">COL</span> Postcode</th>
                  <th><span className="pqt-th-col">COL</span> ETA</th>
                  <th><span className="pqt-th-del">DEL</span> Postcode</th>
                  <th><span className="pqt-th-del">DEL</span> ETA</th>
                  <th>Vehicle</th>
                </>
              ) : (
                <>
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
              const isAlert = it.role !== 'neutral'
              const rowClass = [
                isSnoozed ? 'pqt-snoozed' : '',
                !isSnoozed && (isPending ? 'pending' : isAlert ? `alert role-${it.role}` : ''),
              ].filter(Boolean).join(' ')

              // Derive consistent 4-slot action buttons
              const secondaryLabel = it.noDriver ? 'Find driver' : 'On site'
              const secondaryVisible = it.noDriver || !it.isOnSite
              const primaryLabel = it.noDriver
                ? 'Post job'
                : it.stage === 'collect' ? 'Mark collected' : 'Mark delivered'
              const primaryAction = it.noDriver
                ? () => { console.log('[TODO] Post job', id); addReceipt(id, 'Job posted') }
                : () => markActioned(id)
              const secondaryAction = it.noDriver
                ? () => { console.log('[TODO] Find driver', id) }
                : () => markOnSite(it)

              const stopCell = (stop: Stop | undefined, pc: string, due: string) => (
                <td className="pq-cmp-stop">
                  {stop
                    ? <button className="route-pt pc" onClick={(e) => openPop(e, addressNode(stop))}>{pc}</button>
                    : <span className="pc muted">{pc}</span>}
                  <span className="pq-eta">{due}</span>
                </td>
              )

              return (
                <Fragment key={id}>
                  <tr className={rowClass} onDoubleClick={() => openJob(it.job)} style={{ cursor: 'pointer' }}>

                    {/* Due */}
                    <td className="pqt-due">
                      <b>{it.num}</b>
                      <span>{it.qual}</span>
                    </td>

                    {/* Status */}
                    <td className="pqt-status">
                      {isSnoozed
                        ? <span className="pqt-pill role-snoozed"><Icon name="clock" size={11} /> Snoozed · {fmtTime(snoozed[id])}</span>
                        : isPending
                          ? <span className="pqt-pill role-pending"><span className="pqt-dot" />{it.stage === 'collect' ? 'Collected' : 'Delivered'} {pending[id]}</span>
                          : <span className={`pqt-pill role-${it.role}`}><span className="pqt-dot" />{it.pill}</span>}
                      {!isPending && !isSnoozed && it.cue && <div className="pqt-cue">{it.cue}</div>}
                      {rcpts.length > 0 && <div className="pqt-rcpt">{rcpts[rcpts.length - 1]}</div>}
                    </td>

                    {isExpanded ? (
                      <>
                        {/* Job */}
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
                        <td className="pqt-stop-time"><b>{it.collDue}</b></td>
                        <td className="pqt-stop">
                          {it.delStop
                            ? <button className="route-pt pc" onClick={(e) => openPop(e, addressNode(it.delStop!))}>{it.delPc}</button>
                            : <span className="pc muted">{it.delPc}</span>}
                        </td>
                        <td className="pqt-stop-time"><b>{it.delDue}</b></td>
                        <td className="pqt-veh">{it.job.vehicle || <span className="muted">—</span>}</td>
                      </>
                    ) : (
                      <>
                        {/* Compact: customer cell — mirrors standard cmp-cust */}
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
                        {/* COL stop */}
                        {stopCell(it.collStop, it.collPc, it.collDue)}
                        {/* DEL stop */}
                        {stopCell(it.delStop, it.delPc, it.delDue)}
                      </>
                    )}

                    {/* Driver */}
                    <td className={`pqt-driver${driver ? '' : ' muted'}`}>{driver ?? 'Unassigned'}</td>

                    {/* Actions — always 4 fixed slots */}
                    <td className="pqt-act" onClick={e => e.stopPropagation()}>
                      <div className="pqt-act-inner">
                        {isPending ? (
                          <>
                            <button className="btn primary sm pq-act-primary" onClick={() => confirmAction(it)}>Confirm</button>
                            <button className="btn sm pq-act-sec" onClick={() => undo(id)}>Undo</button>
                            <span className="pq-act-icon" />
                            <span className="pq-act-icon" />
                          </>
                        ) : (
                          <>
                            <button
                              className="btn sm pq-act-sec"
                              style={{ visibility: secondaryVisible ? 'visible' : 'hidden' }}
                              onClick={secondaryAction}
                            >
                              {secondaryLabel}
                            </button>
                            <button className="btn primary sm pq-act-primary" onClick={primaryAction}>
                              {primaryLabel}
                            </button>
                            <button
                              className="pq-act-icon"
                              disabled={it.noDriver}
                              title={it.noDriver ? 'No driver assigned' : `Call ${driver}`}
                              onClick={() => { addReceipt(id, `Called ${fmtTime(nowMin)}`); console.log('[TODO] Aircall', driver) }}
                            >
                              <Icon name="phone" size={14} />
                            </button>
                            <button
                              className="pq-act-icon"
                              title="More actions"
                              onClick={(e) => { e.stopPropagation(); openKebab(id) }}
                            >
                              <Icon name="more" size={14} />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>

                  {/* Kebab row */}
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
                          ) : kebabMode === 'eta' ? (
                            <div className="pqt-kebab-form">
                              <label className="pqt-kebab-label">{it.stage === 'collect' ? 'Collection' : 'Delivery'} ETA</label>
                              <div className="pqt-kebab-form-row">
                                <input
                                  type="time"
                                  className="pqt-eta-input"
                                  value={etaText}
                                  onChange={e => setEtaText(e.target.value)}
                                  autoFocus
                                />
                                <button className="btn primary sm" onClick={() => saveEta(it, etaText)} disabled={!etaText}>Save ETA</button>
                                <button className="btn sm" onClick={() => { setKebabMode('menu'); setEtaText('') }}>Cancel</button>
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
                              <KebabBtn icon="clock" label="Update ETA" onClick={() => setKebabMode('eta')} />
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
