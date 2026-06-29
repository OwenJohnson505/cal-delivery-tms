/**
 * PriorityQueue — the "Admins" saved view. One merged, time-ranked list of each active
 * job's next outstanding leg (collect OR deliver), interpreted into a stated situation +
 * recommended action, with a confirm-before-resort workflow. Implements the Priority Queue
 * View spec (§4 ranking, §5 situations, §6 row anatomy, §9 confirm workflow). All timing is
 * a design mock driven by usePriorityStore thresholds; status writes go back via jobsStore.
 */
import { useEffect, useState, type ReactNode } from 'react'
import { Icon } from '@/app/Icon.tsx'
import { useJobsStore, type SavedJob } from '@/store/jobsStore.ts'
import { useCustomersStore, type Customer } from '@/store/customersStore.ts'
import { useViewStore } from '@/store/viewStore.ts'
import { usePriorityStore, type PriorityConfig } from '@/store/priorityStore.ts'

const fmtTime = (min: number): string => `${String(Math.floor((min % 1440 + 1440) % 1440 / 60)).padStart(2, '0')}:${String((min % 60 + 60) % 60).padStart(2, '0')}`
const hashRef = (s: string): number => { let h = 0; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0; return h }
const BASE_NOW = 9 * 60 + 20 // mock "now" = 09:20

const DELIVER_STAGES = new Set(['Collected', 'Part COL', 'En route DEL', 'On site DEL', 'Part DEL'])
function stageOf(progress: string): 'collect' | 'deliver' | 'done' {
  if (progress === 'Delivered' || progress === 'Failed') return 'done'
  if (DELIVER_STAGES.has(progress)) return 'deliver'
  return 'collect'
}

type Role = 'danger' | 'warning' | 'neutral'
interface QItem {
  job: SavedJob; cust?: Customer
  stage: 'collect' | 'deliver'; verb: 'Collect' | 'Deliver'
  due: string; delta: number; onSiteMin: number; pc: string
  role: Role; icon: string; legIcon: string; headline: string; cue?: string
  token: string; tokenSub: string; sortKey: number
}

function buildItem(job: SavedJob, cust: Customer | undefined, nowMin: number, cfg: PriorityConfig): QItem {
  const stage = stageOf(job.progress) as 'collect' | 'deliver'
  const verb = stage === 'collect' ? 'Collect' : 'Deliver'
  const stops = job.snapshot.stops
  const stop = stage === 'collect'
    ? stops.find((s) => s.type === 'Collection' || s.type === 'Both')
    : [...stops].reverse().find((s) => s.type === 'Delivery' || s.type === 'Both')
  const pc = stop?.addr.pc || '—'
  // Synthetic "live" due time clustered around now — the seed's absolute times span the
  // whole day, which would not make a believable single-moment queue. Deterministic per job.
  const dueMin = BASE_NOW + ((hashRef(job.ref + stage) % 190) - 90)
  const due = fmtTime(dueMin)
  const delta = dueMin - nowMin
  const onSite = (stage === 'collect' && job.progress === 'On site COL') || (stage === 'deliver' && job.progress === 'On site DEL')
  const onSiteMin = onSite ? 22 + (hashRef(job.ref) % 30) : 0
  const noDriver = !job.supplierName
  const stalled = onSite && onSiteMin >= cfg.stallMin
  const legIcon = stage === 'collect' ? 'arrow-up-right' : 'flag'
  const tie = (stage === 'deliver' && cfg.collectionsFirst) ? 0.4 : 0

  let role: Role, icon: string, headline: string, token: string, tokenSub: string, sortKey: number
  let cue: string | undefined
  if (stalled) {
    role = 'danger'; icon = 'alert-triangle'; headline = `Stalled on site ${onSiteMin} min`
    cue = 'Likely not marked collected — confirm or chase driver'
    token = `${onSiteMin}m`; tokenSub = 'on site'
    sortKey = -9999 - (cfg.longestStallFirst ? onSiteMin : 0)
  } else if (noDriver && cfg.unassignedDanger) {
    role = 'danger'; icon = 'user-x'; headline = 'No driver assigned'
    cue = `${verb} due ${due} — assign a driver now`
    token = `${Math.abs(delta)}m`; tokenSub = stage === 'collect' ? 'to collect' : 'to deliver'
    sortKey = delta + tie
  } else if (delta < 0) {
    role = 'danger'; icon = 'clock'; headline = `${verb} overdue ${-delta} min`
    cue = 'Driver running behind — chase for an ETA'
    token = `${-delta}m`; tokenSub = 'late'; sortKey = delta + tie
  } else if (delta <= cfg.dueNowMin) {
    role = 'warning'; icon = legIcon; headline = `${verb} due now`
    token = `${delta}m`; tokenSub = 'to go'; sortKey = delta + tie
  } else if (delta <= cfg.dueSoonMin) {
    role = 'warning'; icon = legIcon; headline = `${verb} due in ${delta} min`
    token = `${delta}m`; tokenSub = 'to go'; sortKey = delta + tie
  } else {
    role = 'neutral'; icon = legIcon; headline = `${verb} in ${delta} min`
    token = `${delta}m`; tokenSub = 'to go'; sortKey = delta + tie
  }
  return { job, cust, stage, verb, due, delta, onSiteMin, pc, role, icon, legIcon, headline, cue, token, tokenSub, sortKey }
}

