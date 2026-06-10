/**
 * NotImplemented — thrown by mock API methods not yet built from the prototype's
 * in-memory stubs (SAVED/GOOGLE_PREDICT/POSTCODES/CUSTOMERS/CONTACTS/DRIVERS/CXBIDS/
 * DOCS/AUDIT). See handover §5.
 */
export class NotImplemented extends Error {
  constructor(method: string) {
    super(
      `mock API ${method} is not implemented yet. Build it from the matching prototype ` +
        `stub in reference/booking-form-modern.html (handover §5 seam table).`,
    )
    this.name = 'NotImplemented'
  }
}
