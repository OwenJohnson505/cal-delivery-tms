/**
 * Inline stop editor (prototype editor mode): address find, contact, timing, goods
 * (+ live "reads as" preview and per-item equipment), and per-unit allocation for
 * deliveries. Rendered in place of the collapsed stop card while a stop is being edited;
 * "Done" collapses it back to the preview.
 */
import { Icon } from '@/app/Icon.tsx'
import { useBookingStore } from '@/store/bookingStore.ts'
import { useEffectiveAssign } from '@/store/selectors.ts'
import { AddressFind } from '@/features/address/AddressFind.tsx'
import {
  parseGoods, fmtItem, availableUnitsFor, isColl, isDel,
} from '@/lib/index.ts'
import type { Address, Stop, StopType, TimeMode } from '@/types/index.ts'

const PRODUCT_EQUIP = ['Straps', 'Blanket']

// 'dd-mm-yyyy HH:MM' <-> datetime-local 'yyyy-MM-ddTHH:mm'
function toLocal(s?: string): string {
  const m = /^(\d{2})-(\d{2})-(\d{4})\s+(\d{2}):(\d{2})/.exec(s || '')
  return m ? `${m[3]}-${m[2]}-${m[1]}T${m[4]}:${m[5]}` : ''
}
function fromLocal(v: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(v)
  return m ? `${m[3]}-${m[2]}-${m[1]} ${m[4]}:${m[5]}` : ''
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

  const stop = stops.find((s) => s.id === stopId)
  if (!stop) return null

  const set = (patch: Partial<Stop>) => updateStop(stop.id, patch)
  const setContact = (patch: Partial<NonNullable<Stop['contact']>>) =>
    set({ contact: { name: '', tel: '', email: '', ...stop.contact, ...patch } })
  const setTime = (mode: TimeMode, extra: Record<string, string> = {}) =>
    set({ time: { mode, ...extra } })
  const setAddr = (patch: Partial<Address>) => set({ addr: { ...stop.addr, ...patch } })

  function onPickAddr(addr: Address) {
    set({ addr, q: addr.co })
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
        <h3>{stop.addr.co || stop.addr.pc || 'New address'}</h3>
        <div className="sh-actions">
          {stops.length > 1 && (
            <button className="btn sm iconbtn" title="Remove stop" onClick={() => removeStop(stop.id)}>
              <Icon name="trash" size={14} />
            </button>
          )}
          <button className="btn primary sm" onClick={onDone}><Icon name="check" size={13} /> Done</button>
        </div>
      </div>

      <div className="ed">
          {/* Address find */}
          <div className="edsec">
            <div className="edhead">Find address</div>
            <AddressFind value={stop.q} onPick={onPickAddr} />
          </div>

          {/* Address — individual fields (prototype editHtml) */}
          <div className="edsec">
            <div className="edhead">
              Address {stop.addr.src && <span className="cc-tag" style={{ marginLeft: 8 }}>{stop.addr.src}</span>}
            </div>
            <div className="fld">
              <label>Company</label>
              <input value={stop.addr.co} onChange={(e) => setAddr({ co: e.target.value })} />
            </div>
            <div className="fld">
              <label>Address</label>
              <input value={stop.addr.address} onChange={(e) => setAddr({ address: e.target.value })} />
            </div>
            <div className="g-cpc">
              <div className="fld">
                <label>City</label>
                <input value={stop.addr.city} onChange={(e) => setAddr({ city: e.target.value })} />
              </div>
              <div className="fld">
                <label>Postcode</label>
                <input value={stop.addr.pc} onChange={(e) => setAddr({ pc: e.target.value })} />
              </div>
              <div className="fld">
                <label>Country</label>
                <select value={stop.addr.country} onChange={(e) => setAddr({ country: e.target.value })}>
                  <option>England</option>
                  <option>Scotland</option>
                  <option>Wales</option>
                  <option>N. Ireland</option>
                </select>
              </div>
            </div>
          </div>

          {/* Contact */}
          <div className="edsec">
            <div className="edhead">Site contact</div>
            <div className="g-cte">
              <div className="fld">
                <label>Name</label>
                <input value={stop.contact?.name || ''} onChange={(e) => setContact({ name: e.target.value })} />
              </div>
              <div className="fld">
                <label>Phone</label>
                <input value={stop.contact?.tel || ''} onChange={(e) => setContact({ tel: e.target.value })} />
              </div>
              <div className="fld">
                <label>Email</label>
                <input value={stop.contact?.email || ''} onChange={(e) => setContact({ email: e.target.value })} />
              </div>
            </div>
            <div className="fld">
              <label>Reference</label>
              <input value={stop.reference} onChange={(e) => set({ reference: e.target.value })} />
            </div>
            <div className="fld">
              <label>Instruction / note (shown to driver &amp; on CX)</label>
              <textarea rows={2} value={stop.note} onChange={(e) => set({ note: e.target.value })} />
            </div>
          </div>

          {/* Timing */}
          <div className="edsec">
            <div className="edhead">Timing</div>
            <div className="svc-row" style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {(['asap', 'at', 'between', 'by'] as TimeMode[]).map((m) => (
                <button
                  key={m}
                  className={'stepdot' + (stop.time.mode === m ? ' on' : '')}
                  onClick={() => setTime(m)}
                >
                  {m === 'asap' ? 'ASAP' : m.charAt(0).toUpperCase() + m.slice(1)}
                </button>
              ))}
            </div>
            {stop.time.mode === 'at' && (
              <div className="fld">
                <label>At</label>
                <input
                  type="datetime-local"
                  value={toLocal(stop.time.at)}
                  onChange={(e) => setTime('at', { at: fromLocal(e.target.value) })}
                />
              </div>
            )}
            {stop.time.mode === 'by' && (
              <div className="fld">
                <label>By</label>
                <input
                  type="datetime-local"
                  value={toLocal(stop.time.by)}
                  onChange={(e) => setTime('by', { by: fromLocal(e.target.value) })}
                />
              </div>
            )}
            {stop.time.mode === 'between' && (
              <div className="g2">
                <div className="fld">
                  <label>From</label>
                  <input
                    type="datetime-local"
                    value={toLocal(stop.time.from)}
                    onChange={(e) => setTime('between', { from: fromLocal(e.target.value), to: stop.time.to || '' })}
                  />
                </div>
                <div className="fld">
                  <label>To</label>
                  <input
                    type="datetime-local"
                    value={toLocal(stop.time.to)}
                    onChange={(e) => setTime('between', { from: stop.time.from || '', to: fromLocal(e.target.value) })}
                  />
                </div>
              </div>
            )}
          </div>

          {/* Goods (collection / both) */}
          {isColl(stop) && (
            <div className="edsec">
              <div className="edhead">Goods</div>
              <div className="fld">
                <textarea
                  rows={2}
                  placeholder="e.g. 2 pallets at 400kg total, 1 box"
                  value={stop.goods}
                  onChange={(e) => set({ goods: e.target.value, goodsTouched: true })}
                />
              </div>
              <GoodsPreview stop={stop} eq={eq} onToggleEq={toggleProductEq} />
            </div>
          )}

          {/* Allocation (delivery / both) */}
          {isDel(stop) && (
            <div className="edsec">
              <div className="edhead">Items — assign to this drop</div>
              <Allocation
                stop={stop}
                stops={stops}
                assign={assign}
                onToggle={(unitIdx, owned) => (owned ? unassignUnit(unitIdx) : assignUnit(unitIdx, stop.id))}
                onAll={(idxs) => assignAllTo(stop.id, idxs)}
                onClear={() => clearStopAssign(stop.id)}
              />
            </div>
          )}

          {/* Crew & handling */}
          <div className="edsec">
            <div className="edhead">Crew &amp; special handling</div>
            <div className="svc-row" style={{ display: 'flex', gap: 14, flexWrap: 'wrap', alignItems: 'center' }}>
              <label className="chk">
                <input type="checkbox" checked={!!stop.svc.twoman} onChange={() => toggleStopSvc(stop.id, 'twoman')} /> Two-man
              </label>
              <label className="chk">
                <input
                  type="checkbox"
                  onChange={(e) => setAllTwoman(e.target.checked)}
                /> Set for all stops
              </label>
              {stop.type === 'Both' && index === stops.length - 1 && (
                <label className="chk">
                  <input type="checkbox" checked={!!stop.svc.wait} onChange={() => toggleStopSvc(stop.id, 'wait')} /> Wait &amp; return
                </label>
              )}
            </div>
          </div>

          <div className="ed-foot" style={{ borderRadius: 0, boxShadow: 'none' }}>
            <button className="btn primary" onClick={onDone}>
              <Icon name="check" size={14} /> Done
            </button>
          </div>
      </div>
    </div>
  )
}

function GoodsPreview({
  stop,
  eq,
  onToggleEq,
}: {
  stop: Stop
  eq: Record<string, Record<string, boolean>>
  onToggleEq: (stopId: number, itemIndex: number, key: string) => void
}) {
  const items = parseGoods(stop.goods)
  if (!items.length) return null
  return (
    <div className="parsed">
      <div className="parsed-h">Reads as</div>
      {items.map((it, ix) => {
        const e = eq[`${stop.id}:${ix}`] || {}
        return (
          <div className="pitem" key={ix}>
            <span dangerouslySetInnerHTML={{ __html: fmtItem(it) }} />
            {it.unit && (
              <span className="eqtog" style={{ marginLeft: 8 }}>
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
            )}
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
