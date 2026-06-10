/**
 * internalRank — frequency-ranked type-ahead over the customer's saved/used addresses.
 * Ported from the prototype (spec §3.2). Source lines: clean (641), fuzzy (642),
 * internalRank (645).
 *
 * `count` is the persisted usage frequency (the "★ 14×" tag). In production, increment
 * it on selection and rank by it (spec §3.2 / §10).
 */

/** A saved-address record (prototype SAVED[] shape, spec §3.6). */
export interface SavedAddress {
  co: string
  addr: string
  city: string
  pc: string
  country: string
  /** Persisted usage count for ranking. */
  count?: number
}

/** Lowercase, strip non-alphanumeric (keep spaces), trim (prototype clean). */
export function clean(s: string): string {
  return (s || '').toLowerCase().replace(/[^a-z0-9\s]/g, '').trim()
}

/** True if q is a substring of hay OR any word in hay starts with q (prototype fuzzy). */
export function fuzzy(hay: string, q: string): boolean {
  hay = hay.toLowerCase()
  return hay.indexOf(q) >= 0 || hay.split(/\s+/).some((w) => w.indexOf(q) === 0)
}

/** Frequency-ranked top-5 saved-address matches for a query (prototype internalRank). */
export function internalRank(q: string, saved: SavedAddress[]): SavedAddress[] {
  q = clean(q)
  if (q.length < 2) return []
  return saved
    .filter((a) => fuzzy(a.co + ' ' + a.addr + ' ' + a.city + ' ' + a.pc, q))
    .sort((x, y) => (y.count || 0) - (x.count || 0))
    .slice(0, 5)
}
