/**
 * ViewToggle — a small segmented control to switch the bookings board between the
 * compact card view and the full table view (shown beside an open email, where the user
 * may have dragged enough width to want the richer table).
 */
import { Icon } from '@/app/Icon.tsx'

export function ViewToggle({ value, onChange }: {
  value: 'cards' | 'table'
  onChange: (v: 'cards' | 'table') => void
}) {
  return (
    <div className="viewtoggle" role="group" aria-label="Booking view">
      <button className={'vt-btn' + (value === 'cards' ? ' on' : '')} onClick={() => onChange('cards')} title="Card view" aria-pressed={value === 'cards'}>
        <Icon name="grid" size={14} />
      </button>
      <button className={'vt-btn' + (value === 'table' ? ' on' : '')} onClick={() => onChange('table')} title="Table view" aria-pressed={value === 'table'}>
        <Icon name="list" size={14} />
      </button>
    </div>
  )
}
