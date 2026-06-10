/**
 * CustomerForm — the Add Customer modal, with Account and Invoicing tabs. Covers the
 * full account model (customersStore). HMRC company lookup (by trading name or reg
 * number) pre-fills the registered name + address; CreditSafe lookup fills credit score
 * + limit. Both are dummied (api/mock/companyLookup).
 */
import { useState } from 'react'
import { Icon } from '@/app/Icon.tsx'
import {
  blankCustomerDraft,
  type CustomerDraft,
  type InvoiceFrequencyMode,
} from '@/store/customersStore.ts'
import type { CompanyAddress } from '@/api/mock/companyLookup.ts'
import { lookupCompany, lookupCredit } from '@/api/mock/companyLookup.ts'

type Tab = 'account' | 'invoicing'

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const CURRENCIES = ['GBP', 'EUR', 'USD']

function toISO(dmy: string): string {
  const m = /^(\d{2})-(\d{2})-(\d{4})$/.exec(dmy)
  return m ? `${m[3]}-${m[2]}-${m[1]}` : ''
}
function fromISO(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso)
  return m ? `${m[3]}-${m[2]}-${m[1]}` : ''
}

export function CustomerForm({
  onClose,
  onSave,
}: {
  onClose: () => void
  onSave: (draft: CustomerDraft) => void
}) {
  const [tab, setTab] = useState<Tab>('account')
  const [d, setD] = useState<CustomerDraft>(blankCustomerDraft())
  const [companyQuery, setCompanyQuery] = useState('')

  const set = (patch: Partial<CustomerDraft>) => setD((p) => ({ ...p, ...patch }))
  const setAddr = (patch: Partial<CompanyAddress>) => setD((p) => ({ ...p, address: { ...p.address, ...patch } }))
  const setInv = (patch: Partial<CustomerDraft['invoicing']>) =>
    setD((p) => ({ ...p, invoicing: { ...p.invoicing, ...patch } }))
  const setInvAddr = (patch: Partial<CompanyAddress>) =>
    setD((p) => ({ ...p, invoicing: { ...p.invoicing, address: { ...p.invoicing.address, ...patch } } }))

  function runCompanyLookup() {
    const r = lookupCompany(companyQuery || d.tradingName)
    if (!r) return
    set({
      tradingName: r.tradingName,
      displayName: d.displayName || r.tradingName,
      companyRegNumber: r.companyRegNumber,
      address: { ...r.address },
    })
  }

  function runCreditLookup() {
    const reg = d.invoicing.companyRegNumber || d.companyRegNumber
    if (!reg) return
    const c = lookupCredit(reg)
    setInv({ creditScore: c.creditScore, creditLimit: c.creditLimit })
  }

  function save() {
    if (!d.tradingName.trim() && !d.displayName.trim()) return
    const draft: CustomerDraft = {
      ...d,
      invoicing: {
        ...d.invoicing,
        tradingName: d.invoicing.mirrorTradingName ? d.tradingName : d.invoicing.tradingName,
        address: d.invoicing.addressMode === 'registered' ? { ...d.address } : d.invoicing.address,
      },
    }
    onSave(draft)
  }

  return (
    <div className="modal-overlay open" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal customer-modal">
        <div className="modal-h">
          New customer
          <span className="x" onClick={onClose}>✕</span>
        </div>

        <div className="cf-tabs">
          <button className={'cf-tab' + (tab === 'account' ? ' on' : '')} onClick={() => setTab('account')}>Account</button>
          <button className={'cf-tab' + (tab === 'invoicing' ? ' on' : '')} onClick={() => setTab('invoicing')}>Invoicing</button>
        </div>

        <div className="modal-b cf-body">
          {tab === 'account' ? (
            <AccountTab
              d={d}
              set={set}
              setAddr={setAddr}
              companyQuery={companyQuery}
              setCompanyQuery={setCompanyQuery}
              runCompanyLookup={runCompanyLookup}
            />
          ) : (
            <InvoicingTab d={d} setInv={setInv} setInvAddr={setInvAddr} runCreditLookup={runCreditLookup} />
          )}
        </div>

        <div className="modal-f">
          <button className="btn" onClick={onClose}>Cancel</button>
          <button className="btn primary" onClick={save} disabled={!d.tradingName.trim() && !d.displayName.trim()}>
            Add customer
          </button>
        </div>
      </div>
    </div>
  )
}

// ── segmented control ──────────────────────────────────────────────────────
function Segmented<T extends string>({ value, options, onChange }: { value: T; options: Array<[T, string]>; onChange: (v: T) => void }) {
  return (
    <div className="cf-seg">
      {options.map(([v, label]) => (
        <button key={v} className={'cf-seg-btn' + (value === v ? ' on' : '')} onClick={() => onChange(v)}>
          {label}
        </button>
      ))}
    </div>
  )
}

