/** Internal job notes panel (prototype lines 513-516) — not shown to the driver. */
import { Icon } from './Icon.tsx'
import { useBookingStore } from '@/store/bookingStore.ts'

export function JobNotes({ grow = false }: { grow?: boolean }) {
  const jobNotes = useBookingStore((s) => s.jobNotes)
  const setJobNotes = useBookingStore((s) => s.setJobNotes)
  return (
    <div className={'panelbox' + (grow ? ' qq-grow' : '')}>
      <div className="sechead">
        <Icon name="note" size={15} /> Job notes{' '}
        <span style={{ fontWeight: 600, color: 'var(--muted)', textTransform: 'none', letterSpacing: 0 }}>
          · internal, not shown to driver
        </span>
      </div>
      <div className={'fld' + (grow ? ' qq-grow' : '')}>
        <textarea
          rows={3}
          placeholder="Internal notes about this job…"
          value={jobNotes}
          onChange={(e) => setJobNotes(e.target.value)}
        />
      </div>
    </div>
  )
}
