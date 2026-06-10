/**
 * Collapsed stop card (prototype previewHtml): head row + a calm preview of company /
 * contact / address / time / goods / ref / note. Every cell is editable IN PLACE via a
 * popover (EditableCell) — no need to open the full editor. The Edit button opens the
 * full editor; double-clicking a cell edits just that field.
 */
import { Icon } from '@/app/Icon.tsx'
import { useBookingStore } from '@/store/bookingStore.ts'
import { useUiStore } from '@/store/uiStore.ts'
import { useEffectiveAssign } from '@/store/selectors.ts'
import { parseGoods, fmtItem } from '@/lib/index.ts'
import { EditableCell } from './EditableCell.tsx'
import { StopCustomFieldsButton } from './StopCustomFieldsButton.tsx'
import { previewGoods, whenLabel, whenValue } from './format.ts'
import type { Address, Stop, StopType, TimeMode } from '@/types/index.ts'

const STATUS_LABEL: Record<string, string> = {
  booked: 'Booked', enroute: 'En route', arrived: 'Arrived', collected: 'Collected', delivered: 'Delivered',
}

// 'dd-mm-yyyy HH:MM' <-> datetime-local 'yyyy-MM-ddTHH:mm'
function toLocal(s?: string): string {
  const m = /^(\d{2})-(\d{2})-(\d{4})\s+(\d{2}):(\d{2})/.exec(s || '')
  return m ? `${m[3]}-${m[2]}-${m[1]}T${m[4]}:${m[5]}` : ''
}
function fromLocal(v: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(v)
  return m ? `${m[3]}-${m[2]}-${m[1]} ${m[4]}:${m[5]}` : ''
}

