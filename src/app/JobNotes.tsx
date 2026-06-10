/** Internal job notes panel (prototype lines 513-516) — not shown to the driver. */
import { Icon } from './Icon.tsx'

export function JobNotes() {
  return (
    <div className="panelbox">
      <div className="sechead">
        <Icon name="note" size={15} /> Job notes{' '}
        <span style={{ fontWeight: 600, color: 'var(--muted)', textTransform: 'none', letterSpacing: 0 }}>
          · internal, not shown to driver
        </span>
      </div>
      <div className="fld">
        <textarea rows={3} placeholder="Internal notes about this job…" />
      </div>
    </div>
  )
}
