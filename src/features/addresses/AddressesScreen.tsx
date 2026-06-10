/**
 * AddressesScreen — every address associated with an account, gathered from its jobs
 * (booked / quoted / draft stops) plus the addresses saved on the customer record. This
 * isn't an external DB — it's a read-only aggregate view so the team can see all of a
 * customer's premises in one place. Filter by account + search.
 */
import { useMemo, useState } from 'react'
import { StatusPill } from '@/app/StatusPill.tsx'
import { useJobsStore } from '@/store/jobsStore.ts'
import { useCustomersStore } from '@/store/customersStore.ts'

interface AddrRow {
  company: string
  line: string
  pc: string
  kind: string // Collection / Delivery / Both / Saved
  source: string // Booking / Quote / Draft / Saved (drives the pill colour)
  account: string
}

export function AddressesScreen() {
  const jobs = useJobsStore((s) => s.jobs)
  const customers = useCustomersStore((s) => s.customers)

  const [account, setAccount] = useState('')
  const [query, setQuery] = useState('')

  const rows = useMemo<AddrRow[]>(() => {
    const out: AddrRow[] = []
    const seen = new Set<string>()
    const push = (r: AddrRow) => {
      const key = `${r.account}|${r.company}|${r.line}|${r.pc}|${r.source}`.toLowerCase()
      if (seen.has(key)) return
      seen.add(key)
      out.push(r)
    }
    // from jobs (booked / quoted / draft)
    jobs.forEach((j) => {
      const source = j.status === 'Quick Quote' ? 'Quote' : j.status
      j.snapshot.stops.forEach((st) => {
        const a = st.addr
        if (!a.co && !a.address && !a.pc) return
        push({
          company: a.co || '—',
          line: [a.address, a.city].filter(Boolean).join(', ') || '—',
          pc: a.pc || '—',
          kind: st.type,
          source,
          account: j.customer,
        })
      })
    })
    // from saved customer addresses
    customers.forEach((c) => {
      c.addresses.forEach((a) => {
        if (!a.company && !a.line1 && !a.postcode) return
        push({
          company: a.company || a.label || '—',
          line: [a.line1, a.city].filter(Boolean).join(', ') || '—',
          pc: a.postcode || '—',
          kind: a.kind === 'collection' ? 'Collection' : a.kind === 'delivery' ? 'Delivery' : 'Both',
          source: 'Saved',
          account: c.companyName,
        })
      })
    })
    return out
  }, [jobs, customers])

  const accounts = useMemo(() => Array.from(new Set(rows.map((r) => r.account))).sort(), [rows])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return rows.filter(
      (r) =>
        (!account || r.account === account) &&
        (!q || `${r.company} ${r.line} ${r.pc} ${r.account}`.toLowerCase().includes(q)),
    )
  }, [rows, account, query])

  return (
    <div className="list-app">
      <div className="list-work">
        <div className="list-head">
          <h1>Addresses</h1>
          <span className="cf-hint">Captured automatically from every booked, quoted &amp; draft job, plus saved account addresses.</span>
        </div>

        <div className="list-toolbar">
          <div className="ac" style={{ maxWidth: 280 }}>
            <input type="text" placeholder="Search company, street or postcode…" value={query} onChange={(e) => setQuery(e.target.value)} />
          </div>
          <select className="db-filter" value={account} onChange={(e) => setAccount(e.target.value)}>
            <option value="">All accounts</option>
            {accounts.map((a) => <option key={a}>{a}</option>)}
          </select>
          <span className="list-count">{filtered.length} {filtered.length === 1 ? 'address' : 'addresses'}</span>
        </div>

        <div className="list-tablewrap">
          <table className="list-table">
            <thead><tr><th>Company / premises</th><th>Address</th><th>Postcode</th><th>Use</th><th>Source</th><th>Account</th></tr></thead>
            <tbody>
              {filtered.map((r, i) => (
                <tr key={i}>
                  <td><b>{r.company}</b></td>
                  <td>{r.line}</td>
                  <td>{r.pc}</td>
                  <td>{r.kind}</td>
                  <td>{r.source === 'Saved' ? <span className="itag itag-muted">Saved</span> : <StatusPill status={r.source} />}</td>
                  <td>{r.account}</td>
                </tr>
              ))}
              {filtered.length === 0 && <tr><td className="empty" colSpan={6}>No addresses {query || account ? 'match your filter' : 'yet'}.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
