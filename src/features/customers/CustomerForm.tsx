/**
 * CustomerForm — full-page New Customer form. Restructured, de-duplicated tabs:
 *   Account · Invoicing · Addresses · Sales · Tariffs · Rules · Notes
 * The company/billing address lives only on Invoicing; Addresses holds collection/
 * delivery points. HMRC company lookup + CreditSafe credit lookup are dummied.
 */
import { useState } from 'react'
import { Icon } from '@/app/Icon.tsx'
import { Section, Segmented, ChipList } from './formBits.tsx'
import {
  COMPANY_TYPES,
  blankCustomerDraft,
  type CustomerDraft,
  type AccountKind,
  type Contact,
  type SavedCustomerAddress,
  type CommissionBand,
  type AddressKind,
} from '@/store/customersStore.ts'
import type { CompanyAddress, CompanyLookupResult } from '@/api/mock/companyLookup.ts'
import { searchCompanies, lookupCredit } from '@/api/mock/companyLookup.ts'
import { useCustomersStore } from '@/store/customersStore.ts'

type Tab = 'account' | 'invoicing' | 'addresses' | 'sales' | 'tariffs' | 'rules' | 'notes'
const TABS: Array<[Tab, string]> = [
  ['account', 'Account'], ['invoicing', 'Invoicing'], ['addresses', 'Addresses'],
  ['sales', 'Sales'], ['tariffs', 'Tariffs'], ['rules', 'Rules'], ['notes', 'Notes'],
]
const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const CURRENCIES = ['GBP', 'EUR', 'USD']
const TARIFFS = ['Standard', 'Small van', 'SWB van', 'LWB van', 'Luton', '7.5t', '18t', 'Artic']

const uid = () => crypto.randomUUID()

function toISO(dmy: string): string {
  const m = /^(\d{2})-(\d{2})-(\d{4})$/.exec(dmy)
  return m ? `${m[3]}-${m[2]}-${m[1]}` : ''
}
function fromISO(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso)
  return m ? `${m[3]}-${m[2]}-${m[1]}` : ''
}

