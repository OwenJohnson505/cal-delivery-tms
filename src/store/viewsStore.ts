/**
 * Views store — column configuration for the bookings list. Columns can be hidden and
 * reordered; configurations are saved as named "views". There are admin presets (shared,
 * pre-loaded for everyone) and user views (created on top). One view is the user's
 * personal default (applied on load).
 *
 * Temporary vs persisted: the live `columns` are a working copy — toggling/reordering
 * without saving is a TEMPORARY change that's lost on reload ("login"). Saving (Save as
 * view / Update view) and the default/active selection PERSIST to localStorage.
 */
import { create } from 'zustand'

/** Column key. Standard keys are catalogued in COLUMNS; per-customer custom-field
 * columns use dynamic `cf:job:<id>` / `cf:stop:<id>` keys handled outside this store. */
export type ColumnKey = string

export interface ColumnDef { key: ColumnKey; label: string }
export interface ColumnState { key: ColumnKey; visible: boolean }
export interface SavedView {
  id: string
  name: string
  columns: ColumnState[]
  /** Admin preset shared with everyone (not user-editable / deletable). */
  system?: boolean
  /** 'table' (default) = the configurable columns; 'priority' = the Admin priority queue. */
  layout?: 'table' | 'priority'
}

/** The full column catalogue — every data point on a booking — in default order. */
export const COLUMNS: ColumnDef[] = [
  // identity / status
  { key: 'customer', label: 'Customer' },
  { key: 'progress', label: 'Status' },
  { key: 'ourRef', label: 'Our ref' },
  { key: 'custRef', label: 'Customer ref' },
  { key: 'refAccepted', label: 'Ref OK' },
  { key: 'accountCode', label: 'Account code' },
  // timing
  { key: 'collection', label: 'Collection' },
  { key: 'delivery', label: 'Delivery' },
  { key: 'collectionEta', label: 'Coll ETA' },
  { key: 'deliveryEta', label: 'Del ETA' },
  // route
  { key: 'route', label: 'Route' },
  { key: 'stopCount', label: 'Stops' },
  // collection stop
  { key: 'collCompany', label: 'Collection company' },
  { key: 'collContact', label: 'Collection contact' },
  { key: 'collPhone', label: 'Collection phone' },
  { key: 'collRef', label: 'Collection ref' },
  { key: 'collPostcode', label: 'Coll PC' },
  { key: 'collCity', label: 'Collection city' },
  // delivery stop
  { key: 'delCompany', label: 'Delivery company' },
  { key: 'delContact', label: 'Delivery contact' },
  { key: 'delPhone', label: 'Delivery phone' },
  { key: 'delRef', label: 'Delivery ref' },
  { key: 'delPostcode', label: 'Del PC' },
  { key: 'delCity', label: 'Delivery city' },
  // goods / service
  { key: 'goods', label: 'Goods' },
  { key: 'vehicle', label: 'Vehicle' },
  { key: 'bodyType', label: 'Body type' },
  { key: 'equipment', label: 'Equipment' },
  { key: 'serviceType', label: 'Service type' },
  // supplier
  { key: 'supplier', label: 'Supplier' },
  { key: 'supplierPhone', label: 'Supplier phone' },
  { key: 'supplierEmail', label: 'Supplier email' },
  // money
  { key: 'revenue', label: 'Revenue' },
  { key: 'cost', label: 'Cost' },
  { key: 'margin', label: 'Margin' },
  // audit
  { key: 'actor', label: 'Booked / quoted by' },
  { key: 'created', label: 'Created' },
  { key: 'notes', label: 'Notes' },
]
const ALL_KEYS = COLUMNS.map((c) => c.key)
const CATALOGUE = new Set(ALL_KEYS)

/** Keep a view's columns covering the full catalogue: drop stale keys, append any
 * newly-added catalogue columns (hidden). So every data point is always toggleable. */
function reconcile(cols: ColumnState[]): ColumnState[] {
  const valid = cols.filter((c) => CATALOGUE.has(c.key))
  const have = new Set(valid.map((c) => c.key))
  const missing = ALL_KEYS.filter((k) => !have.has(k)).map((key) => ({ key, visible: false }))
  return [...valid, ...missing]
}

/** Build a view: the given keys visible (in that order), the rest appended hidden. */
function viewFrom(id: string, name: string, visible: ColumnKey[], system = true): SavedView {
  const rest = ALL_KEYS.filter((k) => !visible.includes(k))
  return {
    id, name, system,
    columns: [...visible.map((key) => ({ key, visible: true })), ...rest.map((key) => ({ key, visible: false }))],
  }
}

// Admin presets — pre-loaded for everyone (as if authored on an admin page).
const PRESETS: SavedView[] = [
  viewFrom('sys-standard', 'Standard', ['customer', 'ourRef', 'progress', 'vehicle', 'collPostcode', 'collection', 'collectionEta', 'delPostcode', 'delivery', 'deliveryEta', 'supplier', 'notes']),
  viewFrom('sys-financials', 'Financials', ['customer', 'progress', 'revenue', 'cost', 'margin', 'actor']),
  viewFrom('sys-operations', 'Operations', ['customer', 'ourRef', 'progress', 'vehicle', 'collPostcode', 'collection', 'collectionEta', 'delPostcode', 'delivery', 'deliveryEta', 'supplier', 'notes']),
  { ...viewFrom('sys-admins', 'Admins', ['customer', 'progress', 'collection', 'delivery', 'supplier']), layout: 'priority' },
]

