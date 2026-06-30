/**
 * Header bar (prototype lines 491-494): customer/contact box, customer ref, route tools
 * (docs / map / print / delivery notes), clear-all. Tools open the relevant modal/window.
 */
import { useState } from 'react'
import { Icon } from './Icon.tsx'
import { StatusPill } from './StatusPill.tsx'
import { CustomerHeader } from '@/features/customer/CustomerHeader.tsx'
import { useBookingStore } from '@/store/bookingStore.ts'
import { useUiStore } from '@/store/uiStore.ts'
import { useViewStore } from '@/store/viewStore.ts'
import { useCustomersStore, type CustomFieldDef } from '@/store/customersStore.ts'

// Stable empty reference so the Zustand selector doesn't return a new [] each render
// (a fresh array fails Object.is and triggers an infinite update loop).
const NO_FIELDS: CustomFieldDef[] = []

export function Header() {
  const reset = useBookingStore((s) => s.reset)
  const quickQuote = useBookingStore((s) => s.quickQuote)
  const setQuickQuote = useBookingStore((s) => s.setQuickQuote)
  const jobStatus = useBookingStore((s) => s.jobStatus)
  const openModal = useUiStore((s) => s.openModal)
  const goToList = useViewStore((s) => s.goToList)
  const editingJobId = useViewStore((s) => s.editingJobId)

  // Selected customer's JOB-level custom fields drive the header button.
  // (Stop-level fields live on a button inside each stop instead.)
  const custId = useBookingStore((s) => s.book.cust)
  const customJob = useBookingStore((s) => s.customJob)
  const openCustomFields = useUiStore((s) => s.openCustomFields)
  const fields = useCustomersStore((s) => s.customers.find((c) => c.id === custId)?.customFields) ?? NO_FIELDS
  const jobFields = fields.filter((f) => f.scope === 'job')
  const cf = jobFieldStatus(jobFields, customJob)

  const [toolsOpen, setToolsOpen] = useState(false)

  // Quick Quote is a create-time shortcut only — hide it once the job is a booking.
  const isBooked = editingJobId != null && jobStatus === 'Booking'

  return (
    <div className="bar">
      <div className="bar-top">
        <div id="ccBox" className="ccbox" style={{ flex: '0 1 auto', minWidth: 0 }}>
          <CustomerHeader />
        </div>
        {custId && <span className="bar-status"><StatusPill status={jobStatus} /></span>}
        <span className="db-spacer" />
        <div className="bar-tools" id="routeTools" style={{ position: 'relative' }}>
          <button className="btn sm iconbtn" title="More actions" onClick={() => setToolsOpen(o => !o)}>
            <Icon name="list2" size={16} />
          </button>
          {toolsOpen && (
            <>
              <div className="bar-tools-scrim" onClick={() => setToolsOpen(false)} />
              <div className="bar-tools-menu">
                <button onClick={() => { openModal('docs'); setToolsOpen(false) }}>
                  <Icon name="file" size={14} /> Documents
                </button>
                <button onClick={() => { openModal('audit'); setToolsOpen(false) }}>
                  <Icon name="list" size={14} /> Audit trail
                </button>
                <button onClick={() => { window.alert('Route map (mock).'); setToolsOpen(false) }}>
                  <Icon name="map" size={14} /> Route map
                </button>
                <button onClick={() => { window.alert('Print delivery notes (mock).'); setToolsOpen(false) }}>
                  <Icon name="printer" size={14} /> Print delivery notes
                </button>
              </div>
            </>
          )}
        </div>
        <div className="bar-sep" />
        <button className="btn sm iconbtn" title="Clear booking" onClick={() => { if (confirm('Clear the whole booking?')) reset() }}>
          <Icon name="trash" size={15} />
        </button>
        <button className="winx" title="Close — back to list" onClick={() => goToList()}>
          <Icon name="close" size={16} />
        </button>
      </div>

      {(!isBooked || jobFields.length > 0) && (
        <div className="bar-sub">
          {!isBooked && (
            <button
              className={'qq-toggle' + (quickQuote ? ' on' : '')}
              title="Quick Quote — only collection postcode + vehicle type"
              onClick={() => setQuickQuote(!quickQuote)}
            >
              <span className="qq-dot" />
              Quick Quote
            </button>
          )}
          {jobFields.length > 0 && (
            <button
              className={'btn sm iconbtn cf-icon-btn' + (cf.missingRequired ? ' warn' : '')}
              title={`Job custom fields ${cf.filled}/${cf.total}${cf.missingRequired ? ' — required fields missing' : ''}`}
              onClick={() => openCustomFields(null)}
            >
              <Icon name="list" size={14} />
              <span className="cf-icon-badge">{cf.filled}/{cf.total}</span>
            </button>
          )}
        </div>
      )}
    </div>
  )
}

/** Filled/total + missing-required summary for the job-level custom-fields badge. */
function jobFieldStatus(
  jobFields: CustomFieldDef[],
  customJob: Record<string, string>,
): { filled: number; total: number; missingRequired: boolean } {
  let filled = 0
  let missingRequired = false
  for (const f of jobFields) {
    if ((customJob[f.id] || '').trim()) filled += 1
    else if (f.required) missingRequired = true
  }
  return { filled, total: jobFields.length, missingRequired }
}
