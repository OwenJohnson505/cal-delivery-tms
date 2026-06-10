/**
 * Left app-nav rail and right contextual-drawer rail (prototype lines 479-486, 563).
 * The right rail's Providers icon turns green while a driver is allocated, and shows an
 * unseen-options badge (spec §9).
 */
import { Icon } from './Icon.tsx'
import { useBookingStore } from '@/store/bookingStore.ts'
import { useUiStore } from '@/store/uiStore.ts'
import { useViewStore } from '@/store/viewStore.ts'

export function LeftRail() {
  const screen = useViewStore((s) => s.screen)
  const goToList = useViewStore((s) => s.goToList)
  const goToCustomers = useViewStore((s) => s.goToCustomers)
  const items: Array<{ icon: string; label: string; onClick?: () => void; active?: boolean }> = [
    { icon: 'grid', label: 'Home' },
    { icon: 'user', label: 'Customers', onClick: () => goToCustomers(), active: screen === 'customers' },
    { icon: 'calendar', label: 'Bookings', onClick: () => goToList('bookings'), active: screen === 'list' },
    { icon: 'chart', label: 'Analytics' },
    { icon: 'wheel', label: 'Drivers' },
  ]
  return (
    <div className="siderail siderail-left">
      <div className="sr-logo">CD</div>
      {items.map((it) => (
        <div
          key={it.label}
          className={'sr-item' + (it.active ? ' active' : '')}
          title={it.label}
          onClick={it.onClick}
        >
          <span className="sr-ic">
            <Icon name={it.icon} size={18} />
          </span>
          <span className="sr-lbl">{it.label}</span>
        </div>
      ))}
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
