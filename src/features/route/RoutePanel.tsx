/**
 * Route panel (grey Route section): the vertical stop list. Each stop is a StopCard
 * that shows its preview lines and edits its address/time, contact and goods inline
 * via compact forms (so nothing overflows the narrow column). A newly-added stop opens
 * its address form automatically.
 */
import { useState } from 'react'
import { useBookingStore } from '@/store/bookingStore.ts'
import { StopCard } from './StopCard.tsx'
import { newStop } from './newStop.ts'

export function RoutePanel() {
  const stops = useBookingStore((s) => s.stops)
  const addStop = useBookingStore((s) => s.addStop)
  // While a stop is being edited, show ONLY that stop so its forms get the full
  // container width (and no connecting rail eating into it).
  const [editingId, setEditingId] = useState<number | null>(null)

  const visible = editingId == null ? stops : stops.filter((s) => s.id === editingId)

  return (
    <div className="section route-section">
      <div className="sec-head"><span className="sec-title">Route · {stops.length} stops</span></div>
      <div className="stops">
        {visible.map((s) => {
          const i = stops.indexOf(s)
          return (
            <StopCard
              key={s.id}
              stop={s}
              index={i}
              last={editingId != null || i === stops.length - 1}
              onEditingChange={(on) => setEditingId(on ? s.id : null)}
            />
          )
        })}
      </div>
      {editingId == null && (
        <button className="add-row" onClick={() => addStop(newStop(stops))}>+ Add stop</button>
      )}
    </div>
  )
}
