/**
 * Goods — parsed goods + per-unit allocation model.
 *
 * Source: handover §1 (Goods), §4, §6.
 *
 * parseGoods() extracts qty/unit/weight/dimensions from free text and drives a live
 * "reads as" preview. goodsUnits() expands a stop's goods into individual units with
 * a render-time global index `idx`.
 *
 * IMPORTANT (handover §6): the allocation index is TRANSIENT — goodsUnits() recomputes
 * idx from text every render and it is stable only while goods text and stop order are
 * unchanged. When porting, persist allocation against a DURABLE identity
 * (collId + lineIndex + occurrence), not the render-time idx. UnitIdentity below is the
 * durable shape to migrate toward; keep `idx` only as a transient render concern.
 */

export type Dimensions = {
  l?: number
  w?: number
  h?: number
  /** Unit of measure for dimensions as parsed (e.g. 'cm', 'm'). */
  unit?: string
}

/** A single parsed goods line (one entry of free-text goods). */
export interface GoodsLine {
  /** Quantity of units this line represents. */
  qty: number
  /** Unit noun, e.g. 'pallet', 'box', 'cage'. */
  unit: string
  /** Per-unit (or total — confirm against prototype) weight in kg. */
  weightKg?: number
  dims?: Dimensions
  /** The original text fragment this line was parsed from. */
  raw: string
}

/**
 * The result of parsing a stop's full goods free-text.
 * `readsAs` is the live preview string shown to the user — one of the four
 * byte-identical output formats that must match the prototype exactly.
 */
export interface ParsedGoods {
  lines: GoodsLine[]
  /** Human-readable "reads as" preview. Must match the prototype byte-for-byte. */
  readsAs: string
}

/**
 * Durable identity for an allocatable unit (handover §6 fix). Replaces reliance on
 * the transient render-time `idx`.
 */
export interface UnitIdentity {
  /** Id of the collection stop the unit was collected at. */
  collId: string
  /** Index of the goods line within that stop's parsed goods. */
  lineIndex: number
  /** Which unit within that line's qty (0-based). */
  occurrence: number
}

/** A unit as produced by goodsUnits() for rendering/allocation. */
export interface GoodsUnit {
  /** Transient render-time global index — DO NOT persist. */
  idx: number
  /** Durable identity — persist allocation against this. */
  identity: UnitIdentity
  unit: string
  weightKg?: number
  dims?: Dimensions
}