export function CustomerForm({ onClose, onSave }: { onClose: () => void; onSave: (d: CustomerDraft) => void }) {
  const [tab, setTab] = useState<Tab>('account')
  const [d, setD] = useState<CustomerDraft>(blankCustomerDraft())
  // Show the account code immediately (the same one addCustomer will assign on save).
  const accountCode = useCustomersStore((s) => s.peekCode())

  const set = (patch: Partial<CustomerDraft>) => setD((p) => ({ ...p, ...patch }))
  const setInv = (patch: Partial<CustomerDraft['invoicing']>) => setD((p) => ({ ...p, invoicing: { ...p.invoicing, ...patch } }))
  const setInvAddr = (patch: Partial<CompanyAddress>) => setD((p) => ({ ...p, invoicing: { ...p.invoicing, address: { ...p.invoicing.address, ...patch } } }))
  const setSales = (patch: Partial<CustomerDraft['sales']>) => setD((p) => ({ ...p, sales: { ...p.sales, ...patch } }))
  const setRules = (patch: Partial<CustomerDraft['rules']>) => setD((p) => ({ ...p, rules: { ...p.rules, ...patch } }))

  // Account type drives the rest of the form. Personal accounts default to card payment.
  const setKind = (kind: AccountKind) =>
    setD((p) => ({
      ...p,
      accountKind: kind,
      invoicing: { ...p.invoicing, paymentType: kind === 'personal' ? 'card' : p.invoicing.paymentType },
    }))

  // Apply a chosen company match — fills name, reg and the invoicing address.
  function applyCompany(r: CompanyLookupResult) {
    setD((p) => ({
      ...p,
      companyName: r.tradingName,
      invoicing: { ...p.invoicing, tradingName: r.tradingName, companyReg: r.companyRegNumber, address: { ...r.address } },
    }))
  }
  function runCreditLookup() {
    if (!d.invoicing.companyReg) return
    const c = lookupCredit(d.invoicing.companyReg)
    setInv({ creditScore: c.creditScore, creditLimit: c.creditLimit })
  }

  function save() {
    if (!d.companyName.trim()) {
      setTab('account')
      return
    }
    onSave({
      ...d,
      invoicing: { ...d.invoicing, tradingName: d.invoicing.sameAsCompany ? d.companyName : d.invoicing.tradingName },
    })
  }

  return (
      <div className="cf-page">
        <div className="cf-page-head">
          <button className="cf-back" onClick={onClose} title="Back to customers">
            <Icon name="copy" size={18} />
          </button>
          <div>
            <h1>New Customer</h1>
            <div className="cf-sub">Create a new customer account</div>
          </div>
          <div className="cf-page-actions">
            <button className="btn" onClick={onClose}>Cancel</button>
            <button className="btn primary" onClick={save} disabled={!d.companyName.trim()}>Save customer</button>
          </div>
        </div>

        <div className="cf-card">
          <div className="cf-tabs">
            {TABS.map(([t, label]) => (
              <button key={t} className={'cf-tab' + (t === tab ? ' on' : '')} onClick={() => setTab(t)}>{label}</button>
            ))}
          </div>

          <div className="cf-body">
            {tab === 'account' && (
              <AccountTab d={d} set={set} setKind={setKind} accountCode={accountCode} applyCompany={applyCompany} />
            )}
            {tab === 'invoicing' && (
              <InvoicingTab d={d} setInv={setInv} setInvAddr={setInvAddr} runCreditLookup={runCreditLookup} />
            )}
            {tab === 'addresses' && <AddressesTab d={d} set={set} />}
            {tab === 'sales' && <SalesTab d={d} setSales={setSales} />}
            {tab === 'tariffs' && <TariffsTab d={d} set={set} />}
            {tab === 'rules' && <RulesTab d={d} setRules={setRules} />}
            {tab === 'notes' && (
              <Section title="Notes" hint="internal">
                <div className="fld">
                  <textarea rows={8} placeholder="Anything the team should know about this account…" value={d.notes} onChange={(e) => set({ notes: e.target.value })} />
                </div>
              </Section>
            )}
          </div>
        </div>
      </div>
  )
}

