/**
 * src/lib — framework-free business logic, the heart of the port.
 *
 * Every export here is a STUB that throws NotPortedYet until ported from
 * reference/booking-form-modern.html. No business rule should live in a component;
 * keep it here, fully tested (handover §9).
 */
export { parseGoods } from './parseGoods.ts'
export { goodsUnits, availableUnitsFor } from './allocation.ts'
export { buildCxNotes, type BuildCxNotesInput } from './buildCxNotes.ts'
export { etaToClock } from './etaToClock.ts'
export { internalRank, type SavedAddressRecord } from './internalRank.ts'
export { rollupRequirements, type RequirementsInput } from './requirements.ts'
export { NotPortedYet } from './notPorted.ts'
