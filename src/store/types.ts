/**
 * Store shape — the prototype's module-scope globals (spec §1) as typed state.
 *
 *   stops[] -> stops · BOOK -> book · MS -> ms · TAR -> tariff · EQ -> eq
 *   allocatedDriver -> allocatedDriver · cxNotes/cxDirty/cxPosted -> cx
 *   ASSIGN -> assign · assignTouched -> assignTouched · jobStatus -> jobStatus
 */
import type {
  AllocatedDriver,
  AssignMap,
  Book,
  CxNotesState,
  JobStatus,
  MultiSelectState,
  ProductEquipment,
  Stop,
  Tariff,
} from '@/types/index.ts'

export interface BookingState {
  /** Ordered route — order is meaningful (gates allocation, spec §4.3). */
  stops: Stop[]
  book: Book
  ms: MultiSelectState
  tariff: Tariff
  eq: ProductEquipment
  /** True once the operator manually intervenes in allocation (spec §4.3 syncAssign). */
  assignTouched: boolean
  allocatedDriver: AllocatedDriver
  cx: CxNotesState
  assign: AssignMap
  jobStatus: JobStatus
}

export interface BookingActions {
  // --- Route / stops ---
  addStop(stop: Stop): void
  updateStop(id: number, patch: Partial<Stop>): void
  removeStop(id: number): void
  moveStop(id: number, toIndex: number): void

  // --- Allocation ---
  assignUnit(unitIdx: number, deliveryStopId: number): void
  unassignUnit(unitIdx: number): void

  // --- Driver ---
  setAllocatedDriver(driver: AllocatedDriver): void

  // --- CX notes ---
  setCxNotes(text: string): void
  markCxDirty(dirty: boolean): void
  markCxPosted(): void

  // --- Job lifecycle ---
  setJobStatus(status: JobStatus): void
  reset(): void
}

export type BookingStore = BookingState & BookingActions
