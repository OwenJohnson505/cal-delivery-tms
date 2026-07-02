/**
 * Filter store — the PER-USER, persisted configuration for the bookings toolbar's chip
 * filters: which filters are pinned as chips, saved option-set presets within a single
 * filter, and saved views (whole filter combinations). Backed by localStorage (same
 * pattern uiStore uses for tableDensity).
 *
 * The APPLIED filter values are NOT here — they are ephemeral React state in ListScreen
 * (like colFilters), reset on reload. This store only holds the reusable config.
 */
import { create } from 'zustand'

/** Stable ids for the seven chip filters. */
export type FilterId = 'sales' | 'late' | 'team' | 'customer' | 'collregion' | 'delregion' | 'vehicle'

/** A saved option-set within ONE filter (click to tick the lot). */
export interface FilterPreset {
  name: string
  vals: string[]
}
/** A saved VIEW = a whole combination of filters applied together. */
export interface SavedView {
  name: string
  f: Partial<Record<FilterId, string[]>>
}

interface FilterConfig {
  pinned: FilterId[]
  presets: Partial<Record<FilterId, FilterPreset[]>>
  views: SavedView[]
}

interface FilterState extends FilterConfig {
  setPinned(pinned: FilterId[]): void
  addPreset(filterId: FilterId, preset: FilterPreset): void
  deletePreset(filterId: FilterId, index: number): void
  addView(view: SavedView): void
  deleteView(index: number): void
}

const KEY = 'cd-bk-filters-v1'

const DEFAULTS: FilterConfig = {
  pinned: ['sales', 'late', 'customer', 'vehicle', 'collregion'],
  presets: {
    sales: [{ name: 'My team', vals: ['Sarah Doyle', 'James Hill'] }],
    late: [{ name: 'Anything late', vals: ['Late collection', 'Late delivery'] }],
    vehicle: [{ name: 'Heavies', vals: ['18t', '26t', 'Artic'] }],
  },
  views: [
    { name: 'My late jobs', f: { sales: ['Sarah Doyle'], late: ['Late collection', 'Late delivery'] } },
    { name: 'Heavies', f: { vehicle: ['18t', '26t', 'Artic'] } },
  ],
}

function load(): FilterConfig {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return DEFAULTS
    const parsed = JSON.parse(raw) as Partial<FilterConfig>
    return {
      pinned: parsed.pinned ?? DEFAULTS.pinned,
      presets: parsed.presets ?? DEFAULTS.presets,
      views: parsed.views ?? DEFAULTS.views,
    }
  } catch {
    return DEFAULTS
  }
}

function persist(cfg: FilterConfig): void {
  try { localStorage.setItem(KEY, JSON.stringify(cfg)) } catch { /* ignore */ }
}

export const useFilterStore = create<FilterState>((set, get) => ({
  ...load(),

  setPinned: (pinned) => {
    set({ pinned })
    const s = get()
    persist({ pinned, presets: s.presets, views: s.views })
  },

  addPreset: (filterId, preset) =>
    set((s) => {
      const list = [...(s.presets[filterId] ?? []), preset]
      const presets = { ...s.presets, [filterId]: list }
      persist({ pinned: s.pinned, presets, views: s.views })
      return { presets }
    }),

  deletePreset: (filterId, index) =>
    set((s) => {
      const list = (s.presets[filterId] ?? []).filter((_, i) => i !== index)
      const presets = { ...s.presets, [filterId]: list }
      persist({ pinned: s.pinned, presets, views: s.views })
      return { presets }
    }),

  addView: (view) =>
    set((s) => {
      const views = [...s.views, view]
      persist({ pinned: s.pinned, presets: s.presets, views })
      return { views }
    }),

  deleteView: (index) =>
    set((s) => {
      const views = s.views.filter((_, i) => i !== index)
      persist({ pinned: s.pinned, presets: s.presets, views })
      return { views }
    }),
}))
