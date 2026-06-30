/**
 * PinnedJobPill — floating Dynamic-Island-style monitor for a single pinned job.
 *
 * Collapsed: compact pill at screen bottom-centre showing status + ref + active ETA.
 * Expanded:  dark card showing all route / ETA / driver details.
 *
 * Single-click  → toggle collapsed ↔ expanded.
 * Double-click  → open the full job wizard.
 * Drag (pill or expanded header) → repositions freely around the screen.
 * Unpin button  → dismisses the pill entirely.
 */
import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { Icon } from '@/app/Icon.tsx'
import { useViewStore } from '@/store/viewStore.ts'
import { useJobsStore } from '@/store/jobsStore.ts'
import { useCustomersStore } from '@/store/customersStore.ts'
import { useBookingStore } from '@/store/bookingStore.ts'
import type { Stop } from '@/types/index.ts'

// ── Helpers ───────────────────────────────────────────────────────────────────
function timeOf(dt: string): string {
  const s = (dt || '').trim()
  if (/^\d{1,2}:\d{2}$/.test(s)) return s
  const parts = s.split(' ')
  return parts.length === 2 ? parts[1] : ''
}

function hhmmToMins(t: string): number | null {
  const m = (t || '').match(/^(\d{1,2}):(\d{2})$/)
  return m ? parseInt(m[1]) * 60 + parseInt(m[2]) : null
}

const DELIVER_STAGES = new Set([
  'Collected', 'Part COL', 'En route DEL', 'On site DEL', 'Part DEL',
])

type DotRole = 'neutral' | 'warning' | 'danger' | 'done'

function dotRole(progress: string): DotRole {
  if (progress === 'Delivered') return 'done'
  if (progress === 'Failed') return 'danger'
  if (progress === 'On site COL' || progress === 'On site DEL') return 'warning'
  return 'neutral'
}

function etaClass(eta: string, due: string): string {
  const etaM = hhmmToMins(eta)
  const dueM = hhmmToMins(due)
  if (etaM == null || dueM == null) return ''
  return etaM > dueM ? 'pp-eta-late' : 'pp-eta-ok'
}

