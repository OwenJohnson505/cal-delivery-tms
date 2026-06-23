/**
 * View store — top-level navigation between the list screens and the booking wizard.
 */
import { create } from 'zustand'

export type Screen = 'list' | 'wizard' | 'customers' | 'users' | 'teams' | 'tariffs' | 'addresses' | 'forms' | 'emailrules' | 'email'
export type ListTab = 'bookings' | 'quotes' | 'drafts'

interface ViewState {
  screen: Screen
  listTab: ListTab
  /** Id of the saved job currently open in the wizard, or null for a new one. */
  editingJobId: string | null

  goToList(tab?: ListTab): void
  goToCustomers(): void
  /** Navigate to any standalone screen (customers/users/teams/tariffs/addresses). */
  go(screen: Screen): void
  openWizard(editingJobId?: string | null): void
  setListTab(tab: ListTab): void
}

export const useViewStore = create<ViewState>((set) => ({
  screen: 'list',
  listTab: 'bookings',
  editingJobId: null,

  goToList: (tab) => set((s) => ({ screen: 'list', listTab: tab ?? s.listTab })),
  goToCustomers: () => set({ screen: 'customers' }),
  go: (screen) => set({ screen }),
  openWizard: (editingJobId = null) => set({ screen: 'wizard', editingJobId }),
  setListTab: (tab) => set({ listTab: tab }),
}))
