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
import type { CompanyAddress } from '@/api/mock/companyLookup.ts'

export type AccountKind = 'company' | 'personal'
export type AccountStatus = 'active' | 'inactive'
export type PaymentType = 'card' | 'invoice'
export type PaymentBasis = 'net' | 'eow' | 'eom'
export type InvoiceFrequency = 'per-job' | 'per-day' | 'weekly' | 'bi-weekly' | 'monthly'
export type AddressKind = 'collection' | 'delivery' | 'both'
export type CommissionMetric = 'revenue' | 'margin'

/**
 * Customer-defined custom fields for the booking form. Each field is filled in on the
 * booking screen (via the header "Custom fields" modal), scoped to the whole job or to
 * each stop. Real impl: a customer-config service; here it lives on the account.
 */
export type CustomFieldType = 'text' | 'number' | 'date' | 'select'
export type CustomFieldScope = 'job' | 'stop'
export interface CustomFieldDef {
  id: string
  label: string
  scope: CustomFieldScope
  type: CustomFieldType
  /** Options for a 'select' field (ignored otherwise). */
  options: string[]
  required: boolean
}

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
  /** PO this contact's jobs must use (PO-rule check). */
  defaultPo: string
}

export interface SavedCustomerAddress {
  id: string
  /** Company / premises name (auto-filled from booked jobs). */
  company: string
  /** Optional human label (e.g. "Main depot") — added manually. */
  label: string
  /** Shorthand nicknames (e.g. "North Depot") — searchable on the booking screen. */
  shorthands: string[]
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
  /** Accepted PO prefixes — a PO not matching one is flagged on the booking. */
  poPrefixes: string[]
  /** A fixed PO expected on every job for this account (optional). */
  fixedPo: string
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
  team: string // legacy free-text (superseded by departmentId/teamId)
  /** Owning department + team (see orgStore) — drives staff filtering of views. */
  departmentId: string
  teamId: string
  loyaltyEnabled: boolean // CalClub (Incentives tab)
  contacts: Contact[]
  // Invoicing
  invoicing: InvoicingInfo
  // Addresses (collection / delivery)
  addresses: SavedCustomerAddress[]
  // Sales
  sales: SalesInfo
  // Tariffs
  assignedTariffs: string[]
  defaultTariff: string
  // Rules / Notes
  rules: RulesInfo
  notes: string
  /** Custom booking-form fields this customer wants captured (job- or stop-level). */
  customFields: CustomFieldDef[]
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
    team: '',
    departmentId: '',
    teamId: '',
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
      frequency: 'weekly',
      weekdays: [],
      currency: 'GBP',
      prefixes: [],
      poRequired: false,
      attachPods: false,
      separatePerRef: false,
      poPrefixes: [],
      fixedPo: '',
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
    assignedTariffs: [],
    defaultTariff: '',
    rules: { requireBookingRef: false, preferredDriversOnly: false, blockOverCreditLimit: false },
    notes: '',
    customFields: [],
  }
}

interface CustomersState {
  customers: Customer[]
  seq: number
  /** The next account code, without mutating (for showing it before save). */
  peekCode(): string
  addCustomer(draft: CustomerDraft): Customer
  deleteCustomer(id: string): void
}

/** Seed accounts with nicknames + contacts so the booking search can be exercised. */
const SEED: Array<{
  id: string
  name: string
  altNames: string[]
  contacts: Array<[name: string, email: string, phone: string, role: string]>
}> = [
  { id: 'brightway', name: 'Brightway Trading Ltd', altNames: ['Brightway', 'BWT'], contacts: [
    ['Sarah Doyle', 's.doyle@brightway.co.uk', '0113 555 0148', 'Accounts'],
    ['James Hill', 'j.hill@brightway.co.uk', '0113 555 0150', 'Logistics'],
  ] },
  { id: 'meridian', name: 'Meridian Foods Ltd', altNames: ['Meridian'], contacts: [
    ['Sarah Doyle', 'sarah@meridianfoods.com', '0161 555 7781', 'Operations'],
  ] },
  { id: 'cal', name: 'Cal Logistics', altNames: ['Cal', 'CLL'], contacts: [
    ['Tom Baker', 'tom@callogistics.co.uk', '0151 555 2200', 'Transport'],
  ] },
  { id: 'orbit', name: 'Orbit Retail', altNames: ['Orbit'], contacts: [
    ['Priya Shah', 'priya@orbitretail.com', '0161 555 9001', 'Buyer'],
  ] },
  { id: 'owen', name: 'Owen Transport Limited', altNames: ['OT Limited', 'OTL'], contacts: [
    ['Owen Reid', 'owen@owentransport.co.uk', '0113 555 3300', 'Director'],
  ] },
  { id: 'northgate', name: 'Northgate Logistics', altNames: ['Northgate', 'NGL'], contacts: [
    ['John Carter', 'j.carter@northgate.co.uk', '0113 496 0021', 'Goods-in'],
  ] },
  { id: 'forsyth', name: 'Forsyth Retail Group', altNames: ['Forsyth', 'FRG'], contacts: [
    ['Emma Watts', 'emma@forsythretail.com', '0161 555 4040', 'Accounts'],
  ] },
]

/** Demo custom fields so the booking "Custom fields" modal can be exercised. */
const SEED_CUSTOM_FIELDS: Record<string, CustomFieldDef[]> = {
  brightway: [
    { id: 'cf-order', label: 'Order number', scope: 'job', type: 'text', options: [], required: true },
    { id: 'cf-cc', label: 'Cost centre', scope: 'job', type: 'select', options: ['North', 'South', 'Central'], required: false },
    { id: 'cf-bay', label: 'Delivery bay', scope: 'stop', type: 'text', options: [], required: false },
    { id: 'cf-booking', label: 'Booking-in date', scope: 'stop', type: 'date', options: [], required: false },
    { id: 'cf-exchange', label: 'Pallet exchange', scope: 'stop', type: 'select', options: ['Yes', 'No'], required: false },
  ],
}

function seedCustomers(): Customer[] {
  return SEED.map((c, i) => {
    const base = blankCustomerDraft()
    return {
      ...base,
      id: c.id,
      accountCode: `CUS-${1001 + i}`,
      accountKind: 'company' as const,
      companyName: c.name,
      altNames: c.altNames,
      startDate: '01-04-2025',
      contacts: c.contacts.map(([name, email, phone, role], ci) => ({
        id: crypto.randomUUID(), name, email, phone, role, isMain: ci === 0, defaultPo: '',
      })),
      invoicing: { ...base.invoicing, tradingName: c.name },
      customFields: SEED_CUSTOM_FIELDS[c.id] ?? [],
    }
  })
}

export const useCustomersStore = create<CustomersState>((set, get) => ({
  customers: seedCustomers(),
  seq: 1000 + SEED.length,

  peekCode: () => `CUS-${get().seq + 1}`,

  addCustomer: (draft) => {
    const seq = get().seq + 1
    const customer: Customer = { ...draft, id: crypto.randomUUID(), accountCode: `CUS-${seq}` }
    set((s) => ({ customers: [customer, ...s.customers], seq }))
    return customer
  },

  deleteCustomer: (id) => set((s) => ({ customers: s.customers.filter((c) => c.id !== id) })),
}))
