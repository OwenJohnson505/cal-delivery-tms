/**
 * FormBuilder — the visual editor (developer brief §9). Produces/edits a ScreenForm:
 * free-positioned panels that own their children, click-to-select, drag to move, a
 * resize handle, an inspector to configure the selected panel/field, add/delete, and a
 * live Preview that runs the real renderer. It only ever edits configuration data.
 *
 * MVP (Phase 1) — deferred to later phases: layers tree, cross-panel drag, stack/grid
 * auto-layout, the logic/rules engine, validation builder, versioning.
 */
import { useEffect, useRef, useState, type ReactNode, type PointerEvent as ReactPointerEvent } from 'react'
import { Icon } from '@/app/Icon.tsx'
import { FormRenderer } from './FormRenderer.tsx'
import {
  useFormsStore, FIELD_TYPES, type ScreenForm, type FormPanel, type FormElement, type FieldType, type Rect,
} from '@/store/formsStore.ts'

type Sel = { panelId: string; elId?: string } | null
const uid = (p: string) => `${p}-${Math.random().toString(36).slice(2, 8)}`

const FIELD_PRESETS: { type: FieldType; w: number; h: number }[] = [
  { type: 'text', w: 280, h: 56 }, { type: 'textarea', w: 320, h: 96 }, { type: 'dropdown', w: 240, h: 56 },
  { type: 'checkbox', w: 180, h: 40 }, { type: 'date', w: 200, h: 56 }, { type: 'currency', w: 180, h: 56 },
  { type: 'address', w: 360, h: 56 }, { type: 'lookup', w: 280, h: 56 },
]

