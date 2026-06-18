/**
 * FormsScreen — Settings → Form Builder. Manage the tenant's booking/screen forms and
 * choose which one is LIVE for each of Booking / Quote / Quick Quote. The bespoke
 * "Original Wizard" is a built-in, non-editable form that is live by default; authoring a
 * custom form and flipping it live makes the booking screen render that form instead
 * (see App routing). Flip back to Original Wizard to restore the hand-built screen.
 */
import { useState } from 'react'
import { Icon } from '@/app/Icon.tsx'
import { FormBuilder } from './FormBuilder.tsx'
import { useFormsStore, FORM_MODES, ORIGINAL_WIZARD, type FormMode } from '@/store/formsStore.ts'

export function FormsScreen() {
  const forms = useFormsStore((s) => s.forms)
  const active = useFormsStore((s) => s.active)
  const setActive = useFormsStore((s) => s.setActive)
  const createForm = useFormsStore((s) => s.createForm)
  const duplicateForm = useFormsStore((s) => s.duplicateForm)
  const deleteForm = useFormsStore((s) => s.deleteForm)
  const [editingId, setEditingId] = useState<string | null>(null)

  const nameOf = (id: string) => (id === ORIGINAL_WIZARD ? 'Original Wizard' : forms.find((f) => f.id === id)?.name ?? '—')
  const liveModes = (id: string) => FORM_MODES.filter((m) => active[m.key] === id).map((m) => m.label)

  if (editingId) {
    return (
      <div className="list-app">
        <FormBuilder formId={editingId} onClose={() => setEditingId(null)} />
      </div>
    )
  }

  return (
    <div className="list-app">
      <div className="list-work">
        <div className="bk-tabsrow">
          <h2 className="screen-title">Form Builder</h2>
          <span className="db-spacer" />
          <button className="btn primary" onClick={() => setEditingId(createForm())}><Icon name="plus" size={15} /> New form</button>
        </div>
        <p className="cf-hint" style={{ margin: '0 0 14px' }}>
          Build your own booking screens and choose which one goes live for each mode. The <b>Original Wizard</b> is the
          bespoke hand-built screen — live by default, and always available to switch back to.
        </p>

        {/* live assignments — the "3 live forms" */}
        <div className="fm-live">
          {FORM_MODES.map((m) => (
            <label key={m.key} className="fm-live-card">
              <span className="fm-live-mode">{m.label}</span>
              <select className="fm-live-sel" value={active[m.key]} onChange={(e) => setActive(m.key as FormMode, e.target.value)}>
                <option value={ORIGINAL_WIZARD}>Original Wizard (built-in)</option>
                {forms.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
              </select>
              <span className="fm-live-now">live: <b>{nameOf(active[m.key])}</b></span>
            </label>
          ))}
        </div>

        {/* form library */}
        <div className="fm-listhead">Your forms</div>
        <table className="list-table">
          <thead><tr><th>Form</th><th>Live for</th><th>Updated</th><th className="fit"></th></tr></thead>
          <tbody>
            <tr className="fm-builtin">
              <td><b>Original Wizard</b> <span className="fm-badge">built-in</span></td>
              <td>{liveModes(ORIGINAL_WIZARD).join(', ') || '—'}</td>
              <td>—</td>
              <td className="fit"><span className="cf-hint">not editable</span></td>
            </tr>
            {forms.map((f) => (
              <tr key={f.id}>
                <td><button className="cell-link" onClick={() => setEditingId(f.id)}>{f.name}</button></td>
                <td>{liveModes(f.id).map((l) => <span key={l} className="fm-badge live">{l}</span>)}</td>
                <td>{f.updatedAt}</td>
                <td className="fit fm-actions">
                  <button className="btn sm" onClick={() => setEditingId(f.id)}><Icon name="edit" size={13} /> Edit</button>
                  <button className="btn sm" onClick={() => setEditingId(duplicateForm(f.id))} title="Duplicate"><Icon name="copy" size={13} /></button>
                  <button className="btn sm iconbtn danger" onClick={() => { if (confirm(`Delete "${f.name}"? Any live slot using it falls back to the Original Wizard.`)) deleteForm(f.id) }} title="Delete"><Icon name="trash" size={13} /></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
