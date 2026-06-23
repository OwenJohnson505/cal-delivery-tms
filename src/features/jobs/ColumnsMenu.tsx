/**
 * ColumnsMenu — the booking list's view + column controls: a Views dropdown (admin
 * presets + the user's saved views, with set-default), and a Columns popover to show/
 * hide and drag-reorder columns, reset temporary tweaks, save a new view, or update the
 * current one. See viewsStore for the temporary-vs-persisted model.
 */
import { useState } from 'react'
import { Icon } from '@/app/Icon.tsx'
import { COLUMNS, useViewsStore, type ColumnKey } from '@/store/viewsStore.ts'

const LABEL: Record<ColumnKey, string> = Object.fromEntries(COLUMNS.map((c) => [c.key, c.label])) as Record<ColumnKey, string>

/** Per-customer custom-field columns, surfaced only while the list is filtered to a
 * single customer (passed in by ListScreen; not part of the saved-view system). */
export interface ExtraColumnsProps {
  extraTitle?: string
  extraColumns?: Array<{ key: string; label: string }>
  activeExtra?: string[]
  onToggleExtra?: (key: string) => void
  /** Shown (greyed) when nothing is filtered, to hint how to get custom-field columns. */
  extraHint?: string
}

export function ColumnsMenu(props: ExtraColumnsProps = {}) {
  const { extraTitle, extraColumns = [], activeExtra = [], onToggleExtra, extraHint } = props
  const presets = useViewsStore((s) => s.presets)
  const userViews = useViewsStore((s) => s.userViews)
  const activeViewId = useViewsStore((s) => s.activeViewId)
  const defaultViewId = useViewsStore((s) => s.defaultViewId)
  const columns = useViewsStore((s) => s.columns)
  const dirty = useViewsStore((s) => s.dirty)
  const applyView = useViewsStore((s) => s.applyView)
  const toggleColumn = useViewsStore((s) => s.toggleColumn)
  const moveColumn = useViewsStore((s) => s.moveColumn)
  const resetWorking = useViewsStore((s) => s.resetWorking)
  const saveAsView = useViewsStore((s) => s.saveAsView)
  const updateActiveView = useViewsStore((s) => s.updateActiveView)
  const setDefault = useViewsStore((s) => s.setDefault)
  const deleteView = useViewsStore((s) => s.deleteView)

  const [open, setOpen] = useState(false)
  const [naming, setNaming] = useState(false)
  const [name, setName] = useState('')
  const [drag, setDrag] = useState<number | null>(null)

  const activeIsUser = userViews.some((v) => v.id === activeViewId)
  const activeView = [...presets, ...userViews].find((v) => v.id === activeViewId)
  const visibleCount = columns.filter((c) => c.visible).length

  return (
    <div className="cm">
      {/* Views switcher */}
      <label className="tb-field">
        <span>View</span>
        <select className="tb-select cm-views" value={activeViewId} onChange={(e) => applyView(e.target.value)}>
          <optgroup label="Shared (admin)">
            {presets.map((v) => <option key={v.id} value={v.id}>{v.name}{defaultViewId === v.id ? ' ★' : ''}</option>)}
          </optgroup>
          {userViews.length > 0 && (
            <optgroup label="My views">
              {userViews.map((v) => <option key={v.id} value={v.id}>{v.name}{defaultViewId === v.id ? ' ★' : ''}</option>)}
            </optgroup>
          )}
        </select>
      </label>

      {/* Columns popover */}
      <button className={'btn sm cm-btn' + (dirty ? ' dirty' : '')} onClick={() => setOpen((o) => !o)} title="Show / hide / reorder columns">
        <Icon name="list" size={14} /> Columns
        <span className="cm-count">{visibleCount}</span>
      </button>

      {open && (
        <>
          <div className="cc-pop-scrim" onClick={() => { setOpen(false); setNaming(false) }} />
          <div className="cm-pop">
            <div className="cm-pop-h">
              <span>Columns — <b>{activeView?.name}</b>{dirty ? ' · edited' : ''}</span>
              {dirty && <button className="cm-link" onClick={resetWorking}>Reset</button>}
            </div>

            <div className="cm-list">
              {columns.map((c, i) => (
                <div
                  key={c.key}
                  className={'cm-row' + (drag === i ? ' dragging' : '') + (c.visible ? '' : ' off')}
                  draggable
                  onDragStart={() => setDrag(i)}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={() => { if (drag !== null && drag !== i) moveColumn(drag, i); setDrag(null) }}
                  onDragEnd={() => setDrag(null)}
                >
                  <span className="cm-grip" title="Drag to reorder">⋮⋮</span>
                  <span className="cm-label">{LABEL[c.key]}</span>
                  <span className="cm-move">
                    <button className="cm-mv" disabled={i === 0} title="Move up" onClick={() => moveColumn(i, i - 1)}><Icon name="chevron-up" size={13} /></button>
                    <button className="cm-mv" disabled={i === columns.length - 1} title="Move down" onClick={() => moveColumn(i, i + 1)}><Icon name="chevron-down" size={13} /></button>
                  </span>
                  <label className="cm-toggle" title={c.visible ? 'Hide column' : 'Show column'}>
                    <input type="checkbox" checked={c.visible} onChange={() => toggleColumn(c.key)} />
                    <span className="cm-track"><span className="cm-knob" /></span>
                  </label>
                </div>
              ))}
            </div>

            {/* per-customer custom-field columns (only when filtered to one customer) */}
            {extraColumns.length > 0 && (
              <div className="cm-extra">
                <div className="cm-extra-h">{extraTitle ?? 'Custom fields'}</div>
                {extraColumns.map((c) => (
                  <div className={'cm-row cm-extra-row' + (activeExtra.includes(c.key) ? '' : ' off')} key={c.key}>
                    <span className="cm-label">{c.label}</span>
                    <label className="cm-toggle" title={activeExtra.includes(c.key) ? 'Hide column' : 'Show column'}>
                      <input type="checkbox" checked={activeExtra.includes(c.key)} onChange={() => onToggleExtra?.(c.key)} />
                      <span className="cm-track"><span className="cm-knob" /></span>
                    </label>
                  </div>
                ))}
              </div>
            )}
            {extraColumns.length === 0 && extraHint && (
              <div className="cm-extra"><div className="cm-extra-hint">{extraHint}</div></div>
            )}

            <div className="cm-actions">
              {activeIsUser && dirty && <button className="btn sm primary" onClick={updateActiveView}>Update “{activeView?.name}”</button>}
              {!naming ? (
                <button className="btn sm" onClick={() => { setNaming(true); setName('') }}>Save as new view…</button>
              ) : (
                <span className="cm-save">
                  <input autoFocus placeholder="View name…" value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && name.trim()) { saveAsView(name); setNaming(false) } }} />
                  <button className="btn sm primary" disabled={!name.trim()} onClick={() => { saveAsView(name); setNaming(false) }}>Save</button>
                </span>
              )}
            </div>

            <div className="cm-foot">
              <button className="cm-link" onClick={() => setDefault(activeViewId)} disabled={defaultViewId === activeViewId}>
                {defaultViewId === activeViewId ? '★ This is your default' : 'Set as my default'}
              </button>
              {activeIsUser && (
                <button className="cm-link danger" onClick={() => { if (confirm(`Delete view “${activeView?.name}”?`)) { deleteView(activeViewId); setOpen(false) } }}>
                  Delete view
                </button>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
