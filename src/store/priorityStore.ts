/**
 * Priority store — the configurable logic behind the Admin priority-queue view
 * (Settings → Priority List). Thresholds drive the situation bands; the tie-break flags
 * decide ordering when timings are equal. Persisted to localStorage. See the Priority
 * Queue View spec (§4 ranking, §5 situations, §12 parameters).
 */
import { create } from 'zustand'

export interface PriorityConfig {
  /** On-site minutes before a job counts as "stalled / probably not marked". */
  stallMin: number
  /** Upper bound (minutes) for the amber "due now" band. */
  dueNowMin: number
  /** Upper bound (minutes) for the amber "due soon" band. */
  dueSoonMin: number
  /** Background recompute / re-sort cadence (seconds). */
  refreshSec: number
  /** Tie-break: a collection outranks a delivery when their times are equal. */
  collectionsFirst: boolean
  /** Among stalled jobs, the longest time on site comes first. */
  longestStallFirst: boolean
  /** An unassigned (no-driver) job is always a danger row, regardless of timing. */
  unassignedDanger: boolean
}

export const PRIORITY_DEFAULTS: PriorityConfig = {
  stallMin: 20,
  dueNowMin: 5,
  dueSoonMin: 15,
  refreshSec: 30,
  collectionsFirst: true,
  longestStallFirst: true,
  unassignedDanger: true,
}

const KEY = 'cd-priority-config'
function load(): PriorityConfig {
  try { return { ...PRIORITY_DEFAULTS, ...JSON.parse(localStorage.getItem(KEY) || '{}') } } catch { return { ...PRIORITY_DEFAULTS } }
}

interface PriorityState {
  config: PriorityConfig
  setConfig(patch: Partial<PriorityConfig>): void
  reset(): void
}

export const usePriorityStore = create<PriorityState>((set, get) => ({
  config: load(),
  setConfig: (patch) => {
    const config = { ...get().config, ...patch }
    try { localStorage.setItem(KEY, JSON.stringify(config)) } catch { /* ignore */ }
    set({ config })
  },
  reset: () => {
    try { localStorage.removeItem(KEY) } catch { /* ignore */ }
    set({ config: { ...PRIORITY_DEFAULTS } })
  },
}))
