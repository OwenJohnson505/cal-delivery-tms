/**
 * Job / booking-level state.
 *
 * Source: handover §3 (state lives in module-scope vars: stops[], BOOK, MS/TAR/EQ,
 * allocatedDriver, cxNotes/cxDirty/cxPosted, ASSIGN), §4, §5 (Draft/Quote/Booking),
 * §1 (service & vehicle: tariff, multi-select body/equipment/service).
 *
 * The names below mirror the prototype's globals 1:1 so the port maps cleanly. Their
 * exact internal shapes are not fully enumerated in the handover text — confirm
 * against the prototype and tighten these from `Record<...>`/`unknown` placeholders.
 */

/** Footer/persistence lifecycle. Drives the contextual Draft/Quote/Booking actions. */
export type JobStatus = 'Draft' | 'Quote' | 'Booking'

/**
 * MS — job-scope multi-selects (body type / equipment / service) plus tariff selection.
 * Handover refers to MS.equip / MS.service as job-scope requirement sources.
 */
export interface JobMultiSelect {
  /** Job-scope equipment requirements (normalised-case keys — see Requirement). */
  equip: Record<string, boolean>
  /** Job-scope service requirements. */
  service: Record<string, boolean>
  /** Selected body type(s). */
  body?: Record<string, boolean>
  // TODO(prototype): confirm MS shape and key casing (see EQ casing bug, handover §6).
}

/** TAR — selected tariff (rate card / vehicle profile) from the tariff combobox. */
export interface Tariff {
  id: string
  label: string
  // TODO(prototype): confirm tariff shape (rate basis, vehicle profile, ...).
}

/**
 * EQ — product-scope equipment, keyed by 'stopId:itemIndex'.
 *
 * KNOWN BUG (handover §6 / spec §5.3): values are stored lowercase ({straps:true}) but
 * read capitalised (e['Straps']). Normalise casing when porting the requirements
 * rollup; keep keys canonical (lowercase) here.
 */
export type ProductEquipment = Record<string, Record<string, boolean>>

/**
 * ASSIGN — per-unit allocation map: global unit index -> owning delivery stop id
 * (exclusive ownership). Handover §4: `ASSIGN[globalUnitIdx] = deliveryStopId`.
 *
 * NOTE (handover §6): the global unit index is transient. Persist allocation against a
 * durable UnitIdentity (see types/goods.ts) rather than this render-time index; this
 * map type models the prototype's current behaviour for a faithful first port.
 */
export type AssignMap = Record<number, string>

/** BOOK — top-level booking/customer container (account, contact, etc.). */
export interface Book {
  // TODO(prototype): model BOOK from the prototype (customer account, selected
  // contact, multi-account selection, references, etc.).
  [key: string]: unknown
}
