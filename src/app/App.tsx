/**
 * App — top-level router. Shows the list screens (Bookings / Quotes / Drafts) by default,
 * or the booking wizard when adding/opening a job. The left nav rail is shared chrome.
 */
import { LeftRail } from './Rails.tsx'
import { BookingWizard } from './BookingWizard.tsx'
import { ListScreen } from '@/features/jobs/ListScreen.tsx'
import { CustomersScreen } from '@/features/customers/CustomersScreen.tsx'
import { useViewStore } from '@/store/viewStore.ts'

export function App() {
  const screen = useViewStore((s) => s.screen)

  if (screen === 'wizard') {
    return <BookingWizard />
  }
  return (
    <>
      <LeftRail />
      {screen === 'customers' ? <CustomersScreen /> : <ListScreen />}
    </>
  )
}
