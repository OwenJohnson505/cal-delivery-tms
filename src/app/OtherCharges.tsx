/**
 * Charges section — matches the redesign reference: a "+ Add charge" menu of common
 * charges (with default rates) and inline-editable amount rows. No dropdown box.
 */
import { useState } from 'react'
import { useBookingStore } from '@/store/bookingStore.ts'

const CHARGE_CAT: [string, number][] = [
  ['Handballing', 35], ['Waiting time', 45], ['Congestion charge', 15], ['Ferry crossing', 120],
  ['Timed delivery', 25], ['Out of hours', 60], ['Pallet exchange', 12], ['ADR surcharge', 50], ['Storage', 20],
]

export function OtherCharges() {
  const charges = useBookingStore((s) => s.charges)
  const addCharge = useBookingStore((s) => s.addCharge)
  const setChargeRate = useBookingStore((s) => s.setChargeRate)
  const removeCharge = useBookingStore((s) => s.removeCharge)
  const [menu, setMenu] = useState(false)

  return (
    <div className="section">
      <div className="sec-head">
        <span className="sec-title">Charges</span>
        <div className="spacer" />
        <span className="sec-action" onClick={() => setMenu((o) => !o)}>+ Add charge</span>
      </div>

      {menu && (
        <div className="picker open">
          <div className="picker-inner">
            <div className="picker-title">Add a charge</div>
            <div className="menu">
              {CHARGE_CAT.map(([name, rate]) => (
                <div key={name} className="menu-item" onClick={() => { addCharge(name, rate); setMenu(false) }}>
                  <span>{name}</span>
                  <span className="mrate">£{rate.toFixed(2)}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {charges.length === 0 ? (
        <div className="charges-empty">No charges yet — add one above.</div>
      ) : (
        charges.map((c) => (
          <div key={c.id} className="charge">
            <span className="cname">{c.label}</span>
            <span className="cfield">
              <span className="cur">£</span>
              <input
                inputMode="decimal"
                value={c.rate.toFixed(2)}
                onChange={(e) => setChargeRate(c.id, parseFloat(e.target.value) || 0)}
              />
            </span>
            <span className="del" title="Remove" onClick={() => removeCharge(c.id)}>×</span>
          </div>
        ))
      )}
    </div>
  )
}