const LS_KEY = 'cd-booking-views-v8' // bumped for the Admins (priority queue) view

interface Persisted {
  userViews: SavedView[]
  defaultViewId: string
  activeViewId: string
}
function load(): Persisted {
  const fallback: Persisted = { userViews: [], defaultViewId: 'sys-standard', activeViewId: 'sys-standard' }
  try {
    const raw = localStorage.getItem(LS_KEY)
    if (!raw) return fallback
    const p = JSON.parse(raw) as Partial<Persisted>
    return {
      userViews: Array.isArray(p.userViews) ? p.userViews : [],
      defaultViewId: p.defaultViewId || 'sys-standard',
      activeViewId: p.activeViewId || p.defaultViewId || 'sys-standard',
    }
  } catch {
    return fallback
  }
}
function save(p: Persisted) {
  try { localStorage.setItem(LS_KEY, JSON.stringify(p)) } catch { /* ignore */ }
}

const clone = (cols: ColumnState[]): ColumnState[] => cols.map((c) => ({ ...c }))

interface ViewsState {
  presets: SavedView[]
  userViews: SavedView[]
  activeViewId: string
  defaultViewId: string
  /** Working (effective) columns — temporary tweaks live here until saved. */
  columns: ColumnState[]
  /** True when the working columns differ from the active view (unsaved). */
  dirty: boolean

  allViews(): SavedView[]
  getView(id: string): SavedView | undefined
  applyView(id: string): void
  toggleColumn(key: ColumnKey): void
  moveColumn(from: number, to: number): void
  resetWorking(): void
  saveAsView(name: string): void
  updateActiveView(): void
  setDefault(id: string): void
  deleteView(id: string): void
}

function initial() {
  const p = load()
  const all = [...PRESETS, ...p.userViews]
  const active = all.find((v) => v.id === p.activeViewId) ?? all.find((v) => v.id === p.defaultViewId) ?? PRESETS[0]
  return { ...p, columns: reconcile(clone(active.columns)), activeViewId: active.id }
}

export const useViewsStore = create<ViewsState>((set, get) => {
  const init = initial()
  const persist = () => {
    const s = get()
    save({ userViews: s.userViews, defaultViewId: s.defaultViewId, activeViewId: s.activeViewId })
  }
  return {
    presets: PRESETS,
    userViews: init.userViews,
    activeViewId: init.activeViewId,
    defaultViewId: init.defaultViewId,
    columns: init.columns,
    dirty: false,

    allViews: () => [...get().presets, ...get().userViews],
    getView: (id) => get().allViews().find((v) => v.id === id),

    applyView: (id) => {
      const v = get().getView(id)
      if (!v) return
      set({ activeViewId: id, columns: reconcile(clone(v.columns)), dirty: false })
      persist()
    },

    toggleColumn: (key) =>
      set((s) => ({ columns: s.columns.map((c) => (c.key === key ? { ...c, visible: !c.visible } : c)), dirty: true })),

    moveColumn: (from, to) =>
      set((s) => {
        if (to < 0 || to >= s.columns.length) return {}
        const cols = clone(s.columns)
        const [m] = cols.splice(from, 1)
        cols.splice(to, 0, m)
        return { columns: cols, dirty: true }
      }),

    resetWorking: () => {
      const v = get().getView(get().activeViewId)
      if (v) set({ columns: reconcile(clone(v.columns)), dirty: false })
    },

    saveAsView: (name) => {
      const id = `usr-${crypto.randomUUID().slice(0, 8)}`
      const view: SavedView = { id, name: name.trim() || 'My view', columns: clone(get().columns), system: false }
      set((s) => ({ userViews: [...s.userViews, view], activeViewId: id, dirty: false }))
      persist()
    },

    updateActiveView: () => {
      const id = get().activeViewId
      const isUser = get().userViews.some((v) => v.id === id)
      if (!isUser) return // presets aren't user-editable
      set((s) => ({ userViews: s.userViews.map((v) => (v.id === id ? { ...v, columns: clone(s.columns) } : v)), dirty: false }))
      persist()
    },

    setDefault: (id) => { set({ defaultViewId: id }); persist() },

    deleteView: (id) =>
      set((s) => {
        if (!s.userViews.some((v) => v.id === id)) return {}
        const userViews = s.userViews.filter((v) => v.id !== id)
        const defaultViewId = s.defaultViewId === id ? 'sys-standard' : s.defaultViewId
        let { activeViewId, columns, dirty } = s
        if (activeViewId === id) {
          const fallback = [...s.presets, ...userViews].find((v) => v.id === defaultViewId) ?? s.presets[0]
          activeViewId = fallback.id
          columns = clone(fallback.columns)
          dirty = false
        }
        save({ userViews, defaultViewId, activeViewId })
        return { userViews, defaultViewId, activeViewId, columns, dirty }
      }),
  }
})
