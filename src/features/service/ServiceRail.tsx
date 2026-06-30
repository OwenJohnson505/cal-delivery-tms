/**
 * Service & vehicle rail (prototype lines 526-532): tariff combobox + body/equipment/
 * service multi-selects. Shown as a SUMMARISED box (read-only chips) with an Edit toggle
 * that reveals the controls — collapsed by default in the narrow email-job view, open in
 * the full wizard. Selections write to the store, driving the requirements rollup + CX.
 */
import { useState } from 'react'
import { Icon } from '@/app/Icon.tsx'
import { Combobox } from './Combobox.tsx'
import { VehicleSpecifics } from './VehicleSpecifics.tsx'
import { useBookingStore } from '@/store/bookingStore.ts'
import { useEmailsStore } from '@/store/emailsStore.ts'

const TARIFFS = ['Small van', 'SWB van', 'LWB van', 'Luton', '7.5t', '18t', 'Artic']

export function ServiceRail() {
  const tariff = useBookingStore((s) => s.tariff)
  const setTariff = useBookingStore((s) => s.setTariff)
  const ms = useBookingStore((s) => s.ms)
  const emailFull = useEmailsStore((s) => s.panelState === 'full')
  const [open, setOpen] = useState(!emailFull)

  const summaryRow = (k: string, sel: string[]) =>
    sel.length > 0 && (
      <div className="svc-sum-row" key={k}>
        <span className="svc-sum-k">{k}</span>
        <span className="svc-sum-v">{sel.map((x) => <span key={x} className="svc-chip">{x}</span>)}</span>
      </div>
    )
  const nothing = ms.body.sel.length + ms.equip.sel.length + ms.service.sel.length === 0

  return (
    <div className="rsec svc-box">
      <div className="svc-head">
        <h3>Service &amp; vehicle</h3>
        <span className="db-spacer" />
        <button className="btn sm iconbtn" title={open ? 'Done' : 'Edit service & vehicle'} onClick={() => setOpen((o) => !o)}>
          <Icon name={open ? 'check' : 'edit'} size={13} />
        </button>
      </div>
      {open ? (
        <>
          <div className="fld">
            <label>Vehicle type / tariff</label>
            <Combobox value={tariff.q} options={TARIFFS} placeholder="Select a vehicle / rate card…" onChange={setTariff} />
          </div>
          <VehicleSpecifics />
        </>
      ) : (
        <div className="svc-summary">
          <div className="svc-sum-row">
            <span className="svc-sum-k">Vehicle</span>
            <span className="svc-sum-v">{tariff.q || <span className="svc-sum-empty">—</span>}</span>
          </div>
          {summaryRow('Body', ms.body.sel)}
          {summaryRow('Equipment', ms.equip.sel)}
          {summaryRow('Service', ms.service.sel)}
          {nothing && <div className="svc-sum-empty">No body / equipment / service selected.</div>}
        </div>
      )}
    </div>
  )
}
