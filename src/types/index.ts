/**
 * Shared domain types for the Cal Delivery TMS booking wizard.
 *
 * Derived from the handover (§2/§4) state model. Anything marked TODO(prototype) must
 * be confirmed/tightened against reference/booking-form-modern.html once it is on disk.
 */
export type { Address, AddressSource, AddressClass } from './address.ts'
export type { Contact } from './contact.ts'
export type { TimeSpec, TimeMode, DateTimeString } from './time.ts'
export type { Pod, PodSource } from './pod.ts'
export type {
  Stop,
  StopType,
  StopService,
  StopStatus,
  ClockTime,
} from './stop.ts'
export type { Requirement, RequirementScope } from './requirement.ts'
export type {
  ParsedGoods,
  GoodsLine,
  GoodsUnit,
  UnitIdentity,
  Dimensions,
} from './goods.ts'
export type { Driver, Bid, AllocatedDriver } from './driver.ts'
export type { CxNotesState } from './cx.ts'
export type {
  JobStatus,
  JobMultiSelect,
  Tariff,
  ProductEquipment,
  AssignMap,
  Book,
} from './booking.ts'
