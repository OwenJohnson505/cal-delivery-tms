/**
 * Customer/contact header (prototype renderHeader). Shows the selected account + contact
 * with copy-able email/phone and an info button (customer info pack). Account/contact
 * search is wired to the mock customer service.
 */
import { useState } from 'react'
import { Icon } from '@/app/Icon.tsx'
import { useApi } from '@/api/ApiProvider.tsx'
import { useBookingStore } from '@/store/bookingStore.ts'
import { useUiStore } from '@/store/uiStore.ts'
import type { CustomerAccount, CustomerContact } from '@/api/index.ts'

export function CustomerHeader() {
  const api = useApi()
  const book = useBookingStore((s) => s.book)
  const setBook = useBookingStore((s) => s.setBook)
  const openModal = useUiStore((s) => s.openModal)

  const [query, setQuery] = useState('')
  const [accounts, setAccounts] = useState<CustomerAccount[]>([])
  const [open, setOpen] = useState(false)

  async function onSearch(q: string) {
    setQuery(q)
    if (!q.trim()) {
      setAccounts([])
      setOpen(false)
      return
    }
    const res = await api.customer.searchAccounts(q)
    setAccounts(res)
    setOpen(true)
  }

  async function pick(acc: CustomerAccount) {
    const contacts: CustomerContact[] = await api.customer.searchContacts('', acc.id)
    const c = contacts[0] || null
    setBook({
      cust: acc.id,
      contact: c ? { name: c.name, email: c.email, tel: c.tel } : null,
    })
    setQuery('')
    setOpen(false)
    setAccounts([])
  }

  if (!book.cust) {
    return (
      <div className="cc-edit">
        <div className="cb">
          <input
            type="text"
            placeholder="Search customer by name, email or company…"
            autoComplete="off"
            value={query}
            onChange={(e) => onSearch(e.target.value)}
          />
          <div className={'cb-menu' + (open ? ' open' : '')}>
            {accounts.map((a) => (
              <div key={a.id} className="cb-opt" onMouseDown={() => pick(a)}>
                <div className="co">{a.name}</div>
                <div className="ad">{a.refs.length ? a.refs.join(' · ') : 'No recent refs'}</div>
              </div>
            ))}
            {!accounts.length && <div className="cb-opt">No matching accounts.</div>}
          </div>
        </div>
      </div>
    )
  }

  const c = book.contact
  return (
    <div className="cc-oneline" style={{ minWidth: 0 }}>
      <span
        className="cc-oneinfo"
        style={{ flex: '0 1 auto', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis' }}
      >
        <Icon name="building" size={14} /> <b>{accountName(book.cust)}</b>
        {c && (
          <>
            <span className="dotsep">·</span>
            <Icon name="user" size={14} /> {c.name}
            <span className="dotsep">·</span>
            <span className="cpx" title="Click to copy">{c.email}</span>
            <span className="dotsep">·</span>
            <span className="cpx" title="Click to copy">{c.tel}</span>
          </>
        )}
      </span>
      <button className="btn sm iconbtn" title="Customer info" onClick={() => openModal('custinfo')} style={{ flex: 'none' }}>
        <Icon name="info" size={14} />
      </button>
      <button className="btn sm" title="Change customer" onClick={() => setBook({ cust: null, contact: null })}>
        Change
      </button>
    </div>
  )
}

function accountName(id: string): string {
  const names: Record<string, string> = {
    brightway: 'Brightway Trading Ltd',
    meridian: 'Meridian Foods',
    cal: 'Cal Logistics',
    orbit: 'Orbit Retail',
  }
  return names[id] || id
}
