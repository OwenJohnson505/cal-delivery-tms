/**
 * Route panel (prototype .route / renderAll): the vertical stop list, or the full-screen
 * stop editor when a stop is being edited. Used in the full (non-Quick-Quote) layout;
 * Quick Quote has its own condensed route in QuickQuotePanel.
 */
import { Icon } from '@/app/Icon.tsx'
import { useBookingStore } from '@/store/bookingStore.ts'
import { useUiStore } from '@/store/uiStore.ts'
import { StopCard } from './StopCard.tsx'
import { StopEditor } from './StopEditor.tsx'
import { newStop } from './newStop.ts'

export function RoutePanel() {
  const stops = useBookingStore((s) => s.stops)
  const addStop = useBookingStore((s) => s.addStop)
  const editingStopId = useUiStore((s) => s.editingStopId)
  const editStop = useUiStore((s) => s.editStop)

  if (editingStopId != null) {
    return <StopEditor stopId={editingStopId} />
  }

  return (
    <div className="route">
      <div className="route-scroll">
        <div className="rtitle">Route · stops</div>
        <div className="stops-list">
          {stops.map((s, i) => (
            <StopCard key={s.id} stop={s} index={i} />
          ))}
        </div>
        <button
          className="btn add-stop"
          onClick={() => {
            const s = newStop(stops)
            addStop(s)
            editStop(s.id)
          }}
        >
          <Icon name="plus" size={15} /> Add another address
        </button>
      </div>
    </div>
  )
}
