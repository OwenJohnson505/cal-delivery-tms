/**
 * Route panel (prototype .route): the vertical stop list. Each stop is either the
 * collapsed preview (StopCard) or the inline full editor (StopEditor). New/incomplete
 * stops start expanded; "Done" collapses to the preview, "Edit" re-expands.
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

  // Stops shown in the full editor. Start with any incomplete stops expanded.
  const [expanded, setExpanded] = useState<Set<number>>(
    () => new Set(stops.filter(isIncomplete).map((s) => s.id)),
  )
  const expand = (id: number) => setExpanded((prev) => new Set(prev).add(id))
  const collapse = (id: number) =>
    setExpanded((prev) => {
      const next = new Set(prev)
      next.delete(id)
      return next
    })

  return (
    <div className="route">
      <div className="route-scroll">
        <div className="rtitle">Route · stops</div>
        <div className="stops-list">
          {stops.map((s, i) =>
            expanded.has(s.id) ? (
              <StopEditor key={s.id} stopId={s.id} index={i} onDone={() => collapse(s.id)} />
            ) : (
              <StopCard key={s.id} stop={s} index={i} onEdit={() => expand(s.id)} />
            ),
          )}
        </div>
        <button
          className="btn add-stop"
          onClick={() => {
            const s = newStop(stops)
            addStop(s)
            expand(s.id)
          }}
        >
          <Icon name="plus" size={15} /> Add another address
        </button>
      </div>
    </div>
  )
}
