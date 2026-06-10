/**
 * QuickQuotePanel — the purpose-built Quick Quote middle section. Replaces the full
 * two-column working area with one centred card: a compact dot-and-postcode route, the
 * vehicle type, optional notes, and a live "LS9 → WA2 · Small van" summary.
 *
 * The top bar, side rails and footer stay (consistency); only this middle is reorganised.
 */
import { Icon } from '@/app/Icon.tsx'
import { Combobox } from '@/features/service/Combobox.tsx'
import { useBookingStore } from '@/store/bookingStore.ts'
import { outcode } from '@/lib/index.ts'
import { newStop } from './newStop.ts'
import type { Address, Stop, StopType } from '@/types/index.ts'

const TARIFFS = ['Small van', 'SWB van', 'LWB van', 'Luton', '7.5t', '18t', 'Artic']

const DOT_COLOR: Record<StopType, string> = {
  Collection: 'var(--collect)',
  Delivery: 'var(--deliver)',
  Both: 'var(--accent)',
}

export function QuickQuotePanel() {
  const stops = useBookingStore((s) => s.stops)
  const tariff = useBookingStore((s) => s.tariff)
  const addStop = useBookingStore((s) => s.addStop)
  const updateStop = useBookingStore((s) => s.updateStop)
  const removeStop = useBookingStore((s) => s.removeStop)
  const setTariff = useBookingStore((s) => s.setTariff)
  const jobNotes = useBookingStore((s) => s.jobNotes)
  const setJobNotes = useBookingStore((s) => s.setJobNotes)

  const setAddr = (id: number, patch: Partial<Address>) => {
    const s = stops.find((x) => x.id === id)
    if (s) updateStop(id, { addr: { ...s.addr, ...patch } })
  }

  // Live summary: route outcodes joined, plus the vehicle.
  const outs = stops.map((s) => outcode(s.addr.pc)).filter(Boolean)
  const summary = [outs.join(' → '), tariff.q].filter(Boolean).join('  ·  ')

  return (
    <div className="qq-main">
      <div className="qq-panel">
        <div className="qq-panel-h">Quick quote</div>
        <div className="qq-panel-sub">
          Just the essentials — postcodes and a vehicle. Switch off Quick Quote in the top bar for a
          full quote or booking.
        </div>

        {/* Route */}
        <div className="qq-section">
          <div className="qq-label">Route</div>
          <div className="qq-route">
            {stops.map((stop) => (
              <QuickRouteRow
                key={stop.id}
                stop={stop}
                canRemove={stops.length > 1}
                onType={(type) => updateStop(stop.id, { type })}
                onPc={(pc) => setAddr(stop.id, { pc })}
                onRemove={() => removeStop(stop.id)}
              />
            ))}
          </div>
          <button className="qq-add" onClick={() => addStop(newStop(stops))}>
            <Icon name="plus" size={14} /> Add another stop
          </button>
        </div>

        {/* Vehicle */}
        <div className="qq-section qq-vehicle">
          <div className="qq-label">
            Vehicle type <span className="qq-req">required</span>
          </div>
          <Combobox
            value={tariff.q}
            options={TARIFFS}
            placeholder="Select a vehicle / rate card…"
            className={!tariff.q ? 'req' : ''}
            onChange={setTariff}
          />
        </div>

        {/* Notes */}
        <div className="qq-section">
          <div className="qq-label">Notes — optional, internal background</div>
          <textarea
            className="qq-notes"
            rows={3}
            placeholder="Anything that helps price the job…"
            value={jobNotes}
            onChange={(e) => setJobNotes(e.target.value)}
          />
        </div>

        {summary && (
          <div className="qq-summary">
            <Icon name="truck" size={14} />
            <span>{summary}</span>
          </div>
        )}
      </div>
    </div>
  )
}

function QuickRouteRow({
  stop,
  canRemove,
  onType,
  onPc,
  onRemove,
}: {
  stop: Stop
  canRemove: boolean
  onType: (t: StopType) => void
  onPc: (pc: string) => void
  onRemove: () => void
}) {
  const isColl = stop.type === 'Collection' || stop.type === 'Both'
  return (
    <div className="qq-stop-row">
      <span className="qq-stop-dot" style={{ background: DOT_COLOR[stop.type] }} />
      <select
        className="typesel qq-typesel"
        value={stop.type}
        onChange={(e) => onType(e.target.value as StopType)}
      >
        <option>Collection</option>
        <option>Delivery</option>
        <option>Both</option>
      </select>
      <input
        className={'qq-pc' + (isColl && !stop.addr.pc ? ' req' : '')}
        placeholder="Postcode"
        value={stop.addr.pc}
        onChange={(e) => onPc(e.target.value)}
      />
      {canRemove ? (
        <button className="btn sm iconbtn qq-row-x" title="Remove stop" onClick={onRemove}>
          <Icon name="trash" size={15} />
        </button>
      ) : (
        <span className="qq-row-x" />
      )}
    </div>
  )
}
