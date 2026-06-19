/** Internal job notes panel (prototype lines 513-516) — not shown to the driver. */
import { useState } from 'react'
import { Icon } from './Icon.tsx'
import { useBookingStore } from '@/store/bookingStore.ts'
import { useEmailsStore } from '@/store/emailsStore.ts'

export function JobNotes({ grow = false }: { grow?: boolean }) {
  const jobNotes = useBookingStore((s) => s.jobNotes)
  const setJobNotes = useBookingStore((s) => s.setJobNotes)
  // collapsed by default in the narrow email-job view; open in the full wizard
  const emailFull = useEmailsStore((s) => s.panelState === 'full')
  const [open, setOpen] = useState(!emailFull)
  return (
    <div className={'panelbox' + (grow ? ' qq-grow' : '') + (open ? '' : ' collapsed')}>
      <button className="sechead sechead-toggle" onClick={() => setOpen((o) => !o)}>
        <span className="sh-chev">{open ? '▾' : '▸'}</span>
        <Icon name="note" size={15} /> Job notes{' '}
        <span style={{ fontWeight: 600, color: 'var(--muted)', textTransform: 'none', letterSpacing: 0 }}>· internal</span>
        {!open && jobNotes.trim() && <span className="sh-count">●</span>}
      </button>
      {open && (
        <div className={'fld' + (grow ? ' qq-grow' : '')}>
          <textarea
            rows={3}
            placeholder="Internal notes about this job…"
            value={jobNotes}
            onChange={(e) => setJobNotes(e.target.value)}
          />
        </div>
      )}
    </div>
  )
}