// ── Account ───────────────────────────────────────────────────────────────────
function AccountTab({ d, set, setKind, accountCode, applyCompany }: {
  d: CustomerDraft; set: (p: Partial<CustomerDraft>) => void; setKind: (k: AccountKind) => void
  accountCode: string; applyCompany: (r: CompanyLookupResult) => void
}) {
  const isCompany = d.accountKind === 'company'
  const addContact = () => set({ contacts: [...d.contacts, { id: uid(), name: '', email: '', phone: '', role: '', isMain: d.contacts.length === 0 }] })
  const updContact = (id: string, patch: Partial<Contact>) => set({ contacts: d.contacts.map((c) => (c.id === id ? { ...c, ...patch } : c)) })
  const setMain = (id: string) => set({ contacts: d.contacts.map((c) => ({ ...c, isMain: c.id === id })) })
  const removeContact = (id: string) => set({ contacts: d.contacts.filter((c) => c.id !== id) })

  return (
    <>
      {/* Step 1 — type, then sub-type / start date / code. This drives the rest. */}
      <Section title="What kind of account is this?">
        <div className="cf-kind">
          <button className={'cf-kind-card' + (isCompany ? ' on' : '')} onClick={() => setKind('company')}>
            <Icon name="building" size={20} />
            <div>
              <div className="cf-kind-t">Company</div>
              <div className="cf-kind-d">A business — has a reg number, VAT, invoicing terms.</div>
            </div>
          </button>
          <button className={'cf-kind-card' + (!isCompany ? ' on' : '')} onClick={() => setKind('personal')}>
            <Icon name="user" size={20} />
            <div>
              <div className="cf-kind-t">Personal</div>
              <div className="cf-kind-d">An individual — name and contact details, usually card payment.</div>
            </div>
          </button>
        </div>
        <div className="g-cpc">
          {isCompany ? (
            <div className="fld"><label>Company type</label>
              <select value={d.companyType} onChange={(e) => set({ companyType: e.target.value })}>
                {COMPANY_TYPES.map((t) => <option key={t}>{t}</option>)}
              </select>
            </div>
          ) : <div />}
          <div className="fld"><label>Start date</label><input type="date" value={toISO(d.startDate)} onChange={(e) => set({ startDate: fromISO(e.target.value) })} /></div>
          <div className="fld"><label>Account code</label><input value={accountCode} disabled /></div>
        </div>
      </Section>

      {/* Step 2 — identify the account (adapts to type) */}
      {isCompany ? (
        <Section title="Company" hint="HMRC lookup (dummy) — pick a match to fill name, reg & invoicing address">
          <div className="fld">
            <label>Find company</label>
            <CompanySearch onPick={applyCompany} />
          </div>
          <div className="fld"><label>Company name *</label><input value={d.companyName} onChange={(e) => set({ companyName: e.target.value })} placeholder="Shown across the system" /></div>
          <div className="fld">
            <label>Alternative / reference names</label>
            <ChipList values={d.altNames} placeholder="Other names / nicknames this customer is known by…" onChange={(v) => set({ altNames: v })} />
          </div>
        </Section>
      ) : (
        <Section title="Person">
          <div className="fld"><label>Full name *</label><input value={d.companyName} onChange={(e) => set({ companyName: e.target.value })} placeholder="e.g. Sarah Doyle" /></div>
          <div className="g2">
            <div className="fld"><label>Email</label><input value={d.personalEmail} onChange={(e) => set({ personalEmail: e.target.value })} /></div>
            <div className="fld"><label>Phone</label><input value={d.personalPhone} onChange={(e) => set({ personalPhone: e.target.value })} /></div>
          </div>
          <div className="fld">
            <label>Alternative / reference names</label>
            <ChipList values={d.altNames} placeholder="Other names this person is known by…" onChange={(v) => set({ altNames: v })} />
          </div>
        </Section>
      )}

      {/* Step 3 — account details */}
      <Section title="Account details">
        <div className="g2">
          <div className="fld"><label>Status</label><Segmented value={d.status} onChange={(v) => set({ status: v })} options={[['active', 'Active'], ['inactive', 'Inactive']]} /></div>
          <div className="fld"><label>Assigned to (admin user)</label><input value={d.assignedTo} onChange={(e) => set({ assignedTo: e.target.value })} placeholder="e.g. Owen Johnson" /></div>
        </div>
        <div className="g2">
          <div className="fld cf-disabled"><label>Team</label><select disabled><option>Teams coming soon</option></select></div>
          <div className="fld"><label>Loyalty</label>
            <label className="chk" style={{ height: 28 }}><input type="checkbox" checked={d.loyaltyEnabled} onChange={(e) => set({ loyaltyEnabled: e.target.checked })} /> Enable CalClub loyalty points</label>
          </div>
        </div>
      </Section>

      {/* Step 4 — contacts (company only; a personal account is its own contact) */}
      {isCompany && (
        <Section title="Contacts" hint="star the main contact" action={<button className="btn sm" onClick={addContact}><Icon name="plus" size={13} /> Add contact</button>}>
          {d.contacts.length === 0 ? (
            <div className="cf-empty">No contacts yet.</div>
          ) : (
            d.contacts.map((c) => (
              <div className="cf-contact" key={c.id}>
                <button className={'cf-star' + (c.isMain ? ' on' : '')} title="Main contact" onClick={() => setMain(c.id)}>★</button>
                <div className="cf-contact-grid">
                  <div className="fld"><label>Name</label><input value={c.name} onChange={(e) => updContact(c.id, { name: e.target.value })} /></div>
                  <div className="fld"><label>Role</label><input value={c.role} onChange={(e) => updContact(c.id, { role: e.target.value })} placeholder="e.g. Accounts" /></div>
                  <div className="fld"><label>Email</label><input value={c.email} onChange={(e) => updContact(c.id, { email: e.target.value })} /></div>
                  <div className="fld"><label>Phone</label><input value={c.phone} onChange={(e) => updContact(c.id, { phone: e.target.value })} /></div>
                </div>
                <button className="btn sm iconbtn" title="Remove" onClick={() => removeContact(c.id)}><Icon name="trash" size={14} /></button>
              </div>
            ))
          )}
        </Section>
      )}
    </>
  )
}

