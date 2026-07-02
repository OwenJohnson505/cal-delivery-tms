/**
 * Popover — a viewport-safe anchored popover.
 *
 * Renders its content into a portal on <body>, so it can never be clipped by an
 * ancestor's `overflow: hidden` (e.g. the rounded widget panels). It positions
 * itself fixed, anchored under (or above) the trigger, and clamps to the viewport
 * so it always stays fully on screen.
 */
import { useLayoutEffect, useRef, useState, type ReactNode, type RefObject, type CSSProperties } from 'react'
import { createPortal } from 'react-dom'

export function Popover({ anchorRef, open, onClose, align = 'end', width, className = '', children }: {
  anchorRef: RefObject<HTMLElement | null>
  open: boolean
  onClose: () => void
  /** horizontal alignment to the anchor: 'start' = left edges, 'end' = right edges */
  align?: 'start' | 'end'
  /** fixed width; otherwise the popover uses its natural/CSS width */
  width?: number
  className?: string
  children: ReactNode
}) {
  const popRef = useRef<HTMLDivElement>(null)
  const [style, setStyle] = useState<CSSProperties>({ visibility: 'hidden', position: 'fixed', top: 0, left: 0 })

  useLayoutEffect(() => {
    if (!open) return
    const place = () => {
      const a = anchorRef.current, p = popRef.current
      if (!a || !p) return
      const ar = a.getBoundingClientRect()
      const pw = p.offsetWidth, ph = p.offsetHeight
      const gap = 6, m = 8
      let left = align === 'end' ? ar.right - pw : ar.left
      left = Math.max(m, Math.min(left, window.innerWidth - pw - m))
      let top = ar.bottom + gap
      // flip above the anchor if there isn't room below
      if (top + ph > window.innerHeight - m && ar.top - gap - ph > m) top = ar.top - gap - ph
      top = Math.max(m, Math.min(top, window.innerHeight - ph - m))
      setStyle({ position: 'fixed', top, left, right: 'auto', ...(width ? { width } : {}), zIndex: 3000 })
    }
    place()
    window.addEventListener('resize', place)
    window.addEventListener('scroll', place, true)
    return () => { window.removeEventListener('resize', place); window.removeEventListener('scroll', place, true) }
  }, [open, anchorRef, align, width])

  if (!open) return null
  return createPortal(
    <>
      <div className="pop-scrim" onClick={onClose} />
      <div ref={popRef} className={className} style={style}>{children}</div>
    </>,
    document.body,
  )
}
