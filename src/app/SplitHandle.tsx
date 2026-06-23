/**
 * SplitHandle — a vertical drag bar that sits between the email panel and the booking
 * column when both are open. Dragging resizes the split (great on an ultrawide, where a
 * user might want the inbox and the full table side by side). The actual width lives in
 * App as `--jobcol-w`; this just reports the cursor position while dragging.
 */
import { useEffect, useRef } from 'react'

export function SplitHandle({ onResize }: { onResize: (clientX: number) => void }) {
  const dragging = useRef(false)
  useEffect(() => {
    const move = (e: MouseEvent) => {
      if (!dragging.current) return
      e.preventDefault()
      onResize(e.clientX)
    }
    const up = () => {
      if (!dragging.current) return
      dragging.current = false
      document.body.classList.remove('col-resizing')
    }
    window.addEventListener('mousemove', move)
    window.addEventListener('mouseup', up)
    return () => {
      window.removeEventListener('mousemove', move)
      window.removeEventListener('mouseup', up)
    }
  }, [onResize])

  return (
    <div
      className="ep-split"
      role="separator"
      aria-orientation="vertical"
      title="Drag to resize — pull the divider to favour the inbox or the bookings"
      onMouseDown={() => { dragging.current = true; document.body.classList.add('col-resizing') }}
      onDoubleClick={() => onResize(-1)} /* -1 = reset to the default split */
    />
  )
}
