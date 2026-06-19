/**
 * App — top-level router. Shows the list screens (Bookings / Quotes / Drafts) by default,
 * or the booking wizard when adding/opening a job. The left nav rail is shared chrome.
 */
import { LeftRail } from './Rails.tsx'
import { ListScreen } from '@/features/jobs/ListScreen.tsx'
import { CustomersScreen } from '@/features/customers/CustomersScreen.tsx'
import { UsersScreen } from '@/features/users/UsersScreen.tsx'
import { TeamsScreen } from '@/features/teams/TeamsScreen.tsx'
import { TariffsScreen } from '@/features/tariffs/TariffsScreen.tsx'
import { AddressesScreen } from '@/features/addresses/AddressesScreen.tsx'
import { FormsScreen } from '@/features/forms/FormsScreen.tsx'
import { WizardHost } from '@/features/forms/LiveBookingScreen.tsx'
import { EmailPanel } from '@/features/email/EmailPanel.tsx'
import { EmailRulesScreen } from '@/features/email/EmailRulesScreen.tsx'
import { useViewStore } from '@/store/viewStore.ts'
import { useEmailsStore } from '@/store/emailsStore.ts'
import { useUiStore } from '@/store/uiStore.ts'

export function App() {
  const screen = useViewStore((s) => s.screen)
  const panelState = useEmailsStore((s) => s.panelState)
  // 'full' = immersive (narrow job column + cards/vertical-wizard + big email);
  // 'list' = side mode (normal table / normal wizard + email panel alongside);
  // 'mini' = fully closed — no email chrome at all; reopened from the left-rail Emails button.
  // Email only pairs with the booking page (list + wizard) — not customers, settings,
  // service-providers screens, etc.
  const onBookingPage = screen === 'list' || screen === 'wizard'
  const emailVisible = panelState !== 'mini' && onBookingPage
  const emailFull = panelState === 'full' && onBookingPage
  const emailSide = panelState === 'list' && onBookingPage
  const navOpen = useUiStore((s) => s.navOpen)
  // In SIDE email mode (list), opening a wizard drawer (Service providers / History)
  // shrinks the booking into a vertical scroller and widens the drawer to take that
  // room — keeping the booking visible (thinner) alongside the email. In FULL mode the
  // drawer is reached via JobTabs and takes over the job column instead.
  const drawerOpen = useUiStore((s) => s.drawer !== null) && emailSide && screen === 'wizard'
  // Inside a job (the wizard) in full-email mode → collapse the inbox list so the editor
  // and the email body get the room (a 2-way split). Restores when you leave the job.
  const emailInJob = emailFull && screen === 'wizard'

  const wiz = screen === 'wizard'
  return (
    <div className={'shell' + (wiz ? ' wiz' : '')
      + (emailFull ? ' panel-open' : '')
      + (emailSide ? ' email-side email-list' : '')
      + ((emailFull || emailSide) ? ' email-left' : '')
      + (drawerOpen ? ' drawer-open' : '')
      + (emailInJob ? ' email-injob' : '')
      + (emailFull && navOpen ? ' nav-pinned' : '')}>
      <div className="shell-main">
        {screen === 'wizard' ? (
          <WizardHost />
        ) : (
          <>
            <LeftRail />
            {screen === 'customers' && <CustomersScreen />}
            {screen === 'users' && <UsersScreen />}
            {screen === 'teams' && <TeamsScreen />}
            {screen === 'tariffs' && <TariffsScreen />}
            {screen === 'addresses' && <AddressesScreen />}
            {screen === 'forms' && <FormsScreen />}
            {screen === 'emailrules' && <EmailRulesScreen />}
            {screen === 'list' && <ListScreen />}
          </>
        )}
      </div>
      {emailVisible && <EmailPanel />}
    </div>
  )
}
