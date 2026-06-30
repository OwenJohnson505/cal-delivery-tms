/**
 * PriorityQueue — the "Admins" saved view as a dense single TABLE.
 * Two density modes:
 *   Compact  (6 cols): Due · Status · Job · Stop (current leg, COL/DEL labelled) · Driver · Actions
 *   Expanded (8 cols): Due · Status · Job (+ route) · Collection · Delivery · Vehicle · Driver · Actions
 * Priority order: 1. No driver  2. Overdue collect  3. Overdue deliver  4. Stalled  5. Upcoming
 */
import { Fragment, useEffect, useState, type ReactNode } from 'react'
import { Icon } from '@/app/Icon.tsx'
import { useJobsStore, type SavedJob } from '@/store/jobsStore.ts'
import { useCustomersStore, type Customer } from '@/store/customersStore.ts'
import { useViewStore } from '@/store/viewStore.ts'
import { usePriorityStore, type PriorityConfig } from '@/store/priorityStore.ts'

// ── Config ───────────────────────────────────────────────────────────────────
const MISSING_ETA_RANK = 999
// Priority bands — clear gaps ensure categories never interleave.
// Order: 1. no driver  2. overdue collect  3. overdue deliver  4. stalled  5. upcoming
const BAND_NODRIVER   = -100000
const BAND_OV_COLLECT =  -10000
const BAND_OV_DELIVER =   -5000
const BAND_STALLED    =   -2000

const fmtTime = (min: number): string =>
  `${String(Math.floor(((min % 1440) + 1440) % 1440 / 60)).padStart(2, '0')}:${String(((min % 60) + 60) % 60).padStart(2, '0')}`
const hashRef = (s: string): number => { let h = 0; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0; return h }
const BASE_NOW = 9 * 60 + 20 // mock "now" = 09:20

// ── Stage classification ──────────────────────────────────────────────────────
const DELIVER_STAGES = new Set(['Collected', 'Part COL', 'En route DEL', 'On site DEL', 'Part DEL'])
function stageOf(progress: string): 'collect' | 'deliver' | 'done' {
  if (progress === 'Delivered' || progress === 'Failed') return 'done'
  if (DELIVER_STAGES.has(progress)) return 'deliver'
  return 'collect'
}

// ── Types ─────────────────────────────────────────────────────────────────────
type Role = 'danger' | 'warning' | 'neutral'
interface QItem {
  job: SavedJob; cust?: Customer
  stage: 'collect' | 'deliver'; verb: 'Collect' | 'Deliver'
  due: string; delta: number; pc: string
  collPc: string; collDue: string
  delPc: string; delDue: string
  role: Role; legIcon: string; pill: string; cue?: string
  num: string; qual: string; sortKey: number
}

// ── Build item + priority engine ──────────────────────────────────────────────
function buildItem(job: SavedJob, cust: Customer | undefined, nowMin: number, cfg: PriorityConfig): QItem {
  const stage = stageOf(job.progress) as 'collect' | 'deliver'
  const verb = stage === 'collect' ? 'Collect' : 'Deliver'
  const stops = job.snapshot.stops

  const collStop = stops.find(s => s.type === 'Collection' || s.type === 'Both')
  const delStop = [...stops].reverse().find(s => s.type === 'Delivery' || s.type === 'Both')
  const collPc = collStop?.addr.pc || '—'
  const delPc = delStop?.addr.pc || '—'
  const pc = stage === 'collect' ? collPc : delPc

  // Synthetic ETAs clustered around now — seed data spans the whole day so we use
  // deterministic per-job offsets to produce a believable single-moment queue
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
    // Priority 1: no driver — (a) when is the job due? (b) how far away?
    const absMin = Math.abs(delta)
    const timeDesc = delta < 0 ? `${absMin} min ago` : `in ${absMin} min`
    role = 'danger'; pill = 'No driver'
    cue = `${verb} due ${fmtTime(dueMin)} — ${timeDesc}`
    num = `${absMin}m`; qual = delta < 0 ? 'overdue' : 'to collect'
    sortKey = BAND_NODRIVER + delta
  } else if (delta < 0 && stage === 'collect') {
    // Priority 2: overdue collection
    role = 'danger'; pill = 'Collect overdue'
    cue = `Was due ${fmtTime(dueMin)} · ${-delta} min ago`
    num = `${-delta}m`; qual = 'late'; sortKey = BAND_OV_COLLECT + delta
  } else if (delta < 0) {
    // Priority 3: overdue delivery
    role = 'danger'; pill = 'Deliver overdue'
    cue = `Was due ${fmtTime(dueMin)} · ${-delta} min ago`
    num = `${-delta}m`; qual = 'late'; sortKey = BAND_OV_DELIVER + delta
  } else if (stalled) {
    // Priority 4: stalled — (a) when did driver arrive? (b) how long on site?
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

  return { job, cust, stage, verb, due, delta, pc, collPc, collDue, delPc, delDue, role, legIcon, pill, cue, num, qual, sortKey }
}