export function StopCard({ stop, index, onEdit }: { stop: Stop; index: number; onEdit: () => void }) {
  const stops = useBookingStore((s) => s.stops)
  const updateStop = useBookingStore((s) => s.updateStop)
  const removeStop = useBookingStore((s) => s.removeStop)
  const viewPod = useUiStore((s) => s.viewPod)
  const assign = useEffectiveAssign()

  const a = stop.addr
  const c = stop.contact
  const goods = previewGoods(stop, stops, assign)
  const isColl = stop.type === 'Collection' || stop.type === 'Both'
  const numColor =
    stop.type === 'Collection' ? 'var(--collect)' : stop.type === 'Delivery' ? 'var(--deliver)' : 'var(--accent)'

  const set = (patch: Partial<Stop>) => updateStop(stop.id, patch)
  const setAddr = (patch: Partial<Address>) => set({ addr: { ...a, ...patch } })
  const setContact = (patch: Partial<NonNullable<Stop['contact']>>) =>
    set({ contact: { name: '', tel: '', email: '', ...c, ...patch } })
  const setTime = (mode: TimeMode, extra: Record<string, string> = {}) => set({ time: { mode, ...extra } })

  return (
    <div className="stop">
      <div className="stop-head">
        <span className="num" style={{ background: numColor }}>{index + 1}</span>
        <select className="typesel" value={stop.type} onChange={(e) => set({ type: e.target.value as StopType })}>
          <option>Collection</option>
          <option>Delivery</option>
          <option>Both</option>
        </select>
        <h3>{a.co || a.pc || 'New address'}</h3>
        {stop.reference && <span className="stop-ref-tag" title="Reference">{stop.reference}</span>}
        <div className="sh-actions">
          <span className="itag">{STATUS_LABEL[stop.status] || stop.status}</span>
          {stop.status === 'enroute' && stop.eta && <span className="cc-tag">ETA {stop.eta}</span>}
          {stop.pod && (
            <button className="btn sm iconbtn" title="View proof" onClick={() => viewPod(stop.id)}>
              <Icon name="camera" size={14} />
            </button>
          )}
          <StopCustomFieldsButton stopId={stop.id} />
          <button className="btn sm" title="Edit stop" onClick={onEdit}>
            <Icon name="edit" size={13} /> Edit
          </button>
          {stops.length > 1 && (
            <button className="btn sm iconbtn danger" title="Remove stop" onClick={() => removeStop(stop.id)}>
              <Icon name="trash" size={14} />
            </button>
          )}
        </div>
      </div>

      <div className="pv">
        <div className="prow">
          <EditableCell
            label="Company"
            title="Company"
            value={a.co ? <b>{a.co}</b> : <span className="ph">No address yet — use Edit</span>}
          >
            <div className="fld">
              <label>Company name</label>
              <input autoFocus value={a.co} onChange={(e) => setAddr({ co: e.target.value })} />
            </div>
          </EditableCell>

          <EditableCell
            label="Contact"
            title="Site contact"
            value={c ? <b>{c.name}{c.tel ? ` · ${c.tel}` : ''}</b> : <span className="ph">—</span>}
          >
            <div className="fld"><label>Name</label><input value={c?.name || ''} onChange={(e) => setContact({ name: e.target.value })} /></div>
            <div className="fld"><label>Phone</label><input value={c?.tel || ''} onChange={(e) => setContact({ tel: e.target.value })} /></div>
            <div className="fld"><label>Email</label><input value={c?.email || ''} onChange={(e) => setContact({ email: e.target.value })} /></div>
          </EditableCell>
        </div>

        <div className="prow">
          <EditableCell
            label="Address"
            title="Address"
            value={
              a.address ? (
                <>{[a.address, a.city].filter(Boolean).join(', ')}{a.pc ? <> · <b>{a.pc}</b></> : null}</>
              ) : (
                <span className="ph">—</span>
              )
            }
          >
            <div className="fld"><label>Address</label><input autoFocus value={a.address} onChange={(e) => setAddr({ address: e.target.value })} /></div>
            <div className="g-cpc">
              <div className="fld"><label>City</label><input value={a.city} onChange={(e) => setAddr({ city: e.target.value })} /></div>
              <div className="fld"><label>Postcode</label><input value={a.pc} onChange={(e) => setAddr({ pc: e.target.value })} /></div>
            </div>
          </EditableCell>

          <EditableCell label={whenLabel(stop.time)} title="Timing" value={whenValue(stop.time)}>
            <div className="svc-row" style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
              {(['asap', 'at', 'between', 'by'] as TimeMode[]).map((m) => (
                <button key={m} className={'stepdot' + (stop.time.mode === m ? ' on' : '')} onClick={() => setTime(m)}>
                  {m === 'asap' ? 'ASAP' : m.charAt(0).toUpperCase() + m.slice(1)}
                </button>
              ))}
            </div>
            {stop.time.mode === 'at' && (
              <div className="fld"><label>At</label><input type="datetime-local" value={toLocal(stop.time.at)} onChange={(e) => setTime('at', { at: fromLocal(e.target.value) })} /></div>
            )}
            {stop.time.mode === 'by' && (
              <div className="fld"><label>By</label><input type="datetime-local" value={toLocal(stop.time.by)} onChange={(e) => setTime('by', { by: fromLocal(e.target.value) })} /></div>
            )}
            {stop.time.mode === 'between' && (
              <>
                <div className="fld"><label>From</label><input type="datetime-local" value={toLocal(stop.time.from)} onChange={(e) => setTime('between', { from: fromLocal(e.target.value), to: stop.time.to || '' })} /></div>
                <div className="fld"><label>To</label><input type="datetime-local" value={toLocal(stop.time.to)} onChange={(e) => setTime('between', { from: stop.time.from || '', to: fromLocal(e.target.value) })} /></div>
              </>
            )}
          </EditableCell>
        </div>

        {(goods || isColl) && (
          <div className="prow">
            <EditableCell
              label="Goods"
              title="Goods"
              editable={isColl}
              value={goods ? goods : <span className="ph">—</span>}
            >
              <div className="fld">
                <label>Goods — type or paste</label>
                <textarea
                  autoFocus
                  rows={3}
                  placeholder="e.g. 2 pallets at 400kg total, 1 box"
                  value={stop.goods}
                  onChange={(e) => set({ goods: e.target.value, goodsTouched: true })}
                />
              </div>
              <div className="ce-prev">
                <div className="ce-prev-h">Formatted goods</div>
                {parseGoods(stop.goods).length ? (
                  parseGoods(stop.goods).map((it, i) => (
                    <div className="ce-prev-row" key={i} dangerouslySetInnerHTML={{ __html: fmtItem(it) }} />
                  ))
                ) : (
                  <div className="ce-prev-empty">Nothing parsed yet.</div>
                )}
              </div>
            </EditableCell>
          </div>
        )}

        {stop.note && (
          <div className="prow">
            <EditableCell label="Note" title="Note" value={stop.note}>
              <div className="fld">
                <label>Driver instruction</label>
                <textarea autoFocus rows={2} value={stop.note} onChange={(e) => set({ note: e.target.value })} />
              </div>
            </EditableCell>
          </div>
        )}
      </div>
    </div>
  )
}
