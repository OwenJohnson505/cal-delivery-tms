/**
 * Goods parser + formatters. Ported verbatim from the prototype (spec §4.2).
 * Source lines: NUMWORDS/UNITS (855-856), cap/plur/normWU (857/858/862),
 * parseGoods (863-880), fmtItem (881-888), itemShort (889).
 *
 * GUARDRAIL: fmtItem ("Reads as" preview) is one of the four byte-identical outputs —
 * it returns the exact HTML the prototype renders (esc + <span class="pdim">). Covered
 * by snapshot tests.
 */
import type { ParsedItem } from '@/types/index.ts'
import { esc } from './text.ts'

const NUMWORDS: Record<string, number> = {
  one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8,
  nine: 9, ten: 10, a: 1, an: 1,
}

const UNITS = [
  'pallet', 'box', 'crate', 'carton', 'cage', 'drum', 'roll', 'bag', 'parcel',
  'tote', 'stillage', 'barrel', 'sack', 'bundle', 'skid', 'container', 'item',
]

/** Capitalise first letter (prototype cap()). */
export function cap(x: string): string {
  return x ? x.charAt(0).toUpperCase() + x.slice(1) : x
}

/** Pluralise (prototype plur()): +es after s/x/z/ch/sh, else +s. */
export function plur(w: string): string {
  return /([sxz]|ch|sh)$/i.test(w) ? w + 'es' : w + 's'
}

/** Normalise a weight unit token (prototype normWU()). */
export function normWU(u: string): string {
  u = u.toLowerCase()
  if (u[0] === 'k') return 'kg'
  if (u[0] === 't') return 't'
  if (u[0] === 'l') return 'lb'
  if (u === 'g') return 'g'
  return u
}

/** Parse free-text goods into line items (prototype parseGoods()). */
export function parseGoods(text: string): ParsedItem[] {
  if (!text || !text.trim()) return []
  const segs = text
    .split(/[\n,;/+]|\band\b|&/i)
    .map((x) => x.trim())
    .filter(Boolean)
  const items: ParsedItem[] = []
  segs.forEach((seg) => {
    const low = ' ' + seg.toLowerCase() + ' '
    let unit: string | null = null
    let uidx = -1
    for (let i = 0; i < UNITS.length; i++) {
      const re = new RegExp('\\b' + UNITS[i] + '(s|es)?\\b')
      const mm = re.exec(low)
      if (mm) {
        unit = UNITS[i]
        uidx = mm.index
        break
      }
    }
    let wt = ''
    const wm = low.match(/(\d+(?:\.\d+)?)\s*(kgs?|kilos?|kilograms?|tonnes?|tons?|lbs?|kg|t|g)\b/)
    if (wm) {
      const tot = /total|combined|altogether/.test(low)
      const ea = /each|per |apiece/.test(low)
      wt = wm[1] + ' ' + normWU(wm[2]) + (tot ? ' (total)' : ea ? ' (each)' : '')
    }
    let dim = ''
    const dm = low.match(/(\d+(?:\.\d+)?)\s*[x×]\s*(\d+(?:\.\d+)?)\s*[x×]\s*(\d+(?:\.\d+)?)\s*(mm|cm|m)?/)
    if (dm) dim = dm[1] + '×' + dm[2] + '×' + dm[3] + (dm[4] || '')
    if (!unit) {
      items.push({ qty: null, unit: null, wt, dim, raw: seg })
      return
    }
    const pre = low.slice(0, uidx).trim()
    let qty = 1
    const qd = pre.match(/(\d+)\s*$/)
    if (qd) {
      qty = parseInt(qd[1], 10)
    } else {
      const qw = pre.match(/\b(one|two|three|four|five|six|seven|eight|nine|ten|a|an)\b\s*$/)
      if (qw) qty = NUMWORDS[qw[1]]
    }
    items.push({ qty, unit: cap(unit), wt, dim, raw: seg })
  })
  return items
}

/** "Reads as" preview — exact HTML the prototype renders (prototype fmtItem()). */
export function fmtItem(it: ParsedItem): string {
  if (!it.unit) return esc(it.raw)
  const hd = it.qty + ' × ' + (it.qty! > 1 ? plur(it.unit) : it.unit)
  const ex: string[] = []
  if (it.wt) ex.push(it.wt)
  if (it.dim) ex.push(it.dim)
  if (!it.wt && !it.dim) ex.push('weight/size n/a')
  return esc(hd) + ' <span class="pdim">' + esc(ex.join(' · ')) + '</span>'
}

/** Compact summary (prototype itemShort()). */
export function itemShort(it: ParsedItem): string {
  return it.unit
    ? it.qty + ' ' + (it.qty! > 1 ? plur(it.unit.toLowerCase()) : it.unit.toLowerCase())
    : it.raw
}
