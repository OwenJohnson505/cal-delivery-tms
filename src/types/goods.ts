/**
 * Goods — parsed line items and the per-unit allocation model. Source: spec §4.
 *
 * NOTE: `wt` and `dim` are FORMATTED STRINGS as the parser emits them (e.g.
 * '400 kg (total)', '120×100×150cm'), not numbers — they flow straight into the
 * "reads as" preview and CX text, which must stay byte-identical to the prototype.
 */

/** A parsed goods line (spec §4.2 item shape: { qty, unit, wt, dim, raw }). */
export interface ParsedItem {
  /** Quantity; null when the segment had no recognised unit. */
  qty: number | null
  /** Capitalised unit noun (e.g. 'Pallet'); null when unrecognised. */
  unit: string | null
  /** Formatted weight string, '' if none (e.g. '400 kg (total)', '50 kg (each)'). */
  wt: string
  /** Formatted dimensions string, '' if none (e.g. '120×100×150cm'). */
  dim: string
  /** The original text fragment this item was parsed from (preserved verbatim). */
  raw: string
}

/**
 * A physical unit emitted by goodsUnits() (spec §4.3). A qty:3 line becomes three.
 * `idx` is the stable, incrementing global index and is the allocation key in ASSIGN.
 */
export interface GoodsUnit {
  /** Global incrementing index — the allocation key (transient; see UnitIdentity). */
  idx: number
  /** Id of the collection stop this unit was collected at. */
  collId: number
  /** Unit noun ('Item' for unrecognised lines). */
  unitName: string
  /** Display label, e.g. 'Pallet 1 of 2' or the raw text for unrecognised lines. */
  label: string
  wt: string
  dim: string
}

/**
 * Durable identity for an allocatable unit — the production fix for the transient `idx`
 * (spec §4.3 edge note). Persist allocation against this if goods can be edited after
 * allocation. Not used by the faithful first port; introduce when allocation persistence
 * is built.
 */
export interface UnitIdentity {
  collId: number
  lineIndex: number
  occurrence: number
}
