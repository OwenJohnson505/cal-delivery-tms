/**
 * Inline stop editor (prototype editor mode): address find, contact, timing, goods
 * (+ live "reads as" preview and per-item equipment), and per-unit allocation for
 * deliveries. Rendered in place of the collapsed stop card while a stop is being edited;
 * "Done" collapses it back to the preview.
 */
import { useState } from 'react'
import { Icon } from '@/app/Icon.tsx'
import { useBookingStore } from '@/store/bookingStore.ts'
import { useEffectiveAssign } from '@/store/selectors.ts'
import { AddressFind } from '@/features/address/AddressFind.tsx'
import { StopCustomFieldsButton } from './StopCustomFieldsButton.tsx'
import {
  parseGoods, fmtItem, availableUnitsFor, isColl, isDel,
} from '@/lib/index.ts'
import type { Address, Stop, StopType, TimeMode } from '@/types/index.ts'

const PRODUCT_EQUIP = ['Straps', 'Blanket']
// Same separators parseGoods uses, so one added line == one parsed item.
const GOODS_SEP = /[\n,;/+]|\band\b|&/i

// 'dd-mm-yyyy HH:MM' <-> datetime-local 'yyyy-MM-ddTHH:mm'
function toLocal(s?: string): string {
  const m = /^(\d{2})-(\d{2})-(\d{4})\s+(\d{2}):(\d{2})/.exec(s || '')
  return m ? `${m[3]}-${m[2]}-${m[1]}T${m[4]}:${m[5]}` : ''
}
function fromLocal(v: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(v)
  return m ? `${m[3]}-${m[2]}-${m[1]} ${m[4]}:${m[5]}` : ''
}
const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
/** ASAP resolves to now + 45 min (display only). */
function asapDisplay(): string {
  const d = new Date(Date.now() + 45 * 60000)
  const p = (n: number) => ('0' + n).slice(-2)
  return `${DOW[d.getDay()]} ${p(d.getDate())}/${p(d.getMonth() + 1)} · by ${p(d.getHours())}:${p(d.getMinutes())}`
}

const NUM_COLOR: Record<StopType, string> = {
  Collection: 'var(--collect)',
  Delivery: 'var(--deliver)',
  Both: 'var(--accent)',
}

