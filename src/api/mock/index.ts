/**
 * Mock API client — implements the §5 seams from the prototype's in-memory stubs +
 * setTimeout latency. Used by tests, Storybook, and local dev until real services are
 * wired in one seam at a time (handover §8 step 8).
 *
 * Every method currently throws NotImplemented; fill each from its prototype stub once
 * reference/booking-form-modern.html is on disk. The structure mirrors the Api interface
 * so filling in a method needs no signature changes.
 */
import type { Api } from '../index.ts'
import { NotImplemented } from './notImplemented.ts'

export function createMockApi(): Api {
  return {
    address: {
      internal: {
        search: () => Promise.reject(new NotImplemented('address.internal.search')),
        resolve: () => Promise.reject(new NotImplemented('address.internal.resolve')),
        recordUse: () =>
          Promise.reject(new NotImplemented('address.internal.recordUse')),
      },
      places: {
        predict: () => Promise.reject(new NotImplemented('address.places.predict')),
        details: () => Promise.reject(new NotImplemented('address.places.details')),
      },
      postcode: {
        lookup: () => Promise.reject(new NotImplemented('address.postcode.lookup')),
      },
    },
    customer: {
      searchAccounts: () =>
        Promise.reject(new NotImplemented('customer.searchAccounts')),
      searchContacts: () =>
        Promise.reject(new NotImplemented('customer.searchContacts')),
      createContact: () =>
        Promise.reject(new NotImplemented('customer.createContact')),
    },
    drivers: {
      searchDrivers: () =>
        Promise.reject(new NotImplemented('drivers.searchDrivers')),
      listDrivers: () => Promise.reject(new NotImplemented('drivers.listDrivers')),
      listBids: () => Promise.reject(new NotImplemented('drivers.listBids')),
    },
    cx: {
      post: () => Promise.reject(new NotImplemented('cx.post')),
    },
    ops: {
      subscribeStopUpdates: () => {
        throw new NotImplemented('ops.subscribeStopUpdates')
      },
    },
    documents: {
      list: () => Promise.reject(new NotImplemented('documents.list')),
      upload: () => Promise.reject(new NotImplemented('documents.upload')),
      remove: () => Promise.reject(new NotImplemented('documents.remove')),
    },
    audit: {
      list: () => Promise.reject(new NotImplemented('audit.list')),
      append: () => Promise.reject(new NotImplemented('audit.append')),
    },
    persistence: {
      load: () => Promise.reject(new NotImplemented('persistence.load')),
      saveDraft: () => Promise.reject(new NotImplemented('persistence.saveDraft')),
      saveQuote: () => Promise.reject(new NotImplemented('persistence.saveQuote')),
      saveBooking: () =>
        Promise.reject(new NotImplemented('persistence.saveBooking')),
    },
  }
}

export { NotImplemented } from './notImplemented.ts'
