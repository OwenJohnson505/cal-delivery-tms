/**
 * JobRailTabs — in email-open mode the fixed right rail (History / Service providers)
 * is hidden (the email client owns that space), so these buttons sit under the booking
 * header instead. They open the same drawers, which in email mode slide in over the job
 * column only — keeping the email panel visible alongside.
 */
import { Icon } from './Icon.tsx'
import { useUiStore } from '@/store/uiStore.ts'
import { useBookingStore } from '@/store/bookingStore.ts'

export function JobRailTabs() {
  const openDrawer = useUiStore((s) => s.openDrawer)
  const provSeen = useUiStore((s) => s.provSeen)
  const allocated = useBookingStore((s) => s.allocatedDriver)
  const badge = Math.max(0, 5 + 3 - provSeen) // internal drivers + CX bids (mock)

  return (
    <div className="jrt">
      <button
        className={'jrt-btn' + (allocated ? ' allocated' : '')}
        onClick={() => openDrawer('providers')}
        title="Service providers — drivers & CX bids"
      >
        <Icon name="truck" size={15} /> Service providers
        {badge > 0 && <span className="jrt-badge">{badge}</span>}
      </button>
      <button className="jrt-btn" onClick={() => openDrawer('history')} title="Job history">
        <Icon name="clock" size={15} /> History
      </button>
    </div>
  )
}
