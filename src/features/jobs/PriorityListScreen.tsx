/**
 * PriorityListScreen — Settings → Priority List. Configures the logic behind the Admin
 * priority-queue view: the timing thresholds that define the situation bands, and the
 * tie-break rules that decide ordering when timings are equal (e.g. is a late collection
 * higher priority than a late delivery). Persisted via usePriorityStore.
 */
import { Icon } from '@/app/Icon.tsx'
import { useViewStore } from '@/store/viewStore.ts'
import { usePriorityStore, PRIORITY_DEFAULTS, type PriorityConfig } from '@/store/priorityStore.ts'

function Toggle({ on, onChange }: { on: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="cm-toggle pl-toggle">
      <input type="checkbox" checked={on} onChange={(e) => onChange(e.target.checked)} />
      <span className="cm-track"><span className="cm-knob" /></span>
    </label>
  )
}

function NumRow({ label, hint, unit, value, onChange, min, max }: {
  label: string; hint: string; unit: string; value: number; onChange: (v: number) => void; min: number; max: number
}) {
  return (
    <div className="pl-row">
      <div className="pl-row-main"><div className="pl-row-lbl">{label}</div><div className="pl-row-hint">{hint}</div></div>
      <div className="pl-num">
        <input type="number" min={min} max={max} value={value} onChange={(e) => onChange(Math.max(min, Math.min(max, Number(e.target.value) || 0)))} />
        <span>{unit}</span>
      </div>
    </div>
  )
}

function RuleRow({ label, hint, on, onChange }: { label: string; hint: string; on: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="pl-row">
      <div className="pl-row-main"><div className="pl-row-lbl">{label}</div><div className="pl-row-hint">{hint}</div></div>
      <Toggle on={on} onChange={onChange} />
    </div>
  )
}

export function PriorityListScreen() {
  const config = usePriorityStore((s) => s.config)
  const setConfig = usePriorityStore((s) => s.setConfig)
  const reset = usePriorityStore((s) => s.reset)
  const goToList = useViewStore((s) => s.goToList)
  const set = (patch: Partial<PriorityConfig>) => setConfig(patch)

  return (
    <div className="list-app">
      <div className="list-work">
        <div className="pl-head">
          <button className="cm-link" onClick={() => goToList()}>‹ Back to board</button>
          <span className="db-spacer" />
          <button className="cm-link" onClick={reset}>Reset to defaults</button>
        </div>
        <h1 className="pl-title"><Icon name="sliders" size={20} /> Priority list</h1>
        <p className="pl-sub">The rules behind the <b>Admins</b> view — the order admins work the board. Tune the bands that flag a job, and how ties are broken.</p>

        <div className="pl-card">
          <div className="pl-card-h">Timing thresholds</div>
          <NumRow label="Stalled on site after" hint="On-site minutes before a job is flagged as stalled (driver probably forgot to mark it)." unit="min" value={config.stallMin} onChange={(v) => set({ stallMin: v })} min={5} max={120} />
          <NumRow label="“Due now” window" hint="Within this many minutes of the due time, a job turns amber “due now”." unit="min" value={config.dueNowMin} onChange={(v) => set({ dueNowMin: v })} min={1} max={30} />
          <NumRow label="“Due soon” window" hint="Within this many minutes, a job shows amber “due in N min”. Beyond it stays quiet (grey)." unit="min" value={config.dueSoonMin} onChange={(v) => set({ dueSoonMin: v })} min={5} max={120} />
          <NumRow label="Refresh cadence" hint="How often the queue recomputes times and re-sorts." unit="sec" value={config.refreshSec} onChange={(v) => set({ refreshSec: v })} min={5} max={300} />
        </div>

        <div className="pl-card">
          <div className="pl-card-h">Ordering rules</div>
          <RuleRow label="Collections rank above deliveries on a tie" hint="When a collection and a delivery are due at the same time, work the collection first (a missed collection blocks the whole job). Turn off to treat them equally." on={config.collectionsFirst} onChange={(v) => set({ collectionsFirst: v })} />
          <RuleRow label="Longest stall first" hint="When several jobs are stalled on site, the one that has been frozen longest floats to the very top." on={config.longestStallFirst} onChange={(v) => set({ longestStallFirst: v })} />
          <RuleRow label="Unassigned jobs are always urgent" hint="A job with no driver is shown as a danger row regardless of how far away its ETA is — it can’t progress until allocated." on={config.unassignedDanger} onChange={(v) => set({ unassignedDanger: v })} />
        </div>

        <p className="pl-foot">Defaults: stall {PRIORITY_DEFAULTS.stallMin}m · due-now {PRIORITY_DEFAULTS.dueNowMin}m · due-soon {PRIORITY_DEFAULTS.dueSoonMin}m · refresh {PRIORITY_DEFAULTS.refreshSec}s.</p>
      </div>
    </div>
  )
}
