/**
 * MultiSelect — chip multi-select (prototype .ms / ms-box). Generic over a label list;
 * emits the new selection array.
 */
import { useState } from 'react'

export function MultiSelect({
  options,
  selected,
  placeholder,
  onChange,
  labels,
}: {
  options: string[]
  selected: string[]
  placeholder: string
  onChange: (sel: string[]) => void
  /** Optional display labels keyed by value (defaults to the value itself). */
  labels?: Record<string, string>
}) {
  const [open, setOpen] = useState(false)
  const label = (v: string) => labels?.[v] ?? v

  function toggle(opt: string) {
    onChange(selected.includes(opt) ? selected.filter((s) => s !== opt) : [...selected, opt])
  }

  return (
    <div className="ms">
      <div className="ms-box" onClick={() => setOpen((o) => !o)}>
        {selected.length === 0 && <span className="ms-ph">{placeholder}</span>}
        {selected.map((s) => (
          <span key={s} className="ms-chip">
            {label(s)}
            <i
              onClick={(e) => {
                e.stopPropagation()
                toggle(s)
              }}
            >
              ×
            </i>
          </span>
        ))}
        <span className="ms-caret">▼</span>
      </div>
      <div className={'ms-menu' + (open ? ' open' : '')}>
        {options.map((o) => {
          const on = selected.includes(o)
          return (
            <div key={o} className={'ms-opt' + (on ? ' on' : '')} onClick={() => toggle(o)}>
              <span className="ms-tick">{on ? '✓' : ''}</span>
              {label(o)}
            </div>
          )
        })}
      </div>
    </div>
  )
}