export function FormBuilder({ formId, onClose }: { formId: string; onClose: () => void }) {
  const storeForm = useFormsStore((s) => s.forms.find((f) => f.id === formId))
  const updateForm = useFormsStore((s) => s.updateForm)
  const renameForm = useFormsStore((s) => s.renameForm)

  const [form, setForm] = useState<ScreenForm | null>(storeForm ?? null)
  const [sel, setSel] = useState<Sel>(null)
  const [preview, setPreview] = useState(false)
  useEffect(() => { setForm(storeForm ?? null) }, [storeForm?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!form) return <div className="fb-empty">Form not found.</div>

  /** Update local working copy + persist to the store (localStorage). */
  const commit = (next: ScreenForm) => { setForm(next); updateForm(next.id, { panels: next.panels, canvas: next.canvas }) }
  const patchPanel = (panelId: string, patch: Partial<FormPanel>) =>
    commit({ ...form, panels: form.panels.map((p) => (p.id === panelId ? { ...p, ...patch } : p)) })
  const patchEl = (panelId: string, elId: string, patch: Partial<FormElement>) =>
    commit({ ...form, panels: form.panels.map((p) => (p.id !== panelId ? p : { ...p, children: p.children.map((e) => (e.id === elId ? { ...e, ...patch } : e)) })) })

  const addPanel = () => {
    const p: FormPanel = { id: uid('panel'), key: uid('panel.'), title: 'New panel', layout: { x: 24, y: 24 + form.panels.length * 16, w: 460, h: 200 }, childLayout: 'free', collapsible: false, headerless: false, repeat: null, children: [] }
    commit({ ...form, panels: [...form.panels, p] }); setSel({ panelId: p.id })
  }
  const addField = (type: FieldType) => {
    const panelId = sel?.panelId ?? form.panels[0]?.id
    if (!panelId) return
    const preset = FIELD_PRESETS.find((f) => f.type === type) ?? { w: 260, h: 56 }
    const el: FormElement = { id: uid('el'), key: uid('field.'), kind: 'field', fieldType: type, label: FIELD_TYPES.find((f) => f.value === type)?.label ?? 'Field', binding: 'job.customFields.' + uid('f'), layout: { x: 14, y: 14, w: preset.w, h: preset.h }, ...(type === 'dropdown' || type === 'multiselect' ? { source: 'static', options: [{ value: 'a', label: 'Option A' }, { value: 'b', label: 'Option B' }] } : {}) }
    commit({ ...form, panels: form.panels.map((p) => (p.id === panelId ? { ...p, children: [...p.children, el] } : p)) })
    setSel({ panelId, elId: el.id })
  }
  const del = () => {
    if (!sel) return
    if (sel.elId) commit({ ...form, panels: form.panels.map((p) => (p.id === sel.panelId ? { ...p, children: p.children.filter((e) => e.id !== sel.elId) } : p)) })
    else commit({ ...form, panels: form.panels.filter((p) => p.id !== sel.panelId) })
    setSel(null)
  }

  const selPanel = form.panels.find((p) => p.id === sel?.panelId) ?? null
  const selEl = selPanel?.children.find((e) => e.id === sel?.elId) ?? null

  if (preview) {
    return (
      <div className="fb-root">
        <div className="fb-top">
          <button className="btn sm" onClick={() => setPreview(false)}>‹ Back to editor</button>
          <b className="fb-title">{form.name} — preview</b>
          <span className="db-spacer" />
          <span className="cf-hint">Live render via the runtime renderer</span>
        </div>
        <div className="fb-preview"><FormRenderer form={form} /></div>
      </div>
    )
  }

  return (
    <div className="fb-root">
      <div className="fb-top">
        <button className="btn sm" onClick={onClose}>‹ All forms</button>
        <input className="fb-name" value={form.name} onChange={(e) => { setForm({ ...form, name: e.target.value }); renameForm(form.id, e.target.value) }} />
        <span className="db-spacer" />
        <span className="cf-hint">Saved automatically</span>
        <button className="btn sm" onClick={() => setPreview(true)}><Icon name="eye" size={14} /> Preview</button>
      </div>

      <div className="fb-body">
        {/* palette */}
        <div className="fb-palette">
          <div className="fb-pal-sec">Layout</div>
          <button className="fb-pal-btn" onClick={addPanel}><Icon name="grid" size={14} /> Panel</button>
          <div className="fb-pal-sec">Fields {sel?.panelId ? '' : '(select a panel)'}</div>
          {FIELD_TYPES.map((ft) => (
            <button key={ft.value} className="fb-pal-btn" disabled={!sel?.panelId} onClick={() => addField(ft.value)}>{ft.label}</button>
          ))}
        </div>

        {/* canvas */}
        <div className="fb-canvas-wrap" onMouseDown={() => setSel(null)}>
          <div className="fb-canvas" style={{ width: form.canvas.width, height: form.canvas.height }}>
            {form.panels.map((panel) => (
              <Box key={panel.id} rect={panel.layout} selected={sel?.panelId === panel.id && !sel?.elId} className="fb-panel"
                onSelect={() => setSel({ panelId: panel.id })}
                onMove={(r) => patchPanel(panel.id, { layout: r })}>
                <div className="fb-panel-h">{panel.headerless ? <i>· headerless ·</i> : panel.title}{panel.repeat && <span className="fb-rep">⟳ {panel.repeat.collection}</span>}</div>
                {panel.children.map((el) => (
                  <Box key={el.id} rect={el.layout} selected={sel?.elId === el.id} className="fb-el"
                    onSelect={() => setSel({ panelId: panel.id, elId: el.id })}
                    onMove={(r) => patchEl(panel.id, el.id, { layout: clampChild(r, panel.layout) })}>
                    <span className="fb-el-lbl">{el.label || el.key}</span>
                    <span className="fb-el-type">{el.fieldType ?? el.kind}</span>
                  </Box>
                ))}
              </Box>
            ))}
          </div>
        </div>

        {/* inspector */}
        <div className="fb-inspector">
          {!sel && <div className="fb-insp-empty">Select a panel or field to configure it.</div>}
          {selEl && selPanel && <ElementInspector el={selEl} onPatch={(p) => patchEl(selPanel.id, selEl.id, p)} onDelete={del} />}
          {selPanel && !selEl && <PanelInspector panel={selPanel} onPatch={(p) => patchPanel(selPanel.id, p)} onDelete={del} />}
        </div>
      </div>
    </div>
  )
}

function clampChild(r: Rect, panel: Rect): Rect {
  return { ...r, x: Math.max(8, Math.min(r.x, panel.w - r.w - 8)), y: Math.max(28, Math.min(r.y, panel.h - r.h - 8)) }
}

/** A selectable, draggable, resizable box (panel or element) using pointer events. */
function Box({ rect, selected, className, children, onSelect, onMove }: {
  rect: Rect; selected: boolean; className: string; children: ReactNode
  onSelect: () => void; onMove: (r: Rect) => void
}) {
  const ref = useRef<Rect>(rect)
  ref.current = rect
  const drag = (e: ReactPointerEvent, mode: 'move' | 'resize') => {
    e.stopPropagation(); e.preventDefault(); onSelect()
    const sx = e.clientX, sy = e.clientY, start = { ...ref.current }
    const move = (ev: PointerEvent) => {
      const dx = ev.clientX - sx, dy = ev.clientY - sy
      onMove(mode === 'move'
        ? { ...start, x: Math.round(start.x + dx), y: Math.round(start.y + dy) }
        : { ...start, w: Math.max(80, Math.round(start.w + dx)), h: Math.max(32, Math.round(start.h + dy)) })
    }
    const up = () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up) }
    window.addEventListener('pointermove', move); window.addEventListener('pointerup', up)
  }
  return (
    <div
      className={className + (selected ? ' sel' : '')}
      style={{ left: rect.x, top: rect.y, width: rect.w, height: rect.h }}
      onPointerDown={(e) => drag(e, 'move')}
    >
      {children}
      {selected && <span className="fb-resize" onPointerDown={(e) => drag(e, 'resize')} />}
    </div>
  )
}