// Type-ahead company finder — shows matches as you type; pick one to apply.
function CompanySearch({ onPick }: { onPick: (r: CompanyLookupResult) => void }) {
  const [q, setQ] = useState('')
  const [open, setOpen] = useState(false)
  const matches = q.trim().length >= 2 ? searchCompanies(q) : []
  return (
    <div className="ac">
      <div className="cf-lookup">
        <input
          placeholder="Start typing a company name or reg number…"
          value={q}
          onChange={(e) => { setQ(e.target.value); setOpen(true) }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
        />
      </div>
      {open && matches.length > 0 && (
        <div className="ac-menu open" style={{ position: 'static', marginTop: 6 }}>
          {matches.map((m, i) => (
            <div
              key={i}
              className={'cb-opt' + (m.generated ? ' cb-sug' : '')}
              onMouseDown={() => { onPick(m); setQ(''); setOpen(false) }}
            >
              <div className="co">{m.tradingName}</div>
              <div className="ad">
                {m.generated
                  ? 'Use as typed — no registry match'
                  : `Reg ${m.companyRegNumber} · ${[m.address.city, m.address.postcode].filter(Boolean).join(' ')}`}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Invoicing ───────────────────────────────────────────────────────────────────
function AddressFields({ addr, onChange }: { addr: CompanyAddress; onChange: (p: Partial<CompanyAddress>) => void }) {
  return (
    <>
      <div className="g-cpc">
        <div className="fld"><label>Postcode</label><input value={addr.postcode} onChange={(e) => onChange({ postcode: e.target.value })} /></div>
        <div className="fld span2"><label>Line 1</label><input value={addr.line1} onChange={(e) => onChange({ line1: e.target.value })} /></div>
      </div>
      <div className="fld"><label>Line 2</label><input value={addr.line2} onChange={(e) => onChange({ line2: e.target.value })} /></div>
      <div className="g-cpc">
        <div className="fld"><label>City</label><input value={addr.city} onChange={(e) => onChange({ city: e.target.value })} /></div>
        <div className="fld"><label>Town / county</label><input value={addr.town} onChange={(e) => onChange({ town: e.target.value })} /></div>
        <div className="fld"><label>Country</label><input value={addr.country} onChange={(e) => onChange({ country: e.target.value })} /></div>
      </div>
    </>
  )
}

function InvoicingTab({ d, setInv, setInvAddr, runCreditLookup }: {
  d: CustomerDraft
  setInv: (p: Partial<CustomerDraft['invoicing']>) => void; setInvAddr: (p: Partial<CompanyAddress>) => void; runCreditLookup: () => void
}) {
  const inv = d.invoicing
  const isCompany = d.accountKind === 'company'
  return (
    <>
      <Section title={isCompany ? 'Invoicing name & address' : 'Billing address'} hint="the billing address lives here">
        {isCompany && (
          <>
            <label className="chk"><input type="checkbox" checked={inv.sameAsCompany} onChange={(e) => setInv({ sameAsCompany: e.target.checked })} /> Trading name same as company name</label>
            {!inv.sameAsCompany && <div className="fld"><label>Trading name (on invoices)</label><input value={inv.tradingName} onChange={(e) => setInv({ tradingName: e.target.value })} /></div>}
          </>
        )}
        <AddressFields addr={inv.address} onChange={setInvAddr} />
      </Section>

      {isCompany && (
        <Section title="Identifiers">
          <div className="g-cpc">
            <div className="fld"><label>Company reg</label><input value={inv.companyReg} onChange={(e) => setInv({ companyReg: e.target.value })} /></div>
            <div className="fld"><label>VAT number</label><input value={inv.vat} onChange={(e) => setInv({ vat: e.target.value })} /></div>
            <div className="fld"><label>EORI number</label><input value={inv.eori} onChange={(e) => setInv({ eori: e.target.value })} /></div>
          </div>
        </Section>
      )}

      <Section title="Payment">
        <div className="g2">
          <div className="fld"><label>Payment type</label><Segmented value={inv.paymentType} onChange={(v) => setInv({ paymentType: v })} options={[['card', 'Upfront card'], ['invoice', 'Invoice terms']]} /></div>
          {inv.paymentType === 'invoice' && (
            <div className="fld">
              <label>Payment terms</label>
              <div style={{ display: 'flex', gap: 6 }}>
                <input type="number" min={0} style={{ width: 80 }} value={inv.termsDays} onChange={(e) => setInv({ termsDays: +e.target.value })} />
                <select value={inv.termsBasis} onChange={(e) => setInv({ termsBasis: e.target.value as typeof inv.termsBasis })}>
                  <option value="net">days net</option>
                  <option value="eow">end of week</option>
                  <option value="eom">end of month</option>
                </select>
              </div>
            </div>
          )}
        </div>
        <div className="g2">
          <div className="fld">
            <label>Invoice frequency</label>
            <select value={inv.frequency} onChange={(e) => setInv({ frequency: e.target.value as typeof inv.frequency })}>
              <option value="per-job">Per job</option><option value="per-day">Per day</option>
              <option value="weekly">Weekly</option><option value="bi-weekly">Bi-weekly</option><option value="monthly">Monthly</option>
            </select>
          </div>
          <div className="fld"><label>Currency</label><select value={inv.currency} onChange={(e) => setInv({ currency: e.target.value })}>{CURRENCIES.map((c) => <option key={c}>{c}</option>)}</select></div>
        </div>
        {(inv.frequency === 'weekly' || inv.frequency === 'bi-weekly') && (
          <div className="cf-weekdays">
            {WEEKDAYS.map((wd) => {
              const on = inv.weekdays.includes(wd)
              return <button key={wd} type="button" className={'cf-seg-btn' + (on ? ' on' : '')} onClick={() => setInv({ weekdays: on ? inv.weekdays.filter((x) => x !== wd) : [...inv.weekdays, wd] })}>{wd}</button>
            })}
          </div>
        )}
      </Section>

      <Section title="Emails">
        <div className="fld"><label>Invoice emails</label><ChipList values={inv.invoiceEmails} placeholder="finance@example.com" onChange={(v) => setInv({ invoiceEmails: v })} /></div>
        <div className="fld"><label>Statement emails</label><ChipList values={inv.statementEmails} placeholder="statements@example.com" onChange={(v) => setInv({ statementEmails: v })} /></div>
      </Section>

      <Section title="Invoice rules">
        <label className="chk"><input type="checkbox" checked={inv.poRequired} onChange={(e) => setInv({ poRequired: e.target.checked })} /> Requires a PO number before invoicing</label>
        <label className="chk"><input type="checkbox" checked={inv.attachPods} onChange={(e) => setInv({ attachPods: e.target.checked })} /> Attach PODs to invoices</label>
        <label className="chk"><input type="checkbox" checked={inv.separatePerRef} onChange={(e) => setInv({ separatePerRef: e.target.checked })} /> Separate invoice per unique customer ref / PO</label>
        <div className="g2">
          <div className="fld"><label>Max value per invoice (£)</label><input type="number" value={inv.maxValuePerInvoice ?? ''} onChange={(e) => setInv({ maxValuePerInvoice: e.target.value === '' ? null : +e.target.value })} placeholder="e.g. 5000" /></div>
          <div className="fld"><label>Invoice prefixes</label><ChipList values={inv.prefixes} placeholder="e.g. ACME-" onChange={(v) => setInv({ prefixes: v })} /></div>
        </div>
      </Section>

      {isCompany && (
        <Section title="Credit" hint="CreditSafe (dummy)" action={<button className="btn sm" onClick={runCreditLookup} disabled={!inv.companyReg}><Icon name="search" size={13} /> Check credit</button>}>
          <div className="g2">
            <div className="fld"><label>Credit limit (£)</label><input type="number" value={inv.creditLimit ?? ''} onChange={(e) => setInv({ creditLimit: e.target.value === '' ? null : +e.target.value })} /></div>
            <div className="fld"><label>Credit score</label><input type="number" value={inv.creditScore ?? ''} onChange={(e) => setInv({ creditScore: e.target.value === '' ? null : +e.target.value })} /></div>
          </div>
        </Section>
      )}
    </>
  )
}

// ── Addresses ───────────────────────────────────────────────────────────────────
function AddressesTab({ d, set }: { d: CustomerDraft; set: (p: Partial<CustomerDraft>) => void }) {
  const add = () => set({ addresses: [...d.addresses, { id: uid(), label: '', kind: 'delivery', postcode: '', line1: '', city: '' }] })
  const upd = (id: string, patch: Partial<SavedCustomerAddress>) => set({ addresses: d.addresses.map((a) => (a.id === id ? { ...a, ...patch } : a)) })
  const remove = (id: string) => set({ addresses: d.addresses.filter((a) => a.id !== id) })
  return (
    <Section title="Delivery / collection addresses" hint="saved with the customer" action={<button className="btn sm" onClick={add}><Icon name="plus" size={13} /> Add address</button>}>
      {d.addresses.length === 0 ? (
        <div className="cf-empty">No saved addresses yet.</div>
      ) : (
        d.addresses.map((a) => (
          <div className="cf-addr" key={a.id}>
            <div className="cf-addr-grid">
              <div className="fld"><label>Label</label><input value={a.label} onChange={(e) => upd(a.id, { label: e.target.value })} placeholder="e.g. Main depot" /></div>
              <div className="fld"><label>Type</label><select value={a.kind} onChange={(e) => upd(a.id, { kind: e.target.value as AddressKind })}><option value="collection">Collection</option><option value="delivery">Delivery</option><option value="both">Both</option></select></div>
              <div className="fld"><label>Postcode</label><input value={a.postcode} onChange={(e) => upd(a.id, { postcode: e.target.value })} /></div>
              <div className="fld span2"><label>Address line 1</label><input value={a.line1} onChange={(e) => upd(a.id, { line1: e.target.value })} /></div>
              <div className="fld"><label>City</label><input value={a.city} onChange={(e) => upd(a.id, { city: e.target.value })} /></div>
            </div>
            <button className="btn sm iconbtn" title="Remove" onClick={() => remove(a.id)}><Icon name="trash" size={14} /></button>
          </div>
        ))
      )}
    </Section>
  )
}

// ── Sales ───────────────────────────────────────────────────────────────────────
function SalesTab({ d, setSales }: { d: CustomerDraft; setSales: (p: Partial<CustomerDraft['sales']>) => void }) {
  const s = d.sales
  const addBand = () => setSales({ bands: [...s.bands, { id: uid(), from: 0, rate: 0 }] })
  const updBand = (id: string, patch: Partial<CommissionBand>) => setSales({ bands: s.bands.map((b) => (b.id === id ? { ...b, ...patch } : b)) })
  const removeBand = (id: string) => setSales({ bands: s.bands.filter((b) => b.id !== id) })
  return (
    <>
      <Section title="Attribution">
        <div className="g2">
          <div className="fld"><label>Converted by</label><input value={s.convertedBy} onChange={(e) => setSales({ convertedBy: e.target.value })} /></div>
          <div className="fld"><label>Lead by</label><input value={s.leadBy} onChange={(e) => setSales({ leadBy: e.target.value })} /></div>
        </div>
        <div className="g2">
          <div className="fld"><label>Source</label><input value={s.source} onChange={(e) => setSales({ source: e.target.value })} placeholder="e.g. Referral, Web" /></div>
          <div className="fld"><label>Estimated annual spend (£)</label><input type="number" value={s.estAnnualSpend ?? ''} onChange={(e) => setSales({ estAnnualSpend: e.target.value === '' ? null : +e.target.value })} /></div>
        </div>
      </Section>

      <Section title="Commission">
        <div className="g2">
          <div className="fld"><label>Commission start</label><input value="Auto — starts on first job" disabled /></div>
          <div className="fld"><label>Commission end</label><input type="date" value={toISO(s.commissionEnd)} onChange={(e) => setSales({ commissionEnd: fromISO(e.target.value) })} /></div>
        </div>
        <div className="g2">
          <div className="fld"><label>Calculated on</label><select value={s.calculatedOn} onChange={(e) => setSales({ calculatedOn: e.target.value as typeof s.calculatedOn })}><option value="revenue">Revenue</option><option value="margin">Margin</option></select><div className="cf-hint">What the rate is multiplied by.</div></div>
          <div className="fld"><label>Based on</label><select value={s.basedOn} onChange={(e) => setSales({ basedOn: e.target.value as typeof s.basedOn })}><option value="margin">Margin</option><option value="revenue">Revenue</option></select><div className="cf-hint">What band thresholds are checked against.</div></div>
        </div>
      </Section>

      <Section title="Bands" action={<button className="btn sm" onClick={addBand}><Icon name="plus" size={13} /> Add band</button>}>
        {s.bands.length === 0 ? (
          <div className="cf-empty">No bands yet — add a rate bracket.</div>
        ) : (
          s.bands.map((b) => (
            <div className="cf-band" key={b.id}>
              <div className="fld"><label>From (£)</label><input type="number" value={b.from} onChange={(e) => updBand(b.id, { from: +e.target.value })} /></div>
              <div className="fld"><label>Rate (%)</label><input type="number" value={b.rate} onChange={(e) => updBand(b.id, { rate: +e.target.value })} /></div>
              <button className="btn sm iconbtn" title="Remove" onClick={() => removeBand(b.id)}><Icon name="trash" size={14} /></button>
            </div>
          ))
        )}
        <div className="fld"><label>Commission cap (£)</label><input type="number" value={s.cap ?? ''} onChange={(e) => setSales({ cap: e.target.value === '' ? null : +e.target.value })} /></div>
      </Section>
    </>
  )
}

// ── Tariffs / Rules ───────────────────────────────────────────────────────────────
function TariffsTab({ d, set }: { d: CustomerDraft; set: (p: Partial<CustomerDraft>) => void }) {
  return (
    <Section title="Tariffs" hint="customer-specific rate cards coming soon">
      <div className="fld">
        <label>Default tariff</label>
        <select value={d.defaultTariff} onChange={(e) => set({ defaultTariff: e.target.value })}>
          <option value="">— Select —</option>
          {TARIFFS.map((t) => <option key={t}>{t}</option>)}
        </select>
      </div>
      <div className="cf-hint">Per-customer rate cards and overrides will be added once the tariff schema is built.</div>
    </Section>
  )
}

function RulesTab({ d, setRules }: { d: CustomerDraft; setRules: (p: Partial<CustomerDraft['rules']>) => void }) {
  const r = d.rules
  return (
    <Section title="Operating rules" hint="more coming soon">
      <label className="chk"><input type="checkbox" checked={r.requireBookingRef} onChange={(e) => setRules({ requireBookingRef: e.target.checked })} /> Require a booking reference on every job</label>
      <label className="chk"><input type="checkbox" checked={r.preferredDriversOnly} onChange={(e) => setRules({ preferredDriversOnly: e.target.checked })} /> Allocate to preferred drivers only</label>
      <label className="chk"><input type="checkbox" checked={r.blockOverCreditLimit} onChange={(e) => setRules({ blockOverCreditLimit: e.target.checked })} /> Block new bookings when over credit limit</label>
    </Section>
  )
}
