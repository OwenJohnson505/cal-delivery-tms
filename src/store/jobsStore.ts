/**
 * Jobs store — the saved bookings / quotes / drafts shown in the list screens. A job is
 * a snapshot of a booking plus derived display fields. In-memory + seeded for the design
 * reference (a real impl would persist via the §5 persistence seam).
 */
import { create } from 'zustand'
import type { BookingState } from './types.ts'
import type { JobStatus } from '@/types/index.ts'
import { useBookingStore } from './bookingStore.ts'
import { createInitialState } from './initialState.ts'
import { outcode } from '@/lib/index.ts'
import { useCustomersStore } from './customersStore.ts'
import { useUsersStore } from './usersStore.ts'

export interface SavedJob {
  id: string
  ref: string
  status: JobStatus
  customer: string
  /** Route outcodes, e.g. "LS9 → WA2". */
  route: string
  vehicle: string
  /** £ total (sum of charges in this basic version). */
  revenue: number
  /** 'dd-mm-yyyy HH:MM' created stamp. */
  createdAt: string
  snapshot: BookingState
  // ── live job columns (booking list) ──
  /** Job status (Unallocated · Posted · … · Delivered · Failed); '' if not a booking. */
  progress: string
  /** £ cost (margin = revenue − cost). */
  cost: number
  /** Collection date/time of the first collection stop, 'DDMMYY HH:MM'. */
  collectAt: string
  /** Delivery date/time of the last stop, 'DDMMYY HH:MM'. */
  deliverAt: string
  /** Timing mode for the tag next to each time. */
  collectMode: TimeMode
  deliverMode: TimeMode
  /** Frozen ETAs ('HH:MM'), blank if none. */
  collectEta: string
  deliverEta: string
  /** The customer reference entered on the job (for the ref-accepted check). */
  custRef: string
  /** Who booked / quoted / drafted the job. */
  actorName: string
  /** Allocated supplier name (blank if none). */
  supplierName: string
}

export type TimeMode = 'asap' | 'at' | 'by' | 'between'

function customerName(id: string | null): string {
  if (!id) return '—'
  return useCustomersStore.getState().customers.find((c) => c.id === id)?.companyName ?? id
}

/** Derive the table display fields from a booking snapshot. */
export function summarize(snap: BookingState): Pick<SavedJob, 'customer' | 'route' | 'vehicle' | 'revenue'> {
  const outs = snap.stops.map((s) => outcode(s.addr.pc)).filter(Boolean)
  return {
    customer: customerName(snap.book.cust),
    route: outs.join(' → ') || '—',
    vehicle: snap.tariff.q || '—',
    revenue: snap.charges.reduce((t, c) => t + (c.rate || 0), 0),
  }
}

/** Snapshot the current in-progress booking (deep clone of its data). */
export function captureSnapshot(): BookingState {
  const s = useBookingStore.getState()
  return structuredClone({
    stops: s.stops, book: s.book, ms: s.ms, tariff: s.tariff, eq: s.eq,
    assign: s.assign, assignTouched: s.assignTouched, allocatedDriver: s.allocatedDriver,
    cx: s.cx, charges: s.charges, jobNotes: s.jobNotes, quickQuote: s.quickQuote,
    jobStatus: s.jobStatus, customJob: s.customJob,
  })
}

const REF_PREFIX: Record<JobStatus, string> = {
  Draft: 'DR', 'Quick Quote': 'QQ', Quote: 'QU', Booking: 'BK',
}

interface JobsState {
  jobs: SavedJob[]
  seq: number
  /** Insert or update a job from a snapshot; returns the saved job. */
  saveJob(opts: { id?: string | null; status: JobStatus; snapshot: BookingState; createdAt: string }): SavedJob
  deleteJob(id: string): void
}

