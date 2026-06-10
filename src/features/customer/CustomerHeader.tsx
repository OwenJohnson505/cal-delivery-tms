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
  // When a company is chosen from the search, we step into picking one of its contacts.
  const [picking, setPicking] = useState<Customer | null>(null)
  // Contact email/phone popover (opened by clicking the contact name).
  const [contactOpen, setContactOpen] = useState(false)
  // Inline edit mode (Edit customer): change contact and/or switch company in place.
  const [editing, setEditing] = useState(false)

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
        // search contacts by name, email or phone
        if (`${ct.name} ${ct.email} ${ct.phone}`.toLowerCase().includes(q)) contacts.push({ c, ct })
      }),
    )
    return { companyHits: companies, contactHits: contacts.slice(0, 6) }
  }, [customers, query])

  // Choosing a company steps into contact selection (no auto-pick). If it has no
  // contacts, select the company straight away.
  const pickCompany = (c: Customer) => {
    if (c.contacts.length === 0) {
      setBook({ cust: c.id, contact: null })
      reset()
    } else {
      setPicking(c)
      setQuery('')
      setOpen(true)
    }
  }
  const pickContact = (c: Customer, ct: Contact) => {
    setBook({ cust: c.id, contact: { name: ct.name, email: ct.email, tel: ct.phone } })
    reset()
  }
  const useNoContact = (c: Customer) => {
    setBook({ cust: c.id, contact: null })
    reset()
  }
  const reset = () => {
    setQuery('')
    setOpen(false)
    setPicking(null)
  }

  if (!book.cust) {
    const hasHits = companyHits.length > 0 || contactHits.length > 0
    return (
      <div className="cc-edit">
        <div className="cb">
          <input
            type="text"
            placeholder={picking ? `${picking.companyName} — choose a contact` : 'Search customer — company, nickname, contact, email or phone…'}
            autoComplete="off"
            value={query}
            onChange={(e) => { setQuery(e.target.value); if (picking) setPicking(null); setOpen(true) }}
            onFocus={() => setOpen(true)}
            onBlur={() => setTimeout(() => setOpen(false), 150)}
          />
          {open && picking && (
            <div className="cb-menu open">
              <div className="cb-group cb-back" onMouseDown={(e) => { e.preventDefault(); setPicking(null) }}>
                ‹ Back · <b>{picking.companyName}</b> — choose a contact
              </div>
              {picking.contacts.map((ct) => (
                <div key={ct.id} className="cb-opt" onMouseDown={(e) => { e.preventDefault(); pickContact(picking, ct) }}>
                  <div className="co"><Icon name="user" size={13} /> {ct.name}{ct.role && <span className="cc-tag">{ct.role}</span>}</div>
                  <div className="ad">{[ct.email, ct.phone].filter(Boolean).join(' · ')}</div>
                </div>
              ))}
              <div className="cb-opt cb-sug" onMouseDown={(e) => { e.preventDefault(); useNoContact(picking) }}>
                <div className="co">Continue without a contact</div>
              </div>
            </div>
          )}
          {open && !picking && query.trim() && (
            <div className="cb-menu open">
              {companyHits.length > 0 && <div className="cb-group">Companies</div>}
              {companyHits.map(({ c, via }) => (
                <div key={c.id} className="cb-opt" onMouseDown={(e) => { e.preventDefault(); pickCompany(c) }}>
                  <div className="co">
                    <Icon name="building" size={13} /> {c.companyName}
                    {via && <span className="cc-tag">“{via}”</span>}
                  </div>
                  <div className="ad">
                    {c.accountCode}
                    {c.contacts.length ? ` · ${c.contacts.length} contact${c.contacts.length === 1 ? '' : 's'} →` : ''}
                  </div>
                </div>
              ))}
              {contactHits.length > 0 && <div className="cb-group">Contacts</div>}
              {contactHits.map(({ c, ct }) => (
                <div key={c.id + ct.id} className="cb-opt" onMouseDown={(e) => { e.preventDefault(); pickContact(c, ct) }}>
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

  // Edit mode: change contact (within the current customer) and/or switch company.
  // Everything writes straight to the store, so closing the box "saves" automatically.
  if (editing && book.cust) {
    const cust = customers.find((x) => x.id === book.cust) || null
    const cc = book.contact
    const currentId = cust?.contacts.find((ct) => cc && ct.name === cc.name && ct.email === cc.email)?.id || ''
    const switchCompany = (cmp: Customer) => {
      if (cmp.id !== book.cust) setBook({ cust: cmp.id, contact: null }) // new account → pick its contact next
      setQuery('')
      setOpen(false)
    }
    const pickContactById = (id: string) => {
      if (!cust) return
      if (!id) return setBook({ contact: null })
      const ct = cust.contacts.find((x) => x.id === id)
      if (ct) setBook({ contact: { name: ct.name, email: ct.email, tel: ct.phone } })
    }
    const exitEdit = () => { setEditing(false); setQuery(''); setOpen(false) }
    return (
      <div
        className="cc-edit-inline"
        tabIndex={-1}
        onBlur={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) exitEdit() }}
      >
        <div className="cb cc-edit-co">
          <input
            type="text"
            autoFocus
            autoComplete="off"
            placeholder={`${cust?.companyName ?? 'Search company'} — type to change`}
            value={query}
            onChange={(e) => { setQuery(e.target.value); setOpen(true) }}
            onFocus={() => setOpen(true)}
          />
          {open && query.trim() && (
            <div className="cb-menu open">
              {companyHits.length === 0 && <div className="cb-opt">No matching customers.</div>}
              {companyHits.map(({ c: cmp, via }) => (
                <div key={cmp.id} className="cb-opt" onMouseDown={(e) => { e.preventDefault(); switchCompany(cmp) }}>
                  <div className="co"><Icon name="building" size={13} /> {cmp.companyName}{via && <span className="cc-tag">“{via}”</span>}</div>
                  <div className="ad">{cmp.accountCode}</div>
                </div>
              ))}
            </div>
          )}
        </div>
        <select className="cc-edit-contact" value={currentId} onChange={(e) => pickContactById(e.target.value)}>
          <option value="">No contact</option>
          {cust?.contacts.map((ct) => (
            <option key={ct.id} value={ct.id}>{ct.name}{ct.role ? ` · ${ct.role}` : ''}</option>
          ))}
        </select>
        <button className="btn sm primary" onClick={exitEdit}>Done</button>
      </div>
    )
  }

  const c = book.contact
  return (
    <div className="cc-oneline" style={{ minWidth: 0 }}>
      {/* Click the company name for the customer-info pack. */}
      <button className="cc-name" title="View customer info" onClick={() => openModal('custinfo')}>
        <Icon name="building" size={14} /> <b>{accountName(customers, book.cust)}</b>
      </button>
      {c && (
        <span className="cc-contact-wrap">
          <span className="dotsep">·</span>
          {/* Click the contact name to reveal email + phone (call/email from there). */}
          <button className="cc-contact" title="Contact details" onClick={() => setContactOpen((o) => !o)}>
            <Icon name="user" size={14} /> {c.name}
          </button>
          {contactOpen && (
            <>
              <div className="cc-pop-scrim" onClick={() => setContactOpen(false)} />
              <div className="cc-contact-pop">
                <div className="ccp-h">{c.name}</div>
                {c.email && (
                  <a className="ccp-row" href={`mailto:${c.email}`} title="Send email">
                    <Icon name="mail" size={14} /> <span>{c.email}</span>
                  </a>
                )}
                {c.tel && (
                  <a className="ccp-row" href={`tel:${c.tel}`} title="Call">
                    <Icon name="phone" size={14} /> <span>{c.tel}</span>
                  </a>
                )}
              </div>
            </>
          )}
        </span>
      )}
      <button className="btn sm iconbtn" title="Edit customer" onClick={() => setEditing(true)}>
        <Icon name="edit" size={15} />
      </button>
    </div>
  )
}

function accountName(customers: Customer[], id: string): string {
  return customers.find((c) => c.id === id)?.companyName ?? id
}
