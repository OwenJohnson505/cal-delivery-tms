/**
 * ViewToggle — segmented control for how the bookings board renders beside an open email.
 * 'Auto' (default) shows the table when it fits the column without left-right scroll and
 * falls back to cards when it doesn't; the user can also force cards or the table.
 */
import { Icon } from '@/app/Icon.tsx'

export type BoardView = 'auto' | 'cards' | 'table'

export function ViewToggle({ value, onChange }: {
  value: BoardView
  onChange: (v: BoardView) => void
}) {
  return (
    <div className="viewtoggle" role="group" aria-label="Booking view">
      <button className={'vt-btn vt-auto' + (value === 'auto' ? ' on' : '')} onClick={() => onChange('auto')} title="Auto — table when it fits, cards when it doesn't" aria-pressed={value === 'auto'}>
        Auto
      </button>
      <button className={'vt-btn' + (value === 'cards' ? ' on' : '')} onClick={() => onChange('cards')} title="Card view" aria-pressed={value === 'cards'}>
        <Icon name="grid" size={14} />
      </button>
      <button className={'vt-btn' + (value === 'table' ? ' on' : '')} onClick={() => onChange('table')} title="Table view" aria-pressed={value === 'table'}>
        <Icon name="list" size={14} />
      </button>
    </div>
  )
}