function Section({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="cf-section">
      <div className="cf-section-h">
        {title}
        {hint && <span className="cf-hint">{hint}</span>}
      </div>
      {children}
    </div>
  )
}

function AddressFields({ addr, onChange }: { addr: CompanyAddress; onChange: (patch: Partial<CompanyAddress>) => void }) {
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

// ── Account tab ──────────────────────────────────────────────────────────────
function AccountTab({
  d, set, setAddr, companyQuery, setCompanyQuery, runCompanyLookup,
}: {
  d: CustomerDraft
  set: (p: Partial<CustomerDraft>) => void
  setAddr: (p: Partial<CompanyAddress>) => void
  companyQuery: string
  setCompanyQuery: (v: string) => void
  runCompanyLookup: () => void
}) {
  return (
    <>
      <Section title="Account">
        <div className="g2">
          <div className="fld">
            <label>Account type</label>
            <Segmented value={d.accountType} onChange={(v) => set({ accountType: v })} options={[['company', 'Company'], ['personal', 'Personal']]} />
          </div>
          <div className="fld">
            <label>Status</label>
            <Segmented value={d.status} onChange={(v) => set({ status: v })} options={[['active', 'Active'], ['inactive', 'Inactive']]} />
          </div>
        </div>
        <div className="g2">
          <div className="fld">
            <label>Start date</label>
            <input type="date" value={toISO(d.startDate)} onChange={(e) => set({ startDate: fromISO(e.target.value) })} />
          </div>
          <div className="fld">
            <label>Account code</label>
            <input value="Auto — generated on save" disabled />
          </div>
        </div>
      </Section>

      <Section title="Find company" hint="HMRC lookup (dummy) — by name or reg number">
        <div className="cf-lookup">
          <input
            placeholder="Trading name or company reg number…"
            value={companyQuery}
            onChange={(e) => setCompanyQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && runCompanyLookup()}
          />
          <button className="btn" onClick={runCompanyLookup}><Icon name="search" size={14} /> Look up</button>
        </div>
      </Section>

      <Section title="Names">
        <div className="g2">
          <div className="fld"><label>Trading name (used on invoicing)</label><input value={d.tradingName} onChange={(e) => set({ tradingName: e.target.value })} /></div>
          <div className="fld"><label>Display name (shown on the system)</label><input value={d.displayName} onChange={(e) => set({ displayName: e.target.value })} /></div>
        </div>
        <div className="fld">
          <label>Nicknames (comma-separated, searchable)</label>
          <input
            placeholder="e.g. OT Limited, OTL"
            value={d.nicknames.join(', ')}
            onChange={(e) => set({ nicknames: e.target.value.split(',').map((s) => s.trim()).filter(Boolean) })}
          />
        </div>
      </Section>

      <Section title="Department & team" hint="coming soon">
        <div className="g2 cf-disabled">
          <div className="fld"><label>Department</label><select disabled><option>—</option></select></div>
          <div className="fld"><label>Team</label><select disabled><option>—</option></select></div>
        </div>
        <div className="cf-hint">Assigning customers to departments/teams will be enabled once that schema exists.</div>
      </Section>

      <Section title="Company address">
        <AddressFields addr={d.address} onChange={setAddr} />
        <div className="fld"><label>Company registration number</label><input value={d.companyRegNumber} onChange={(e) => set({ companyRegNumber: e.target.value })} /></div>
      </Section>
    </>
  )
}

// ── Invoicing tab ─────────────────────────────────────────────────────────────
function InvoicingTab({
  d, setInv, setInvAddr, runCreditLookup,
}: {
  d: CustomerDraft
  setInv: (p: Partial<CustomerDraft['invoicing']>) => void
  setInvAddr: (p: Partial<CompanyAddress>) => void
  runCreditLookup: () => void
}) {
  const inv = d.invoicing
  return (
    <>
      <Section title="Invoicing name & address">
        <label className="chk">
          <input type="checkbox" checked={inv.mirrorTradingName} onChange={(e) => setInv({ mirrorTradingName: e.target.checked })} /> Mirror trading name from account
        </label>
        {!inv.mirrorTradingName && (
          <div className="fld"><label>Invoicing trading name</label><input value={inv.tradingName} onChange={(e) => setInv({ tradingName: e.target.value })} /></div>
        )}
        <div className="fld">
          <label>Invoicing address</label>
          <Segmented value={inv.addressMode} onChange={(v) => setInv({ addressMode: v })} options={[['registered', 'Use registered address'], ['different', 'Different address']]} />
        </div>
        {inv.addressMode === 'different' && <AddressFields addr={inv.address} onChange={setInvAddr} />}
      </Section>

      <Section title="Contacts">
        <div className="fld"><label>Invoice email(s) — comma-separated</label><input value={inv.invoiceEmails} onChange={(e) => setInv({ invoiceEmails: e.target.value })} placeholder="ap@acme.co.uk, finance@acme.co.uk" /></div>
        <div className="fld"><label>Statement email(s) — comma-separated</label><input value={inv.statementEmails} onChange={(e) => setInv({ statementEmails: e.target.value })} /></div>
      </Section>

      <Section title="Identifiers">
        <div className="g2">
          <div className="fld">
            <label>Company reg number</label>
            <div className="cf-lookup">
              <input value={inv.companyRegNumber} onChange={(e) => setInv({ companyRegNumber: e.target.value })} />
              <button className="btn sm" title="Copy from account" onClick={() => setInv({ companyRegNumber: d.companyRegNumber })}>Copy</button>
            </div>
          </div>
          <div className="fld"><label>VAT number</label><input value={inv.vatNumber} onChange={(e) => setInv({ vatNumber: e.target.value })} /></div>
        </div>
        <div className="fld"><label>EORI number</label><input value={inv.eoriNumber} onChange={(e) => setInv({ eoriNumber: e.target.value })} /></div>
      </Section>

      <Section title="Payment terms">
        <Segmented value={inv.paymentTerms.mode} onChange={(v) => setInv({ paymentTerms: { ...inv.paymentTerms, mode: v } })} options={[['card', 'Upfront card'], ['invoice', 'Invoice terms']]} />
        {inv.paymentTerms.mode === 'invoice' && (
          <div className="g2" style={{ marginTop: 8 }}>
            <div className="fld"><label>Days</label><input type="number" min={0} value={inv.paymentTerms.days} onChange={(e) => setInv({ paymentTerms: { ...inv.paymentTerms, days: +e.target.value } })} /></div>
            <div className="fld">
              <label>Basis</label>
              <select value={inv.paymentTerms.basis} onChange={(e) => setInv({ paymentTerms: { ...inv.paymentTerms, basis: e.target.value as typeof inv.paymentTerms.basis } })}>
                <option value="net">days net</option>
                <option value="eow">end of week</option>
                <option value="eom">end of month</option>
              </select>
            </div>
          </div>
        )}
      </Section>

      <Section title="Invoice frequency">
        <select value={inv.invoiceFrequency.mode} onChange={(e) => setInv({ invoiceFrequency: { ...inv.invoiceFrequency, mode: e.target.value as InvoiceFrequencyMode } })}>
          <option value="per-job">Per job</option>
          <option value="per-day">Per day</option>
          <option value="weekly">Weekly</option>
          <option value="bi-weekly">Bi-weekly</option>
          <option value="monthly">Monthly</option>
        </select>
        {(inv.invoiceFrequency.mode === 'weekly' || inv.invoiceFrequency.mode === 'bi-weekly') && (
          <div className="cf-weekdays">
            {WEEKDAYS.map((wd) => {
              const on = inv.invoiceFrequency.weekdays.includes(wd)
              return (
                <button
                  key={wd}
                  className={'cf-seg-btn' + (on ? ' on' : '')}
                  onClick={() => setInv({ invoiceFrequency: { ...inv.invoiceFrequency, weekdays: on ? inv.invoiceFrequency.weekdays.filter((x) => x !== wd) : [...inv.invoiceFrequency.weekdays, wd] } })}
                >
                  {wd}
                </button>
              )
            })}
          </div>
        )}
        <label className="chk" style={{ marginTop: 8 }}>
          <input type="checkbox" checked={inv.poRequired} onChange={(e) => setInv({ poRequired: e.target.checked })} /> Requires a PO number before invoicing
        </label>
        <label className="chk">
          <input type="checkbox" checked={inv.separateInvoicePerPo} onChange={(e) => setInv({ separateInvoicePerPo: e.target.checked })} /> Separate invoice per unique PO number
        </label>
      </Section>

      <Section title="Commercials">
        <div className="g2">
          <div className="fld">
            <label>Currency</label>
            <select value={inv.currency} onChange={(e) => setInv({ currency: e.target.value })}>
              {CURRENCIES.map((c) => <option key={c}>{c}</option>)}
            </select>
          </div>
          <div className="fld"><label>Invoice prefixes (comma-separated)</label><input value={inv.invoicePrefixes} onChange={(e) => setInv({ invoicePrefixes: e.target.value })} placeholder="e.g. ACME, AC-" /></div>
        </div>
        <div className="cf-credit">
          <button className="btn" onClick={runCreditLookup}><Icon name="search" size={14} /> Check credit (CreditSafe)</button>
          <div className="cf-credit-vals">
            <span><b>Score:</b> {inv.creditScore ?? '—'}</span>
            <span><b>Limit:</b> {inv.creditLimit != null ? `£${inv.creditLimit.toLocaleString()}` : '—'}</span>
          </div>
        </div>
      </Section>
    </>
  )
}
