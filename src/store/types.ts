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
  StopService,
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
  /** Quick Quote mode — simplifies the form to postcode + vehicle (spec: feature). */
  quickQuote: boolean
  /** Internal job notes (not shown to the driver). Shared by both layouts. */
  jobNotes: string
}

export interface BookingActions {
  // --- Route / stops ---
  addStop(stop: Stop): void
  updateStop(id: number, patch: Partial<Stop>): void
  removeStop(id: number): void
  moveStop(id: number, toIndex: number): void

  // --- Customer ---
  setBook(patch: Partial<Book>): void

  // --- Service & vehicle ---
  /** Replace a multi-select group's selection (body | equip | service). */
  setMsSelection(group: keyof MultiSelectState, sel: string[]): void
  setTariff(q: string): void

  // --- Stop-scope service + product equipment ---
  toggleStopSvc(id: number, key: keyof StopService): void
  /** Apply two-man to all stops (and set the default for new stops). */
  setAllTwoman(on: boolean): void
  toggleProductEq(stopId: number, itemIndex: number, key: string): void

  // --- Allocation ---
  assignUnit(unitIdx: number, deliveryStopId: number): void
  unassignUnit(unitIdx: number): void
  /** Assign every available unit to a delivery (prototype assignAll). */
  assignAllTo(deliveryStopId: number, unitIdxs: number[]): void
  /** Clear all units owned by a stop (prototype clearStop). */
  clearStopAssign(deliveryStopId: number): void

  // --- Driver ---
  setAllocatedDriver(driver: AllocatedDriver): void

  // --- CX notes ---
  setCxNotes(text: string): void
  markCxDirty(dirty: boolean): void
  markCxPosted(): void

  // --- Job lifecycle ---
  setJobStatus(status: JobStatus): void
  setQuickQuote(on: boolean): void
  setJobNotes(notes: string): void
  reset(): void
}

export type BookingStore = BookingState & BookingActions
