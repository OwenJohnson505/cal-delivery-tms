/**
 * EditableCell — a route-card preview cell that can be edited in place via a small
 * popover (prototype field() + cellEdit/ce-pop). The pencil or a double-click opens the
 * popover; it edits just this field without entering the full stop editor.
 *
 * The popover is rendered fixed-positioned (anchored to the trigger cell's rect) so it
 * floats in front of everything — the stop cards clip their overflow for rounded
 * corners, and the route panel scrolls, so an absolutely-positioned popover would be
 * cut off.
 */
import { useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { Icon } from '@/app/Icon.tsx'

const POP_W = 340
const POP_EST_H = 300

export function EditableCell({
  label,
  value,
  title,
  children,
  editable = true,
}: {
  label: ReactNode
  value: ReactNode
  title: string
  /** The field editor(s) shown in the popover. */
  children: ReactNode
  editable?: boolean
}) {
  const [open, setOpen] = useState(false)
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null)
  const cellRef = useRef<HTMLDivElement>(null)

  const openPop = () => {
    const el = cellRef.current
    if (el) {
      const r = el.getBoundingClientRect()
      const left = Math.max(8, Math.min(r.right - POP_W, window.innerWidth - POP_W - 8))
      // open below the cell; flip above if it would run off the bottom
      const below = r.bottom + 4
      const top = below + POP_EST_H > window.innerHeight ? Math.max(8, r.top - 4 - POP_EST_H) : below
      setPos({ top, left })
    }
    setOpen(true)
  }
  const close = () => setOpen(false)

  const popStyle: CSSProperties = { position: 'fixed', top: pos?.top, left: pos?.left, right: 'auto' }

  return (
    <div
      ref={cellRef}
      className={'f' + (editable ? ' editable' : '')}
      onDoubleClick={() => { if (editable) openPop() }}
    >
      <span className="k">{label}</span>
      <span className="v">{value}</span>
      {editable && (
        <button
          className="cell-edit"
          title="Edit"
          onClick={(e) => { e.stopPropagation(); if (open) close(); else openPop() }}
        >
          <Icon name="edit" size={12} />
        </button>
      )}
      {open && (
        <>
          <div className="ce-scrim" onClick={close} />
          <div className="ce-pop open" style={popStyle}>
            <div className="ce-h">
              {title}
              <span className="x" onClick={close}>✕</span>
            </div>
            <div className="ce-b">{children}</div>
            <div className="ce-f">
              <button className="btn primary sm" onClick={close}>Save</button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
