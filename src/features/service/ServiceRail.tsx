/**
 * Service & vehicle rail (prototype lines 526-532): tariff combobox + body/equipment/
 * service multi-selects. Selections write to the store, which drives the requirements
 * rollup and CX notes live.
 */
import { MultiSelect } from './MultiSelect.tsx'
import { Combobox } from './Combobox.tsx'
import { useBookingStore } from '@/store/bookingStore.ts'

const TARIFFS = ['Small van', 'SWB van', 'LWB van', 'Luton', '7.5t', '18t', 'Artic']

export function ServiceRail() {
  const ms = useBookingStore((s) => s.ms)
  const tariff = useBookingStore((s) => s.tariff)
  const quickQuote = useBookingStore((s) => s.quickQuote)
  const setMsSelection = useBookingStore((s) => s.setMsSelection)
  const setTariff = useBookingStore((s) => s.setTariff)

  const specifics = (
    <>
      <div className="fld">
        <label>Body type</label>
        <MultiSelect options={ms.body.o} selected={ms.body.sel} placeholder={ms.body.ph} onChange={(sel) => setMsSelection('body', sel)} />
      </div>
      <div className="fld">
        <label>Equipment</label>
        <MultiSelect options={ms.equip.o} selected={ms.equip.sel} placeholder={ms.equip.ph} onChange={(sel) => setMsSelection('equip', sel)} />
      </div>
      <div className="fld">
        <label>Service type</label>
        <MultiSelect options={ms.service.o} selected={ms.service.sel} placeholder={ms.service.ph} onChange={(sel) => setMsSelection('service', sel)} />
      </div>
    </>
  )

  return (
    <div className="rsec">
      <h3>Service &amp; vehicle</h3>
      <div className="fld">
        <label>
          Vehicle type / tariff
          {quickQuote && <span className="qq-req">required</span>}
        </label>
        <Combobox
          value={tariff.q}
          options={TARIFFS}
          placeholder="Select a vehicle / rate card…"
          className={quickQuote && !tariff.q ? 'req' : ''}
          onChange={setTariff}
        />
      </div>
      {/* Quick Quote keeps only the vehicle type; body/equipment/service are full-quote only */}
      {!quickQuote && specifics}
    </div>
  )
}
