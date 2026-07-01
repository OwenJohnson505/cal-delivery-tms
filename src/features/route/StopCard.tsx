/**
 * Stop — display lines (place / time / contact / goods) in the grey Route section,
 * each of which opens a compact INLINE form that fits the narrow column:
 *  · Address + Time (one form — both are always needed)
 *  · Contact (its own form)
 *  · Goods / allocation (its own form)
 * Edits write straight to the store; "Done" just closes the open form.
 */
import { useState } from 'react'
import { useBookingStore } from '@/store/bookingStore.ts'
import { useEffectiveAssign } from '@/store/selectors.ts'
import { AddressFind } from '@/features/address/AddressFind.tsx'
import { GoodsPreview, Allocation } from './StopEditor.tsx'
import { previewGoods, whenParts } from './format.ts'
import { isColl as isCollLib, isDel } from '@/lib/index.ts'
import type { Address, Stop, StopType, TimeMode } from '@/types/index.ts'

const GOODS_SEP = /[\n,;/+]|\band\b|&/i

function toLocal(s?: string): string {
  const m = /^(\d{2})-(\d{2})-(\d{4})\s+(\d{2}):(\d{2})/.exec(s || '')
  return m ? `${m[3]}-${m[2]}-${m[1]}T${m[4]}:${m[5]}` : ''
}
function fromLocal(v: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(v)
  return m ? `${m[3]}-${m[2]}-${m[1]} ${m[4]}:${m[5]}` : ''
}

type Section = 'addr' | 'contact' | 'goods' | null

