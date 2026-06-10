/**
 * Store shape — the prototype's module-scope globals (handover §3) as typed state.
 *
 * Mapping (prototype global -> store field):
 *   stops[]          -> stops
 *   BOOK             -> book
 *   MS               -> ms        (job-scope multi-selects)
 *   TAR              -> tariff
 *   EQ               -> eq        (product-scope equipment, 'stopId:itemIndex')
 *   allocatedDriver  -> allocatedDriver
 *   cxNotes/cxDirty/cxPosted -> cx (CxNotesState)
 *   ASSIGN           -> assign    (unit idx -> delivery stop id)
 *   jobStatus        -> jobStatus (Draft/Quote/Booking footer)
 */
import type {
  AllocatedDriver,
  AssignMap,
  Book,
  CxNotesState,
  JobMultiSelect,
  JobStatus,
  ProductEquipment,
  Stop,
  Tariff,
} from '@/types/index.ts'

export interface BookingState {
  /** Ordered route — order is meaningful (gates allocation). */
  stops: Stop[]
  book: Book
  ms: JobMultiSelect
  tariff: Tariff | null
  eq: ProductEquipment
  allocatedDriver: AllocatedDriver
  cx: CxNotesState
  assign: AssignMap
  jobStatus: JobStatus
}

export interface BookingActions {
  // --- Route / stops ---
  addStop(stop: Stop): void
  updateStop(id: string, patch: Partial<Stop>): void
  removeStop(id: string): void
  /** Reorder a stop within the route (order gates allocation — recompute downstream). */
  moveStop(id: string, toIndex: number): void

  // --- Allocation ---
  /** Assign a unit (by current global idx) to a delivery stop; exclusive ownership. */
  assignUnit(unitIdx: number, deliveryStopId: string): void
  unassignUnit(unitIdx: number): void

  // --- Driver ---
  setAllocatedDriver(driver: AllocatedDriver): void

  // --- CX notes ---
  /** Replace the live note text (while !posted). */
  setCxNotes(text: string): void
  markCxDirty(dirty: boolean): void
  /** Freeze the note as posted. */
  markCxPosted(): void

  // --- Job lifecycle ---
  setJobStatus(status: JobStatus): void

  /** Reset to a fresh empty booking. */
  reset(): void
}

export type BookingStore = BookingState & BookingActions