// ── Component ─────────────────────────────────────────────────────────────────
export function PinnedJobPill() {
  const pinnedId = useViewStore(s => s.pinnedJobId)
  const pinJob = useViewStore(s => s.pinJob)
  const job = useJobsStore(s => pinnedId ? s.jobs.find(j => j.id === pinnedId) ?? null : null)
  const cust = useCustomersStore(s =>
    job?.snapshot.book.cust
      ? s.customers.find(c => c.id === job.snapshot.book.cust) ?? null
      : null
  )

  const [expanded, setExpanded] = useState(false)
  const [dragPos, setDragPos] = useState<{ left: number; top: number } | null>(null)
  const [isDragging, setIsDragging] = useState(false)

  const pillRef = useRef<HTMLDivElement>(null)
  const clickTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const dragData = useRef<{ startMx: number; startMy: number; startLeft: number; startTop: number } | null>(null)
  const hasDragged = useRef(false)

  // Reset position + state when a different job is pinned
  useEffect(() => {
    setExpanded(false)
    setDragPos(null)
  }, [pinnedId])

  // Global mouse move/up for dragging
  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!dragData.current) return
      const dx = e.clientX - dragData.current.startMx
      const dy = e.clientY - dragData.current.startMy
      if (!hasDragged.current && Math.hypot(dx, dy) < 5) return
      hasDragged.current = true
      const pill = pillRef.current
      const w = pill ? pill.offsetWidth : 320
      const h = pill ? pill.offsetHeight : 40
      setDragPos({
        left: Math.max(8, Math.min(window.innerWidth - w - 8, dragData.current.startLeft + dx)),
        top: Math.max(8, Math.min(window.innerHeight - h - 8, dragData.current.startTop + dy)),
      })
    }
    const onUp = () => {
      if (!dragData.current) return
      dragData.current = null
      setIsDragging(false)
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    return () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
  }, [])

  if (!job) return null

  // ── Derived data ───────────────────────────────────────────────────────────
  const isDelivering = DELIVER_STAGES.has(job.progress)
  const collectEta = timeOf(job.collectEta || '')
  const deliverEta = timeOf(job.deliverEta || '')
  const collectDue = timeOf(job.collectAt)
  const deliverDue = timeOf(job.deliverAt)

  const stops: Stop[] = job.snapshot.stops
  const collStop = stops.find(s => s.type === 'Collection' || s.type === 'Both')
  const delStop = [...stops].reverse().find(s => s.type === 'Delivery' || s.type === 'Both')
  const collPc = collStop?.addr.pc || '—'
  const delPc = delStop?.addr.pc || '—'

  const driver = job.supplierName || null
  const role = dotRole(job.progress)

  // ETA shown in the collapsed pill — whichever leg is active
  const pillEta = isDelivering
    ? (deliverEta ? `DEL  ${deliverEta}` : null)
    : (collectEta ? `COL  ${collectEta}` : null)

  // ── Interaction handlers ───────────────────────────────────────────────────
  const startDrag = (e: React.MouseEvent) => {
    if (e.button !== 0) return
    const pill = pillRef.current
    if (!pill) return
    const rect = pill.getBoundingClientRect()
    dragData.current = {
      startMx: e.clientX,
      startMy: e.clientY,
      startLeft: dragPos?.left ?? rect.left,
      startTop: dragPos?.top ?? rect.top,
    }
    hasDragged.current = false
    setIsDragging(true)
    e.preventDefault()
  }

  const handleClick = () => {
    if (hasDragged.current) return
    if (clickTimer.current !== null) {
      // Second tap within 230ms = double-click → open wizard
      clearTimeout(clickTimer.current)
      clickTimer.current = null
      useBookingStore.getState().loadSnapshot(job.snapshot)
      useViewStore.getState().openWizard(job.id)
    } else {
      clickTimer.current = setTimeout(() => {
        clickTimer.current = null
        setExpanded(v => !v)
      }, 230)
    }
  }

  const openWizardDirect = (e: React.MouseEvent) => {
    e.stopPropagation()
    useBookingStore.getState().loadSnapshot(job.snapshot)
    useViewStore.getState().openWizard(job.id)
  }

  // ── Positioning ────────────────────────────────────────────────────────────
  const posStyle: CSSProperties = dragPos
    ? { left: dragPos.left, top: dragPos.top, bottom: 'auto', transform: 'none' }
    : {}

  const pillClass = [
    'pinned-pill',
    expanded ? 'pp-expanded' : '',
    isDragging ? 'pp-dragging' : '',
  ].filter(Boolean).join(' ')

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div ref={pillRef} className={pillClass} style={posStyle}>
      {!expanded ? (
        /* ── Collapsed pill ──────────────────────────────────────────────── */
        <div className="pp-collapsed" onMouseDown={startDrag} onClick={handleClick}>
          <span className={`pp-dot pp-dot-${role}`} />
          <span className="pp-ref">{job.ref}</span>
          <span className="pp-sep" />
          <span className="pp-progress">{job.progress || 'Booked'}</span>
          {pillEta && (
            <>
              <span className="pp-sep" />
              <span className="pp-eta">{pillEta}</span>
            </>
          )}
        </div>
      ) : (
        /* ── Expanded panel ──────────────────────────────────────────────── */
        <div className="pp-panel">
          {/* Header — drag handle and click-to-collapse */}
          <div className="pp-header" onMouseDown={startDrag} onClick={handleClick}>
            <span className={`pp-dot pp-dot-${role}`} />
            <div className="pp-header-text">
              <span className="pp-ref">{job.ref}</span>
              <span className="pp-header-cust">{cust?.displayName || job.customer}</span>
            </div>
            <span className="db-spacer" />
            <span className="pp-header-status">{job.progress || 'Booked'}</span>
            <span className="pp-collapse-chevron"><Icon name="chevron-down" size={14} /></span>
          </div>

          {/* Body — route + ETA grid */}
          <div className="pp-body">
            <div className="pp-stop-row">
              <span className="pp-stop-badge pp-badge-col">COL</span>
              <div className="pp-stop-detail">
                <span className="pp-stop-pc">{collPc}</span>
                <span className="pp-stop-times">
                  {'Due '}{collectDue || 'ASAP'}
                  {' · ETA '}
                  {collectEta
                    ? <span className={etaClass(collectEta, collectDue)}>{collectEta}</span>
                    : <span className="pp-eta-missing">not set</span>
                  }
                </span>
              </div>
            </div>

            <div className="pp-stop-row">
              <span className="pp-stop-badge pp-badge-del">DEL</span>
              <div className="pp-stop-detail">
                <span className="pp-stop-pc">{delPc}</span>
                <span className="pp-stop-times">
                  {'Due '}{deliverDue || 'ASAP'}
                  {' · ETA '}
                  {deliverEta
                    ? <span className={etaClass(deliverEta, deliverDue)}>{deliverEta}</span>
                    : <span className="pp-eta-missing">not set</span>
                  }
                </span>
              </div>
            </div>

            <div className="pp-driver-row">
              <Icon name="truck" size={13} />
              {driver
                ? <span className="pp-driver-name">{driver}{job.vehicle ? ` · ${job.vehicle}` : ''}</span>
                : <span className="pp-driver-none">No driver assigned</span>
              }
            </div>
          </div>

          {/* Footer — actions */}
          <div className="pp-footer">
            <button className="pp-unpin-btn" onClick={() => pinJob(null)}>
              <Icon name="pin" size={13} /> Unpin
            </button>
            <button className="pp-open-btn" onClick={openWizardDirect}>
              <Icon name="arrow-up-right" size={13} /> Open job
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
