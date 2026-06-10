/**
 * Shared domain types for the Cal Delivery TMS booking wizard.
 * Derived from booking-form-developer-spec.md §2 + the prototype source.
 */
export type { Address, AddressClass, Country } from './address.ts'
export type { Contact } from './contact.ts'
export type { TimeSpec, TimeMode, DateTimeString } from './time.ts'
export type { Pod, PodType, PodVia } from './pod.ts'
export type {
  Stop,
  StopType,
  StopService,
  StopStatus,
  ClockTime,
} from './stop.ts'
export type { RequirementRow } from './requirement.ts'
export type { ParsedItem, GoodsUnit, UnitIdentity } from './goods.ts'
export type { Driver, Bid, AllocatedDriver } from './driver.ts'
export type { CxNotesState } from './cx.ts'
export type {
  JobStatus,
  MultiSelectGroup,
  MultiSelectState,
  Tariff,
  ProductEquipment,
  AssignMap,
  Book,
} from './booking.ts'
