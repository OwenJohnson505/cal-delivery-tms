/**
 * UI store — ephemeral view state (open drawer/modal, which stop is being edited).
 * Kept separate from the booking domain store so domain state stays serialisable.
 */
import { create } from 'zustand'

export type DrawerName = 'history' | 'providers' | null
export type ModalName = 'pod' | 'audit' | 'docs' | 'custinfo' | 'customfields' | null

interface UiState {
  drawer: DrawerName
  modal: ModalName
  /** Stop id whose full-screen editor is open, or null for the route list. */
  editingStopId: number | null
  /** Payload for the POD modal (which stop's proof). */
  podStopId: number | null
  /** Which stop the custom-fields modal targets — null means the job-level fields. */
  customFieldsStopId: number | null
  /** Count of provider options the user has seen (drives the unseen badge). */
  provSeen: number
  /** Pin the left nav rail open (it collapses by default while the email panel is open). */
  navOpen: boolean
  /** Whether the left-rail Settings group (secondary nav) is expanded. Collapsed by default. */
  settingsOpen: boolean
  /** Bookings table density: 'compact' groups related data into a few dense columns;
   * 'expanded' gives every data point its own column (the configured view). */
  tableDensity: 'compact' | 'expanded'
  /** Admin priority queue density (independent from the standard table). */
  pqDensity: 'compact' | 'expanded'

  openDrawer(d: DrawerName): void
  closeDrawers(): void
  openModal(m: ModalName): void
  closeModal(): void
  /** Open the custom-fields modal for the job (null) or a specific stop. */
  openCustomFields(stopId: number | null): void
  editStop(id: number | null): void
  viewPod(stopId: number | null): void
  setProvSeen(n: number): void
  toggleNav(): void
  toggleSettings(): void
  setTableDensity(v: 'compact' | 'expanded'): void
  setPqDensity(v: 'compact' | 'expanded'): void
}

const DENSITY_KEY = 'cd-table-density'
function loadDensity(): 'compact' | 'expanded' {
  try { return localStorage.getItem(DENSITY_KEY) === 'expanded' ? 'expanded' : 'compact' } catch { return 'compact' }
}

export const useUiStore = create<UiState>((set) => ({
  drawer: null,
  modal: null,
  editingStopId: null,
  podStopId: null,
  customFieldsStopId: null,
  provSeen: 0,
  navOpen: false,
  settingsOpen: false,
  tableDensity: loadDensity(),
  pqDensity: 'compact',

  openDrawer: (d) => set({ drawer: d }),
  closeDrawers: () => set({ drawer: null }),
  openModal: (m) => set({ modal: m }),
  closeModal: () => set({ modal: null, podStopId: null, customFieldsStopId: null }),
  openCustomFields: (stopId) => set({ modal: 'customfields', customFieldsStopId: stopId }),
  editStop: (id) => set({ editingStopId: id }),
  viewPod: (stopId) => set({ podStopId: stopId, modal: stopId == null ? null : 'pod' }),
  setProvSeen: (n) => set({ provSeen: n }),
  toggleNav: () => set((s) => ({ navOpen: !s.navOpen })),
  toggleSettings: () => set((s) => ({ settingsOpen: !s.settingsOpen })),
  setTableDensity: (v) => { try { localStorage.setItem(DENSITY_KEY, v) } catch { /* ignore */ } ; set({ tableDensity: v }) },
  setPqDensity: (v) => set({ pqDensity: v }),
}))
