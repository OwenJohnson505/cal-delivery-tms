/**
 * BookingWizard — the Delivery Booking screen shell (prototype body, lines 478-576),
 * composing the feature subsystems. Reached from the list screens via "Add new booking"
 * or by opening a saved job.
 */
import { LeftRail } from './Rails.tsx'
import { Header } from './Header.tsx'
import { JobTabs } from './JobTabs.tsx'
import { Footer } from './Footer.tsx'
import { RoutePanel } from '@/features/route/RoutePanel.tsx'
import { QuickQuotePanel } from '@/features/route/QuickQuotePanel.tsx'
import { RequirementsPanel } from '@/features/service/RequirementsPanel.tsx'
import { ServiceRail } from '@/features/service/ServiceRail.tsx'
import { OtherCharges } from './OtherCharges.tsx'
import { HistoryDrawer } from '@/features/audit/HistoryDrawer.tsx'
import { ProvidersDrawer } from '@/features/driver/ProvidersDrawer.tsx'
import { Modals } from './Modals.tsx'
import { useUiStore } from '@/store/uiStore.ts'
import { useBookingStore } from '@/store/bookingStore.ts'
import { useEmailsStore } from '@/store/emailsStore.ts'

export function BookingWizard() {
  const drawerOpen = useUiStore((s) => s.drawer !== null)
  const closeDrawers = useUiStore((s) => s.closeDrawers)
  const quickQuote = useBookingStore((s) => s.quickQuote)
  // In immersive (full) email mode the fixed right rail is hidden, so History /
  // Providers are reached via the JobTabs bar instead.
  const emailFull = useEmailsStore((s) => s.panelState === 'full')

  return (
    <>
      <LeftRail />
      <div className="app">
        {emailFull && <JobTabs />}
        <div className="work">
          <Header />
          {quickQuote ? (
            // Quick Quote: a purpose-built condensed middle — footer stays a bar below it.
            <>
              <QuickQuotePanel />
              <Footer />
            </>
          ) : (
            // Ultrawide "thin slice": one narrow top-to-bottom column (no side rail),
            // so several wizards can stack across a wide monitor. Route · stops sits
            // full-width; the remaining panels form a 2-col grid (auto-collapsing to 1
            // col when the slice is narrow, e.g. beside an open email).
            <div className="main main-stack">
              <RoutePanel />
              {/* Thin single-column stack of grey section containers. Driver moved
                  into Service Providers; internal Job notes moved to a header button. */}
              <ServiceRail />
              <OtherCharges />
              <RequirementsPanel />
              {/* Bottom section: booked-by / customer ref / total revenue / actions. */}
              <Footer />
            </div>
          )}
        </div>
      </div>
      <div
        className={'drawer-overlay' + (drawerOpen ? ' open' : '')}
        onClick={closeDrawers}
      />
      <HistoryDrawer />
      <ProvidersDrawer />
      <Modals />
    </>
  )
}
