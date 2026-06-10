/**
 * Left app-nav rail and right contextual-drawer rail (prototype lines 479-486, 563).
 * The right rail's Providers icon turns green while a driver is allocated, and shows an
 * unseen-options badge (spec §9).
 */
import { Icon } from './Icon.tsx'
import { useBookingStore } from '@/store/bookingStore.ts'
import { useUiStore } from '@/store/uiStore.ts'

export function LeftRail() {
  const items: Array<[string, string, boolean]> = [
    ['grid', 'Home', false],
    ['user', 'Customers', false],
    ['calendar', 'Bookings', true],
    ['chart', 'Analytics', false],
    ['wheel', 'Drivers', false],
  ]
  return (
    <div className="siderail siderail-left">
      <div className="sr-logo">CD</div>
      {items.map(([icon, label, active]) => (
        <div key={label} className={'sr-item' + (active ? ' active' : '')} title={label}>
          <span className="sr-ic">
            <Icon name={icon} size={18} />
          </span>
          <span className="sr-lbl">{label}</span>
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
