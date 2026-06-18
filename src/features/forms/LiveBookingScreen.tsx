/**
 * WizardHost — picks what the booking screen shows: the bespoke Original Wizard, or the
 * tenant's live custom ScreenForm for the current mode (booking / quote / quickquote).
 * Switching the live form in Settings → Form Builder changes this with no code change.
 *
 * Editing an existing saved job always uses the bespoke wizard (the generic renderer
 * can't yet load/round-trip a saved job — that's the data-binding phase).
 */
import { LeftRail } from '@/app/Rails.tsx'
import { BookingWizard } from '@/app/BookingWizard.tsx'
import { FormRenderer, type FormValues } from './FormRenderer.tsx'
import { useFormsStore, ORIGINAL_WIZARD, type FormMode, type ScreenForm } from '@/store/formsStore.ts'
import { useBookingStore } from '@/store/bookingStore.ts'
import { useJobsStore, captureSnapshot } from '@/store/jobsStore.ts'
import { useViewStore } from '@/store/viewStore.ts'
import type { JobStatus } from '@/types/index.ts'

function stamp(): string {
  const d = new Date()
  const p = (n: number) => ('0' + n).slice(-2)
  return `${p(d.getDate())}-${p(d.getMonth() + 1)}-${d.getFullYear()} ${p(d.getHours())}:${p(d.getMinutes())}`
}

export function WizardHost() {
  const quickQuote = useBookingStore((s) => s.quickQuote)
  const jobStatus = useBookingStore((s) => s.jobStatus)
  const editingJobId = useViewStore((s) => s.editingJobId)
  const active = useFormsStore((s) => s.active)
  const forms = useFormsStore((s) => s.forms)

  const mode: FormMode = quickQuote ? 'quickquote' : jobStatus === 'Quote' ? 'quote' : 'booking'
  const activeId = active[mode]
  const customForm = activeId !== ORIGINAL_WIZARD && !editingJobId ? forms.find((f) => f.id === activeId) : undefined
  if (!customForm) return <BookingWizard />
  return <CustomFormBooking form={customForm} mode={mode} />
}

function CustomFormBooking({ form, mode }: { form: ScreenForm; mode: FormMode }) {
  const newBooking = useBookingStore((s) => s.newBooking)
  const setBook = useBookingStore((s) => s.setBook)
  const setJobNotes = useBookingStore((s) => s.setJobNotes)
  const saveJob = useJobsStore((s) => s.saveJob)
  const goToList = useViewStore((s) => s.goToList)

  const status: JobStatus = mode === 'quickquote' ? 'Quick Quote' : mode === 'quote' ? 'Quote' : 'Booking'
  const flat = form.panels.flatMap((p) => p.children)
  const keyFor = (binding: string) => flat.find((e) => e.binding === binding)?.key

  const onSubmit = (values: FormValues) => {
    // Best-effort kernel mapping — full FieldBinding write-through is a later phase.
    newBooking()
    const ck = keyFor('job.customerId')
    if (ck && values[ck]) setBook({ cust: String(values[ck]) })
    const nk = flat.find((e) => e.binding?.toLowerCase().includes('notes'))?.key
    if (nk && values[nk]) setJobNotes(String(values[nk]))
    saveJob({ id: null, status, snapshot: captureSnapshot(), createdAt: stamp() })
    goToList(status === 'Booking' ? 'bookings' : 'quotes')
  }

  return (
    <>
      <LeftRail />
      <div className="app fb-livewrap">
        <div className="fb-live-banner">Live custom form: <b>{form.name}</b> · {status}</div>
        <FormRenderer form={form} onSubmit={onSubmit} onCancel={() => goToList()} submitLabel={`Save as ${status}`} />
      </div>
    </>
  )
}
