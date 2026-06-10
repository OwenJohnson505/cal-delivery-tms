/**
 * Shared text/format primitives, ported verbatim from the prototype so output stays
 * byte-identical. Source lines: pad (631), esc (640), fmt (643).
 */

/** Two-digit zero-pad. */
export function pad(n: number): string {
  return ('0' + n).slice(-2)
}

/** HTML-escape, matching the prototype's esc() exactly. */
export function esc(s: unknown): string {
  return ('' + (s == null ? '' : s)).replace(/[&<>"]/g, function (c) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c] as string
  })
}

/** Format a Date as 'HH:MM'. */
export function fmt(d: Date): string {
  return ('0' + d.getHours()).slice(-2) + ':' + ('0' + d.getMinutes()).slice(-2)
}
