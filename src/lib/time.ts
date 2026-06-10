/**
 * Date/time parsing + phrasing helpers, ported verbatim (spec §2.2, §8).
 * Source lines: parseDt (647), ord (648), DOW/MON (637), fmt (643),
 * DOWFULL (1272), hm/dstamp/tphrase (1273-1281), outcode (1271).
 *
 * Datetime strings are 'dd-mm-yyyy HH:MM'. These are pure (no global clock) except where
 * a TimeSpec is 'asap' — ASAP is resolved relative to now by the UI, not here (spec §2.2).
 */
import type { TimeSpec } from '@/types/index.ts'
import { fmt } from './text.ts'

const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const DOWFULL = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY']

/** Parse 'dd-mm-yyyy HH:MM' to a Date, or null (prototype parseDt). */
export function parseDt(s: string): Date | null {
  const m = /^(\d{2})-(\d{2})-(\d{4})\s+(\d{2}):(\d{2})/.exec(s || '')
  return m ? new Date(+m[3], +m[2] - 1, +m[1], +m[4], +m[5]) : null
}

/** Ordinal suffix (prototype ord). */
export function ord(n: number): string {
  const v = n % 100
  const a = ['th', 'st', 'nd', 'rd']
  return n + (a[(v - 20) % 10] || a[v] || 'th')
}

/** Display parts for a datetime string, or null (prototype dtParts). */
export function dtParts(
  s: string,
): { day: string; date: string; time: string } | null {
  const d = parseDt(s)
  return d
    ? { day: DOW[d.getDay()], date: ord(d.getDate()) + ' ' + MON[d.getMonth()], time: fmt(d) }
    : null
}

/** 'HH:MM' for a datetime string (prototype hm). */
export function hm(str: string): string {
  const pp = dtParts(str)
  return pp ? pp.time : ''
}

/** 'DAY DD/MM' uppercased day stamp (prototype dstamp). */
export function dstamp(str: string): string {
  const d = parseDt(str)
  if (!d) return ''
  const dd = ('0' + d.getDate()).slice(-2)
  const mm = ('0' + (d.getMonth() + 1)).slice(-2)
  return DOWFULL[d.getDay()] + ' ' + dd + '/' + mm
}

/** CX time phrase for a TimeSpec window (prototype tphrase). */
export function tphrase(t: TimeSpec | null | undefined): string {
  if (!t || !t.mode) return 'TBC'
  if (t.mode === 'at') return hm(t.at || '') ? dstamp(t.at || '') + ', ' + hm(t.at || '') : 'TBC'
  if (t.mode === 'by') return hm(t.by || '') ? 'BY ' + dstamp(t.by || '') + ', ' + hm(t.by || '') : 'TBC'
  if (t.mode === 'between')
    return hm(t.from || '')
      ? dstamp(t.from || '') + ', ' + hm(t.from || '') + '-' + hm(t.to || '')
      : 'TBC'
  return ''
}

/** Collection time phrase — 'ASAP' when asap (prototype collTime). */
export function collTime(t: TimeSpec | null | undefined): string {
  return !t || t.mode === 'asap' ? 'ASAP' : tphrase(t)
}

/** Delivery time phrase — 'DIRECT' when asap (prototype delTime). */
export function delTime(t: TimeSpec | null | undefined): string {
  return !t || t.mode === 'asap' ? 'DIRECT' : tphrase(t)
}

/** First half of a postcode, uppercased (prototype outcode). */
export function outcode(pc: string): string {
  if (!pc) return ''
  return pc.trim().split(/\s+/)[0].toUpperCase()
}
