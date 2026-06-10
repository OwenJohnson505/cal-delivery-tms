/**
 * App — the Delivery Booking screen shell (prototype body, lines 478-576), composing
 * the feature subsystems. Layout/markup mirror the reference build; behaviour is driven
 * by the typed store + ported lib + mock API.
 */
import { LeftRail, RightRail } from './Rails.tsx'
import { Header } from './Header.tsx'
import { Footer } from './Footer.tsx'
import { JobNotes } from './JobNotes.tsx'
import { RoutePanel } from '@/features/route/RoutePanel.tsx'
import { RequirementsPanel } from '@/features/service/RequirementsPanel.tsx'
import { ServiceRail } from '@/features/service/ServiceRail.tsx'
import { DriverSection } from '@/features/driver/DriverSection.tsx'
import { OtherCharges } from './OtherCharges.tsx'
import { HistoryDrawer } from '@/features/audit/HistoryDrawer.tsx'
import { ProvidersDrawer } from '@/features/driver/ProvidersDrawer.tsx'
import { Modals } from './Modals.tsx'
import { useUiStore } from '@/store/uiStore.ts'

export function App() {
  const drawerOpen = useUiStore((s) => s.drawer !== null)
  const closeDrawers = useUiStore((s) => s.closeDrawers)

  return (
    <>
      <LeftRail />
      <div className="app">
        <div className="work">
          <Header />
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
