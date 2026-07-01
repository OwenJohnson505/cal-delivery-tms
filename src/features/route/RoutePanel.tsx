/**
 * Route panel (grey Route section): the vertical stop list. Each stop is a StopCard
 * that shows its preview lines and edits its address/time, contact and goods inline
 * via compact forms (so nothing overflows the narrow column). A newly-added stop opens
 * its address form automatically.
 */
import { useBookingStore } from '@/store/bookingStore.ts'
import { StopCard } from './StopCard.tsx'
import { newStop } from './newStop.ts'

export function RoutePanel() {
  const stops = useBookingStore((s) => s.stops)
  const addStop = useBookingStore((s) => s.addStop)

  return (
    <div className="section route-section">
      <div className="sec-head"><span className="sec-title">Route · {stops.length} stops</span></div>
      <div className="stops">
        {stops.map((s, i) => (
          <StopCard key={s.id} stop={s} index={i} last={i === stops.length - 1} />
        ))}
      </div>
      <button className="add-row" onClick={() => addStop(newStop(stops))}>+ Add stop</button>
    </div>
  )
}
