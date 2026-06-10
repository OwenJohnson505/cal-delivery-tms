/**
 * NotPortedYet — thrown by lib/ functions whose behaviour must be ported from the
 * prototype (reference/booking-form-modern.html) and has not been yet.
 *
 * These functions encode business rules that the handover (§6, §9) requires to match
 * the prototype byte-for-byte. They are deliberately NOT reconstructed from spec prose,
 * because the spec and prototype are known to disagree. Each stub throws until ported.
 */
export class NotPortedYet extends Error {
  constructor(fnName: string) {
    super(
      `${fnName}() is not ported yet. Port it from reference/booking-form-modern.html ` +
        `(search the prototype source for the same name) and replace this stub. ` +
        `See reference/README.md for the porting checklist.`,
    )
    this.name = 'NotPortedYet'
  }
}
