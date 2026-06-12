/**
 * BookingWizard — the Delivery Booking screen shell (prototype body, lines 478-576),
 * composing the feature subsystems. Reached from the list screens via "Add new booking"
 * or by opening a saved job.
 */
import { LeftRail, RightRail } from './Rails.tsx'
import { Header } from './Header.tsx'
import { JobTabs } from './JobTabs.tsx'
import { Footer } from './Footer.tsx'
import { JobNotes } from './JobNotes.tsx'
import { RoutePanel } from '@/features/route/RoutePanel.tsx'
import { QuickQuotePanel } from '@/features/route/QuickQuotePanel.tsx'
import { RequirementsPanel } from '@/features/service/RequirementsPanel.tsx'
import { ServiceRail } from '@/features/service/ServiceRail.tsx'
import { DriverSection } from '@/features/driver/DriverSection.tsx'
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
  // In email-open mode the fixed right rail is hidden, so History / Providers are
  // reached via buttons under the header instead.
  const emailOpen = useEmailsStore((s) => s.panelState !== 'closed')

  return (
    <>
      <LeftRail />
      <div className="app">
        {emailOpen && <JobTabs />}
        <div className="work">
          <Header />
          {quickQuote ? (
            // Quick Quote: a purpose-built condensed middle (top bar / rails / footer stay)
            <QuickQuotePanel />
          ) : (
            <div className="main">
              <div className="left">
                <RoutePanel />
                <div className="botrow">
                  <JobNotes />
                  <RequirementsPanel />
                </div>
              </div>
              <div className="rail">
                <ServiceRail />
                <DriverSection />
                <OtherCharges />
              </div>
            </div>
          )}
          <Footer />
        </div>
      </div>
      <RightRail />
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