// ── Component ─────────────────────────────────────────────────────────────────
export function PriorityQueue({ jobs }: { jobs: SavedJob[] }) {
  const customers = useCustomersStore(s => s.customers)
  const setProgress = useJobsStore(s => s.setProgress)
  const cfg = usePriorityStore(s => s.config)
  const go = useViewStore(s => s.go)

  const [nowMin, setNowMin] = useState(BASE_NOW)
  const [density, setDensity] = useState<'compact' | 'expanded'>('compact')
  const [pending, setPending] = useState<Record<string, string>>({})
  const [receipts, setReceipts] = useState<Record<string, string[]>>({})
  const [kebab, setKebab] = useState<string | null>(null)

  useEffect(() => {
    const t = window.setInterval(() => setNowMin(n => n + 1), Math.max(5, cfg.refreshSec) * 1000)
    return () => window.clearInterval(t)
  }, [cfg.refreshSec])

  const custById = (id?: string | null) => customers.find(c => c.id === id)
  const active = jobs.filter(j => stageOf(j.progress) !== 'done')
  const done = jobs.filter(j => stageOf(j.progress) === 'done')
  const items = active.map(j => buildItem(j, custById(j.snapshot.book.cust), nowMin, cfg)).sort((a, b) => a.sortKey - b.sortKey)

  const addReceipt = (id: string, text: string) => setReceipts(r => ({ ...r, [id]: [...(r[id] ?? []), text] }))
  const markActioned = (id: string) => setPending(p => ({ ...p, [id]: fmtTime(nowMin) }))
  const undo = (id: string) => setPending(p => { const n = { ...p }; delete n[id]; return n })
  const confirm = (it: QItem) => {
    undo(it.job.id)
    // TODO: write-back to TMS/DMS
    setProgress(it.job.id, it.stage === 'collect' ? 'Collected' : 'Delivered')
  }
  const pendingIds = Object.keys(pending)
  const isExpanded = density === 'expanded'
  const colSpan = isExpanded ? 8 : 6

  return (
    <div className={`pq${isExpanded ? '' : ' pq-cmp'}`}>

      {/* ── Header ── */}
      <div className="pq-head">
        <span className="db-spacer" />
        {pendingIds.length > 0 && (
          <button className="pq-confirmall" onClick={() => items.filter(it => pending[it.job.id]).forEach(confirm)}>
            Confirm all actioned ({pendingIds.length})
          </button>
        )}
        <button className="pq-settings" title="Priority list settings" onClick={() => go('priority')}>
          <Icon name="sliders" size={14} /> Priority list
        </button>
        <span className="pq-live"><span className="pq-live-dot" /> Live · now {fmtTime(nowMin)}</span>
      </div>

      {/* ── Density toolbar ── */}
      <div className="pq-toolbar">
        <div className="viewtoggle" role="group" aria-label="Table density">
          <button className={'vt-btn vt-wide' + (!isExpanded ? ' on' : '')} onClick={() => setDensity('compact')}>Compact</button>
          <button className={'vt-btn vt-wide' + (isExpanded ? ' on' : '')} onClick={() => setDensity('expanded')}>Expanded</button>
        </div>
      </div>

      {/* ── Table ── */}
      <div className="pqt-scroll">
        <table className={`pqt${isExpanded ? ' pqt-exp' : ' pqt-cmp'}`}>
          <thead>
            <tr>
              <th>Due</th>
              <th>Status</th>
              <th>Job</th>
              {isExpanded ? (
                <>
                  <th><span className="pqt-th-col">COL</span> Postcode</th>
                  <th><span className="pqt-th-col">COL</span> ETA</th>
                  <th><span className="pqt-th-del">DEL</span> Postcode</th>
                  <th><span className="pqt-th-del">DEL</span> ETA</th>
                  <th>Vehicle</th>
                </>
              ) : (
                <th>Stop</th>
              )}
              <th>Driver</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {items.map(it => {
              const id = it.job.id
              const isPending = !!pending[id]
              const rcpts = receipts[id] ?? []
              const driver = it.job.supplierName || null
              const isAlert = it.role !== 'neutral'
              const rowClass = isPending ? 'pending' : isAlert ? `alert role-${it.role}` : ''

              return (
                <Fragment key={id}>
                  <tr className={rowClass}>

                    {/* Col 1: Due — primary scan target */}
                    <td className="pqt-due">
                      <b>{it.num}</b>
                      <span>{it.qual}</span>
                    </td>

                    {/* Col 2: Status — pill + cue + receipts */}
                    <td className="pqt-status">
                      {isPending
                        ? <span className="pqt-pill role-pending"><span className="pqt-dot" />{it.stage === 'collect' ? 'Collected' : 'Delivered'} {pending[id]} · confirm?</span>
                        : <span className={`pqt-pill role-${it.role}`}><span className="pqt-dot" />{it.pill}</span>}
                      {!isPending && it.cue && <div className="pqt-cue">{it.cue}</div>}
                      {rcpts.length > 0 && <div className="pqt-rcpt">{rcpts.join(' · ')}</div>}
                    </td>

                    {/* Col 3: Job — leg icon + customer + ref */}
                    <td>
                      <div className="pqt-job">
                        <span className={`pqt-leg leg-${it.stage}`}><Icon name={it.legIcon} size={13} /></span>
                        <div className="pqt-job-main">
                          <b>{it.cust?.displayName || it.job.customer}</b>
                          <span className="pqt-ref">{it.job.ref}</span>
                        </div>
                      </div>
                    </td>

                    {/* Cols 4–7 (expanded) or Col 4 (compact: current stop) */}
                    {isExpanded ? (
                      <>
                        <td className="pqt-stop"><span className="pc">{it.collPc}</span></td>
                        <td className="pqt-stop-time"><b>{it.collDue}</b></td>
                        <td className="pqt-stop"><span className="pc">{it.delPc}</span></td>
                        <td className="pqt-stop-time"><b>{it.delDue}</b></td>
                        <td className="pqt-veh">{it.job.vehicle || <span className="muted">—</span>}</td>
                      </>
                    ) : (
                      <td className="pqt-stop">
                        <span className="pc">{it.pc}</span>
                        <div className="pqt-stop-eta">{it.due}</div>
                      </td>
                    )}

                    {/* Driver */}
                    <td className={driver ? '' : 'muted'}>{driver ?? 'Unassigned'}</td>

                    {/* Actions */}
                    <td className="pqt-act">
                      <div className="pqt-act-inner">
                        {isPending ? (
                          <>
                            <button className="btn primary sm" onClick={() => confirm(it)}>Confirm</button>
                            <button className="btn sm" onClick={() => undo(id)}>Undo</button>
                          </>
                        ) : (
                          <>
                            <button className="btn primary sm pq-primary" onClick={() => markActioned(id)}>
                              {it.stage === 'collect' ? 'Mark collected' : 'Mark delivered'}
                            </button>
                            <button className="pq-icon" title={`Call ${driver ?? 'driver'}`} onClick={() => {
                              // TODO: Aircall click-to-call via driver.phone
                              console.log('[TODO] Aircall call', it.job.supplierName)
                              addReceipt(id, `Called ${fmtTime(nowMin)}`)
                            }}>
                              <Icon name="phone" size={14} />
                            </button>
                            <button className="pq-icon" title="More actions" onClick={() => setKebab(kebab === id ? null : id)}>⋯</button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>

                  {/* Inline kebab — spans all columns */}
                  {kebab === id && !isPending && (
                    <tr className="pqt-kebab-row">
                      <td colSpan={colSpan}>
                        <div className="pqt-kebab">
                          <KebabBtn icon="phone" label="Ring driver" onClick={() => {
                            // TODO: Aircall click-to-call
                            console.log('[TODO] Aircall call', it.job.supplierName)
                            addReceipt(id, `Called ${fmtTime(nowMin)}`); setKebab(null)
                          }} />
                          <KebabBtn icon="mail" label="Update customer" onClick={() => {
                            // TODO: Front — open drafted ETA message
                            console.log('[TODO] Front draft ETA', it.job.ref)
                            addReceipt(id, `Customer updated ${fmtTime(nowMin)}`); setKebab(null)
                          }} />
                          <KebabBtn icon="truck" label="Reassign driver" onClick={() => {
                            // TODO: Driver Base allocator handoff
                            console.log('[TODO] Driver Base reassign', it.job.ref)
                            setKebab(null)
                          }} />
                          <KebabBtn icon="note" label="Add note" onClick={() => {
                            // TODO: append note to job
                            console.log('[TODO] Add note', it.job.ref)
                            addReceipt(id, 'Note added'); setKebab(null)
                          }} />
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

      {/* ── Completed ── */}
      <div className="pq-done-wrap">
        <div className="pq-done-h"><Icon name="check" size={13} /> Completed — {done.length} job{done.length === 1 ? '' : 's'}</div>
        {done.map(j => (
          <div key={j.id} className="pq-done-row">
            <Icon name="check-circle" size={15} />
            <span className="pq-done-cust">{custById(j.snapshot.book.cust)?.displayName || j.customer}</span>
            <span className="pc pq-done-ref">{j.ref}</span>
            <span className="db-spacer" />
            <span className="pq-done-when">{j.progress === 'Failed' ? 'Failed' : `Delivered ${(j.deliverEta || j.deliverAt || '').split(' ').pop() || ''}`}</span>
          </div>
        ))}
      </div>
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