export function StopEditor({ stopId, index, onDone }: { stopId: number; index: number; onDone: () => void }) {
  const stops = useBookingStore((s) => s.stops)
  const updateStop = useBookingStore((s) => s.updateStop)
  const removeStop = useBookingStore((s) => s.removeStop)
  const toggleStopSvc = useBookingStore((s) => s.toggleStopSvc)
  const setAllTwoman = useBookingStore((s) => s.setAllTwoman)
  const toggleProductEq = useBookingStore((s) => s.toggleProductEq)
  const eq = useBookingStore((s) => s.eq)
  const assign = useEffectiveAssign()
  const assignUnit = useBookingStore((s) => s.assignUnit)
  const unassignUnit = useBookingStore((s) => s.unassignUnit)
  const assignAllTo = useBookingStore((s) => s.assignAllTo)
  const clearStopAssign = useBookingStore((s) => s.clearStopAssign)
  // single-line "add an item" draft + optional bulk-paste box
  const [draft, setDraft] = useState('')
  const [bulkOpen, setBulkOpen] = useState(false)
  const [bulkText, setBulkText] = useState('')

  const stop = stops.find((s) => s.id === stopId)
  if (!stop) return null

  const set = (patch: Partial<Stop>) => updateStop(stop.id, patch)
  const setContact = (patch: Partial<NonNullable<Stop['contact']>>) =>
    set({ contact: { name: '', tel: '', email: '', ...stop.contact, ...patch } })
  const setTime = (mode: TimeMode, extra: Record<string, string> = {}) =>
    set({ time: { mode, ...extra } })
  const setAddr = (patch: Partial<Address>) => set({ addr: { ...stop.addr, ...patch } })

  function onPickAddr(addr: Address) {
    set({ addr, q: '' })
  }

  // Goods are stored as the raw string parseGoods reads. We keep it normalised to
  // one segment per line so the "reads as" rows map 1:1 to lines (for remove).
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

  return (
    <div className="stop editing">
      <div className="stop-head">
        <span className="num" style={{ background: NUM_COLOR[stop.type] }}>{index + 1}</span>
        <select className="typesel" value={stop.type} onChange={(e) => set({ type: e.target.value as StopType })}>
          <option>Collection</option>
          <option>Delivery</option>
          <option>Both</option>
        </select>
        <input
          className="stop-ref"
          placeholder="Reference (your ref / PO)…"
          value={stop.reference}
          onChange={(e) => set({ reference: e.target.value })}
        />
        <div className="sh-actions">
          <StopCustomFieldsButton stopId={stop.id} />
          {stops.length > 1 && (
            <button className="btn sm iconbtn danger" title="Remove stop" onClick={() => removeStop(stop.id)}>
              <Icon name="trash" size={14} />
            </button>
          )}
        </div>
      </div>

      <div className="ed ed-compact ed-2col">
       <div className="ed-col">
        {/* Address & timing */}
        <div className="edsec">
          <div className="edhead">Address &amp; timing {stop.addr.src && <span className="cc-tag" style={{ marginLeft: 8 }}>{stop.addr.src}</span>}</div>
          <AddressFind value={stop.q} onPick={onPickAddr} />
          <div className="g2">
            <div className="fld"><label>Company</label><input value={stop.addr.co} onChange={(e) => setAddr({ co: e.target.value })} /></div>
            <div className="fld"><label>Address</label><input value={stop.addr.address} onChange={(e) => setAddr({ address: e.target.value })} /></div>
          </div>
          <div className="g2">
            <div className="fld"><label>City</label><input value={stop.addr.city} onChange={(e) => setAddr({ city: e.target.value })} /></div>
            <div className="fld"><label>Postcode</label><input value={stop.addr.pc} onChange={(e) => setAddr({ pc: e.target.value })} /></div>
          </div>
          <div className="g2">
            <div className="fld"><label>Country</label>
              <select value={stop.addr.country} onChange={(e) => setAddr({ country: e.target.value })}>
                <option>England</option><option>Scotland</option><option>Wales</option><option>N. Ireland</option>
              </select>
            </div>
            <div className="fld">
              <label>When</label>
              <div className="svc-row" style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                {(['asap', 'at', 'between', 'by'] as TimeMode[]).map((m) => (
                  <button key={m} className={'stepdot' + (stop.time.mode === m ? ' on' : '')} onClick={() => setTime(m)}>
                    {m === 'asap' ? 'ASAP' : m.charAt(0).toUpperCase() + m.slice(1)}
                  </button>
                ))}
              </div>
            </div>
          </div>
          {/* the time box is always shown so it never pops in/out */}
          {stop.time.mode === 'asap' && (
            <div className="fld"><input type="text" value={asapDisplay()} disabled /></div>
          )}
          {stop.time.mode === 'at' && (
            <div className="fld"><input type="datetime-local" value={toLocal(stop.time.at)} onChange={(e) => setTime('at', { at: fromLocal(e.target.value) })} /></div>
          )}
          {stop.time.mode === 'by' && (
            <div className="fld"><input type="datetime-local" value={toLocal(stop.time.by)} onChange={(e) => setTime('by', { by: fromLocal(e.target.value) })} /></div>
          )}
          {stop.time.mode === 'between' && (
            <div className="g2">
              <input type="datetime-local" value={toLocal(stop.time.from)} onChange={(e) => setTime('between', { from: fromLocal(e.target.value), to: stop.time.to || '' })} />
              <input type="datetime-local" value={toLocal(stop.time.to)} onChange={(e) => setTime('between', { from: stop.time.from || '', to: fromLocal(e.target.value) })} />
            </div>
          )}
        </div>

        {/* Driver instructions (kept on the left to free goods space on the right) */}
        <div className="edsec">
          <div className="edhead">Driver instruction</div>
          <div className="fld"><input value={stop.note} placeholder="" onChange={(e) => set({ note: e.target.value })} /></div>
        </div>
       </div>
       <div className="ed-col">
        {/* Contact */}
        <div className="edsec">
          <div className="edhead">Site contact</div>
          <div className="g2">
            <div className="fld"><label>Contact name</label><input value={stop.contact?.name || ''} onChange={(e) => setContact({ name: e.target.value })} /></div>
            <div className="fld"><label>Phone</label><input value={stop.contact?.tel || ''} onChange={(e) => setContact({ tel: e.target.value })} /></div>
          </div>
          <div className="fld"><label>Email</label><input value={stop.contact?.email || ''} onChange={(e) => setContact({ email: e.target.value })} /></div>
        </div>

        {/* Goods / items & crew */}
        <div className="edsec">
          <div className="edhead">{isColl(stop) ? 'Goods' : 'Items'} &amp; handling</div>
          {isColl(stop) && (
            <>
              <div className="goods-add-row">
                <input
                  className="goods-add"
                  placeholder="Add an item — e.g. 2 pallets @ 400kg — then Enter"
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addGoods(draft); setDraft('') } }}
                />
                <button type="button" className="btn sm" disabled={!draft.trim()} onClick={() => { addGoods(draft); setDraft('') }}>Add</button>
                <button type="button" className={'btn sm' + (bulkOpen ? ' primary' : '')} title="Paste a list of items" onClick={() => setBulkOpen((o) => !o)}>Paste list</button>
              </div>
              {bulkOpen && (
                <div className="goods-bulk">
                  <textarea
                    rows={4}
                    autoFocus
                    placeholder="Paste items — one per line or comma-separated (e.g. straight from an email)…"
                    value={bulkText}
                    onChange={(e) => setBulkText(e.target.value)}
                  />
                  <div className="goods-bulk-actions">
                    <button type="button" className="btn sm primary" disabled={!bulkText.trim()} onClick={() => { addGoods(bulkText); setBulkText(''); setBulkOpen(false) }}>Add all</button>
                    <button type="button" className="btn sm" onClick={() => { setBulkText(''); setBulkOpen(false) }}>Cancel</button>
                  </div>
                </div>
              )}
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
          <div className="svc-row" style={{ display: 'flex', gap: 14, flexWrap: 'wrap', alignItems: 'center' }}>
            <label className="chk"><input type="checkbox" checked={!!stop.svc.twoman} onChange={() => toggleStopSvc(stop.id, 'twoman')} /> Two-man</label>
            {stop.svc.twoman && (
              <label className="chk"><input type="checkbox" onChange={(e) => setAllTwoman(e.target.checked)} /> Set for all stops</label>
            )}
            {stop.type === 'Both' && index === stops.length - 1 && (
              <label className="chk"><input type="checkbox" checked={!!stop.svc.wait} onChange={() => toggleStopSvc(stop.id, 'wait')} /> Wait &amp; return</label>
            )}
          </div>
        </div>
       </div>
      </div>
      <div className="ed-foot">
        <span className="ed-foot-hint">Finished this stop?</span>
        <button className="btn primary" onClick={onDone}>
          <Icon name="check" size={14} /> {index < stops.length - 1 ? 'Done — next stop' : 'Done'}
        </button>
      </div>
    </div>
  )
}

