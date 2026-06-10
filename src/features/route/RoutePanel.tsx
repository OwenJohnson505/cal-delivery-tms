/**
 * Route panel (prototype .route): the vertical stop list. One stop at a time is shown in
 * the inline full editor (so it fits without scrolling); the rest are collapsed previews.
 * A new booking opens on its first incomplete stop; "Done" advances to the next incomplete
 * stop (then collapses everything); "Edit" opens a collapsed stop.
 */
import { useState } from 'react'
import { Icon } from '@/app/Icon.tsx'
import { useBookingStore } from '@/store/bookingStore.ts'
import { StopCard } from './StopCard.tsx'
import { StopEditor } from './StopEditor.tsx'
import { newStop } from './newStop.ts'
import type { Stop } from '@/types/index.ts'

const isIncomplete = (s: Stop) => !s.addr.co && !s.addr.pc && !s.addr.address

export function RoutePanel() {
  const stops = useBookingStore((s) => s.stops)
  const addStop = useBookingStore((s) => s.addStop)

  // Exactly one stop is editable at a time — start on the first incomplete one.
  const [editingId, setEditingId] = useState<number | null>(
    () => stops.find(isIncomplete)?.id ?? null,
  )

  const done = (id: number) => {
    // advance to the next incomplete stop, else collapse all
    const i = stops.findIndex((s) => s.id === id)
    const next = stops.slice(i + 1).find(isIncomplete)
    setEditingId(next ? next.id : null)
  }

  return (
    <div className="route">
      <div className="route-scroll">
        <div className="rtitle">Route · stops</div>
        <div className="stops-list">
          {stops.map((s, i) =>
            s.id === editingId ? (
              <StopEditor key={s.id} stopId={s.id} index={i} onDone={() => done(s.id)} />
            ) : (
              <StopCard key={s.id} stop={s} index={i} onEdit={() => setEditingId(s.id)} />
            ),
          )}
        </div>
        <button
          className="btn add-stop"
          onClick={() => {
            const s = newStop(stops)
            addStop(s)
            setEditingId(s.id)
          }}
        >
          <Icon name="plus" size={15} /> Add another address
        </button>
      </div>
    </div>
  )
}
