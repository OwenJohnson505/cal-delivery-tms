/**
 * StatusPill — the one badge used for every status on the site (document statuses
 * on the list screens, job/stop lifecycle statuses on the booking). Colour comes
 * from the central statusColor() map; partial states ("Collected 1 of 2") keep
 * their base status's colour. Pass the display label as `status`.
 */
import { statusColor } from '@/lib/index.ts'

export function StatusPill({ status }: { status: string }) {
  const c = statusColor(status)
  return (
    <span className="status-pill" style={{ color: c.fg, background: c.bg }}>
      {status}
    </span>
  )
}
