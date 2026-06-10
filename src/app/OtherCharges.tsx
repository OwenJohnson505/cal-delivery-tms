/**
 * Other charges (prototype lines 539-547) — additional line-item charges such as
 * handballing or waiting time. Wired to the store; used in both the full rail and the
 * Quick Quote panel.
 */
import { useState } from 'react'
import { Icon } from './Icon.tsx'
import { useBookingStore } from '@/store/bookingStore.ts'

const CHARGE_TYPES = [
  'Handballing',
  'Waiting time',
  'Congestion charge',
  'Tail-lift surcharge',
  'Out-of-hours',
  'Additional drop',
]

export function OtherCharges({ grow = false }: { grow?: boolean }) {
  const charges = useBookingStore((s) => s.charges)
  const addCharge = useBookingStore((s) => s.addCharge)
  const removeCharge = useBookingStore((s) => s.removeCharge)

  const [label, setLabel] = useState('')
  const [rate, setRate] = useState('')

  function add() {
    if (!label) return
    addCharge(label, parseFloat(rate) || 0)
    setLabel('')
    setRate('')
  }

  return (
    <div className={'rsec' + (grow ? ' qq-grow' : '')}>
      <h3>Other charges</h3>
      <div style={{ display: 'flex', gap: 6, alignItems: 'end' }}>
        <div className="fld" style={{ flex: 1 }}>
          <label>Charge</label>
          <select value={label} onChange={(e) => setLabel(e.target.value)}>
            <option value="">— Select —</option>
            {CHARGE_TYPES.map((t) => (
              <option key={t}>{t}</option>
            ))}
          </select>
        </div>
        <div className="fld" style={{ width: 64 }}>
          <label>Rate £</label>
          <input
            type="text"
            inputMode="decimal"
            placeholder="0.00"
            value={rate}
            onChange={(e) => setRate(e.target.value)}
          />
        </div>
        <button className="btn primary sm" style={{ marginBottom: 1 }} onClick={add} disabled={!label}>
          Add
        </button>
      </div>
      <table>
        <tbody>
          {charges.length === 0 ? (
            <tr>
              <td className="empty">No charges added</td>
            </tr>
          ) : (
            charges.map((c) => (
              <tr key={c.id}>
                <td>{c.label}</td>
                <td className="num">£{c.rate.toFixed(2)}</td>
                <td style={{ width: 28, textAlign: 'right' }}>
                  <button className="btn sm iconbtn danger" title="Remove charge" onClick={() => removeCharge(c.id)}>
                    <Icon name="trash" size={14} />
                  </button>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  )
}
