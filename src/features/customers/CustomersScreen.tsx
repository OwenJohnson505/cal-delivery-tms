/**
 * CustomersScreen — a simple accounts list with a create form (name only for now). Reuses
 * the list-screen table styling. To be built out (contacts, terms, references, …) later.
 */
import { useMemo, useState } from 'react'
import { Icon } from '@/app/Icon.tsx'
import { useCustomersStore } from '@/store/customersStore.ts'
import { useJobsStore } from '@/store/jobsStore.ts'

export function CustomersScreen() {
  const customers = useCustomersStore((s) => s.customers)
  const addCustomer = useCustomersStore((s) => s.addCustomer)
  const deleteCustomer = useCustomersStore((s) => s.deleteCustomer)
  const jobs = useJobsStore((s) => s.jobs)

  const [name, setName] = useState('')
  const [query, setQuery] = useState('')

  const jobCount = useMemo(() => {
    const c: Record<string, number> = {}
    jobs.forEach((j) => {
      c[j.customer] = (c[j.customer] || 0) + 1
    })
    return c
  }, [jobs])

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase()
    return customers.filter((c) => !q || c.name.toLowerCase().includes(q))
  }, [customers, query])

  function create() {
    const trimmed = name.trim()
    if (!trimmed) return
    addCustomer(trimmed)
    setName('')
  }

  return (
    <div className="list-app">
      <div className="list-work">
        <div className="list-head">
          <h1>Customers</h1>
        </div>

        {/* Create form (name only for now) */}
        <div className="cust-create">
          <div className="fld" style={{ flex: 1, maxWidth: 360 }}>
            <label>New customer</label>
            <input
              type="text"
              placeholder="Customer name…"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && create()}
            />
          </div>
          <button className="btn primary" onClick={create} disabled={!name.trim()}>
            <Icon name="plus" size={15} /> Add customer
          </button>
        </div>

        <div className="list-toolbar">
          <div className="ac" style={{ maxWidth: 320 }}>
            <input
              type="text"
              placeholder="Search customers…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          <span className="list-count">{rows.length} {rows.length === 1 ? 'customer' : 'customers'}</span>
        </div>

        <div className="list-tablewrap">
          <table className="list-table">
            <thead>
              <tr>
                <th>Customer</th>
                <th className="num">Jobs</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((c) => (
                <tr key={c.id}>
                  <td><b>{c.name}</b></td>
                  <td className="num">{jobCount[c.name] || 0}</td>
                  <td className="list-actions">
                    <button
                      className="btn sm iconbtn"
                      title="Delete"
                      onClick={() => {
                        if (confirm(`Delete ${c.name}?`)) deleteCustomer(c.id)
                      }}
                    >
                      <Icon name="trash" size={14} />
                    </button>
                  </td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td className="empty" colSpan={3}>
                    No customers {query ? 'match your search' : 'yet'}.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
