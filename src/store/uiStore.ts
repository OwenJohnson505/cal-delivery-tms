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
  /** Count of provider options the user has seen (drives the unseen badge). */
  provSeen: number

  openDrawer(d: DrawerName): void
  closeDrawers(): void
  openModal(m: ModalName): void
  closeModal(): void
  editStop(id: number | null): void
  viewPod(stopId: number | null): void
  setProvSeen(n: number): void
}

export const useUiStore = create<UiState>((set) => ({
  drawer: null,
  modal: null,
  editingStopId: null,
  podStopId: null,
  provSeen: 0,

  openDrawer: (d) => set({ drawer: d }),
  closeDrawers: () => set({ drawer: null }),
  openModal: (m) => set({ modal: m }),
  closeModal: () => set({ modal: null, podStopId: null }),
  editStop: (id) => set({ editingStopId: id }),
  viewPod: (stopId) => set({ podStopId: stopId, modal: stopId == null ? null : 'pod' }),
  setProvSeen: (n) => set({ provSeen: n }),
}))
