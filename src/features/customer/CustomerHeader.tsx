/**
 * Customer/contact header (prototype renderHeader). Searches the customer database
 * (companies — by name or nickname/alt name — and their contacts) with a type-ahead
 * dropdown. Selecting a company picks its main contact; selecting a contact picks both.
 */
import { useMemo, useState } from 'react'
import { Icon } from '@/app/Icon.tsx'
import { useBookingStore } from '@/store/bookingStore.ts'
import { useUiStore } from '@/store/uiStore.ts'
import { useCustomersStore, type Customer, type Contact } from '@/store/customersStore.ts'

export function CustomerHeader() {
  const customers = useCustomersStore((s) => s.customers)
  const book = useBookingStore((s) => s.book)
  const setBook = useBookingStore((s) => s.setBook)
  const openModal = useUiStore((s) => s.openModal)

  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)

  const { companyHits, contactHits } = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return { companyHits: [] as Array<{ c: Customer; via: string | null }>, contactHits: [] as Array<{ c: Customer; ct: Contact }> }
    const companies = customers
      .map((c) => {
        if (c.companyName.toLowerCase().includes(q)) return { c, via: null as string | null }
        const nick = c.altNames.find((n) => n.toLowerCase().includes(q))
        return nick ? { c, via: nick } : null
      })
      .filter(Boolean)
      .slice(0, 6) as Array<{ c: Customer; via: string | null }>
    const contacts: Array<{ c: Customer; ct: Contact }> = []
    customers.forEach((c) =>
      c.contacts.forEach((ct) => {
        if (`${ct.name} ${ct.email}`.toLowerCase().includes(q)) contacts.push({ c, ct })
      }),
    )
    return { companyHits: companies, contactHits: contacts.slice(0, 6) }
  }, [customers, query])

  const pickCompany = (c: Customer) => {
    const m = c.contacts.find((ct) => ct.isMain) || c.contacts[0]
    setBook({ cust: c.id, contact: m ? { name: m.name, email: m.email, tel: m.phone } : null })
    reset()
  }
  const pickContact = (c: Customer, ct: Contact) => {
    setBook({ cust: c.id, contact: { name: ct.name, email: ct.email, tel: ct.phone } })
    reset()
  }
  const reset = () => {
    setQuery('')
    setOpen(false)
  }

  if (!book.cust) {
    const hasHits = companyHits.length > 0 || contactHits.length > 0
    return (
      <div className="cc-edit">
        <div className="cb">
          <input
            type="text"
            placeholder="Search customer — company, nickname, contact or email…"
            autoComplete="off"
            value={query}
            onChange={(e) => { setQuery(e.target.value); setOpen(true) }}
            onFocus={() => setOpen(true)}
            onBlur={() => setTimeout(() => setOpen(false), 150)}
          />
          {open && query.trim() && (
            <div className="cb-menu open">
              {companyHits.length > 0 && <div className="cb-group">Companies</div>}
              {companyHits.map(({ c, via }) => (
                <div key={c.id} className="cb-opt" onMouseDown={() => pickCompany(c)}>
                  <div className="co">
                    <Icon name="building" size={13} /> {c.companyName}
                    {via && <span className="cc-tag">“{via}”</span>}
                  </div>
                  <div className="ad">
                    {c.accountCode}
                    {c.contacts.length ? ` · ${c.contacts.length} contact${c.contacts.length === 1 ? '' : 's'}` : ''}
                  </div>
                </div>
              ))}
              {contactHits.length > 0 && <div className="cb-group">Contacts</div>}
              {contactHits.map(({ c, ct }) => (
                <div key={c.id + ct.id} className="cb-opt" onMouseDown={() => pickContact(c, ct)}>
                  <div className="co"><Icon name="user" size={13} /> {ct.name}<span className="cc-tag">{c.companyName}</span></div>
                  <div className="ad">{[ct.email, ct.phone].filter(Boolean).join(' · ')}</div>
                </div>
              ))}
              {!hasHits && <div className="cb-opt">No matching customers or contacts.</div>}
            </div>
          )}
        </div>
      </div>
    )
  }

  const c = book.contact
  return (
    <div className="cc-oneline" style={{ minWidth: 0 }}>
      <span className="cc-oneinfo" style={{ flex: '0 1 auto', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis' }}>
        <Icon name="building" size={14} /> <b>{accountName(customers, book.cust)}</b>
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
        <Icon name="info" size={16} />
      </button>
      <button className="btn sm" title="Change customer" onClick={() => setBook({ cust: null, contact: null })}>
        Change
      </button>
    </div>
  )
}

function accountName(customers: Customer[], id: string): string {
  return customers.find((c) => c.id === id)?.companyName ?? id
}
