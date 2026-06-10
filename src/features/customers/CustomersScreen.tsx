/**
 * CustomersScreen — accounts list, plus the full-page New Customer form (shown in place
 * of the list while creating).
 */
import { useMemo, useState } from 'react'
import { Icon } from '@/app/Icon.tsx'
import { useCustomersStore, type Customer } from '@/store/customersStore.ts'
import { useJobsStore } from '@/store/jobsStore.ts'
import { CustomerForm } from './CustomerForm.tsx'

export function CustomersScreen() {
  const customers = useCustomersStore((s) => s.customers)
  const addCustomer = useCustomersStore((s) => s.addCustomer)
  const updateCustomer = useCustomersStore((s) => s.updateCustomer)
  const deleteCustomer = useCustomersStore((s) => s.deleteCustomer)
  const jobs = useJobsStore((s) => s.jobs)

  const [query, setQuery] = useState('')
  const [creating, setCreating] = useState(false)
  /** The customer currently open for editing (null = not editing). */
  const [editing, setEditing] = useState<Customer | null>(null)

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
      (c) => !q || `${c.companyName} ${c.altNames.join(' ')} ${c.accountCode}`.toLowerCase().includes(q),
    )
  }, [customers, query])

  if (creating || editing) {
    return (
      <div className="list-app">
        <CustomerForm
          customer={editing ?? undefined}
          onClose={() => { setCreating(false); setEditing(null) }}
          onSave={(draft) => {
            if (editing) updateCustomer(editing.id, draft)
            else addCustomer(draft)
            setCreating(false)
            setEditing(null)
          }}
        />
      </div>
    )
  }

  return (
    <div className="list-app">
      <div className="list-work">
        <div className="list-head">
          <h1>Customers</h1>
          <button className="btn primary" onClick={() => setCreating(true)}>
            <Icon name="plus" size={15} /> Add customer
          </button>
        </div>

        <div className="list-toolbar">
          <div className="ac" style={{ maxWidth: 320 }}>
            <input
              type="text"
              placeholder="Search name, alt name or code…"
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
                <th>Company</th>
                <th>Type</th>
                <th>Code</th>
                <th>Status</th>
                <th className="num">Jobs</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((c) => (
                <tr key={c.id} onDoubleClick={() => setEditing(c)}>
                  <td><b>{c.companyName}</b></td>
                  <td>{c.accountKind === 'personal' ? 'Personal' : c.companyType}</td>
                  <td>{c.accountCode}</td>
                  <td><span className={'itag' + (c.status === 'inactive' ? ' itag-muted' : '')}>{c.status === 'active' ? 'Active' : 'Inactive'}</span></td>
                  <td className="num">{jobCount[c.companyName] || 0}</td>
                  <td className="list-actions">
                    <button className="btn sm" title="Open" onClick={() => setEditing(c)}>
                      <Icon name="edit" size={13} /> Open
                    </button>
                    <button
                      className="btn sm iconbtn danger"
                      title="Delete"
                      onClick={() => {
                        if (confirm(`Delete ${c.companyName}?`)) deleteCustomer(c.id)
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
    </div>
  )
}
