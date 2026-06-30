/**
 * Per-stop "Custom fields" button. Shows only when the selected customer has
 * stop-level custom fields; opens the custom-fields modal scoped to this stop.
 * Job-level fields live on the header button instead (CustomerHeader / Header).
 */
import { Icon } from '@/app/Icon.tsx'
import { useBookingStore } from '@/store/bookingStore.ts'
import { useUiStore } from '@/store/uiStore.ts'
import { useCustomersStore, type CustomFieldDef } from '@/store/customersStore.ts'

const NO_FIELDS: CustomFieldDef[] = []

export function StopCustomFieldsButton({ stopId, size = 'sm' }: { stopId: number; size?: 'sm' | '' }) {
  const custId = useBookingStore((s) => s.book.cust)
  const stop = useBookingStore((s) => s.stops.find((st) => st.id === stopId))
  const fields = useCustomersStore((s) => s.customers.find((c) => c.id === custId)?.customFields) ?? NO_FIELDS
  const openCustomFields = useUiStore((s) => s.openCustomFields)

  const stopFields = fields.filter((f) => f.scope === 'stop')
  if (!stop || stopFields.length === 0) return null

  const filled = stopFields.filter((f) => !!(stop.custom?.[f.id] || '').trim()).length
  const missingRequired = stopFields.some((f) => f.required && !(stop.custom?.[f.id] || '').trim())

  return (
    <button
      type="button"
      className={'btn sm iconbtn cf-icon-btn' + (missingRequired ? ' warn' : '')}
      title={`Custom fields ${filled}/${stopFields.length}${missingRequired ? ' — required fields missing' : ''}`}
      onClick={() => openCustomFields(stopId)}
    >
      <Icon name="list" size={13} />
      <span className="cf-icon-badge">{filled}/{stopFields.length}</span>
    </button>
  )
}
