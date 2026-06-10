/**
 * Display helpers for the route cards — ported from the prototype (previewGoods line 972,
 * whenVal line 653). These produce lower-case, human-readable summaries (distinct from the
 * UPPERCASE CX strings in lib/allocation).
 */
import type { AssignMap, Stop, TimeSpec } from '@/types/index.ts'
import { goodsUnits, isColl, isDel, parseGoods, itemShort, plur } from '@/lib/index.ts'

/** "Collect 2 pallets · Deliver 1 box" style summary (prototype previewGoods). */
export function previewGoods(s: Stop, stops: Stop[], assign: AssignMap): string {
  const both = isColl(s) && isDel(s)
  const parts: string[] = []
  if (isColl(s)) {
    const its = parseGoods(s.goods)
    if (its.length) parts.push((both ? 'Collect ' : '') + its.map(itemShort).join(', '))
  }
  if (isDel(s)) {
    const units = goodsUnits(stops).filter((u) => assign[u.idx] === s.id)
    const counts: Record<string, number> = {}
    const order: string[] = []
    units.forEach((u) => {
      if (counts[u.unitName] === undefined) {
        counts[u.unitName] = 0
        order.push(u.unitName)
      }
      counts[u.unitName]++
    })
    const d = order.map(
      (k) => counts[k] + ' ' + (counts[k] > 1 ? plur(k.toLowerCase()) : k.toLowerCase()),
    )
    if (d.length) parts.push((both ? 'Deliver ' : '') + d.join(', '))
  }
  return parts.join(' · ')
}

const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

function fmt(d: Date): string {
  return ('0' + d.getHours()).slice(-2) + ':' + ('0' + d.getMinutes()).slice(-2)
}
function ord(n: number): string {
  const v = n % 100
  const a = ['th', 'st', 'nd', 'rd']
  return n + (a[(v - 20) % 10] || a[v] || 'th')
}
function parseDt(s: string): Date | null {
  const m = /^(\d{2})-(\d{2})-(\d{4})\s+(\d{2}):(\d{2})/.exec(s || '')
  return m ? new Date(+m[3], +m[2] - 1, +m[1], +m[4], +m[5]) : null
}

/** Short label for the time mode. */
export function whenLabel(t: TimeSpec | null | undefined): string {
  if (!t || !t.mode) return 'When'
  return t.mode === 'asap' ? 'ASAP' : t.mode === 'at' ? 'At' : t.mode === 'between' ? 'Between' : 'By'
}

/** Human time value (prototype whenVal). ASAP resolves to now + 45 min at display. */
export function whenValue(t: TimeSpec | null | undefined): string {
  if (!t || !t.mode) return 'Not set'
  if (t.mode === 'asap') {
    const d = new Date(Date.now() + 45 * 60000)
    return `${DOW[d.getDay()]} ${ord(d.getDate())} ${MON[d.getMonth()]} · by ${fmt(d)}`
  }
  const one = (s?: string) => {
    const d = parseDt(s || '')
    return d ? `${DOW[d.getDay()]} ${ord(d.getDate())} ${MON[d.getMonth()]} · ${fmt(d)}` : 'TBC'
  }
  if (t.mode === 'at') return one(t.at)
  if (t.mode === 'by') return 'By ' + one(t.by)
  if (t.mode === 'between') {
    const a = parseDt(t.from || '')
    const b = parseDt(t.to || '')
    if (!a) return 'TBC'
    return `${DOW[a.getDay()]} ${ord(a.getDate())} ${MON[a.getMonth()]} · ${fmt(a)}${b ? '–' + fmt(b) : ''}`
  }
  return 'TBC'
}