function ElementInspector({ el, onPatch, onDelete }: { el: FormElement; onPatch: (p: Partial<FormElement>) => void; onDelete: () => void }) {
  return (
    <div className="fb-insp">
      <div className="fb-insp-h">Field<span className="db-spacer" /><button className="btn sm iconbtn danger" onClick={onDelete} title="Delete"><Icon name="trash" size={13} /></button></div>
      <Row label="Label"><input value={el.label ?? ''} onChange={(e) => onPatch({ label: e.target.value })} /></Row>
      <Row label="Type">
        <select value={el.fieldType} onChange={(e) => onPatch({ fieldType: e.target.value as FieldType })}>
          {FIELD_TYPES.map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}
        </select>
      </Row>
      <Row label="Placeholder"><input value={el.placeholder ?? ''} onChange={(e) => onPatch({ placeholder: e.target.value })} /></Row>
      <Row label="Comment ⓘ"><input value={el.comment ?? ''} onChange={(e) => onPatch({ comment: e.target.value })} /></Row>
      <Row label="Required"><input type="checkbox" className="fb-chk" checked={!!el.required} onChange={(e) => onPatch({ required: e.target.checked })} /></Row>
      {(el.fieldType === 'dropdown' || el.fieldType === 'multiselect' || el.fieldType === 'lookup' || el.fieldType === 'address') && (
        <Row label="Source">
          <select value={el.source ?? 'static'} onChange={(e) => onPatch({ source: e.target.value as FormElement['source'] })}>
            <option value="static">Static list</option>
            <option value="customers">Customers</option>
            <option value="vehicles">Vehicles</option>
            <option value="drivers">Drivers</option>
            <option value="customer.addresses">Customer's addresses</option>
            <option value="customer.contacts">Customer's contacts</option>
          </select>
        </Row>
      )}
      {el.source === 'static' && (el.fieldType === 'dropdown' || el.fieldType === 'multiselect') && (
        <Row label="Options">
          <textarea rows={3} value={(el.options ?? []).map((o) => o.label).join('\n')}
            onChange={(e) => onPatch({ options: e.target.value.split('\n').filter(Boolean).map((l) => ({ value: l.trim(), label: l.trim() })) })} />
        </Row>
      )}
      <Row label="Binding"><input value={el.binding ?? ''} onChange={(e) => onPatch({ binding: e.target.value })} title="kernel path (job.x / stop.x) or custom key" /></Row>
      <SizeRows rect={el.layout} onPatch={(layout) => onPatch({ layout })} />
    </div>
  )
}

function PanelInspector({ panel, onPatch, onDelete }: { panel: FormPanel; onPatch: (p: Partial<FormPanel>) => void; onDelete: () => void }) {
  return (
    <div className="fb-insp">
      <div className="fb-insp-h">Panel<span className="db-spacer" /><button className="btn sm iconbtn danger" onClick={onDelete} title="Delete"><Icon name="trash" size={13} /></button></div>
      <Row label="Title"><input value={panel.title} onChange={(e) => onPatch({ title: e.target.value })} /></Row>
      <Row label="Layout">
        <select value={panel.childLayout} onChange={(e) => onPatch({ childLayout: e.target.value as FormPanel['childLayout'] })}>
          <option value="free">Free (absolute)</option>
          <option value="stack">Stack</option>
          <option value="grid">Grid</option>
        </select>
      </Row>
      <Row label="Collapsible"><input type="checkbox" className="fb-chk" checked={panel.collapsible} onChange={(e) => onPatch({ collapsible: e.target.checked })} /></Row>
      <Row label="Hide header"><input type="checkbox" className="fb-chk" checked={panel.headerless} onChange={(e) => onPatch({ headerless: e.target.checked })} /></Row>
      <Row label="Repeatable">
        <select value={panel.repeat?.collection ?? ''} onChange={(e) => onPatch({ repeat: e.target.value ? { collection: e.target.value as 'stops' | 'legs' | 'charges', min: 1, max: null, addLabel: 'Add another' } : null })}>
          <option value="">No</option>
          <option value="stops">Bind to stops</option>
          <option value="legs">Bind to legs</option>
          <option value="charges">Bind to charges</option>
        </select>
      </Row>
      <SizeRows rect={panel.layout} onPatch={(layout) => onPatch({ layout })} />
    </div>
  )
}

function SizeRows({ rect, onPatch }: { rect: Rect; onPatch: (r: Rect) => void }) {
  const num = (k: keyof Rect) => (
    <input type="number" value={rect[k]} onChange={(e) => onPatch({ ...rect, [k]: Math.round(+e.target.value || 0) })} />
  )
  return (
    <>
      <Row label="X / Y"><span className="fb-xy">{num('x')}{num('y')}</span></Row>
      <Row label="W / H"><span className="fb-xy">{num('w')}{num('h')}</span></Row>
    </>
  )
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return <label className="fb-row"><span className="fb-row-lbl">{label}</span><span className="fb-row-ctl">{children}</span></label>
}