function GoodsPreview({
  stop,
  eq,
  onToggleEq,
  onRemove,
}: {
  stop: Stop
  eq: Record<string, Record<string, boolean>>
  onToggleEq: (stopId: number, itemIndex: number, key: string) => void
  onRemove: (itemIndex: number) => void
}) {
  const items = parseGoods(stop.goods)
  const [infoOpen, setInfoOpen] = useState(false)
  return (
    <div className="parsed">
      <div className="parsed-h">
        <span>Formatted goods{items.length ? ` · ${items.length}` : ''}</span>
        <span className="fg-info-wrap">
          <button type="button" className="dsec-info" title="About formatted goods" onClick={() => setInfoOpen((o) => !o)}>
            <Icon name="info" size={13} />
          </button>
          {infoOpen && (
            <>
              <div className="cc-pop-scrim" onClick={() => setInfoOpen(false)} />
              <div className="fg-info-pop">Add items above — one at a time, or paste a list — and they’ll be itemised here.</div>
            </>
          )}
        </span>
      </div>
      {items.map((it, ix) => {
        const e = eq[`${stop.id}:${ix}`] || {}
        return (
          <div className="pitem" key={ix}>
            <span className="pitem-txt" dangerouslySetInnerHTML={{ __html: fmtItem(it) }} />
            <span className="eqtog">
              {PRODUCT_EQUIP.map((k) => {
                const on = e[k] || e[k.toLowerCase()]
                return (
                  <button
                    key={k}
                    type="button"
                    className={'eqbtn' + (on ? ' on' : '')}
                    onClick={() => onToggleEq(stop.id, ix, k)}
                  >
                    {k}
                  </button>
                )
              })}
            </span>
            <button type="button" className="pdel" title="Remove item" onClick={() => onRemove(ix)}>
              <Icon name="trash" size={12} />
            </button>
          </div>
        )
      })}
    </div>
  )
}

