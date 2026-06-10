/**
 * Booking store — single typed Zustand store with Immer for the nested stops[]/assign
 * updates (handover §7). Actions here cover plain state mutation only; any business rule
 * (allocation gating, CX regeneration, requirements rollup) lives in src/lib and is
 * composed in by callers — NEVER inlined here (handover §9).
 */
import { create } from 'zustand'
import { immer } from 'zustand/middleware/immer'
import type { BookingStore } from './types.ts'
import { createInitialState } from './initialState.ts'

export const useBookingStore = create<BookingStore>()(
  immer((set) => ({
    ...createInitialState(),

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

    // --- Allocation ---
    assignUnit: (unitIdx, deliveryStopId) =>
      set((s) => {
        s.assign[unitIdx] = deliveryStopId
      }),

    unassignUnit: (unitIdx) =>
      set((s) => {
        delete s.assign[unitIdx]
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

    reset: () =>
      set((s) => {
        Object.assign(s, createInitialState())
      }),
  })),
)
