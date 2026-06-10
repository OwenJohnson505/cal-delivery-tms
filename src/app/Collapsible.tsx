/**
 * Collapsible — a click-to-open optional section. Used in Quick Quote mode to keep the
 * form small: optional fields (notes/goods, date & time, specifics) stay collapsed until
 * the user opens them.
 */
import { useState, type ReactNode } from 'react'

export function Collapsible({
  label,
  defaultOpen = false,
  children,
}: {
  label: string
  defaultOpen?: boolean
  children: ReactNode
}) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div className={'collapsible' + (open ? ' open' : '')}>
      <button type="button" className="collapsible-head" onClick={() => setOpen((o) => !o)}>
        <span className="collapsible-caret">{open ? '▾' : '▸'}</span>
        {label}
      </button>
      {open && <div className="collapsible-body">{children}</div>}
    </div>
  )
}
