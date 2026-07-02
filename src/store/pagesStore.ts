/**
 * Pages store — the iPhone-style home: customizable pages, each holding widgets on an
 * 8×6 grid, with page-specific quick-action tools. Persistent global tools live here too.
 *
 * Widgets are placed by (col,row) + span (w,h). The catalogue starts small — the current
 * app screens are seeded as widgets so nothing is unreachable; richer widgets come later.
 */
import { create } from 'zustand'

export const HOME_COLS = 8
export const HOME_ROWS = 6

export interface HWidget { id: string; type: string; col: number; row: number; w: number; h: number }
export interface HPage { id: string; name: string; icon: string; tools: string[]; widgets: HWidget[] }

let uid = 1
const nid = () => 'hw' + (uid++)
const mk = (type: string, col: number, row: number, w: number, h: number): HWidget => ({ id: nid(), type, col, row, w, h })

interface PagesState {
  pages: HPage[]
  active: number
  /** Global quick-action tools pinned to the bottom bar on every page. */
  pinnedTools: string[]
  setActive(i: number): void
  renamePage(i: number, name: string): void
  addPage(name: string, icon: string): void
  updatePage(i: number, name: string, icon: string): void
  deletePage(i: number): void
  setPageTools(i: number, tools: string[]): void
  togglePin(id: string): void
  addWidget(type: string, col: number, row: number, w: number, h: number): void
  removeWidget(id: string): void
}

export const usePagesStore = create<PagesState>((set) => ({
  pages: [
    { id: 'p1', name: 'Operations', icon: 'truck', tools: ['assign', 'track', 'newjob'], widgets: [
      mk('bookings', 0, 0, 8, 3), mk('email', 0, 3, 8, 3), // bookings on top, email below (full width)
    ] },
    { id: 'p2', name: 'Accounts', icon: 'briefcase', tools: ['invoice', 'statement', 'credit'], widgets: [
      mk('customers', 0, 0, 5, 6), mk('createbooking', 5, 0, 3, 6),
    ] },
    { id: 'p3', name: 'Planning', icon: 'calendar', tools: ['route', 'capacity', 'newquote'], widgets: [
      mk('bookings', 0, 0, 8, 6),
    ] },
  ],
  active: 0,
  pinnedTools: ['calc', 'notepad', 'calendar', 'timer'],

  setActive: (i) => set({ active: i }),
  renamePage: (i, name) => set((s) => ({ pages: s.pages.map((p, k) => k === i ? { ...p, name } : p) })),
  addPage: (name, icon) => set((s) => ({ pages: [...s.pages, { id: 'p' + Date.now(), name, icon, tools: ['assign', 'track', 'newjob'], widgets: [] }], active: s.pages.length })),
  updatePage: (i, name, icon) => set((s) => ({ pages: s.pages.map((p, k) => k === i ? { ...p, name, icon } : p) })),
  deletePage: (i) => set((s) => {
    if (s.pages.length <= 1) return s
    const pages = s.pages.filter((_, k) => k !== i)
    return { pages, active: Math.max(0, s.active - (i <= s.active ? 1 : 0)) }
  }),
  setPageTools: (i, tools) => set((s) => ({ pages: s.pages.map((p, k) => k === i ? { ...p, tools } : p) })),
  togglePin: (id) => set((s) => ({ pinnedTools: s.pinnedTools.includes(id) ? s.pinnedTools.filter((x) => x !== id) : [...s.pinnedTools, id] })),
  addWidget: (type, col, row, w, h) => set((s) => ({ pages: s.pages.map((p, k) => k === s.active ? { ...p, widgets: [...p.widgets, mk(type, col, row, w, h)] } : p) })),
  removeWidget: (id) => set((s) => ({ pages: s.pages.map((p, k) => k === s.active ? { ...p, widgets: p.widgets.filter((w) => w.id !== id) } : p) })),
}))

/** Grid occupancy + fit helpers for the active page. */
export function occupied(widgets: HWidget[], exceptId?: string): Set<string> {
  const s = new Set<string>()
  for (const w of widgets) {
    if (w.id === exceptId) continue
    for (let r = w.row; r < w.row + w.h; r++) for (let c = w.col; c < w.col + w.w; c++) if (r < HOME_ROWS && c < HOME_COLS) s.add(r + ',' + c)
  }
  return s
}
export function fits(widgets: HWidget[], col: number, row: number, w: number, h: number): boolean {
  if (col < 0 || row < 0 || col + w > HOME_COLS || row + h > HOME_ROWS) return false
  const o = occupied(widgets)
  for (let r = row; r < row + h; r++) for (let c = col; c < col + w; c++) if (o.has(r + ',' + c)) return false
  return true
}
export function maxAt(widgets: HWidget[], col: number, row: number): { mw: number; mh: number } {
  let mw = 0, mh = 0
  for (let w = 1; col + w <= HOME_COLS; w++) { if (fits(widgets, col, row, w, 1)) mw = w; else break }
  for (let h = 1; row + h <= HOME_ROWS; h++) { if (fits(widgets, col, row, 1, h)) mh = h; else break }
  return { mw, mh }
}
