/**
 * FormRenderer — the runtime renderer (developer brief §10). Reads a ScreenForm config
 * and renders a live, data-bound operator screen: panels positioned on the canvas, each
 * field rendered by type, data sources resolved (static / entity / customer-profile).
 *
 * Kept deliberately pure over the config: it never reaches into kernel logic. Values are
 * held in a local map keyed by element key; the caller decides what to do on submit.
 * (The declarative logic engine, validation and repeatable-group runtime are later phases.)
 */
import { useMemo, useState, type CSSProperties, type ReactNode } from 'react'
import type { ScreenForm, FormElement, FormPanel, DataSourceKind } from '@/store/formsStore.ts'
import { useCustomersStore } from '@/store/customersStore.ts'
import { useTariffsStore } from '@/store/tariffsStore.ts'

export type FormValues = Record<string, unknown>

function resolveOptions(
  source: DataSourceKind | undefined,
  el: FormElement,
  customers: ReturnType<typeof useCustomersStore.getState>['customers'],
  vehicles: ReturnType<typeof useTariffsStore.getState>['tariffs'],
  selectedCustomerId: string | null,
): { value: string; label: string }[] {
  switch (source) {
    case 'static': return el.options ?? []
    case 'customers': return customers.map((c) => ({ value: c.id, label: c.displayName || c.companyName }))
    case 'vehicles': return vehicles.map((v) => ({ value: v.id, label: v.name }))
    case 'drivers': return [] // Real impl: driver feed (entity source)
    case 'customer.addresses': {
      const c = customers.find((x) => x.id === selectedCustomerId)
      return (c?.addresses ?? []).map((a, i) => ({ value: String(i), label: [a.company || a.label, a.postcode].filter(Boolean).join(' · ') || `Address ${i + 1}` }))
    }
    case 'customer.contacts': {
      const c = customers.find((x) => x.id === selectedCustomerId)
      return (c?.contacts ?? []).map((ct, i) => ({ value: String(i), label: ct.name || ct.email || `Contact ${i + 1}` }))
    }
    default: return el.options ?? []
  }
}

function Field({ el, value, onChange, options }: {
  el: FormElement; value: unknown; onChange: (v: unknown) => void; options: { value: string; label: string }[]
}) {
  const common = { className: 'fr-input', placeholder: el.placeholder }
  const v = value == null ? '' : String(value)
  switch (el.fieldType) {
    case 'textarea':
      return <textarea {...common} rows={3} value={v} onChange={(e) => onChange(e.target.value)} />
    case 'number':
    case 'currency':
      return <input {...common} type="number" value={v} onChange={(e) => onChange(e.target.value)} />
    case 'date':
      return <input {...common} type="date" value={v} onChange={(e) => onChange(e.target.value)} />
    case 'datetime':
      return <input {...common} type="datetime-local" value={v} onChange={(e) => onChange(e.target.value)} />
    case 'checkbox':
      return <input type="checkbox" className="fr-check" checked={!!value} onChange={(e) => onChange(e.target.checked)} />
    case 'dropdown':
    case 'lookup':
    case 'address':
      return (
        <select className="fr-input" value={v} onChange={(e) => onChange(e.target.value)}>
          <option value="">{el.placeholder ?? 'Select…'}</option>
          {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      )
    case 'multiselect':
      return (
        <select className="fr-input" multiple value={Array.isArray(value) ? (value as string[]) : []}
          onChange={(e) => onChange([...e.target.selectedOptions].map((o) => o.value))}>
          {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      )
    default:
      return <input {...common} type="text" value={v} onChange={(e) => onChange(e.target.value)} />
  }
}

function PanelView({ panel, values, setValue, customerId }: {
  panel: FormPanel; values: FormValues; setValue: (key: string, v: unknown) => void; customerId: string | null
}) {
  const customers = useCustomersStore((s) => s.customers)
  const vehicles = useTariffsStore((s) => s.tariffs)
  const [collapsed, setCollapsed] = useState(false)
  return (
    <div className="fr-panel" style={{ left: panel.layout.x, top: panel.layout.y, width: panel.layout.w, minHeight: panel.layout.h }}>
      {!panel.headerless && (
        <div className="fr-panel-h">
          <b>{panel.title}</b>
          {panel.repeat && <span className="fr-repeat-badge">repeats · {panel.repeat.collection}</span>}
          {panel.collapsible && <button className="fr-collapse" onClick={() => setCollapsed((o) => !o)}>{collapsed ? '▾' : '▴'}</button>}
        </div>
      )}
      {!collapsed && (
        <div className={'fr-panel-body fr-' + panel.childLayout}>
          {panel.children.map((el) => {
            if (el.kind === 'divider') return <div key={el.id} className="fr-divider" style={pos(panel, el)} />
            if (el.kind === 'heading' || el.kind === 'text') {
              return <div key={el.id} className={'fr-static fr-' + (el.size ?? 'md')} style={pos(panel, el)}>{el.content || el.label}</div>
            }
            const options = resolveOptions(el.source, el, customers, vehicles, customerId)
            return (
              <label key={el.id} className="fr-field" style={pos(panel, el)}>
                <span className="fr-label">{el.label || el.key}{el.required && <i className="fr-req">*</i>}{el.comment && <span className="fr-info" title={el.comment}>ⓘ</span>}</span>
                <Field el={el} value={values[el.key]} onChange={(val) => setValue(el.key, val)} options={options} />
              </label>
            )
          })}
          {panel.repeat && <button className="fr-add" disabled title="Repeatable groups run in a later phase">+ {panel.repeat.addLabel}</button>}
        </div>
      )}
    </div>
  )
}

/** Stack/grid layouts auto-flow; free layout honours absolute x/y. */
function pos(panel: FormPanel, el: FormElement): CSSProperties {
  if (panel.childLayout === 'free') return { position: 'absolute', left: el.layout.x, top: el.layout.y, width: el.layout.w }
  return { width: panel.childLayout === 'grid' ? Math.min(el.layout.w, panel.layout.w - 28) : undefined }
}

export function FormRenderer({ form, footer, onSubmit, onCancel, submitLabel }: {
  form: ScreenForm
  footer?: ReactNode
  onSubmit?: (values: FormValues) => void
  onCancel?: () => void
  submitLabel?: string
}) {
  const [values, setValues] = useState<FormValues>({})
  const setValue = (key: string, v: unknown) => setValues((p) => ({ ...p, [key]: v }))
  // the "selected customer" drives profile-sourced fields (addresses/contacts)
  const customerId = useMemo(() => {
    const custKey = form.panels.flatMap((p) => p.children).find((e) => e.source === 'customers')?.key
    return custKey ? (values[custKey] as string) || null : null
  }, [form, values])

  return (
    <div className="fr-root">
      <div className="fr-canvas" style={{ width: form.canvas.width, minHeight: form.canvas.height }}>
        {form.panels.map((p) => (
          <PanelView key={p.id} panel={p} values={values} setValue={setValue} customerId={customerId} />
        ))}
      </div>
      {footer && <div className="fr-footer">{footer}</div>}
      {onSubmit && (
        <div className="fr-footer">
          {onCancel && <button className="btn" onClick={onCancel}>Cancel</button>}
          <span className="db-spacer" />
          <button className="btn primary" onClick={() => onSubmit(values)}>{submitLabel ?? 'Save'}</button>
        </div>
      )}
    </div>
  )
}
