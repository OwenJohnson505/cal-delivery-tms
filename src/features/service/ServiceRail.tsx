/**
 * Service & vehicle rail (prototype lines 526-532): tariff combobox + body/equipment/
 * service multi-selects. Selections write to the store, which drives the requirements
 * rollup and CX notes live. Shown in the full layout; Quick Quote handles the vehicle in
 * QuickQuotePanel.
 */
import { Combobox } from './Combobox.tsx'
import { VehicleSpecifics } from './VehicleSpecifics.tsx'
import { useBookingStore } from '@/store/bookingStore.ts'

const TARIFFS = ['Small van', 'SWB van', 'LWB van', 'Luton', '7.5t', '18t', 'Artic']

export function ServiceRail() {
  const tariff = useBookingStore((s) => s.tariff)
  const setTariff = useBookingStore((s) => s.setTariff)

  return (
    <div className="rsec">
      <h3>Service &amp; vehicle</h3>
      <div className="fld">
        <label>Vehicle type / tariff</label>
        <Combobox
          value={tariff.q}
          options={TARIFFS}
          placeholder="Select a vehicle / rate card…"
          onChange={setTariff}
        />
      </div>
      <VehicleSpecifics />
    </div>
  )
}
