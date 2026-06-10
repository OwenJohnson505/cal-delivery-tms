/**
 * QuickQuotePanel — the purpose-built Quick Quote middle section (top bar, side rails and
 * footer stay). Two balanced columns:
 *   Left  — route (dot + postcode rows, optional per-stop time) and internal notes.
 *   Right — vehicle type, other charges (handballing, …), and requirements (tail lift,
 *           curtain side, ADR, …).
 */
import { useState } from 'react'
import { Icon } from '@/app/Icon.tsx'
import { JobNotes } from '@/app/JobNotes.tsx'
import { OtherCharges } from '@/app/OtherCharges.tsx'
import { Combobox } from '@/features/service/Combobox.tsx'
import { VehicleSpecifics } from '@/features/service/VehicleSpecifics.tsx'
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

function toLocal(s?: string): string {
  const m = /^(\d{2})-(\d{2})-(\d{4})\s+(\d{2}):(\d{2})/.exec(s || '')
  return m ? `${m[3]}-${m[2]}-${m[1]}T${m[4]}:${m[5]}` : ''
}
function fromLocal(v: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(v)
  return m ? `${m[3]}-${m[2]}-${m[1]} ${m[4]}:${m[5]}` : ''
}

export function QuickQuotePanel() {
  const stops = useBookingStore((s) => s.stops)
  const tariff = useBookingStore((s) => s.tariff)
  const addStop = useBookingStore((s) => s.addStop)
  const updateStop = useBookingStore((s) => s.updateStop)
  const removeStop = useBookingStore((s) => s.removeStop)
  const setTariff = useBookingStore((s) => s.setTariff)

  const outs = stops.map((s) => outcode(s.addr.pc)).filter(Boolean)
  const summary = [outs.join(' → '), tariff.q].filter(Boolean).join('  ·  ')

  return (
    <div className="qq-main">
      <div className="qq-grid">
        {/* LEFT — route + notes */}
        <div className="qq-col">
          <div className="rsec">
            <h3>Route</h3>
            <div className="qq-route">
              {stops.map((stop) => (
                <QuickRouteRow
                  key={stop.id}
                  stop={stop}
                  canRemove={stops.length > 1}
                  onType={(type) => updateStop(stop.id, { type })}
                  onPatch={(patch) => updateStop(stop.id, patch)}
                  onRemove={() => removeStop(stop.id)}
                />
              ))}
            </div>
            <button className="qq-add" onClick={() => addStop(newStop(stops))}>
              <Icon name="plus" size={14} /> Add another stop
            </button>
            {summary && (
              <div className="qq-summary">
                <Icon name="truck" size={14} />
                <span>{summary}</span>
              </div>
            )}
          </div>

          <JobNotes />
        </div>

        {/* RIGHT — vehicle, charges, requirements */}
        <div className="qq-col">
          <div className="rsec">
            <h3>Vehicle</h3>
            <div className="fld">
              <label>
                Vehicle type / tariff <span className="qq-req">required</span>
              </label>
              <Combobox
                value={tariff.q}
                options={TARIFFS}
                placeholder="Select a vehicle / rate card…"
                className={!tariff.q ? 'req' : ''}
                onChange={setTariff}
              />
            </div>
          </div>

          <OtherCharges />

          <div className="rsec">
            <h3>Requirements</h3>
            <VehicleSpecifics />
          </div>
        </div>
      </div>
    </div>
  )
}

function QuickRouteRow({
  stop,
  canRemove,
  onType,
  onPatch,
  onRemove,
}: {
  stop: Stop
  canRemove: boolean
  onType: (t: StopType) => void
  onPatch: (patch: Partial<Stop>) => void
  onRemove: () => void
}) {
  const isColl = stop.type === 'Collection' || stop.type === 'Both'
  const hasTime = stop.time.mode !== 'asap'
  const [showTime, setShowTime] = useState(hasTime)

  const setAddr = (patch: Partial<Address>) => onPatch({ addr: { ...stop.addr, ...patch } })

  return (
    <>
      <div className="qq-stop-row">
        <span className="qq-stop-dot" style={{ background: DOT_COLOR[stop.type] }} />
        <select className="typesel qq-typesel" value={stop.type} onChange={(e) => onType(e.target.value as StopType)}>
          <option>Collection</option>
          <option>Delivery</option>
          <option>Both</option>
        </select>
        <input
          className={'qq-pc' + (isColl && !stop.addr.pc ? ' req' : '')}
          placeholder="Postcode"
          value={stop.addr.pc}
          onChange={(e) => setAddr({ pc: e.target.value })}
        />
        <button
          className={'btn sm iconbtn qq-row-btn' + (hasTime ? ' on' : '')}
          title="Add a date & time (optional)"
          onClick={() => setShowTime((v) => !v)}
        >
          <Icon name="clock" size={15} />
        </button>
        {canRemove ? (
          <button className="btn sm iconbtn" title="Remove stop" onClick={onRemove}>
            <Icon name="trash" size={15} />
          </button>
        ) : (
          <span className="qq-row-x" />
        )}
      </div>
      {showTime && (
        <div className="qq-time-row">
          <span className="qq-time-lbl">Date &amp; time</span>
          <input
            type="datetime-local"
            value={toLocal(stop.time.at)}
            onChange={(e) => {
              const v = e.target.value
              onPatch({ time: v ? { mode: 'at', at: fromLocal(v) } : { mode: 'asap' } })
            }}
          />
          {hasTime && (
            <button
              className="discl"
              onClick={() => {
                onPatch({ time: { mode: 'asap' } })
                setShowTime(false)
              }}
            >
              Clear
            </button>
          )}
        </div>
      )}
    </>
  )
}