export function StopCard({ stop, index, last, onEditingChange }: {
  stop: Stop; index: number; last: boolean; onEditingChange?: (on: boolean) => void
}) {
  const stops = useBookingStore((s) => s.stops)
  const updateStop = useBookingStore((s) => s.updateStop)
  const removeStop = useBookingStore((s) => s.removeStop)
  const toggleProductEq = useBookingStore((s) => s.toggleProductEq)
  const eq = useBookingStore((s) => s.eq)
  const assign = useEffectiveAssign()
  const assignUnit = useBookingStore((s) => s.assignUnit)
  const unassignUnit = useBookingStore((s) => s.unassignUnit)
  const assignAllTo = useBookingStore((s) => s.assignAllTo)
  const clearStopAssign = useBookingStore((s) => s.clearStopAssign)

  const [edit, setEditState] = useState<Section>(null)
  const setEdit = (s: Section) => { setEditState(s); onEditingChange?.(s !== null) }
  const [draft, setDraft] = useState('')
  const focused = edit !== null

  const a = stop.addr
  const c = stop.contact
  const isColl = stop.type === 'Collection' || stop.type === 'Both'
  const goods = previewGoods(stop, stops, assign)
  const loc = [a.pc, a.city].filter(Boolean).join(' · ')

  const set = (patch: Partial<Stop>) => updateStop(stop.id, patch)
  const setAddr = (patch: Partial<Address>) => set({ addr: { ...a, ...patch } })
  const setContact = (patch: Partial<NonNullable<Stop['contact']>>) =>
    set({ contact: { name: '', tel: '', email: '', ...c, ...patch } })
  const setTime = (mode: TimeMode, extra: Record<string, string> = {}) => set({ time: { mode, ...extra } })

  const goodsSegs = (t: string) => t.split(GOODS_SEP).map((x) => x.trim()).filter(Boolean)
  const addGoods = (text: string) => {
    const adds = goodsSegs(text)
    if (!adds.length) return
    set({ goods: [...goodsSegs(stop.goods), ...adds].join('\n'), goodsTouched: true })
  }
  const removeGoods = (ix: number) => {
    const segs = goodsSegs(stop.goods)
    segs.splice(ix, 1)
    set({ goods: segs.join('\n'), goodsTouched: true })
  }

  const toggle = (s: Section) => setEdit(edit === s ? null : s)

  return (
    <div className={'stop' + (focused ? ' stop-focus' : '')}>
      {!focused && (
        <div className="rail">
          <div className={'dot ' + (isColl ? 'pickup' : 'drop')}>{index + 1}</div>
          {!last && <div className="stem" />}
        </div>
      )}
      <div className="stop-content">
        <div className="stop-top">
          {focused && <span className={'dot dot-inline ' + (isColl ? 'pickup' : 'drop')}>{index + 1}</span>}
          <select className="kind-sel" value={stop.type} onChange={(e) => set({ type: e.target.value as StopType })}>
            <option>Collection</option>
            <option>Delivery</option>
            <option>Both</option>
          </select>
          <div className="spacer" />
          {stop.reference && <span className="chip">{stop.reference}</span>}
          {stops.length > 1 && (
            <button className="stop-del" title="Remove stop" onClick={() => removeStop(stop.id)}>×</button>
          )}
        </div>

        {/* Address (place) — hidden while its form is open (the fields show it) */}
        {edit !== 'addr' && (
          <div className="place" onClick={() => toggle('addr')}>
            <span className="name">{a.co || 'Add address'}</span>
            {loc && <span className="pc">· {loc}</span>}
            <span className="chev">›</span>
          </div>
        )}

        {edit === 'addr' ? (
          <div className="stop-form">
            <div className="sf-title">Address &amp; time</div>
            <AddressFind value={stop.q} onPick={(addr) => set({ addr, q: '' })} />
            <div className="sf-field"><label>Company</label><input value={a.co} onChange={(e) => setAddr({ co: e.target.value })} /></div>
            <div className="sf-field"><label>Address</label><input value={a.address} onChange={(e) => setAddr({ address: e.target.value })} /></div>
            <div className="sf-two">
              <div className="sf-field"><label>City</label><input value={a.city} onChange={(e) => setAddr({ city: e.target.value })} /></div>
              <div className="sf-field sf-pc"><label>Postcode</label><input value={a.pc} onChange={(e) => setAddr({ pc: e.target.value })} /></div>
            </div>
            <div className="sf-field">
              <label>When</label>
              <div className="sf-when">
                {(['asap', 'at', 'between', 'by'] as TimeMode[]).map((m) => (
                  <button key={m} className={'opt' + (stop.time.mode === m ? ' selected' : '')} onClick={() => setTime(m)}>
                    {m === 'asap' ? 'ASAP' : m.charAt(0).toUpperCase() + m.slice(1)}
                  </button>
                ))}
              </div>
            </div>
            {stop.time.mode === 'at' && (
              <div className="sf-field"><input type="datetime-local" value={toLocal(stop.time.at)} onChange={(e) => setTime('at', { at: fromLocal(e.target.value) })} /></div>
            )}
            {stop.time.mode === 'by' && (
              <div className="sf-field"><input type="datetime-local" value={toLocal(stop.time.by)} onChange={(e) => setTime('by', { by: fromLocal(e.target.value) })} /></div>
            )}
            {stop.time.mode === 'between' && (
              <div className="sf-two">
                <input type="datetime-local" value={toLocal(stop.time.from)} onChange={(e) => setTime('between', { from: fromLocal(e.target.value), to: stop.time.to || '' })} />
                <input type="datetime-local" value={toLocal(stop.time.to)} onChange={(e) => setTime('between', { from: stop.time.from || '', to: fromLocal(e.target.value) })} />
              </div>
            )}
            <div className="sf-actions"><button className="btn primary sm" onClick={() => setEdit(null)}>Done</button></div>
          </div>
        ) : (() => {
          const w = whenParts(stop.time)
          return (
            <div className="ml">
              <b>{w.date}</b>{w.time ? <> · {w.time}</> : null}{w.mode ? <> · <span className="ml-mode">{w.mode}</span></> : null}
            </div>
          )
        })()}

        {/* Contact */}
        <div className="ml stop-tap" onClick={() => toggle('contact')}>
          {c && (c.name || c.tel)
            ? <>{c.name}{c.tel ? <> · {c.tel}</> : null}</>
            : <span className="place-add">+ Add contact</span>}
        </div>
        {edit === 'contact' && (
          <div className="stop-form">
            <div className="sf-title">Site contact</div>
            <div className="sf-field"><label>Name</label><input value={c?.name || ''} onChange={(e) => setContact({ name: e.target.value })} /></div>
            <div className="sf-field"><label>Phone</label><input value={c?.tel || ''} onChange={(e) => setContact({ tel: e.target.value })} /></div>
            <div className="sf-field"><label>Email</label><input value={c?.email || ''} onChange={(e) => setContact({ email: e.target.value })} /></div>
            <div className="sf-actions"><button className="btn primary sm" onClick={() => setEdit(null)}>Done</button></div>
          </div>
        )}

        {/* Goods */}
        <div className="ml">
          {goods ? <><span>{goods}</span> · <a onClick={() => toggle('goods')}>edit</a></> : <a className="place-add" onClick={() => toggle('goods')}>+ Add goods</a>}
        </div>
        {edit === 'goods' && (
          <div className="stop-form">
            <div className="sf-title">{isCollLib(stop) ? 'Goods' : 'Items'} &amp; handling</div>
            {isColl && (
              <>
                <div className="sf-goods-add">
                  <input
                    placeholder="Add an item — e.g. 2 pallets @ 400kg"
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addGoods(draft); setDraft('') } }}
                  />
                  <button className="btn sm" disabled={!draft.trim()} onClick={() => { addGoods(draft); setDraft('') }}>Add</button>
                </div>
                <GoodsPreview stop={stop} eq={eq} onToggleEq={toggleProductEq} onRemove={removeGoods} />
              </>
            )}
            {isDel(stop) && (
              <Allocation
                stop={stop}
                stops={stops}
                assign={assign}
                onToggle={(unitIdx, owned) => (owned ? unassignUnit(unitIdx) : assignUnit(unitIdx, stop.id))}
                onAll={(idxs) => assignAllTo(stop.id, idxs)}
                onClear={() => clearStopAssign(stop.id)}
              />
            )}
            <div className="sf-actions"><button className="btn primary sm" onClick={() => setEdit(null)}>Done</button></div>
          </div>
        )}
      </div>
    </div>
  )
}
