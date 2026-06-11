/**
 * App — top-level router. Shows the list screens (Bookings / Quotes / Drafts) by default,
 * or the booking wizard when adding/opening a job. The left nav rail is shared chrome.
 */
import { LeftRail } from './Rails.tsx'
import { BookingWizard } from './BookingWizard.tsx'
import { ListScreen } from '@/features/jobs/ListScreen.tsx'
import { CustomersScreen } from '@/features/customers/CustomersScreen.tsx'
import { UsersScreen } from '@/features/users/UsersScreen.tsx'
import { TeamsScreen } from '@/features/teams/TeamsScreen.tsx'
import { TariffsScreen } from '@/features/tariffs/TariffsScreen.tsx'
import { AddressesScreen } from '@/features/addresses/AddressesScreen.tsx'
import { EmailPanel } from '@/features/email/EmailPanel.tsx'
import { useViewStore } from '@/store/viewStore.ts'
import { useEmailsStore } from '@/store/emailsStore.ts'

export function App() {
  const screen = useViewStore((s) => s.screen)
  const emailOpen = useEmailsStore((s) => s.panelOpen)

  // The email panel lives at app level so it stays open while moving between the
  // list and an open booking (refs in an email jump straight to the job).
  return (
    <div className="shell">
      <div className={'shell-main' + (emailOpen ? ' hug' : '')}>
        {screen === 'wizard' ? (
          <BookingWizard />
        ) : (
          <>
            <LeftRail />
            {screen === 'customers' && <CustomersScreen />}
            {screen === 'users' && <UsersScreen />}
            {screen === 'teams' && <TeamsScreen />}
            {screen === 'tariffs' && <TariffsScreen />}
            {screen === 'addresses' && <AddressesScreen />}
            {screen === 'list' && <ListScreen />}
          </>
        )}
      </div>
      {emailOpen && <EmailPanel />}
    </div>
  )
}
