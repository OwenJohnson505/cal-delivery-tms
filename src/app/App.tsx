/**
 * App — top-level router. Shows the list screens (Bookings / Quotes / Drafts) by default,
 * or the booking wizard when adding/opening a job. The left nav rail is shared chrome.
 */
import { useCallback, useState, type CSSProperties } from 'react'
import { LeftRail } from './Rails.tsx'
import { SplitHandle } from './SplitHandle.tsx'
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
  const selectedId = useEmailsStore((s) => s.selectedId)
  // 'full' = immersive (narrow job column + cards/vertical-wizard + big email);
  // 'list' = side mode (normal table / normal wizard + email panel alongside);
  // 'mini' = fully closed — no email chrome at all; reopened from the left-rail Emails button.
  // Email only pairs with the booking page (list + wizard) — not customers, settings,
  // service-providers screens, etc.
  const onBookingPage = screen === 'list' || screen === 'wizard'
  // 'email' is a first-class screen: the inbox opens full-screen on its own, with no
  // booking column behind it (no longer forced to pair with a booking).
  const emailScreen = screen === 'email'
  const emailVisible = (panelState !== 'mini' && onBookingPage) || emailScreen
  const emailFull = panelState === 'full' && (onBookingPage || emailScreen)
  const emailSide = panelState === 'list' && onBookingPage
  // In SIDE email mode (list), opening a wizard drawer (Service providers / History)
  // shrinks the booking into a vertical scroller and widens the drawer to take that
  // room — keeping the booking visible (thinner) alongside the email. In FULL mode the
  // drawer is reached via JobTabs and takes over the job column instead.
  const drawerOpen = useUiStore((s) => s.drawer !== null) && emailSide && screen === 'wizard'
  // Inside a job (the wizard) in full-email mode → collapse the inbox list so the editor
  // and the email body get the room (a 2-way split). Restores when you leave the job.
  const emailInJob = emailFull && screen === 'wizard'

  // Paired = email AND bookings both showing → a draggable divider lets the user re-balance
  // the split (handy on an ultrawide). The chosen width persists; double-click resets it.
  const paired = emailFull && !emailScreen
  // On the bookings list with no email open in the reader → the inbox is just a narrow
  // list; the bookings table should take ALL the remaining width (no dead space beside a
  // half-empty inbox). Opening an email restores the resizable split.
  const listOnly = paired && screen === 'list' && selectedId == null
  const [jobColW, setJobColW] = useState<number | null>(() => {
    const v = typeof localStorage !== 'undefined' ? localStorage.getItem('cd-jobcol-w') : null
    return v ? Number(v) : null
  })
  const onResize = useCallback((clientX: number) => {
    if (clientX < 0) { setJobColW(null); try { localStorage.removeItem('cd-jobcol-w') } catch { /* ignore */ } ; return }
    const NAV = 44, MIN_EMAIL = 440, MIN_JOB = 420
    const total = window.innerWidth
    // the booking column is flush to the right edge → its width is everything right of the cursor
    const w = Math.max(MIN_JOB, Math.min(total - clientX, total - NAV - MIN_EMAIL))
    setJobColW(Math.round(w))
    try { localStorage.setItem('cd-jobcol-w', String(Math.round(w))) } catch { /* ignore */ }
  }, [])

  const wiz = screen === 'wizard'
  const shellStyle = (paired && jobColW != null)
    ? ({ '--jobcol-w': `${jobColW}px` } as CSSProperties)
    : undefined
  return (
    <div
      style={shellStyle}
      className={'shell' + (wiz ? ' wiz' : '')
      + (emailFull ? ' panel-open' : '')
      + (emailSide ? ' email-side email-list' : '')
      + ((emailFull || emailSide || emailScreen) ? ' email-left' : '')
      + (emailScreen ? ' email-solo' : '')
      + (drawerOpen ? ' drawer-open' : '')
      + (emailInJob ? ' email-injob' : '')
      + (listOnly ? ' email-listonly' : '')}>
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
      {paired && !listOnly && <SplitHandle onResize={onResize} />}
    </div>
  )
}
