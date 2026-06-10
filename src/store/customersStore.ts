/**
 * Customers store — accounts shown on the Customers screen and (later) used by the booking
 * wizard. Rich account + invoicing model; in-memory + seeded for now (a real impl would
 * use the CRM/accounts service, §5). Lookups (HMRC/CreditSafe) are dummied in
 * api/mock/companyLookup.
 */
import { create } from 'zustand'
import { CUSTOMERS } from '@/api/mock/data.ts'
import type { CompanyAddress } from '@/api/mock/companyLookup.ts'

export type AccountType = 'company' | 'personal'
export type AccountStatus = 'active' | 'inactive'
export type PaymentMode = 'card' | 'invoice'
/** net N days, end-of-week, or end-of-month. */
export type PaymentBasis = 'net' | 'eow' | 'eom'
export type InvoiceFrequencyMode = 'per-job' | 'per-day' | 'weekly' | 'bi-weekly' | 'monthly'
export type AddressMode = 'registered' | 'different'

export interface PaymentTerms {
  mode: PaymentMode
  days: number
  basis: PaymentBasis
}

export interface InvoiceFrequency {
  mode: InvoiceFrequencyMode
  /** Used when weekly/bi-weekly, e.g. ['Mon']. */
  weekdays: string[]
}

export interface Invoicing {
  mirrorTradingName: boolean
  tradingName: string
  addressMode: AddressMode
  address: CompanyAddress
  invoiceEmails: string // comma-separated
  statementEmails: string // comma-separated
  companyRegNumber: string
  vatNumber: string
  eoriNumber: string
  paymentTerms: PaymentTerms
  invoiceFrequency: InvoiceFrequency
  poRequired: boolean
  separateInvoicePerPo: boolean
  currency: string
  creditScore: number | null
  creditLimit: number | null
  invoicePrefixes: string // comma-separated
}

export interface Customer {
  id: string
  accountType: AccountType
  status: AccountStatus
  startDate: string // 'dd-mm-yyyy'
  accountCode: string // system-generated
  /** Registered company name — used on invoicing + searchable. */
  tradingName: string
  /** How the customer is shown across the system. */
  displayName: string
  nicknames: string[]
  department: string
  team: string
  address: CompanyAddress
  companyRegNumber: string
  invoicing: Invoicing
}

/** Form draft = a Customer without its generated id/accountCode. */
export type CustomerDraft = Omit<Customer, 'id' | 'accountCode'>

function emptyAddress(): CompanyAddress {
  return { postcode: '', line1: '', line2: '', city: '', town: '', country: 'United Kingdom' }
}

export function blankCustomerDraft(): CustomerDraft {
  return {
    accountType: 'company',
    status: 'active',
    startDate: '',
    tradingName: '',
    displayName: '',
    nicknames: [],
    department: '',
    team: '',
    address: emptyAddress(),
    companyRegNumber: '',
    invoicing: {
      mirrorTradingName: true,
      tradingName: '',
      addressMode: 'registered',
      address: emptyAddress(),
      invoiceEmails: '',
      statementEmails: '',
      companyRegNumber: '',
      vatNumber: '',
      eoriNumber: '',
      paymentTerms: { mode: 'invoice', days: 30, basis: 'net' },
      invoiceFrequency: { mode: 'per-job', weekdays: [] },
      poRequired: false,
      separateInvoicePerPo: false,
      currency: 'GBP',
      creditScore: null,
      creditLimit: null,
      invoicePrefixes: '',
    },
  }
}

interface CustomersState {
  customers: Customer[]
  seq: number
  addCustomer(draft: CustomerDraft): Customer
  deleteCustomer(id: string): void
}

function seedCustomers(): Customer[] {
  return CUSTOMERS.map((c, i) => ({
    ...blankCustomerDraft(),
    id: c.id,
    accountCode: `CUS-${1001 + i}`,
    tradingName: c.name,
    displayName: c.name,
    status: 'active',
    startDate: '01-04-2025',
    invoicing: { ...blankCustomerDraft().invoicing, tradingName: c.name },
  }))
}

export const useCustomersStore = create<CustomersState>((set, get) => ({
  customers: seedCustomers(),
  seq: 1004,

  addCustomer: (draft) => {
    const seq = get().seq + 1
    const customer: Customer = {
      ...draft,
      id: crypto.randomUUID(),
      accountCode: `CUS-${seq}`,
      displayName: draft.displayName.trim() || draft.tradingName.trim(),
    }
    set((s) => ({ customers: [customer, ...s.customers], seq }))
    return customer
  },

  deleteCustomer: (id) => set((s) => ({ customers: s.customers.filter((c) => c.id !== id) })),
}))
