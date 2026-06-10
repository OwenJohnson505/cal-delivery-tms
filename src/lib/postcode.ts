/**
 * Postcode helpers, ported verbatim (spec §3.2). Source lines: PC_RE (636),
 * isFullPostcode (638), pcKey (639).
 */

/** UK full-postcode pattern. */
export const PC_RE = /^[A-Za-z]{1,2}\d[A-Za-z\d]?\s*\d[A-Za-z]{2}$/

/** True if the string is a full UK postcode (prototype isFullPostcode). */
export function isFullPostcode(s: string): boolean {
  return PC_RE.test((s || '').trim())
}

/** Normalise a postcode to a POSTCODES lookup key (prototype pcKey). */
export function pcKey(s: string): string {
  return (s || '').toUpperCase().replace(/\s+/g, '')
}
