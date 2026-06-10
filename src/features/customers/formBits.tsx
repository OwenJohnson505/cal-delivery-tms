/**
 * Reusable building blocks for the customer form: section header, segmented control,
 * and a chip-list (string[] with add/remove) for emails, prefixes, alternative names, …
 */
import { useState, type ReactNode } from 'react'
import { Icon } from '@/app/Icon.tsx'

export function Section({ title, hint, action, children }: { title: string; hint?: string; action?: ReactNode; children: ReactNode }) {
  return (
    <div className="cf-section">
      <div className="cf-section-h">
        <span>{title}</span>
        {hint && <span className="cf-hint">{hint}</span>}
        {action && <span className="cf-section-action">{action}</span>}
      </div>
      {children}
    </div>
  )
}

export function Segmented<T extends string>({ value, options, onChange }: { value: T; options: Array<[T, string]>; onChange: (v: T) => void }) {
  return (
    <div className="cf-seg">
      {options.map(([v, label]) => (
        <button key={v} type="button" className={'cf-seg-btn' + (value === v ? ' on' : '')} onClick={() => onChange(v)}>
          {label}
        </button>
      ))}
    </div>
  )
}

export function ChipList({ values, placeholder, onChange }: { values: string[]; placeholder?: string; onChange: (next: string[]) => void }) {
  const [draft, setDraft] = useState('')
  const add = () => {
    const v = draft.trim()
    if (!v || values.includes(v)) return setDraft('')
    onChange([...values, v])
    setDraft('')
  }
  return (
    <div className="cf-chiplist">
      <div className="cf-chip-input">
        <input
          value={draft}
          placeholder={placeholder}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), add())}
        />
        <button type="button" className="btn" onClick={add} disabled={!draft.trim()}>
          <Icon name="plus" size={14} /> Add
        </button>
      </div>
      {values.length > 0 && (
        <div className="cf-chips">
          {values.map((v) => (
            <span key={v} className="cf-chip">
              {v}
              <i onClick={() => onChange(values.filter((x) => x !== v))}>×</i>
            </span>
          ))}
        </div>
      )}
    </div>
  )
}
