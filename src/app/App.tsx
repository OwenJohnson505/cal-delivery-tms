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
import { EmailPanel, EmailReopenTab } from '@/features/email/EmailPanel.tsx'
import { useViewStore } from '@/store/viewStore.ts'
import { useEmailsStore } from '@/store/emailsStore.ts'
import { useUiStore } from '@/store/uiStore.ts'

export function App() {
  const screen = useViewStore((s) => s.screen)
  const panelState = useEmailsStore((s) => s.panelState)
  // 'full' = immersive (narrow job column + cards/vertical-wizard + big email);
  // 'list' / 'mini' = side mode (normal table / normal wizard + email panel or rail).
  const emailFull = panelState === 'full'
  const emailSide = panelState !== 'full'
  const navOpen = useUiStore((s) => s.navOpen)
  // In SIDE email mode (list/mini), opening a wizard drawer (Service providers /
  // History) shrinks the booking into a vertical scroller and widens the drawer to
  // take that room — keeping the booking visible (thinner) alongside the email. In
  // FULL mode the drawer is reached via JobTabs and takes over the job column instead.
  const drawerOpen = useUiStore((s) => s.drawer !== null) && emailSide && screen === 'wizard'

  const wiz = screen === 'wizard'
  return (
    <div className={'shell' + (wiz ? ' wiz' : '')
      + (emailFull ? ' panel-open' : '')
      + (emailSide ? ' email-side' : '')
      + (panelState === 'list' ? ' email-list' : '')
      + (panelState === 'mini' ? ' email-mini' : '')
      + (drawerOpen ? ' drawer-open' : '')
      + (emailFull && navOpen ? ' nav-pinned' : '')}>
      <div className="shell-main">
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
      {panelState === 'mini' ? <EmailReopenTab /> : <EmailPanel />}
    </div>
  )
}
