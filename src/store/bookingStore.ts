/**
 * Booking store — single typed Zustand store with Immer for the nested stops[]/assign
 * updates (handover §7). Actions here cover plain state mutation only; any business rule
 * (allocation gating, CX regeneration, requirements rollup) lives in src/lib and is
 * composed in by callers — NEVER inlined here (handover §9).
 */
import { create } from 'zustand'
import { immer } from 'zustand/middleware/immer'
import type { BookingStore } from './types.ts'
import { createInitialState, createSeededState } from './initialState.ts'

export const useBookingStore = create<BookingStore>()(
  immer((set) => ({
    ...createSeededState(),

    // --- Route / stops ---
    addStop: (stop) =>
      set((s) => {
        s.stops.push(stop)
      }),

    updateStop: (id, patch) =>
      set((s) => {
        const stop = s.stops.find((st) => st.id === id)
        if (stop) Object.assign(stop, patch)
      }),

    removeStop: (id) =>
      set((s) => {
        s.stops = s.stops.filter((st) => st.id !== id)
      }),

    moveStop: (id, toIndex) =>
      set((s) => {
        const from = s.stops.findIndex((st) => st.id === id)
        if (from === -1) return
        const [moved] = s.stops.splice(from, 1)
        s.stops.splice(toIndex, 0, moved)
        // NOTE: route order gates allocation. Callers should re-validate `assign`
        // against the new order via src/lib/allocation once that is ported.
      }),

    // --- Customer ---
    setBook: (patch) =>
      set((s) => {
        Object.assign(s.book, patch)
      }),

    // --- Service & vehicle ---
    setMsSelection: (group, sel) =>
      set((s) => {
        s.ms[group].sel = sel
      }),

    setTariff: (q) =>
      set((s) => {
        s.tariff.q = q
      }),

    // --- Stop-scope service + product equipment ---
    toggleStopSvc: (id, key) =>
      set((s) => {
        const stop = s.stops.find((st) => st.id === id)
        if (stop) stop.svc[key] = !stop.svc[key]
      }),

    setAllTwoman: (on) =>
      set((s) => {
        s.stops.forEach((st) => {
          st.svc.twoman = on ? true : st.svc.twoman
        })
      }),

    toggleProductEq: (stopId, itemIndex, key) =>
      set((s) => {
        const k = `${stopId}:${itemIndex}`
        s.eq[k] = s.eq[k] || {}
        s.eq[k][key] = !s.eq[k][key]
      }),

    // --- Allocation ---
    assignUnit: (unitIdx, deliveryStopId) =>
      set((s) => {
        s.assignTouched = true
        s.assign[unitIdx] = deliveryStopId
      }),

    unassignUnit: (unitIdx) =>
      set((s) => {
        s.assignTouched = true
        delete s.assign[unitIdx]
      }),

    assignAllTo: (deliveryStopId, unitIdxs) =>
      set((s) => {
        s.assignTouched = true
        unitIdxs.forEach((i) => {
          s.assign[i] = deliveryStopId
        })
      }),

    clearStopAssign: (deliveryStopId) =>
      set((s) => {
        s.assignTouched = true
        Object.keys(s.assign).forEach((k) => {
          if (s.assign[+k] === deliveryStopId) delete s.assign[+k]
        })
      }),

    // --- Driver ---
    setAllocatedDriver: (driver) =>
      set((s) => {
        s.allocatedDriver = driver
      }),

    // --- CX notes ---
    setCxNotes: (text) =>
      set((s) => {
        if (s.cx.posted) return // frozen once posted
        s.cx.text = text
      }),

    markCxDirty: (dirty) =>
      set((s) => {
        s.cx.dirty = dirty
      }),

    markCxPosted: () =>
      set((s) => {
        s.cx.posted = true
        s.cx.dirty = false
      }),

    // --- Job lifecycle ---
    setJobStatus: (status) =>
      set((s) => {
        s.jobStatus = status
      }),

    setQuickQuote: (on) =>
      set((s) => {
        s.quickQuote = on
      }),

    setJobNotes: (notes) =>
      set((s) => {
        s.jobNotes = notes
      }),

    // --- Other charges ---
    addCharge: (label, rate) =>
      set((s) => {
        s.charges.push({ id: crypto.randomUUID(), label, rate })
      }),

    removeCharge: (id) =>
      set((s) => {
        s.charges = s.charges.filter((c) => c.id !== id)
      }),

    reset: () =>
      set((s) => {
        Object.assign(s, createInitialState())
      }),
  })),
)
