/**
 * CustomersScreen — a simple accounts list with an "Add customer" button that opens a
 * modal form (name only for now), in the same style as the rest of the app's modals.
 * To be built out (contacts, terms, references, …) later.
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
    return customers.filter((c) => !q || c.name.toLowerCase().includes(q))
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

      {formOpen && (
        <NewCustomerModal
          onClose={() => setFormOpen(false)}
          onCreate={(name) => {
            addCustomer(name)
            setFormOpen(false)
          }}
        />
      )}
    </div>
  )
}

function NewCustomerModal({
  onClose,
  onCreate,
}: {
  onClose: () => void
  onCreate: (name: string) => void
}) {
  const [name, setName] = useState('')
  const submit = () => {
    if (name.trim()) onCreate(name.trim())
  }

  return (
    <div className="modal-overlay open" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-h">
          New customer
          <span className="x" onClick={onClose}>✕</span>
        </div>
        <div className="modal-b">
          <div className="fld">
            <label>Customer name</label>
            <input
              type="text"
              autoFocus
              placeholder="e.g. Acme Freight Ltd"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && submit()}
            />
          </div>
        </div>
        <div className="modal-f">
          <button className="btn" onClick={onClose}>Cancel</button>
          <button className="btn primary" onClick={submit} disabled={!name.trim()}>
            Add customer
          </button>
        </div>
      </div>
    </div>
  )
}
