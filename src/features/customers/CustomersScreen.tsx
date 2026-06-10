/**
 * CustomersScreen — accounts list with an "Add customer" button that opens the full
 * CustomerForm modal (Account + Invoicing tabs). To be built out (detail/edit view,
 * department/team, more tabs) later.
 */
import { useMemo, useState } from 'react'
import { Icon } from '@/app/Icon.tsx'
import { useCustomersStore } from '@/store/customersStore.ts'
import { useJobsStore } from '@/store/jobsStore.ts'
import { CustomerForm } from './CustomerForm.tsx'

export function CustomersScreen() {
  const customers = useCustomersStore((s) => s.customers)
  const addCustomer = useCustomersStore((s) => s.addCustomer)
  const deleteCustomer = useCustomersStore((s) => s.deleteCustomer)
  const jobs = useJobsStore((s) => s.jobs)

  const [query, setQuery] = useState('')
  const [formOpen, setFormOpen] = useState(false)

  const jobCount = useMemo(() => {
    const c: Record<string, number> = {}
    jobs.forEach((j) => {
      c[j.customer] = (c[j.customer] || 0) + 1
    })
    return c
  }, [jobs])

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase()
    return customers.filter(
      (c) => !q || `${c.displayName} ${c.tradingName} ${c.nicknames.join(' ')} ${c.accountCode}`.toLowerCase().includes(q),
    )
  }, [customers, query])

  return (
    <div className="list-app">
      <div className="list-work">
        <div className="list-head">
          <h1>Customers</h1>
          <button className="btn primary" onClick={() => setFormOpen(true)}>
            <Icon name="plus" size={15} /> Add customer
          </button>
        </div>

        <div className="list-toolbar">
          <div className="ac" style={{ maxWidth: 320 }}>
            <input
              type="text"
              placeholder="Search name, trading name, nickname or code…"
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
                <th>Display name</th>
                <th>Trading name</th>
                <th>Code</th>
                <th>Status</th>
                <th className="num">Jobs</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((c) => (
                <tr key={c.id}>
                  <td><b>{c.displayName}</b></td>
                  <td>{c.tradingName || '—'}</td>
                  <td>{c.accountCode}</td>
                  <td><span className={'itag' + (c.status === 'inactive' ? ' itag-muted' : '')}>{c.status === 'active' ? 'Active' : 'Inactive'}</span></td>
                  <td className="num">{jobCount[c.displayName] || 0}</td>
                  <td className="list-actions">
                    <button
                      className="btn sm iconbtn"
                      title="Delete"
                      onClick={() => {
                        if (confirm(`Delete ${c.displayName}?`)) deleteCustomer(c.id)
                      }}
                    >
                      <Icon name="trash" size={14} />
                    </button>
                  </td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td className="empty" colSpan={6}>
                    No customers {query ? 'match your search' : 'yet'}.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {formOpen && (
        <CustomerForm
          onClose={() => setFormOpen(false)}
          onSave={(draft) => {
            addCustomer(draft)
            setFormOpen(false)
          }}
        />
      )}
    </div>
  )
}
