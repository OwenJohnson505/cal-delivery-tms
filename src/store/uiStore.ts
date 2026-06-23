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
  /** How the bookings board renders beside an open email — compact cards or the full
   * table (the user picks, e.g. switching to the table once they have the width). */
  boardView: 'cards' | 'table'

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
  setBoardView(v: 'cards' | 'table'): void
}

function loadBoardView(): 'cards' | 'table' {
  try { return localStorage.getItem('cd-board-view') === 'table' ? 'table' : 'cards' } catch { return 'cards' }
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
  boardView: loadBoardView(),

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
  setBoardView: (v) => { try { localStorage.setItem('cd-board-view', v) } catch { /* ignore */ } ; set({ boardView: v }) },
}))
