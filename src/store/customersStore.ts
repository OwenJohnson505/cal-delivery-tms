/**
 * Customers store — the accounts shown on the Customers screen. Seeded from the mock
 * accounts; in-memory for now (a real impl would use the CRM/accounts service, §5).
 * Starts as just { id, name } — to be built out (contacts, terms, …) later.
 */
import { create } from 'zustand'
import { CUSTOMERS } from '@/api/mock/data.ts'

export interface Customer {
  id: string
  name: string
}

interface CustomersState {
  customers: Customer[]
  addCustomer(name: string): Customer
  deleteCustomer(id: string): void
}

export const useCustomersStore = create<CustomersState>((set) => ({
  customers: CUSTOMERS.map((c) => ({ id: c.id, name: c.name })),

  addCustomer: (name) => {
    const customer: Customer = { id: crypto.randomUUID(), name: name.trim() }
    set((s) => ({ customers: [customer, ...s.customers] }))
    return customer
  },

  deleteCustomer: (id) => set((s) => ({ customers: s.customers.filter((c) => c.id !== id) })),
}))
