/**
 * Quick Quote stop card — the leanest possible stop: just type + postcode. Full address,
 * contact, notes/goods and timing are all dropped in Quick Quote mode (use a full quote
 * for those). Background info goes in the shared Job notes panel instead.
 */
import { Icon } from '@/app/Icon.tsx'
import { useBookingStore } from '@/store/bookingStore.ts'
import type { Address, Stop, StopType } from '@/types/index.ts'

export function QuickStopCard({ stop, index }: { stop: Stop; index: number }) {
  const stops = useBookingStore((s) => s.stops)
  const updateStop = useBookingStore((s) => s.updateStop)
  const removeStop = useBookingStore((s) => s.removeStop)

  const isColl = stop.type === 'Collection' || stop.type === 'Both'
  const numColor =
    stop.type === 'Collection' ? 'var(--collect)' : stop.type === 'Delivery' ? 'var(--deliver)' : 'var(--accent)'

  const set = (patch: Partial<Stop>) => updateStop(stop.id, patch)
  const setAddr = (patch: Partial<Address>) => set({ addr: { ...stop.addr, ...patch } })

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
              <Icon name="trash" size={16} />
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
      </div>
    </div>
  )
}
