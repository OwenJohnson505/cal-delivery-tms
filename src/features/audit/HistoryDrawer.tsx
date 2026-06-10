/**
 * Job history drawer (prototype lines 565-569). A searchable list of the customer's
 * recent bookings — backed here by recent refs from the seed account. (Real impl: query
 * the bookings service.)
 */
import { useState } from 'react'
import { useUiStore } from '@/store/uiStore.ts'

const HISTORY = [
  { ref: 'BK-2026-100390', who: 'Tesco Extra · WA2 7NE', when: 'Tue 02/06' },
  { ref: 'BK-2026-100221', who: 'Northgate Logistics · LS9 0PX', when: 'Fri 29/05' },
  { ref: 'BK-2026-100118', who: 'Forsyth Retail · M15 4FN', when: 'Wed 27/05' },
]

export function HistoryDrawer() {
  const open = useUiStore((s) => s.drawer === 'history')
  const closeDrawers = useUiStore((s) => s.closeDrawers)
  const [q, setQ] = useState('')

  if (!open) return null
  const rows = HISTORY.filter(
    (h) => !q || (h.ref + ' ' + h.who).toLowerCase().includes(q.toLowerCase()),
  )

  return (
    <div className="drawer open" id="drawer">
      <div className="drawer-h">
        Job history
        <span className="x" onClick={closeDrawers}>✕</span>
      </div>
      <div className="drawer-search">
        <input
          type="text"
          placeholder="Search postcode, company or ref…"
          autoComplete="off"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
      </div>
      <div className="drawer-list" id="histList">
        {rows.map((h) => (
          <div key={h.ref} className="dcard">
            <div className="dc-top">
              <b>{h.ref}</b>
              <span className="cc-tag">{h.when}</span>
            </div>
            <div className="dc-sub">{h.who}</div>
          </div>
        ))}
        {!rows.length && <div className="hint">No matching bookings.</div>}
      </div>
    </div>
  )
}
