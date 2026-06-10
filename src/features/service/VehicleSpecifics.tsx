/**
 * VehicleSpecifics — body type / equipment / service multi-selects (tail lift, curtain
 * side, ADR, …). Shared by the full ServiceRail and the Quick Quote requirements card.
 */
import { MultiSelect } from './MultiSelect.tsx'
import { useBookingStore } from '@/store/bookingStore.ts'

export function VehicleSpecifics() {
  const ms = useBookingStore((s) => s.ms)
  const setMsSelection = useBookingStore((s) => s.setMsSelection)
  return (
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
}
