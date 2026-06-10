/**
 * Header bar (prototype lines 491-494): customer/contact box, customer ref, route tools
 * (docs / map / print / delivery notes), clear-all. Tools open the relevant modal/window.
 */
import { Icon } from './Icon.tsx'
import { CustomerHeader } from '@/features/customer/CustomerHeader.tsx'
import { RefHistory } from '@/features/customer/RefHistory.tsx'
import { useBookingStore } from '@/store/bookingStore.ts'
import { useUiStore } from '@/store/uiStore.ts'
import { useViewStore } from '@/store/viewStore.ts'

export function Header() {
  const reset = useBookingStore((s) => s.reset)
  const quickQuote = useBookingStore((s) => s.quickQuote)
  const setQuickQuote = useBookingStore((s) => s.setQuickQuote)
  const openModal = useUiStore((s) => s.openModal)
  const goToList = useViewStore((s) => s.goToList)

  return (
    <div className="bar">
      <div id="ccBox" className="ccbox" style={{ flex: '0 1 auto', minWidth: 0 }}>
        <CustomerHeader />
      </div>
      <button
        className={'qq-toggle' + (quickQuote ? ' on' : '')}
        title="Quick Quote — only collection postcode + vehicle type"
        onClick={() => setQuickQuote(!quickQuote)}
      >
        <span className="qq-dot" />
        Quick Quote
      </button>
      <div className="bar-actions">
        <RefHistory />
        <div className="bar-sep" />
        <div className="bar-tools" id="routeTools">
          <button className="btn sm iconbtn" title="Documents" onClick={() => openModal('docs')}>
            <Icon name="file" size={16} />
          </button>
          <button className="btn sm iconbtn" title="Audit trail" onClick={() => openModal('audit')}>
            <Icon name="list" size={16} />
          </button>
          <button
            className="btn sm iconbtn"
            title="Route map"
            onClick={() => window.alert('Route map opens Google Maps directions (mock).')}
          >
            <Icon name="map" size={16} />
          </button>
          <button
            className="btn sm iconbtn"
            title="Print delivery notes"
            onClick={() => window.alert('Delivery notes print doc (mock).')}
          >
            <Icon name="printer" size={16} />
          </button>
        </div>
        <div className="bar-sep" />
        <button className="btn" onClick={() => { if (confirm('Clear the whole booking?')) reset() }}>
          Clear all
        </button>
        <button className="winx" title="Close — back to list" onClick={() => goToList()}>
          <Icon name="close" size={16} />
        </button>
      </div>
    </div>
  )
}
