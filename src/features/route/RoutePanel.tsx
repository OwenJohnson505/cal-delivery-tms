/**
 * Route panel (prototype .route / renderAll): the vertical stop list, or the full-screen
 * stop editor when a stop is being edited.
 */
import { Icon } from '@/app/Icon.tsx'
import { useBookingStore } from '@/store/bookingStore.ts'
import { useUiStore } from '@/store/uiStore.ts'
import { StopCard } from './StopCard.tsx'
import { QuickStopCard } from './QuickStopCard.tsx'
import { StopEditor } from './StopEditor.tsx'
import { newStop } from './newStop.ts'

export function RoutePanel() {
  const stops = useBookingStore((s) => s.stops)
  const addStop = useBookingStore((s) => s.addStop)
  const quickQuote = useBookingStore((s) => s.quickQuote)
  const editingStopId = useUiStore((s) => s.editingStopId)
  const editStop = useUiStore((s) => s.editStop)

  // Full editor only applies in normal mode.
  if (editingStopId != null && !quickQuote) {
    return <StopEditor stopId={editingStopId} />
  }

  return (
    <div className="route">
      <div className="route-scroll">
        <div className="rtitle">Route · stops</div>
        {quickQuote && (
          <div className="qq-banner">
            <Icon name="info" size={14} /> Quick Quote — only a collection postcode and vehicle type are needed.
            Add notes, timing and specifics if you want; untick Quick Quote for a full quote or booking.
          </div>
        )}
        <div className="stops-list">
          {stops.map((s, i) =>
            quickQuote ? (
              <QuickStopCard key={s.id} stop={s} index={i} />
            ) : (
              <StopCard key={s.id} stop={s} index={i} />
            ),
          )}
        </div>
        <button
          className="btn add-stop"
          onClick={() => {
            const s = newStop(stops)
            addStop(s)
            if (!quickQuote) editStop(s.id)
          }}
        >
          <Icon name="plus" size={15} /> Add another address
        </button>
      </div>
    </div>
  )
}
