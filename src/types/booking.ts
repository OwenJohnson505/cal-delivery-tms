/**
 * Job / booking-level state. Source: spec §1 (globals), §2.3 (BOOK), §5 (MS/EQ), §8 (CX).
 *
 * Shapes mirror the prototype globals so the port maps 1:1:
 *   MS  = { body:{o,sel,ph}, equip:{o,sel,ph}, service:{o,sel,ph} }
 *   TAR = { q }                       // selected tariff text
 *   EQ  = { '<stopId>:<itemIndex>': { Straps?:true, Blanket?:true } }
 *   ASSIGN = { <unitIdx>: <deliveryStopId> }
 */

/**
 * Footer/persistence lifecycle (spec §10: jobStatus drives footer actions).
 * 'Quick Quote' is a lightweight quote saved from the simplified Quick Quote form.
 */
export type JobStatus = 'Draft' | 'Quick Quote' | 'Quote' | 'Booking'

/** A multi-select group: options, current selection, placeholder (spec §5 / §1). */
export interface MultiSelectGroup {
  /** Available options. */
  o: string[]
  /** Selected labels. */
  sel: string[]
  /** Placeholder text. */
  ph: string
}

/** MS — the three job-scope multi-selects. */
export interface MultiSelectState {
  body: MultiSelectGroup
  equip: MultiSelectGroup
  service: MultiSelectGroup
}

/** TAR — selected tariff (the combobox text). */
export interface Tariff {
  q: string
}

/**
 * EQ — product-scope equipment, keyed by '<stopId>:<itemIndex>'. Inner keys are the
 * PRODUCT_EQUIP labels. CANONICAL CASING after the §5.3 fix is the capitalised label
 * (e.g. 'Straps', 'Blanket'); lib/requirements normalises on read.
 */
export type ProductEquipment = Record<string, Record<string, boolean>>

/**
 * ASSIGN — per-unit allocation: global unit idx -> owning delivery stop id (exclusive).
 * Spec §4.3: `ASSIGN[unitIdx] = deliveryStopId`. Both are numbers.
 */
export type AssignMap = Record<number, number>

/** BOOK — customer/contact header model (spec §2.3; prototype line 1421). */
export interface Book {
  /** Selected customer/account id (string, e.g. 'brightway'). */
  cust: string | null
  contact: { name: string; email: string; tel: string } | null
  /** Selected contact index within the account's contacts. */
  cIdx?: number
  editCC?: boolean
  adding?: boolean
  expanded?: boolean
  newC?: unknown
}
