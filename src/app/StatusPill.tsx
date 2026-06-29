/**
 * StatusPill — the one badge used for every status on the site (document statuses
 * on the list screens, job/stop lifecycle statuses on the booking). Colour comes
 * from the central statusColor() map; partial states ("Collected 1 of 2") keep
 * their base status's colour. Pass the display label as `status`.
 */
import type { CSSProperties } from 'react'
import { statusColor } from '@/lib/index.ts'

export function StatusPill({ status }: { status: string }) {
  const c = statusColor(status)
  // expose the colours as vars so contexts (e.g. the dark jobs board) can restyle the
  // pill while still driving the status hue from one source.
  return (
    <span className="status-pill" style={{ '--sc-fg': c.fg, '--sc-bg': c.bg } as CSSProperties}>
      {status}
    </span>
  )
}
