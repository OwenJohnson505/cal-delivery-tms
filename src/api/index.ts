/**
 * Typed API client — the integration seams from handover §5.
 *
 * Each subsystem is an interface so the mock implementation (built from the prototype's
 * in-memory stubs) and the real implementation (CRM, Places, Loqate, CX, driver feed,
 * persistence) are swappable behind the same contract. UI talks to these via TanStack
 * Query; never to a concrete impl directly.
 */
export type {
  AddressApi,
  AddressPrediction,
  InternalAddressProvider,
  PlacesAddressProvider,
  PostcodeAddressProvider,
} from './address.ts'
export type {
  CustomerApi,
  CustomerAccount,
  CustomerContact,
} from './customer.ts'
export type { DriverFeedApi } from './driver.ts'
export type { CxApi, CxPostInput, CxPostResult } from './cx.ts'
export type {
  OpsStatusApi,
  StopUpdate,
  DocumentsApi,
  BookingDocument,
  AuditApi,
  AuditEntry,
} from './ops.ts'
export type { PersistenceApi, JobSnapshot } from './persistence.ts'

import type { AddressApi } from './address.ts'
import type { CustomerApi } from './customer.ts'
import type { DriverFeedApi } from './driver.ts'
import type { CxApi } from './cx.ts'
import type { OpsStatusApi, DocumentsApi, AuditApi } from './ops.ts'
import type { PersistenceApi } from './persistence.ts'

/** The aggregate client the app depends on. */
export interface Api {
  address: AddressApi
  customer: CustomerApi
  drivers: DriverFeedApi
  cx: CxApi
  ops: OpsStatusApi
  documents: DocumentsApi
  audit: AuditApi
  persistence: PersistenceApi
}
