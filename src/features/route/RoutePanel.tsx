/**
 * Route panel (prototype .route): the vertical stop list. One stop at a time is shown in
 * the inline full editor (so it fits without scrolling); the rest are collapsed previews.
 * A new booking opens on its first incomplete stop; "Done" advances to the next incomplete
 * stop (then collapses everything); "Edit" opens a collapsed stop.
 */
import { useEffect, useRef, useState } from 'react'
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

  // When a stop opens for editing (advance to stop 2, or add stop 3+), scroll it to
  // the top of the route panel so the active full editor fills the visible area.
  const scrollRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (editingId == null) return
    const cont = scrollRef.current
    if (!cont) return
    requestAnimationFrame(() => {
      const el = cont.querySelector<HTMLElement>('.stop.editing')
      if (!el) return
      // rect-based delta so it's correct regardless of offsetParent positioning
      const delta = el.getBoundingClientRect().top - cont.getBoundingClientRect().top
      cont.scrollTo({ top: Math.max(0, cont.scrollTop + delta - 8), behavior: 'smooth' })
    })
  }, [editingId])

  const done = (id: number) => {
    // advance to the next incomplete stop, else collapse all
    const i = stops.findIndex((s) => s.id === id)
    const next = stops.slice(i + 1).find(isIncomplete)
    setEditingId(next ? next.id : null)
  }

  return (
    <div className="section route-section">
      <div className="sec-head"><span className="sec-title">Route · {stops.length} stops</span></div>
      <div className="stops" ref={scrollRef}>
        {stops.map((s, i) =>
          s.id === editingId ? (
            <StopEditor key={s.id} stopId={s.id} index={i} onDone={() => done(s.id)} />
          ) : (
            <StopCard key={s.id} stop={s} index={i} last={i === stops.length - 1} onEdit={() => setEditingId(s.id)} />
          ),
        )}
      </div>
      <button
        className="add-row"
        onClick={() => {
          const s = newStop(stops)
          addStop(s)
          setEditingId(s.id)
        }}
      >
        + Add stop
      </button>
    </div>
  )
}
