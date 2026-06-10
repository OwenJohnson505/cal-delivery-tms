/**
 * Customer / accounts service (handover §1 customer & contact, §5: CUSTOMERS/CONTACTS
 * stubs -> CRM/accounts service).
 *
 * Search by name/email/company; multi-account picker; add-new-contact flow with domain
 * suggestion. Shapes are modelled from the handover description — confirm/tighten the
 * record fields against the prototype's CUSTOMERS/CONTACTS stubs when it lands.
 */
import type { Contact } from '@/types/index.ts'

/** An account (prototype CUSTOMERS[]: { id, name, refs }). */
export interface CustomerAccount {
  /** String id, e.g. 'brightway'. */
  id: string
  name: string
  /** Recent consignment/PO references for quick pick. */
  refs: string[]
}

/** A contact under an account (prototype CONTACTS[]: { name, email, tel, cust }). */
export interface CustomerContact extends Contact {
  /** Owning account id. */
  cust: string
}

export interface CustomerApi {
  /** Search accounts by name/email/company (multi-account results). */
  searchAccounts(query: string): Promise<CustomerAccount[]>
  /** Search contacts by name/email/company, optionally scoped to an account. */
  searchContacts(query: string, accountId?: string): Promise<CustomerContact[]>
  /** Create a new contact under an account (add-new-contact flow). */
  createContact(
    accountId: string,
    contact: Omit<CustomerContact, 'cust'>,
  ): Promise<CustomerContact>
}