function Allocation({
  stop,
  stops,
  assign,
  onToggle,
  onAll,
  onClear,
}: {
  stop: Stop
  stops: Stop[]
  assign: Record<number, number>
  onToggle: (unitIdx: number, owned: boolean) => void
  onAll: (idxs: number[]) => void
  onClear: () => void
}) {
  const avail = availableUnitsFor(stop, stops)
  if (!avail.length) {
    return (
      <div className="hint">
        No items are collected before this stop in the route. Add a collection with goods earlier, then assign here.
      </div>
    )
  }
  // group by collection
  const groups: Record<number, typeof avail> = {}
  const order: number[] = []
  avail.forEach((u) => {
    if (!groups[u.collId]) {
      groups[u.collId] = []
      order.push(u.collId)
    }
    groups[u.collId].push(u)
  })
  const stopLabel = (id: number) => {
    const i = stops.findIndex((s) => s.id === id)
    return `Stop ${i + 1}${stops[i]?.addr.pc ? ' · ' + stops[i].addr.pc : ''}`
  }

  return (
    <div className="alloc">
      <div className="alloc-head" style={{ display: 'flex', alignItems: 'center' }}>
        <span className="parsed-h">Available units</span>
        <span className="alloc-btns" style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
          <button type="button" className="discl" onClick={() => onAll(avail.map((u) => u.idx))}>All here</button>
          <button type="button" className="discl" onClick={onClear}>Clear</button>
        </span>
      </div>
      {order.map((collId) => (
        <div key={collId}>
          <div className="agroup">From {stopLabel(collId)}</div>
          {groups[collId].map((u) => {
            const owner = assign[u.idx]
            const here = owner === stop.id
            const sub = [u.wt, u.dim].filter(Boolean).join(' · ')
            return (
              <label className={'achk' + (here ? ' on' : '')} key={u.idx}>
                <input type="checkbox" checked={here} onChange={() => onToggle(u.idx, here)} />
                <span className="aname">
                  {u.label}
                  {sub && <span className="pdim"> {sub}</span>}
                </span>
                {!here && owner != null && <span className="aelse">→ {stopLabel(owner)}</span>}
                {!here && owner == null && <span className="afree">unassigned</span>}
              </label>
            )
          })}
        </div>
      ))}
    </div>
  )
}