export function PriorityQueue({ jobs }: { jobs: SavedJob[] }) {
  const customers = useCustomersStore((s) => s.customers)
  const setProgress = useJobsStore((s) => s.setProgress)
  const cfg = usePriorityStore((s) => s.config)
  const go = useViewStore((s) => s.go)

  const [nowMin, setNowMin] = useState(BASE_NOW) // mock "now", ticks forward each refresh
  const [pending, setPending] = useState<Record<string, string>>({}) // jobId -> committed-at HH:MM
  const [receipts, setReceipts] = useState<Record<string, string[]>>({})
  const [kebab, setKebab] = useState<string | null>(null)

  useEffect(() => {
    const t = window.setInterval(() => setNowMin((n) => n + 1), Math.max(5, cfg.refreshSec) * 1000)
    return () => window.clearInterval(t)
  }, [cfg.refreshSec])

  const custById = (id?: string | null) => customers.find((c) => c.id === id)
  const active = jobs.filter((j) => stageOf(j.progress) !== 'done')
  const done = jobs.filter((j) => stageOf(j.progress) === 'done')

  // Build + sort. Sorting uses committed state only — a pending row keeps its computed key
  // (it isn't advanced yet), so it never jumps under the cursor.
  const items = active
    .map((j) => buildItem(j, custById(j.snapshot.book.cust), nowMin, cfg))
    .sort((a, b) => a.sortKey - b.sortKey)

  const addReceipt = (id: string, text: string) => setReceipts((r) => ({ ...r, [id]: [...(r[id] ?? []), text] }))
  const markActioned = (id: string) => setPending((p) => ({ ...p, [id]: fmtTime(nowMin) }))
  const undo = (id: string) => setPending((p) => { const n = { ...p }; delete n[id]; return n })
  const confirm = (it: QItem) => {
    undo(it.job.id)
    setProgress(it.job.id, it.stage === 'collect' ? 'Collected' : 'Delivered') // write-back, advances the leg
  }
  const pendingIds = Object.keys(pending)

  return (
    <div className="pq">
      <div className="pq-head">
        <span className="pq-title"><span className="pq-accent" /> Admin priority queue</span>
        <span className="db-spacer" />
        {pendingIds.length > 0 && (
          <button className="pq-confirmall" onClick={() => items.filter((it) => pending[it.job.id]).forEach(confirm)}>Confirm all actioned ({pendingIds.length})</button>
        )}
        <button className="pq-settings" title="Priority list settings" onClick={() => go('priority')}><Icon name="sliders" size={14} /> Priority list</button>
        <span className="pq-live"><span className="pq-live-dot" /> Live · now {fmtTime(nowMin)}</span>
      </div>

      <div className="pq-list">
        {items.map((it) => {
          const id = it.job.id
          const isPending = !!pending[id]
          const rcpts = receipts[id] ?? []
          const driver = it.job.supplierName || 'Unassigned'
          return (
            <div key={id} className={'pq-row role-' + it.role + (isPending ? ' pending' : '')}>
              <span className="pq-bar" />
              <span className="pq-token"><b>{it.token}</b><span>{it.tokenSub}</span></span>
              <div className="pq-mid">
                <div className="pq-headline">
                  <Icon name={isPending ? 'check-circle' : it.icon} size={16} />
                  <b>{it.headline}</b>
                  <span className="pq-cust">· {it.cust?.displayName || it.job.customer}</span>
                  <span className="pc pq-pc">{it.pc}</span>
                  {it.due && <span className="pq-eta">ETA {it.due}</span>}
                </div>
                {isPending
                  ? <div className="pq-cue green">{it.stage === 'collect' ? 'Collected' : 'Delivered'} {pending[id]} — awaiting your confirm</div>
                  : it.cue && <div className="pq-cue">{it.cue}</div>}
                <div className="pq-support">
                  <Icon name={it.job.supplierName ? 'user' : 'user-x'} size={12} /> {driver} · {it.job.vehicle || '—'} · ETA {it.due || 'TBC'} · Last: {it.job.progress || 'Booked'}
                  {rcpts.map((r) => <span key={r} className="pq-receipt"> · {r}</span>)}
                </div>
              </div>
              <div className="pq-actions">
                {isPending ? (
                  <>
                    <button className="btn primary sm" onClick={() => confirm(it)}>Confirm &amp; clear</button>
                    <button className="btn sm" onClick={() => undo(id)}>Undo</button>
                  </>
                ) : (
                  <>
                    <button className="btn primary sm pq-primary" onClick={() => markActioned(id)}>{it.stage === 'collect' ? 'Mark collected' : 'Mark delivered'}</button>
                    <button className="pq-icon" title={`Call ${driver}`} onClick={() => addReceipt(id, `Called ${fmtTime(nowMin)}`)}><Icon name="phone" size={15} /></button>
                    <button className="pq-icon" title="More actions" onClick={() => setKebab(kebab === id ? null : id)}>⋯</button>
                  </>
                )}
              </div>
              {kebab === id && !isPending && (
                <div className="pq-kebab">
                  <KebabBtn icon="phone" label="Ring driver" onClick={() => { addReceipt(id, `Called ${fmtTime(nowMin)}`); setKebab(null) }} />
                  <KebabBtn icon="mail" label="Update customer" onClick={() => { addReceipt(id, `Customer updated ${fmtTime(nowMin)}`); setKebab(null) }} />
                  <KebabBtn icon="truck" label="Reassign driver" onClick={() => { window.alert('Reassign → hands off to the allocator (mock).'); setKebab(null) }} />
                  <KebabBtn icon="note" label="Add note" onClick={() => { addReceipt(id, 'Note added'); setKebab(null) }} />
                </div>
              )}
            </div>
          )
        })}
        {!items.length && <div className="pq-empty">Nothing outstanding — all jobs are on track.</div>}
      </div>

      <div className="pq-done-h"><Icon name="check" size={13} /> Completed — {done.length} job{done.length === 1 ? '' : 's'}</div>
      {done.map((j) => (
        <div key={j.id} className="pq-done-row">
          <Icon name="check-circle" size={15} />
          <span className="pq-done-cust">{custById(j.snapshot.book.cust)?.displayName || j.customer}</span>
          <span className="pc pq-done-ref">{j.ref}</span>
          <span className="db-spacer" />
          <span className="pq-done-when">{j.progress === 'Failed' ? 'Failed' : `Delivered ${(j.deliverEta || j.deliverAt).split(' ').pop() || ''}`}</span>
        </div>
      ))}
    </div>
  )
}

function KebabBtn({ icon, label, onClick }: { icon: string; label: string; onClick: () => void }) {
  return <button className="pq-kebab-btn" onClick={onClick}><Icon name={icon} size={14} /> {label as ReactNode}</button>
}
