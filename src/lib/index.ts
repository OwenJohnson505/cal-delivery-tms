/**
 * src/lib — framework-free business logic ported from the prototype (the byte-for-byte
 * behavioural source of truth). No business rule lives in a component (spec §9).
 */
export { parseGoods, fmtItem, itemShort, cap, plur, normWU } from './parseGoods.ts'
export {
  goodsUnits,
  availableUnitsFor,
  deliverItems,
  collectItems,
  syncAssign,
  deliveries,
  stopIndex,
  isColl,
  isDel,
} from './allocation.ts'
export { buildCxNotes, type CxBookingState } from './buildCxNotes.ts'
export {
  parseDt,
  dtParts,
  dstamp,
  tphrase,
  collTime,
  delTime,
  outcode,
  hm,
  ord,
} from './time.ts'
export { etaToClock } from './etaToClock.ts'
export { internalRank, clean, fuzzy, type SavedAddress } from './internalRank.ts'
export { rollupRequirements, type RequirementsInput } from './requirements.ts'
export { esc, pad, fmt } from './text.ts'
