/**
 * etaToClock — convert an ETA into an absolute frozen 'HH:MM'. Ported from the prototype
 * (spec §7). Source line 1358.
 *
 *  - 'HH:MM' kept as-is
 *  - a number / "15 mins" -> now + N minutes, formatted 'HH:MM'
 *  - anything else -> returned unchanged
 *
 * The prototype reads Date.now(); here `now` is injected (defaulting to current time) so
 * the relative branch is pure and testable. ETA is FROZEN once computed (spec §7) — do
 * not re-run it on display.
 */
import type { ClockTime } from '@/types/index.ts'
import { pad } from './text.ts'

export function etaToClock(v: string, now: Date = new Date()): ClockTime {
  v = (v || '').trim()
  if (!v) return ''
  if (/^\d{1,2}:\d{2}$/.test(v)) return v
  const m = v.match(/^(\d+)\s*(m|min|mins|minute|minutes)?$/i)
  if (m) {
    const d = new Date(now.getTime() + parseInt(m[1], 10) * 60000)
    return pad(d.getHours()) + ':' + pad(d.getMinutes())
  }
  return v
}
