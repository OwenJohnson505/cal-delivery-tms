/**
 * Quick Quote stop card — the simplified stop. Only the postcode is needed (mandatory on
 * the collection); full address, contact and timing are hidden. Optional note/goods and
 * date & time are collapsed behind a click (Collapsible).
 */
import { Icon } from '@/app/Icon.tsx'
import { Collapsible } from '@/app/Collapsible.tsx'
import { useBookingStore } from '@/store/bookingStore.ts'
import type { Address, Stop, StopType, TimeMode } from '@/types/index.ts'

function toLocal(s?: string): string {
  const m = /^(\d{2})-(\d{2})-(\d{4})\s+(\d{2}):(\d{2})/.exec(s || '')
  return m ? `${m[3]}-${m[2]}-${m[1]}T${m[4]}:${m[5]}` : ''
}
function fromLocal(v: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(v)
  return m ? `${m[3]}-${m[2]}-${m[1]} ${m[4]}:${m[5]}` : ''
}

export function QuickStopCard({ stop, index }: { stop: Stop; index: number }) {
  const stops = useBookingStore((s) => s.stops)
  const updateStop = useBookingStore((s) => s.updateStop)
  const removeStop = useBookingStore((s) => s.removeStop)

  const isColl = stop.type === 'Collection' || stop.type === 'Both'
  const numColor =
    stop.type === 'Collection' ? 'var(--collect)' : stop.type === 'Delivery' ? 'var(--deliver)' : 'var(--accent)'

  const set = (patch: Partial<Stop>) => updateStop(stop.id, patch)
  const setAddr = (patch: Partial<Address>) => set({ addr: { ...stop.addr, ...patch } })
  const setTime = (mode: TimeMode, extra: Record<string, string> = {}) => set({ time: { mode, ...extra } })

  const hasTiming = stop.time.mode !== 'asap'
  const hasNotes = !!(stop.note || stop.goods)

  return (
    <div className="stop">
      <div className="stop-head">
        <span className="num" style={{ background: numColor }}>{index + 1}</span>
        <select className="typesel" value={stop.type} onChange={(e) => set({ type: e.target.value as StopType })}>
          <option>Collection</option>
          <option>Delivery</option>
          <option>Both</option>
        </select>
        <h3>{stop.addr.pc || (isColl ? 'Collection' : 'Delivery')}</h3>
        <div className="sh-actions">
          {stops.length > 1 && (
            <button className="btn sm iconbtn" title="Remove stop" onClick={() => removeStop(stop.id)}>
              <Icon name="trash" size={14} />
            </button>
          )}
        </div>
      </div>

      <div className="ed" style={{ padding: '8px 11px 11px' }}>
        <div className="fld">
          <label>
            Postcode
            {isColl && <span className="qq-req">required</span>}
          </label>
          <input
            className={isColl && !stop.addr.pc ? 'req' : ''}
            placeholder="e.g. LS9 0PX"
            value={stop.addr.pc}
            onChange={(e) => setAddr({ pc: e.target.value })}
          />
        </div>

        <Collapsible label={hasNotes ? 'Note / goods ✓' : 'Add note / goods'} defaultOpen={hasNotes}>
          {isColl && (
            <div className="fld">
              <label>Goods (optional)</label>
              <textarea
                rows={2}
                placeholder="e.g. 2 pallets, 1 box"
                value={stop.goods}
                onChange={(e) => set({ goods: e.target.value, goodsTouched: true })}
              />
            </div>
          )}
          <div className="fld">
            <label>Note (optional)</label>
            <textarea rows={2} value={stop.note} onChange={(e) => set({ note: e.target.value })} />
          </div>
        </Collapsible>

        <Collapsible label={hasTiming ? 'Date & time ✓' : 'Add date & time'} defaultOpen={hasTiming}>
          <div className="svc-row" style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
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
            <div className="g2">
              <div className="fld"><label>From</label><input type="datetime-local" value={toLocal(stop.time.from)} onChange={(e) => setTime('between', { from: fromLocal(e.target.value), to: stop.time.to || '' })} /></div>
              <div className="fld"><label>To</label><input type="datetime-local" value={toLocal(stop.time.to)} onChange={(e) => setTime('between', { from: stop.time.from || '', to: fromLocal(e.target.value) })} /></div>
            </div>
          )}
        </Collapsible>
      </div>
    </div>
  )
}
