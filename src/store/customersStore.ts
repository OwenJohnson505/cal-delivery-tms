/**
 * Customers store — accounts shown on the Customers screen and (later) used by the booking
 * wizard. Rich account model captured across the New Customer page tabs. In-memory +
 * seeded for now (real impl → CRM/accounts service, §5). Lookups dummied in
 * api/mock/companyLookup.
 *
 * Design notes (de-duplication): the company/billing address lives ONLY on Invoicing
 * (`invoicing.address`); the Addresses tab holds collection/delivery points only.
 * `companyName` is the system/display name; `invoicing.tradingName` is the legal/
 * invoicing name (defaults to the company name via `sameAsCompany`).
 */
import { create } from 'zustand'
import { CUSTOMERS } from '@/api/mock/data.ts'
import type { CompanyAddress } from '@/api/mock/companyLookup.ts'

export type AccountKind = 'company' | 'personal'
export type AccountStatus = 'active' | 'inactive'
export type PaymentType = 'card' | 'invoice'
export type PaymentBasis = 'net' | 'eow' | 'eom'
export type InvoiceFrequency = 'per-job' | 'per-day' | 'weekly' | 'bi-weekly' | 'monthly'
export type AddressKind = 'collection' | 'delivery' | 'both'
export type CommissionMetric = 'revenue' | 'margin'

/** Company sub-types (only relevant when accountKind === 'company'). */
export const COMPANY_TYPES = [
  'Private Limited Company',
  'Public Limited Company (PLC)',
  'Sole Trader',
  'Partnership',
  'LLP',
  'Other',
]

export interface Contact {
  id: string
  name: string
  email: string
  phone: string
  role: string
  isMain: boolean
}

export interface SavedCustomerAddress {
  id: string
  label: string
  kind: AddressKind
  postcode: string
  line1: string
  city: string
}

export interface CommissionBand {
  id: string
  /** Threshold this band applies from (in the "based on" metric). */
  from: number
  /** Rate %. */
  rate: number
}

export interface InvoicingInfo {
  tradingName: string
  sameAsCompany: boolean
  /** The company / billing / registered address — the single source of truth. */
  address: CompanyAddress
  companyReg: string
  vat: string
  eori: string
  paymentType: PaymentType
  termsDays: number
  termsBasis: PaymentBasis
  invoiceEmails: string[]
  statementEmails: string[]
  frequency: InvoiceFrequency
  weekdays: string[]
  currency: string
  prefixes: string[]
  poRequired: boolean
  attachPods: boolean
  separatePerRef: boolean
  maxValuePerInvoice: number | null
  creditLimit: number | null
  creditScore: number | null
}

export interface SalesInfo {
  convertedBy: string
  leadBy: string
  source: string
  estAnnualSpend: number | null
  commissionEnd: string
  calculatedOn: CommissionMetric
  basedOn: CommissionMetric
  bands: CommissionBand[]
  cap: number | null
}

export interface RulesInfo {
  requireBookingRef: boolean
  preferredDriversOnly: boolean
  blockOverCreditLimit: boolean
}

export interface Customer {
  id: string
  accountCode: string
  // Account — type first; it drives the rest of the form
  accountKind: AccountKind
  companyType: string // company sub-type (company accounts only)
  /** System / display name. For a company: the company name; for personal: the full name. */
  companyName: string
  altNames: string[] // alternative / reference names + nicknames
  /** Personal accounts: the individual's own contact details. */
  personalEmail: string
  personalPhone: string
  status: AccountStatus
  startDate: string // dd-mm-yyyy
  assignedTo: string
  team: string // coming soon
  loyaltyEnabled: boolean // CalClub
  contacts: Contact[]
  // Invoicing
  invoicing: InvoicingInfo
  // Addresses (collection / delivery)
  addresses: SavedCustomerAddress[]
  // Sales
  sales: SalesInfo
  // Tariffs / Rules / Notes
  defaultTariff: string
  rules: RulesInfo
  notes: string
}

export type CustomerDraft = Omit<Customer, 'id' | 'accountCode'>

function emptyAddress(): CompanyAddress {
  return { postcode: '', line1: '', line2: '', city: '', town: '', country: 'United Kingdom' }
}

export function blankCustomerDraft(): CustomerDraft {
  return {
    accountKind: 'company',
    companyType: COMPANY_TYPES[0],
    companyName: '',
    altNames: [],
    personalEmail: '',
    personalPhone: '',
    status: 'active',
    startDate: '',
    assignedTo: '',
    team: '',
    loyaltyEnabled: false,
    contacts: [],
    invoicing: {
      tradingName: '',
      sameAsCompany: true,
      address: emptyAddress(),
      companyReg: '',
      vat: '',
      eori: '',
      paymentType: 'invoice',
      termsDays: 30,
      termsBasis: 'net',
      invoiceEmails: [],
      statementEmails: [],
      frequency: 'per-job',
      weekdays: [],
      currency: 'GBP',
      prefixes: [],
      poRequired: false,
      attachPods: false,
      separatePerRef: false,
      maxValuePerInvoice: null,
      creditLimit: null,
      creditScore: null,
    },
    addresses: [],
    sales: {
      convertedBy: '',
      leadBy: '',
      source: '',
      estAnnualSpend: null,
      commissionEnd: '',
      calculatedOn: 'revenue',
      basedOn: 'margin',
      bands: [],
      cap: null,
    },
    defaultTariff: '',
    rules: { requireBookingRef: false, preferredDriversOnly: false, blockOverCreditLimit: false },
    notes: '',
  }
}

interface CustomersState {
  customers: Customer[]
  seq: number
  addCustomer(draft: CustomerDraft): Customer
  deleteCustomer(id: string): void
}

function seedCustomers(): Customer[] {
  return CUSTOMERS.map((c, i) => {
    const base = blankCustomerDraft()
    return {
      ...base,
      id: c.id,
      accountCode: `CUS-${1001 + i}`,
      accountKind: 'company' as const,
      companyName: c.name,
      startDate: '01-04-2025',
      invoicing: { ...base.invoicing, tradingName: c.name },
    }
  })
}

export const useCustomersStore = create<CustomersState>((set, get) => ({
  customers: seedCustomers(),
  seq: 1004,

  addCustomer: (draft) => {
    const seq = get().seq + 1
    const customer: Customer = { ...draft, id: crypto.randomUUID(), accountCode: `CUS-${seq}` }
    set((s) => ({ customers: [customer, ...s.customers], seq }))
    return customer
  },

  deleteCustomer: (id) => set((s) => ({ customers: s.customers.filter((c) => c.id !== id) })),
}))
