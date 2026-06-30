/**
 * EditableCell — a route-card preview cell that can be edited in place via a small
 * popover (prototype field() + cellEdit/ce-pop). The pencil or a double-click opens the
 * popover; it edits just this field without entering the full stop editor.
 */
import { useState, type ReactNode } from 'react'
import { Icon } from '@/app/Icon.tsx'

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

  return (
    <div
      className={'f' + (editable ? ' editable' : '')}
      onDoubleClick={() => editable && setOpen(true)}
    >
      <span className="k">{label}</span>
      <span className="v">{value}</span>
      {editable && (
        <button
          className="cell-edit"
          title="Edit"
          onClick={(e) => {
            e.stopPropagation()
            setOpen((o) => !o)
          }}
        >
          <Icon name="edit" size={12} />
        </button>
      )}
      {open && (
        <div className="ce-pop open" style={{ top: 'calc(100% + 4px)', right: 0 }}>
          <div className="ce-h">
            {title}
            <span className="x" onClick={() => setOpen(false)}>✕</span>
          </div>
          <div className="ce-b">{children}</div>
          <div className="ce-f">
            <button className="btn primary sm" onClick={() => setOpen(false)}>Done</button>
          </div>
        </div>
      )}
    </div>
  )
}
