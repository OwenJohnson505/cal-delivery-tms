/**
 * Combobox — a styled, filterable dropdown matching the app design (prototype .cb /
 * .cb-menu). Replaces the native <datalist>, whose popup can't be themed. Type to filter
 * or click an option; free text is allowed (it's a rate-card hint, not a closed set).
 */
import { useRef, useState } from 'react'

export function Combobox({
  value,
  options,
  placeholder,
  className,
  onChange,
}: {
  value: string
  options: string[]
  placeholder?: string
  className?: string
  onChange: (value: string) => void
}) {
  const [open, setOpen] = useState(false)
  const blurTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  const q = value.trim().toLowerCase()
  const filtered = q ? options.filter((o) => o.toLowerCase().includes(q)) : options

  return (
    <div className="cb">
      <input
        type="text"
        className={className}
        autoComplete="off"
        value={value}
        placeholder={placeholder}
        onChange={(e) => {
          onChange(e.target.value)
          setOpen(true)
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => {
          // delay so an option's onMouseDown registers before we close
          blurTimer.current = setTimeout(() => setOpen(false), 120)
        }}
      />
      <div className={'cb-menu' + (open && filtered.length ? ' open' : '')}>
        {filtered.map((o) => (
          <div
            key={o}
            className="cb-opt"
            onMouseDown={() => {
              if (blurTimer.current) clearTimeout(blurTimer.current)
              onChange(o)
              setOpen(false)
            }}
          >
            {o}
          </div>
        ))}
      </div>
    </div>
  )
}