// ---- seed samples -------------------------------------------------------------
function sample(opts: {
  status: JobStatus
  cust: string
  collPc: string
  delPc: string
  vehicle: string
  charges?: Array<{ label: string; rate: number }>
}): BookingState {
  const base = createInitialState()
  base.book = { cust: opts.cust, contact: null }
  base.tariff = { q: opts.vehicle }
  base.jobStatus = opts.status
  base.charges = (opts.charges ?? []).map((c, i) => ({ id: `seed-c${i}`, ...c }))
  const mk = (id: number, type: 'Collection' | 'Delivery', pc: string): BookingState['stops'][number] => ({
    id, type, q: '', addr: { co: '', address: '', city: '', pc, country: 'England', src: '', cls: 'manual' },
    contact: null, time: { mode: 'asap' }, reference: '', note: '', goods: '', goodsTouched: false,
    alloc: [], allocTouched: false, svc: {}, status: 'booked', eta: '', pod: null,
  })
  base.stops = [mk(1, 'Collection', opts.collPc), mk(2, 'Delivery', opts.delPc)]
  return base
}

type SeedRow = {
  ref: string; status: JobStatus; at: string; snap: BookingState
  progress: string; revenue: number; cost: number
  collectAt: string; deliverAt: string; collectMode: TimeMode; deliverMode: TimeMode
  collectEta: string; deliverEta: string; custRef: string; notes?: string
  actorName: string; supplierName: string
}

function seedJobs(): SavedJob[] {
  const rows: SeedRow[] = [
    { ref: 'BK-100482', status: 'Booking', at: '06-06-2026 18:53', snap: sample({ status: 'Booking', cust: 'brightway', collPc: 'LS9 0PX', delPc: 'WA2 7NE', vehicle: '18t', charges: [{ label: 'Handballing', rate: 35 }] }), notes: 'Call ahead — gate code 4471.',
      progress: 'Collected', revenue: 420, cost: 280, collectAt: '100626 09:30', deliverAt: '100626 14:15', collectMode: 'at', deliverMode: 'by', collectEta: '09:25', deliverEta: '14:05', custRef: 'PO-7781', actorName: 'Sarah Doyle', supplierName: 'Dave Foster' },
    { ref: 'BK-100479', status: 'Booking', at: '05-06-2026 11:20', snap: sample({ status: 'Booking', cust: 'meridian', collPc: 'M15 4FN', delPc: 'L7 9PG', vehicle: 'Luton' }),
      progress: 'En route DEL', revenue: 310, cost: 210, collectAt: '110626 08:00', deliverAt: '110626 16:30', collectMode: 'asap', deliverMode: 'between', collectEta: '08:10', deliverEta: '16:20', custRef: 'MER-22', actorName: 'James Hill', supplierName: 'Aisha Khan' },
    { ref: 'BK-100485', status: 'Booking', at: '07-06-2026 08:05', snap: sample({ status: 'Booking', cust: 'brightway', collPc: 'LS9 0PX', delPc: 'BD1 2AB', vehicle: '7.5t' }),
      progress: 'Unallocated', revenue: 240, cost: 150, collectAt: '120626 11:00', deliverAt: '120626 15:30', collectMode: 'at', deliverMode: 'by', collectEta: '', deliverEta: '', custRef: 'WRONG-1', actorName: 'Sarah Doyle', supplierName: '' },
    { ref: 'BK-100486', status: 'Booking', at: '07-06-2026 09:40', snap: sample({ status: 'Booking', cust: 'orbit', collPc: 'LS4 2AB', delPc: 'M1 4ET', vehicle: 'Artic' }),
      progress: 'Part DEL', revenue: 560, cost: 390, collectAt: '110626 06:30', deliverAt: '110626 18:00', collectMode: 'at', deliverMode: 'between', collectEta: '06:30', deliverEta: '17:40', custRef: 'ORB-90', actorName: 'James Hill', supplierName: 'Rob Niles' },
    { ref: 'QU-100501', status: 'Quote', at: '06-06-2026 09:14', snap: sample({ status: 'Quote', cust: 'orbit', collPc: 'LS4 2AB', delPc: 'WA4 1PX', vehicle: '7.5t' }),
      progress: '', revenue: 180, cost: 120, collectAt: '120626 10:00', deliverAt: '120626 15:00', collectMode: 'at', deliverMode: 'at', collectEta: '', deliverEta: '', custRef: '', actorName: 'Sarah Doyle', supplierName: '' },
    { ref: 'QQ-100503', status: 'Quick Quote', at: '06-06-2026 10:02', snap: sample({ status: 'Quick Quote', cust: 'cal', collPc: 'LS9 0PX', delPc: 'M15 4FN', vehicle: 'Small van' }),
      progress: '', revenue: 95, cost: 70, collectAt: '', deliverAt: '', collectMode: 'asap', deliverMode: 'asap', collectEta: '', deliverEta: '', custRef: '', actorName: 'Tom Baker', supplierName: '' },
    { ref: 'DR-100510', status: 'Draft', at: '06-06-2026 16:41', snap: sample({ status: 'Draft', cust: 'brightway', collPc: 'WA2 7NE', delPc: 'LS9 0PX', vehicle: '' }),
      progress: '', revenue: 0, cost: 0, collectAt: '', deliverAt: '', collectMode: 'asap', deliverMode: 'asap', collectEta: '', deliverEta: '', custRef: '', actorName: 'Sarah Doyle', supplierName: '' },
  ]
  return rows.map((r, i) => ({
    id: `seed-${i}`,
    ref: r.ref,
    status: r.status,
    createdAt: r.at,
    snapshot: { ...r.snap, jobNotes: r.notes ?? '' },
    ...summarize(r.snap),
    revenue: r.revenue, // explicit seed revenue (overrides the charge-sum)
    progress: r.progress,
    cost: r.cost,
    collectAt: r.collectAt,
    deliverAt: r.deliverAt,
    collectMode: r.collectMode,
    deliverMode: r.deliverMode,
    collectEta: r.collectEta,
    deliverEta: r.deliverEta,
    custRef: r.custRef,
    actorName: r.actorName,
    supplierName: r.supplierName,
  }))
}

