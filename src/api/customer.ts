/**
 * Customer / accounts service (handover §1 customer & contact, §5: CUSTOMERS/CONTACTS
 * stubs -> CRM/accounts service).
 *
 * Search by name/email/company; multi-account picker; add-new-contact flow with domain
 * suggestion. Shapes are modelled from the handover description — confirm/tighten the
 * record fields against the prototype's CUSTOMERS/CONTACTS stubs when it lands.
 */
import type { Contact } from '@/types/index.ts'

export interface CustomerAccount {
  id: string
  name: string
  company?: string
  /** Email domain used for the add-contact domain suggestion. */
  domain?: string
  // TODO(prototype): confirm full account shape (codes, terms, tariff defaults, ...).
}

export interface CustomerContact extends Contact {
  id: string
  accountId: string
}

export interface CustomerApi {
  /** Search accounts by name/email/company (multi-account results). */
  searchAccounts(query: string): Promise<CustomerAccount[]>
  /** Search contacts by name/email/company, optionally scoped to an account. */
  searchContacts(query: string, accountId?: string): Promise<CustomerContact[]>
  /** Create a new contact under an account (add-new-contact flow). */
  createContact(
    accountId: string,
    contact: Omit<CustomerContact, 'id' | 'accountId'>,
  ): Promise<CustomerContact>
}
