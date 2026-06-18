/**
 * Left app-nav rail and right contextual-drawer rail (prototype lines 479-486, 563).
 * The right rail's Providers icon turns green while a driver is allocated, and shows an
 * unseen-options badge (spec §9).
 */
import { Icon } from './Icon.tsx'
import { useBookingStore } from '@/store/bookingStore.ts'
import { useUiStore } from '@/store/uiStore.ts'
import { useViewStore } from '@/store/viewStore.ts'
import { useEmailsStore } from '@/store/emailsStore.ts'

type NavItem = { icon: string; label: string; onClick?: () => void; active?: boolean }

function NavRailItem({ it }: { it: NavItem }) {
  return (
    <div
      className={'sr-item' + (it.active ? ' active' : '')}
      title={it.label}
      onClick={it.onClick}
    >
      <span className="sr-ic">
        <Icon name={it.icon} size={18} />
      </span>
      <span className="sr-lbl">{it.label}</span>
    </div>
  )
}

export function LeftRail() {
  const screen = useViewStore((s) => s.screen)
  const goToList = useViewStore((s) => s.goToList)
  const goToCustomers = useViewStore((s) => s.goToCustomers)
  const go = useViewStore((s) => s.go)
  const panelState = useEmailsStore((s) => s.panelState)
  const setPanelState = useEmailsStore((s) => s.setPanelState)
  const emailFull = panelState === 'full'
  const emailOpen = panelState !== 'mini'
  const navOpen = useUiStore((s) => s.navOpen)
  const toggleNav = useUiStore((s) => s.toggleNav)
  const settingsOpen = useUiStore((s) => s.settingsOpen)
  const toggleSettings = useUiStore((s) => s.toggleSettings)

  // Primary nav: the three everyday destinations, always visible.
  const primary: NavItem[] = [
    { icon: 'calendar', label: 'Bookings', onClick: () => goToList('bookings'), active: screen === 'list' || screen === 'wizard' },
    { icon: 'mail', label: 'Emails', onClick: () => setPanelState(emailOpen ? 'mini' : 'list'), active: emailOpen },
    { icon: 'user', label: 'Customers', onClick: () => goToCustomers(), active: screen === 'customers' },
  ]
  // Secondary nav: tucked inside the Settings group at the bottom, collapsed by default.
  const secondary: NavItem[] = [
    { icon: 'grid', label: 'Form Builder', onClick: () => go('forms'), active: screen === 'forms' },
    { icon: 'pin', label: 'Addresses', onClick: () => go('addresses'), active: screen === 'addresses' },
    { icon: 'tag', label: 'Tariffs', onClick: () => go('tariffs'), active: screen === 'tariffs' },
    { icon: 'users', label: 'Users', onClick: () => go('users'), active: screen === 'users' },
    { icon: 'building', label: 'Teams', onClick: () => go('teams'), active: screen === 'teams' },
    { icon: 'wheel', label: 'Drivers' },
  ]

  return (
    <div className={'siderail siderail-left' + (navOpen ? ' nav-pinned' : '')}>
      <div className="sr-logo">CD</div>
      {emailFull && (
        <button
          className="sr-pin"
          title={navOpen ? 'Collapse navigation' : 'Keep navigation open'}
          onClick={toggleNav}
        >
          {navOpen ? '‹' : '›'}
        </button>
      )}
      {primary.map((it) => (
        <NavRailItem key={it.label} it={it} />
      ))}
      <div className="sr-bottom">
        {settingsOpen && secondary.map((it) => <NavRailItem key={it.label} it={it} />)}
        <div
          className={'sr-item sr-settings' + (settingsOpen ? ' active' : '')}
          title={settingsOpen ? 'Hide settings' : 'Settings'}
          onClick={toggleSettings}
        >
          <span className="sr-ic">
            <Icon name="cog" size={18} />
          </span>
          <span className="sr-lbl">Settings</span>
        </div>
      </div>
    </div>
  )
}

export function RightRail() {
  const openDrawer = useUiStore((s) => s.openDrawer)
  const provSeen = useUiStore((s) => s.provSeen)
  const allocated = useBookingStore((s) => s.allocatedDriver)
  // provider total = internal drivers + CX bids (static in the mock)
  const provTotal = 5 + 3
  const badge = Math.max(0, provTotal - provSeen)

  return (
    <div className="siderail">
      <div className="sr-item" onClick={() => openDrawer('history')} title="Job history">
        <span className="sr-ic">
          <Icon name="clock" size={18} />
        </span>
        <span className="sr-lbl">History</span>
      </div>
      <div
        className={'sr-item' + (allocated ? ' allocated' : '')}
        id="srProviders"
        onClick={() => openDrawer('providers')}
        title="Service providers"
      >
        <span className="sr-ic">
          <Icon name="truck" size={18} />
        </span>
        {badge > 0 && <span className="sr-badge show">{badge > 99 ? '99+' : badge}</span>}
        <span className="sr-lbl">Providers</span>
      </div>
    </div>
  )
}