export const useJobsStore = create<JobsState>((set, get) => ({
  jobs: seedJobs(),
  seq: 100600,

  saveJob: ({ id, status, snapshot, createdAt }) => {
    const snap = { ...snapshot, jobStatus: status }
    const summary = summarize(snap)
    const drv = snap.allocatedDriver
    const existing = id ? get().jobs.find((j) => j.id === id) : undefined
    if (existing) {
      // keep the live columns, just refresh status/summary/supplier from the snapshot
      const updated: SavedJob = {
        ...existing, status, snapshot: snap, ...summary,
        supplierName: drv?.name ?? existing.supplierName,
      }
      set((s) => ({ jobs: s.jobs.map((j) => (j.id === id ? updated : j)) }))
      return updated
    }
    const seq = get().seq + 1
    const us = useUsersStore.getState()
    const actorName = us.users.find((u) => u.id === us.currentUserId)?.name ?? '—'
    const job: SavedJob = {
      id: crypto.randomUUID(),
      ref: `${REF_PREFIX[status]}-${seq}`,
      status,
      createdAt,
      snapshot: snap,
      ...summary,
      progress: status === 'Booking' ? 'Unallocated' : '',
      cost: 0,
      collectAt: '', deliverAt: '', collectMode: 'asap', deliverMode: 'asap',
      collectEta: '', deliverEta: '', custRef: '',
      actorName,
      supplierName: drv?.name ?? '',
    }
    set((s) => ({ jobs: [job, ...s.jobs], seq }))
    return job
  },

  deleteJob: (id) => set((s) => ({ jobs: s.jobs.filter((j) => j.id !== id) })),
}))
