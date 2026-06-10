/**
 * BookingWizard — the Delivery Booking screen shell (prototype body, lines 478-576),
 * composing the feature subsystems. Reached from the list screens via "Add new booking"
 * or by opening a saved job.
 */
import { LeftRail, RightRail } from './Rails.tsx'
import { Header } from './Header.tsx'
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

export function BookingWizard() {
  const drawerOpen = useUiStore((s) => s.drawer !== null)
  const closeDrawers = useUiStore((s) => s.closeDrawers)
  const quickQuote = useBookingStore((s) => s.quickQuote)

  return (
    <>
      <LeftRail />
      <div className="app">
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
