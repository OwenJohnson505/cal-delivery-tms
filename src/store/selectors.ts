/**
 * Derived selectors — pure views over booking state, composed from src/lib. Hooks here
 * read the store and apply the ported business logic so components never inline rules.
 */
import { useMemo } from 'react'
import { useBookingStore } from './bookingStore.ts'
import { buildCxNotes, rollupRequirements, syncAssign } from '@/lib/index.ts'
import type { AssignMap, RequirementRow } from '@/types/index.ts'

/** Assignment with the sole-delivery auto-assign applied (prototype syncAssign). */
export function useEffectiveAssign(): AssignMap {
  const stops = useBookingStore((s) => s.stops)
  const assign = useBookingStore((s) => s.assign)
  const assignTouched = useBookingStore((s) => s.assignTouched)
  return useMemo(() => syncAssign(stops, assign, assignTouched), [stops, assign, assignTouched])
}

/** The requirements rollup rows (job/stop/product scopes). */
export function useRequirements(): RequirementRow[] {
  const stops = useBookingStore((s) => s.stops)
  const ms = useBookingStore((s) => s.ms)
  const eq = useBookingStore((s) => s.eq)
  return useMemo(() => rollupRequirements({ stops, ms, eq }), [stops, ms, eq])
}

/** Live CX posting text generated from the current booking. */
export function useGeneratedCxNotes(): string {
  const stops = useBookingStore((s) => s.stops)
  const ms = useBookingStore((s) => s.ms)
  const tariff = useBookingStore((s) => s.tariff)
  const eq = useBookingStore((s) => s.eq)
  const assign = useEffectiveAssign()
  return useMemo(
    () => buildCxNotes({ stops, ms, tariff, eq, assign }),
    [stops, ms, tariff, eq, assign],
  )
}
