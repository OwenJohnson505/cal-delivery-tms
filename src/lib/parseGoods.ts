/**
 * parseGoods — extract qty/unit/weight/dimensions from free-text goods entry and
 * produce the live "reads as" preview.
 *
 * Behavioural source of truth: reference/booking-form-modern.html (function `parseGoods`,
 * and the "reads as" rendering). Handover §1, §6, §9.
 *
 * GUARDRAIL: the `readsAs` preview is one of the four byte-identical output formats —
 * it MUST match the prototype exactly. Cover with a snapshot test (parseGoods.test.ts).
 */
import type { ParsedGoods } from '@/types/index.ts'
import { NotPortedYet } from './notPorted.ts'

export function parseGoods(_goodsText: string): ParsedGoods {
  // TODO(prototype): port the parser + "reads as" builder verbatim from the prototype.
  throw new NotPortedYet('parseGoods')
}
