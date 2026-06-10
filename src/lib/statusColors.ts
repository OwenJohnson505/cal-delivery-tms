/**
 * Status colour system — the single source of truth for every status badge on the
 * site. Two families:
 *   • Document statuses (list screens): Draft · Quote · Quick Quote · Booking
 *   • Job statuses (booking lifecycle): Waiting → Posted → Allocated →
 *     On route to collection → At collection → Collected → On route to delivery →
 *     At delivery → Delivered
 *
 * Each distinct status has its own colour (a quick visual aid). Partial states
 * ("Collected 1 of 2", "Delivered 2 of 3", "1 of 3 completed") map to their BASE
 * status's colour — the count is a variable, not a different status.
 */

export interface StatusColor {
  /** Text colour. */ fg: string
  /** Soft pill background. */ bg: string
}

// Palette — distinct, legible hues (dark text on a soft tint of the same hue).
const P = {
  grey: { fg: '#475569', bg: '#eef1f5' },
  indigo: { fg: '#4f46e5', bg: '#e9e8fd' },
  blue: { fg: '#1d4ed8', bg: '#e3edff' },
  cyan: { fg: '#0e7490', bg: '#d7f1f6' },
  amber: { fg: '#b45309', bg: '#fdeccb' },
  green: { fg: '#15803d', bg: '#dcf3e3' },
  violet: { fg: '#6d28d9', bg: '#ece4fd' },
  rose: { fg: '#be123c', bg: '#fce4ea' },
  teal: { fg: '#0f766e', bg: '#d2efeb' },
  deepGreen: { fg: '#0e7a57', bg: '#ccecdc' },
} satisfies Record<string, StatusColor>

// Canonical status (normalised key) → colour. Keys are lowercase, no digits/counts.
const STATUS: Record<string, StatusColor> = {
  // ── Document statuses ──
  draft: P.grey,
  quote: P.amber,
  'quick quote': P.teal,
  booking: P.deepGreen,

  // ── Job lifecycle statuses ──
  waiting: P.grey,
  posted: P.indigo,
  allocated: P.blue,
  'on route to collection': P.cyan,
  'at collection': P.amber,
  collected: P.green,
  'on route to delivery': P.violet,
  'at delivery': P.rose,
  delivered: P.deepGreen,

  // ── Aliases for the current stop-status vocabulary ──
  booked: P.blue,
  enroute: P.cyan,
  'en route': P.cyan,
  arrived: P.amber,
}

const FALLBACK: StatusColor = P.grey

/**
 * Normalise a status label to its canonical key: lowercase, strip the variable
 * count ("1 of 2"), and the filler words, so "Collected 1 of 2" and
 * "Collected 1 of 3" both resolve to "collected".
 */
export function normaliseStatus(label: string): string {
  return label
    .toLowerCase()
    .replace(/\d+/g, ' ')
    .replace(/\bof\b/g, ' ')
    .replace(/\bcompleted\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/** The colour for any status label (document or job, full or partial). */
export function statusColor(label: string): StatusColor {
  return STATUS[normaliseStatus(label)] ?? FALLBACK
}
