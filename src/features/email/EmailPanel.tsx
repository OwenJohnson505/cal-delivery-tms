/**
 * EmailPanel — Front-style inbox, designed width-first:
 *  • Two columns inside the panel: compact inbox list (left) · reader (right), so the
 *    message body gets real height. Below ~620px panel width (wizard open) it stacks.
 *  • Reader chrome is one tight header (subject + meta + a single toolbar row); the
 *    rarely-used actions live behind a ⋯ More menu; the linked-job context is a
 *    one-line strip that expands on demand.
 *  • Internal comments live in a pop-out drawer (💬), keeping the timeline clean.
 *  • Everything else from phase 1: lanes (drag to move), bulk, rules/triage, tags,
 *    saved views, snooze/remind, undo send, split/merge, keyboard nav, create job.
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import { Icon } from '@/app/Icon.tsx'
import { StatusPill } from '@/app/StatusPill.tsx'
import { useEmailsStore, relTime, LANES, MAILBOXES, type EmailCategory, type EmailThread, type Lane, type EmailStatus } from '@/store/emailsStore.ts'
import { useJobsStore, type SavedJob } from '@/store/jobsStore.ts'
import { useBookingStore } from '@/store/bookingStore.ts'
import { useViewStore } from '@/store/viewStore.ts'
import { useCustomersStore } from '@/store/customersStore.ts'
import { useTariffsStore } from '@/store/tariffsStore.ts'
import { useUsersStore } from '@/store/usersStore.ts'
import { useAutomationStore } from '@/store/automationStore.ts'

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

const CAT_CLASS: Record<EmailCategory, string> = {
  'Urgent booking': 'cat-urgent',
  'ETA request': 'cat-eta',
  'Driver details': 'cat-driver',
  'General': 'cat-general',
}

const SNOOZE_OPTIONS: Array<[label: string, ms: number]> = [
  ['10 sec (demo)', 10_000],
  ['1 hour', 3_600_000],
  ['Tomorrow 09:00', 16 * 3_600_000],
]

const initials = (name: string) => name.split(/\s+/).map((w) => w[0]).join('').slice(0, 2).toUpperCase()
const atKey = (at: string) => `${at.slice(6, 8)}-${at.slice(3, 5)}-${at.slice(0, 2)} ${at.slice(9)}`
const threadText = (t: EmailThread) =>
  `${t.subject} ${t.msgs.map((m) => `${m.from.name} ${m.from.email} ${m.body}`).join(' ')}`.toLowerCase()

// ── search helpers ───────────────────────────────────────────────────────────────
/** Full free-text surface for a thread: subject + people + bodies + tags + linked job
 * ref — so a search for a booking reference (e.g. BK-100482) finds the thread. */
const haystack = (t: EmailThread) =>
  `${threadText(t)} ${t.tags.join(' ')} ${t.linkedJobRef ?? ''}`.toLowerCase()
const contactHay = (t: EmailThread) =>
  t.msgs.map((m) => `${m.from.name} ${m.from.email}`).join(' ').toLowerCase()
const bodyHay = (t: EmailThread) => t.msgs.map((m) => m.body).join(' ').toLowerCase()
const lastAtOf = (t: EmailThread) => t.msgs[t.msgs.length - 1].at
/** Parse a 'dd-mm-yy HH:MM' stamp to a Date (or null). */
const atDate = (at: string): Date | null => {
  const m = /^(\d{2})-(\d{2})-(\d{2}) (\d{2}):(\d{2})/.exec(at)
  return m ? new Date(2000 + +m[3], +m[2] - 1, +m[1], +m[4], +m[5]) : null
}
export type SearchOp = 'contains' | 'matches'
/** 'contains' = substring; 'matches' = whole-word. Empty needle always passes. */
const opTest = (op: SearchOp, hay: string, needle: string): boolean => {
  const n = needle.trim().toLowerCase()
  if (!n) return true
  return op === 'matches' ? new RegExp(`\\b${escapeRe(n)}\\b`, 'i').test(hay) : hay.includes(n)
}

// ── workflow display helpers ─────────────────────────────────────────────────────
const STATUS_META: Record<EmailStatus, { cls: string; label: string }> = {
  'New': { cls: 'st-new', label: 'New' },
  'Assigned': { cls: 'st-assigned', label: 'Assigned' },
  'In Progress': { cls: 'st-progress', label: 'In Progress' },
  'Awaiting Customer': { cls: 'st-awaiting', label: 'Awaiting' },
  'Action Ready': { cls: 'st-action', label: 'Action Ready' },
  'Resolved': { cls: 'st-resolved', label: 'Resolved' },
}
const STATUS_HELP: Record<EmailStatus, string> = {
  'New': 'Just arrived — no owner yet',
  'Assigned': 'Owned by someone, not started',
  'In Progress': 'Being worked right now — a reply is open / being drafted',
  'Awaiting Customer': 'We replied; waiting on the customer (chase clock running)',
  'Action Ready': 'The system re-surfaced it — needs a human now',
  'Resolved': 'Done, with a resolution reason',
}
function StatusChip({ status }: { status: EmailStatus }) {
  return <span className={'ep-status ' + STATUS_META[status].cls} title={`${status} — ${STATUS_HELP[status]}`}>{STATUS_META[status].label}</span>
}
/** Statuses worth a pill in the list. 'New'/'Assigned' are implied by the
 * (un)assigned name already shown, so we don't repeat them (avoid duplication). */
const SHOW_STATUS = new Set<EmailStatus>(['In Progress', 'Awaiting Customer', 'Action Ready', 'Resolved'])
/** Icons for the sub-status tabs (text wraps in the narrow column; icon + tooltip is cleaner). */
const SUB_ICON: Record<string, string> = { open: 'inbox', awaiting: 'clock', resolved: 'check-circle', unassigned: 'user-plus' }
/** Chase deadline escalation: ok (in future) · amber (overdue) · red (>1 day overdue). */
const chaseInfo = (dueMs: number): { level: 'ok' | 'amber' | 'red'; label: string } => {
  const diff = dueMs - Date.now()
  const absMin = Math.floor(Math.abs(diff) / 60_000)
  const txt = absMin < 60 ? `${absMin}m` : absMin < 1440 ? `${Math.floor(absMin / 60)}h` : `${Math.floor(absMin / 1440)}d`
  const level = diff >= 0 ? 'ok' : -diff > 24 * 3600_000 ? 'red' : 'amber'
  return { level, label: diff >= 0 ? `chase in ${txt}` : `${txt} overdue` }
}

function openJob(job: SavedJob) {
  useBookingStore.getState().loadSnapshot(job.snapshot)
  useViewStore.getState().openWizard(job.id)
}

/** Email body text with job refs / customer refs highlighted as clickable chips. */
function RefText({ text }: { text: string }) {
  const jobs = useJobsStore((s) => s.jobs)
  const map = new Map<string, SavedJob>()
  jobs.forEach((j) => {
    map.set(j.ref.toUpperCase(), j)
    if (j.custRef) map.set(j.custRef.toUpperCase(), j)
  })
  if (!map.size) return <>{text}</>
  const re = new RegExp(`(${[...map.keys()].map(escapeRe).join('|')})`, 'gi')
  return (
    <>
      {text.split(re).map((part, i) => {
        const job = map.get(part.toUpperCase())
        return job ? (
          <button key={i} className="email-ref" title={`Open ${job.ref}`} onClick={() => openJob(job)}>{part}</button>
        ) : (
          <span key={i}>{part}</span>
        )
      })}
    </>
  )
}

function createJobFromEmail(thread: EmailThread) {
  const inbound = thread.msgs.filter((m) => !m.outbound)
  const sender = (inbound[0]?.from.email ?? '').toLowerCase()
  const text = `${thread.subject} ${inbound.map((m) => m.body).join(' ')}`

  const customers = useCustomersStore.getState().customers
  const cust = customers.find((c) => c.contacts.some((ct) => ct.email.toLowerCase() === sender))
  const contact = cust?.contacts.find((ct) => ct.email.toLowerCase() === sender)

  const vehicles = useTariffsStore.getState().tariffs.map((t) => t.name)
  const vehicle = vehicles.find((v) => new RegExp(`\\b${escapeRe(v)}\\b`, 'i').test(text)) ?? ''
  const pcs = (text.match(/\b[A-Z]{1,2}\d{1,2}[A-Z]?\s*\d[A-Z]{2}\b/gi) ?? []).map((p) => p.toUpperCase())

  const b = useBookingStore.getState()
  b.newBooking()
  if (cust) b.setBook({ cust: cust.id, contact: contact ? { name: contact.name, email: contact.email, tel: contact.phone } : null })
  if (vehicle) b.setTariff(vehicle)
  const stops = useBookingStore.getState().stops
  if (pcs[0] && stops[0]) b.updateStop(stops[0].id, { addr: { ...stops[0].addr, pc: pcs[0] } })
  if (pcs[1] && stops[1]) b.updateStop(stops[1].id, { addr: { ...stops[1].addr, pc: pcs[1] } })
  if (cust?.notes) b.setJobNotes(`Account note: ${cust.notes}`)
  // Remember the originating thread so the saved job links back to this conversation.
  useEmailsStore.getState().setPendingJobThread(thread.id)
  useViewStore.getState().openWizard(null)
}

/** Contact popover for a name in the email body — shows the address (always known) and,
 * if the address maps to a saved contact, their full details. Every field copies on
 * click; phone dials; the email starts a new outbound message (compose). */
function ContactPop({ name, email, onClose, onCompose }: {
  name: string; email: string; onClose: () => void; onCompose: (to: string) => void
}) {
  const customers = useCustomersStore((s) => s.customers)
  const e = email.toLowerCase()
  let contact: { name: string; email: string; phone?: string } | null = null
  let company = ''
  for (const c of customers) {
    const ct = c.contacts.find((x) => x.email.toLowerCase() === e)
    if (ct) { contact = ct; company = c.displayName || c.companyName; break }
  }
  const copy = (v: string) => { try { void navigator.clipboard?.writeText(v) } catch { /* ignore */ } }
  return (
    <>
      <div className="cc-pop-scrim" onClick={onClose} />
      <div className="cc-contact-pop ep-contactpop" onClick={(ev) => ev.stopPropagation()}>
        <div className="ccp-h">{contact?.name ?? name}{company && <span className="ccp-sub">{company}</span>}</div>
        <button className="ccp-row" onClick={() => { onCompose(email); onClose() }} title="New email to this address">
          <Icon name="mail" size={14} /> <span>{email}</span>
          <i className="ccp-copy" onClick={(ev) => { ev.stopPropagation(); copy(email) }} title="Copy">⧉</i>
        </button>
        {contact?.phone && (
          <a className="ccp-row" href={`tel:${contact.phone}`} title="Call">
            <Icon name="phone" size={14} /> <span>{contact.phone}</span>
            <i className="ccp-copy" onClick={(ev) => { ev.preventDefault(); ev.stopPropagation(); copy(contact!.phone!) }} title="Copy">⧉</i>
          </a>
        )}
        {company && (
          <button className="ccp-row" onClick={() => copy(company)} title="Copy">
            <Icon name="building" size={14} /> <span>{company}</span>
          </button>
        )}
        {!contact && <div className="ccp-note">Not a saved contact — address only. Click the email to copy or write to them.</div>}
      </div>
    </>
  )
}

/** One-line job strip (linked or detected job) that expands into the full card. */
function JobStrip({ thread, onInsertEta }: { thread: EmailThread; onInsertEta: (text: string) => void }) {
  const jobs = useJobsStore((s) => s.jobs)
  const setProgress = useJobsStore((s) => s.setProgress)
  const appendJobNote = useJobsStore((s) => s.appendJobNote)
  const linkJob = useEmailsStore((s) => s.linkJob)
  const addComment = useEmailsStore((s) => s.addComment)
  const customers = useCustomersStore((s) => s.customers)
  const [open, setOpen] = useState(false)
  const [noteDraft, setNoteDraft] = useState('')

  const text = threadText(thread).toUpperCase()
  const detected = jobs.find((j) => j.ref.toUpperCase() === thread.linkedJobRef?.toUpperCase())
    ?? jobs.find((j) => text.includes(j.ref.toUpperCase()) || (j.custRef && text.includes(j.custRef.toUpperCase())))
  const persisted = !!thread.linkedJobRef && detected?.ref.toUpperCase() === thread.linkedJobRef.toUpperCase()

  const sender = (thread.msgs.find((m) => !m.outbound)?.from.email ?? '').toLowerCase()
  const account = customers.find((c) => c.contacts.some((ct) => ct.email.toLowerCase() === sender))
  const accountJobs = account ? jobs.filter((j) => j.snapshot.book.cust === account.id).length : 0

  const STATUSES = ['Unallocated', 'Posted', 'Pending', 'Allocated', 'En route COL', 'On site COL', 'Collected', 'Part COL', 'En route DEL', 'On site DEL', 'Delivered', 'Part DEL', 'Failed']

  if (!detected && !account) return null
  return (
    <div className="ep-jobwrap">
      <div className="ep-jobstrip">
        {account && <span className="ep-js-acct"><Icon name="building" size={12} /> {account.displayName || account.companyName} <i>· {accountJobs} job{accountJobs === 1 ? '' : 's'}</i></span>}
        {detected && (
          <>
            <button className="cell-link" onClick={() => openJob(detected)}>{detected.ref}</button>
            {detected.progress && <StatusPill status={detected.progress} />}
            <span className="ep-js-eta">ETA {detected.collectEta || '—'} / {detected.deliverEta || '—'}</span>
          </>
        )}
        <span className="db-spacer" />
        {detected && (
          <button className="ep-js-toggle" onClick={() => setOpen((o) => !o)} title="Job details & actions">{open ? '▴' : '▾'}</button>
        )}
      </div>
      {open && detected && (
        <div className="ep-job">
          {/* the strip already shows ref · status · ETA — the expanded card adds only
              NEW detail (route/vehicle/supplier, scheduled times) + actions */}
          <div className="ep-job-h">
            <span className="cf-hint">{detected.route} · {detected.vehicle || '—'} · {detected.supplierName || 'Unassigned'}</span>
            <span className="db-spacer" />
            {persisted
              ? <button className="cm-link" onClick={() => linkJob(thread.id, null)}>Linked ✓</button>
              : <button className="cm-link" onClick={() => linkJob(thread.id, detected.ref)}>Link</button>}
          </div>
          <div className="ep-job-grid">
            <span>Coll booked</span><b>{detected.collectAt || '—'}</b>
            <span>Del booked</span><b>{detected.deliverAt || '—'}</b>
          </div>
          <div className="ep-job-actions">
            <select className="ep-assign" value={detected.progress || ''} onChange={(e) => setProgress(detected.id, e.target.value)} title="Update job status">
              <option value="">Status…</option>
              {STATUSES.map((st) => <option key={st}>{st}</option>)}
            </select>
            <button className="btn sm" onClick={() => onInsertEta(`Hi,\n\nUpdate on ${detected.ref}: collection ETA ${detected.collectEta || 'TBC'}, delivery ETA ${detected.deliverEta || 'TBC'}.\n\nThanks,\nCal Delivery`)}>
              Insert ETA reply
            </button>
            <span className="ep-job-note">
              <input placeholder="Add job note + Enter…" value={noteDraft} onChange={(e) => setNoteDraft(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' && noteDraft.trim()) { appendJobNote(detected.id, noteDraft.trim()); addComment(thread.id, `Note added to ${detected.ref}: ${noteDraft.trim()}`); setNoteDraft('') } }} />
            </span>
          </div>
          {thread.msgs.some((m) => m.attachments?.length) && (
            <div className="ep-job-files">
              {thread.msgs.flatMap((m) => m.attachments ?? []).map((a) => (
                <span key={a.id} className="ep-att">
                  📎 {a.name}
                  <button className="cm-link" onClick={() => { appendJobNote(detected.id, `Attachment filed from email: ${a.name}`); addComment(thread.id, `📎 ${a.name} filed to ${detected.ref}`) }}>
                    File to {detected.ref}
                  </button>
                </span>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── settings view (rules + templates) — now lives on a Settings screen, not in-panel ──
export function SettingsView({ onBack }: { onBack?: () => void }) {
  const rules = useEmailsStore((s) => s.rules)
  const addRule = useEmailsStore((s) => s.addRule)
  const updateRule = useEmailsStore((s) => s.updateRule)
  const deleteRule = useEmailsStore((s) => s.deleteRule)
  const templates = useEmailsStore((s) => s.templates)
  const addTemplate = useEmailsStore((s) => s.addTemplate)
  const deleteTemplate = useEmailsStore((s) => s.deleteTemplate)
  const users = useUsersStore((s) => s.users)

  const [rName, setRName] = useState('')
  const [rKeywords, setRKeywords] = useState('')
  const [rCat, setRCat] = useState<EmailCategory>('General')
  const [rAssign, setRAssign] = useState('')
  const [tName, setTName] = useState('')
  const [tBody, setTBody] = useState('')

  const CATS: EmailCategory[] = ['Urgent booking', 'ETA request', 'Driver details', 'General']
  const PRIO: Record<EmailCategory, 1 | 2 | 3 | 4> = { 'Urgent booking': 1, 'ETA request': 2, 'Driver details': 3, 'General': 4 }

  return (
    <div className="ep-settings">
      {onBack && <div className="ep-set-h"><button className="cm-link" onClick={onBack}>‹ Back</button></div>}
      <div className="ep-set-sec">
        <div className="ep-set-title">Rules <span className="cf-hint">keywords → category · auto-assign · auto-tags (re-run on change)</span></div>
        {rules.map((r) => (
          <div className="ep-rule" key={r.id}>
            <div className="ep-rule-top">
              <label className="chk"><input type="checkbox" checked={r.enabled} onChange={(e) => updateRule(r.id, { enabled: e.target.checked })} /> <b>{r.name}</b></label>
              <span className={'cat-chip ' + CAT_CLASS[r.category]}>{r.category}</span>
              <button className="btn sm iconbtn danger" title="Delete rule" onClick={() => deleteRule(r.id)}><Icon name="trash" size={13} /></button>
            </div>
            <div className="ep-rule-row">
              <input value={r.keywords.join(', ')} title="Keywords (comma-separated)" onChange={(e) => updateRule(r.id, { keywords: e.target.value.split(',').map((k) => k.trim()).filter(Boolean) })} />
              <select value={r.assignToId} title="Auto-assign to" onChange={(e) => updateRule(r.id, { assignToId: e.target.value })}>
                <option value="">No auto-assign</option>
                {users.map((u) => <option key={u.id} value={u.id}>→ {u.name}</option>)}
              </select>
            </div>
            <div className="ep-rule-row">
              <input value={(r.tags ?? []).join(', ')} placeholder="Auto-tags, comma-separated…" onChange={(e) => updateRule(r.id, { tags: e.target.value.split(',').map((k) => k.trim()).filter(Boolean) })} />
              <span />
            </div>
          </div>
        ))}
        <div className="ep-rule ep-rule-new">
          <div className="ep-rule-row">
            <input placeholder="Rule name…" value={rName} onChange={(e) => setRName(e.target.value)} />
            <select value={rCat} onChange={(e) => setRCat(e.target.value as EmailCategory)}>{CATS.map((c) => <option key={c}>{c}</option>)}</select>
          </div>
          <div className="ep-rule-row">
            <input placeholder="Keywords, comma-separated…" value={rKeywords} onChange={(e) => setRKeywords(e.target.value)} />
            <select value={rAssign} onChange={(e) => setRAssign(e.target.value)}>
              <option value="">No auto-assign</option>
              {users.map((u) => <option key={u.id} value={u.id}>→ {u.name}</option>)}
            </select>
          </div>
          <button className="btn sm primary" disabled={!rName.trim() || !rKeywords.trim()}
            onClick={() => { addRule({ name: rName.trim(), enabled: true, keywords: rKeywords.split(',').map((k) => k.trim()).filter(Boolean), category: rCat, priority: PRIO[rCat], assignToId: rAssign }); setRName(''); setRKeywords(''); setRAssign('') }}>
            Add rule
          </button>
        </div>
      </div>
      <div className="ep-set-sec">
        <div className="ep-set-title">Templates &amp; macros</div>
        {templates.map((t) => (
          <div className="ep-tpl" key={t.id}>
            <b>{t.name}</b>
            <span className="ep-tpl-preview">{t.body.replace(/\s+/g, ' ').slice(0, 60)}…</span>
            <button className="btn sm iconbtn danger" title="Delete template" onClick={() => deleteTemplate(t.id)}><Icon name="trash" size={13} /></button>
          </div>
        ))}
        <div className="ep-rule ep-rule-new">
          <input placeholder="Template name…" value={tName} onChange={(e) => setTName(e.target.value)} />
          <textarea rows={3} placeholder="Template body…" value={tBody} onChange={(e) => setTBody(e.target.value)} />
          <button className="btn sm primary" disabled={!tName.trim() || !tBody.trim()} onClick={() => { addTemplate(tName.trim(), tBody); setTName(''); setTBody('') }}>Add template</button>
        </div>
      </div>
    </div>
  )
}

/** One field row in the advanced-search panel: label · contains/matches · value. */
function AdvRow({ label, op, setOp, val, setVal, placeholder }: {
  label: string; op: SearchOp; setOp: (o: SearchOp) => void
  val: string; setVal: (v: string) => void; placeholder: string
}) {
  return (
    <div className="ep-adv-row">
      <span className="ep-adv-lbl">{label}</span>
      <select className="ep-adv-op" value={op} onChange={(e) => setOp(e.target.value as SearchOp)}>
        <option value="contains">contains</option>
        <option value="matches">matches</option>
      </select>
      <input className="ep-adv-val" value={val} onChange={(e) => setVal(e.target.value)} placeholder={placeholder} />
    </div>
  )
}

// ── main panel ──────────────────────────────────────────────────────────────────
export function EmailPanel() {
  const threads = useEmailsStore((s) => s.threads)
  const selectedId = useEmailsStore((s) => s.selectedId)
  const selectThread = useEmailsStore((s) => s.selectThread)
  const addComment = useEmailsStore((s) => s.addComment)
  const assignThread = useEmailsStore((s) => s.assign)
  const toggleFlag = useEmailsStore((s) => s.toggleFlag)
  const markUnread = useEmailsStore((s) => s.markUnread)
  const addTag = useEmailsStore((s) => s.addTag)
  const removeTag = useEmailsStore((s) => s.removeTag)
  const snooze = useEmailsStore((s) => s.snooze)
  const remind = useEmailsStore((s) => s.remind)
  const clearReminder = useEmailsStore((s) => s.clearReminder)
  const splitThread = useEmailsStore((s) => s.splitThread)
  const mergeThreads = useEmailsStore((s) => s.mergeThreads)
  const bulkApply = useEmailsStore((s) => s.bulkApply)
  const templates = useEmailsStore((s) => s.templates)
  const savedViews = useEmailsStore((s) => s.savedViews)
  const addSavedView = useEmailsStore((s) => s.addSavedView)
  const panelState = useEmailsStore((s) => s.panelState)
  const setPanelState = useEmailsStore((s) => s.setPanelState)
  const setStatus = useEmailsStore((s) => s.setStatus)
  const resolveThread = useEmailsStore((s) => s.resolve)
  const reopenThread = useEmailsStore((s) => s.reopen)
  const archiveThread = useEmailsStore((s) => s.archiveThread)
  const postOutbound = useEmailsStore((s) => s.postOutbound)
  const setExpectingStore = useEmailsStore((s) => s.setExpecting)
  const simulateInbound = useEmailsStore((s) => s.simulateInbound)
  const clearDraftPresence = useEmailsStore((s) => s.clearDraftPresence)
  const composeEmail = useEmailsStore((s) => s.composeEmail)
  const users = useUsersStore((s) => s.users)
  const currentUserId = useUsersStore((s) => s.currentUserId)
  const customers = useCustomersStore((s) => s.customers)

  const [text, setText] = useState('')
  const [mailbox, setMailbox] = useState<'all' | string>('all')
  const [lane, setLaneFilter] = useState<'all' | Lane>('all')
  const [mine, setMine] = useState(false)
  const [snoozedOnly, setSnoozedOnly] = useState(false)
  const [smart, setSmart] = useState('')
  const [draft, setDraft] = useState('')
  const [more, setMore] = useState(false)
  const [commentDraft, setCommentDraft] = useState('')
  const [openContact, setOpenContact] = useState<string | null>(null) // message id whose contact popover is open
  const [macroOpen, setMacroOpen] = useState(false)
  const macros = useAutomationStore((s) => s.macros)
  const runMacro = useAutomationStore((s) => s.runMacro)
  const [flashMsg, setFlashMsg] = useState<string | null>(null) // message briefly highlighted after a comment jump
  // Compose a brand-new outbound email (not a reply) — null when closed.
  const [composeNew, setComposeNew] = useState<{ to: string; subject: string; body: string } | null>(null)
  const openCompose = (to = '') => { setComposeNew({ to, subject: '', body: '' }); setPanelState('full') }
  const [checked, setChecked] = useState<string[]>([])
  const [savingView, setSavingView] = useState(false)
  const [viewName, setViewName] = useState('')
  const [showAllMsgs, setShowAllMsgs] = useState(false)
  const [tagDraft, setTagDraft] = useState('')
  // The composer opens like a real mail client: Reply / Reply all / Forward, with a
  // generous editing area (the old always-on 3-row box was unreadable).
  type ComposeState = { kind: 'reply' | 'replyall' | 'forward'; to: string; subject: string }
  const [compose, setCompose] = useState<ComposeState | null>(null)
  const composeRef = useRef<HTMLTextAreaElement>(null)
  const panelRef = useRef<HTMLElement>(null)

  // ── workflow controls (status filter + expecting-a-response) ──
  // Two-level filter: scope (assigned-to-me vs all) × sub-status (open/awaiting/resolved)
  const [scope, setScope] = useState<'mine' | 'all'>('all')
  const [sub, setSub] = useState<'open' | 'awaiting' | 'resolved' | 'unassigned'>('open')
  const [expecting, setExpect] = useState(false)
  const [expectAmount, setExpectAmount] = useState(10) // chase in N minutes/hours
  const [expectUnit, setExpectUnit] = useState<'min' | 'hr'>('min')
  const [expectAt, setExpectAt] = useState('') // explicit date/time override (datetime-local)

  // ── search: predictive suggestions + advanced query ──
  const [searchFocused, setSearchFocused] = useState(false)
  const [adv, setAdv] = useState(false)
  const [filterOpen, setFilterOpen] = useState(false)
  const [advContact, setAdvContact] = useState(''); const [advContactOp, setAdvContactOp] = useState<SearchOp>('contains')
  const [advSubject, setAdvSubject] = useState(''); const [advSubjectOp, setAdvSubjectOp] = useState<SearchOp>('contains')
  const [advBody, setAdvBody] = useState(''); const [advBodyOp, setAdvBodyOp] = useState<SearchOp>('contains')
  const [advFrom, setAdvFrom] = useState(''); const [advTo, setAdvTo] = useState('')
  const [cShown, setCShown] = useState(3) // predictive: contacts shown
  const [eShown, setEShown] = useState(3) // predictive: emails shown
  const [advShown, setAdvShown] = useState(6) // advanced: list rows shown
  useEffect(() => { setCShown(3); setEShown(3) }, [text])
  useEffect(() => { setAdvShown(6) }, [advContact, advContactOp, advSubject, advSubjectOp, advBody, advBodyOp, advFrom, advTo])
  const advActive = adv && !!(advContact.trim() || advSubject.trim() || advBody.trim() || advFrom || advTo)

  /** Close the open email body, returning to the list. If a reply is half-written,
   * confirm whether to keep it as a draft or discard it first. */
  const closeBody = () => {
    if (compose && draft.trim()) {
      const keep = window.confirm(
        "You're in the middle of writing an email.\n\nOK — save it as a draft (keep it)\nCancel — discard it",
      )
      if (!keep) { setCompose(null); setDraft('') }
    }
    setPanelState('list')
  }

  const userName = (id: string | null) => users.find((u) => u.id === id)?.name ?? ''

  const visible = useMemo(() => {
    let list = threads.filter((t) => !t.archived && (snoozedOnly ? !!t.snoozedUntil : !t.snoozedUntil))
    // scope: assigned-to-me vs everyone
    if (scope === 'mine') list = list.filter((t) => t.assigneeId === currentUserId)
    // sub-status: Open (active work) · Awaiting reply · Resolved · Unassigned (All scope)
    if (sub === 'awaiting') list = list.filter((t) => t.status === 'Awaiting Customer')
    else if (sub === 'resolved') list = list.filter((t) => t.status === 'Resolved')
    else if (sub === 'unassigned') list = list.filter((t) => !t.assigneeId && t.status !== 'Resolved')
    else list = list.filter((t) => t.status !== 'Resolved' && t.status !== 'Awaiting Customer')
    if (mailbox !== 'all') list = list.filter((t) => t.mailbox === mailbox)
    if (lane !== 'all') list = list.filter((t) => t.lane === lane)
    if (mine) list = list.filter((t) => t.assigneeId === currentUserId)
    if (smart === 'needsreply') list = list.filter((t) => !t.msgs[t.msgs.length - 1].outbound && t.lane !== 'Done')
    if (smart === 'unassigned') list = list.filter((t) => !t.assigneeId)
    // free-text box (kept) — matches anything incl. tags + linked booking ref
    const q = text.trim().toLowerCase()
    if (q) list = list.filter((t) => haystack(t).includes(q))
    // advanced query — per-field contains/matches + date range, ANDed together
    if (advActive) {
      const from = advFrom ? new Date(advFrom + 'T00:00') : null
      const to = advTo ? new Date(advTo + 'T23:59') : null
      list = list.filter((t) => {
        if (!opTest(advContactOp, contactHay(t), advContact)) return false
        if (!opTest(advSubjectOp, t.subject.toLowerCase(), advSubject)) return false
        if (!opTest(advBodyOp, bodyHay(t), advBody)) return false
        const d = atDate(lastAtOf(t))
        if (from && (!d || d < from)) return false
        if (to && (!d || d > to)) return false
        return true
      })
    }
    return [...list].sort((a, b) =>
      Number(!!b.pinned) - Number(!!a.pinned) ||
      Number(!!a.muted) - Number(!!b.muted) ||
      a.priority - b.priority ||
      atKey(lastAtOf(b)).localeCompare(atKey(lastAtOf(a))),
    )
  }, [threads, snoozedOnly, mailbox, lane, mine, smart, text, currentUserId, scope, sub,
    advActive, advContact, advContactOp, advSubject, advSubjectOp, advBody, advBodyOp, advFrom, advTo])

  // ── predictive suggestions (as you type in the free-text box) ──
  const q = text.trim().toLowerCase()
  const contactIndex = useMemo(() => {
    const map = new Map<string, { name: string; email: string; company: string; score: number; lastAt: string }>()
    threads.forEach((t) => {
      t.msgs.forEach((m) => {
        if (m.outbound) return
        const email = m.from.email.toLowerCase()
        if (!email || email.endsWith('@cal.delivery')) return
        const cust = customers.find((c) => c.contacts.some((ct) => ct.email.toLowerCase() === email))
        const company = cust?.displayName || cust?.companyName || ''
        const cur = map.get(email) ?? { name: m.from.name, email, company, score: 0, lastAt: m.at }
        cur.score += 1
        if (atKey(m.at) > atKey(cur.lastAt)) cur.lastAt = m.at
        if (!cur.company && company) cur.company = company
        map.set(email, cur)
      })
    })
    return [...map.values()]
  }, [threads, customers])
  const contactSuggest = useMemo(() => {
    if (!q) return []
    return contactIndex
      .filter((c) => c.name.toLowerCase().includes(q) || c.email.toLowerCase().includes(q) || c.company.toLowerCase().includes(q))
      .sort((a, b) => b.score - a.score || atKey(b.lastAt).localeCompare(atKey(a.lastAt)))
  }, [contactIndex, q])
  const emailSuggest = useMemo(() => {
    if (!q) return []
    return threads
      .filter((t) => !t.snoozedUntil && haystack(t).includes(q))
      .sort((a, b) => atKey(lastAtOf(b)).localeCompare(atKey(lastAtOf(a))))
  }, [threads, q])
  const showSuggest = searchFocused && !!q && !adv

  const thread = threads.find((t) => t.id === selectedId) ?? null
  const unread = threads.filter((t) => !t.read && !t.snoozedUntil && !t.muted).length
  const snoozedCount = threads.filter((t) => !!t.snoozedUntil).length
  // counts for the sub-tabs, within the current scope (me / all)
  const scoped = threads.filter((t) => !t.archived && (scope === 'mine' ? t.assigneeId === currentUserId : true))
  const subCount = {
    open: scoped.filter((t) => t.status !== 'Resolved' && t.status !== 'Awaiting Customer').length,
    awaiting: scoped.filter((t) => t.status === 'Awaiting Customer').length,
    resolved: scoped.filter((t) => t.status === 'Resolved').length,
    unassigned: scoped.filter((t) => !t.assigneeId && t.status !== 'Resolved').length,
  }
  const lastInbound = thread?.msgs.filter((m) => !m.outbound).slice(-1)[0]

  // Friendly recipient labels for a message — our side shows as the inbox short
  // ("Bookings@"), external people resolve to their contact name. No duplication of the
  // sender's own address (which already sits next to their name in the card header).
  const nameForEmail = (email: string): string => {
    const e = email.toLowerCase()
    if (e.endsWith('@cal.delivery')) return email.split('@')[0] + '@'
    for (const c of customers) {
      const ct = c.contacts.find((x) => x.email.toLowerCase() === e)
      if (ct?.name) return ct.name
    }
    return email.split('@')[0]
  }
  const recipientsFor = (m: { from: { email: string }; outbound?: boolean }): string => {
    if (!thread) return ''
    const out: string[] = []
    if (!m.outbound) out.push(thread.mailbox.split('@')[0] + '@')
    thread.participants
      .filter((p) => p.toLowerCase() !== m.from.email.toLowerCase() && !p.endsWith('@cal.delivery'))
      .forEach((p) => out.push(nameForEmail(p)))
    return [...new Set(out)].join(', ') || '—'
  }

  const startCompose = (kind: 'reply' | 'replyall' | 'forward') => {
    if (!thread) return
    const sender = lastInbound?.from.email ?? ''
    const others = thread.participants.filter((p) => !p.endsWith('@cal.delivery'))
    const reSubject = `Re: ${thread.subject.replace(/^(Re|Fwd):\s*/i, '')}`
    if (kind === 'reply') setCompose({ kind, to: sender, subject: reSubject })
    if (kind === 'replyall') setCompose({ kind, to: others.join(', '), subject: reSubject })
    if (kind === 'forward') {
      setCompose({ kind, to: '', subject: `Fwd: ${thread.subject.replace(/^(Re|Fwd):\s*/i, '')}` })
      const q = lastInbound
        ? `\n\n---------- Forwarded message ----------\nFrom: ${lastInbound.from.name} <${lastInbound.from.email}>\nSent: ${lastInbound.at}\n\n${lastInbound.body}`
        : ''
      setDraft(q)
    }
    // opening the editor = working it (spec §2: In Progress = draft open)
    if (thread.status === 'New' || thread.status === 'Assigned' || thread.status === 'Action Ready') setStatus(thread.id, 'In Progress')
    window.setTimeout(() => composeRef.current?.focus(), 50)
  }

  /** Compute the chase deadline (epoch ms) from the expecting-a-response picker. */
  const chaseDeadlineMs = (): number => {
    if (expectAt) return new Date(expectAt).getTime()
    const amt = Math.max(1, expectAmount || 1)
    return Date.now() + amt * (expectUnit === 'hr' ? 3600_000 : 60_000)
  }

  /** Send the reply, then apply the workflow outcome:
   *  • Expecting a response → Awaiting Customer with a chase deadline.
   *  • else 'resolve' → Resolved/Responded; 'keep' → stays in the assigned queue. */
  const send = (mode: 'resolve' | 'keep') => {
    if (!thread || !draft.trim()) return
    postOutbound(thread.id, draft.trim())
    if (expecting) setExpectingStore(thread.id, chaseDeadlineMs())
    else if (mode === 'resolve') resolveThread(thread.id, 'Responded')
    else setStatus(thread.id, thread.assigneeId ? 'Assigned' : 'New')
    setDraft(''); setCompose(null); setExpect(false)
  }

  const hasOutbound = !!thread?.msgs.some((m) => m.outbound)
  /** Resolve with the integrity guard (spec §4.5): nothing leaves without a reason. */
  const tryResolve = () => {
    if (!thread) return
    if (!hasOutbound) {
      if (!window.confirm("This email has no response.\n\nOK = mark 'No response needed' & resolve\nCancel = go back and reply")) return
      resolveThread(thread.id, 'No Response Needed')
    } else resolveThread(thread.id, 'Responded')
  }
  const tryDelete = () => {
    if (!thread) return
    if (!hasOutbound && !window.confirm("This email has no response. Delete anyway?\n\nOK = mark 'No response needed' & remove\nCancel = go back")) return
    archiveThread(thread.id, hasOutbound ? 'Responded' : 'No Response Needed')
    setPanelState('list')
  }
  /** Scroll to (and briefly flash) the email a comment was left on. */
  const goToComment = (c: { afterMsgId?: string }) => {
    const mid = c.afterMsgId ?? thread?.msgs[thread.msgs.length - 1]?.id
    if (!mid) return
    setShowAllMsgs(true) // ensure the target isn't hidden behind the message collapse
    window.setTimeout(() => {
      document.getElementById('ep-msg-' + mid)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      setFlashMsg(mid)
      window.setTimeout(() => setFlashMsg(null), 1200)
    }, 30)
  }

  // The reader stays open until the user explicitly closes it with the × button — it no
  // longer collapses when clicking dead space (that was too easy to trigger by accident).

  const toggleCheck = (id: string) =>
    setChecked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]))

  const msgs = thread?.msgs ?? []
  const collapsed = !showAllMsgs && msgs.length > 3
  const shownMsgs = collapsed ? msgs.slice(-3) : msgs
  const hiddenCount = msgs.length - shownMsgs.length

  return (
    <aside className="email-panel" ref={panelRef}>
      <div className="ep-head">
        <Icon name="mail" size={16} /> <b>Email</b>
        {unread > 0 && <span className="ep-unread">{unread}</span>}
        <span className="db-spacer" />
        <button className="btn primary sm ep-compose-btn" title="Compose a new email" onClick={() => openCompose()}>
          <Icon name="edit" size={13} /> New
        </button>
      </div>

      <div className={'ep-body' + (panelState === 'full' && thread ? ' has-thread' : '')}>
          {/* ── left column: filters + lanes + inbox list ── */}
          <div className="ep-listcol">
            <div className="ep-filters">
              <div className="ep-searchbox">
                <Icon name="search" size={13} />
                <input
                  className="ep-search"
                  placeholder="Search people, subjects, bodies, refs…"
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  onFocus={() => setSearchFocused(true)}
                  onBlur={() => window.setTimeout(() => setSearchFocused(false), 160)}
                />
                {text && <button className="ep-search-x" title="Clear" onClick={() => setText('')}>×</button>}
                <button className={'ep-adv-toggle' + (adv ? ' on' : '')} title="Advanced search" onClick={() => setAdv((o) => !o)}>
                  <Icon name="filter" size={12} />
                </button>

                {showSuggest && (contactSuggest.length > 0 || emailSuggest.length > 0) && (
                  <div className="ep-suggest" onMouseDown={(e) => e.preventDefault()}>
                    {contactSuggest.length > 0 && (
                      <div className="ep-sug-sec">
                        <div className="ep-sug-h">People</div>
                        {contactSuggest.slice(0, cShown).map((c) => (
                          <button key={c.email} className="ep-sug-row" onClick={() => { setText(c.email); setSearchFocused(false) }}>
                            <span className="ep-ava sug">{initials(c.name)}</span>
                            <span className="ep-sug-main"><b>{c.name}</b>{c.company && <span className="ep-sug-sub">{c.company}</span>}</span>
                            <span className="ep-sug-meta">{c.score} email{c.score === 1 ? '' : 's'}</span>
                          </button>
                        ))}
                        {contactSuggest.length > cShown && (
                          <button className="ep-sug-more" onClick={() => setCShown((n) => n + 3)}>View next 3 people · {contactSuggest.length - cShown} more</button>
                        )}
                      </div>
                    )}
                    {emailSuggest.length > 0 && (
                      <div className="ep-sug-sec">
                        <div className="ep-sug-h">Emails</div>
                        {emailSuggest.slice(0, eShown).map((t) => (
                          <button key={t.id} className="ep-sug-row" onClick={() => { selectThread(t.id); setPanelState('full'); setSearchFocused(false) }}>
                            <span className="ep-sug-main"><b>{t.subject}</b><span className="ep-sug-sub">{t.msgs.find((m) => !m.outbound)?.from.name ?? ''}{t.linkedJobRef ? ` · ${t.linkedJobRef}` : ''}</span></span>
                            <span className="ep-sug-meta">{relTime(lastAtOf(t))}</span>
                          </button>
                        ))}
                        {emailSuggest.length > eShown && (
                          <button className="ep-sug-more" onClick={() => setEShown((n) => n + 3)}>View next 3 emails · {emailSuggest.length - eShown} more</button>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {adv && (
                  <div className="ep-advpanel">
                    <div className="ep-adv-h">Advanced search<span className="db-spacer" /><button className="cm-link" onClick={() => { setAdvContact(''); setAdvSubject(''); setAdvBody(''); setAdvFrom(''); setAdvTo('') }}>Clear</button></div>
                    <AdvRow label="Contact" op={advContactOp} setOp={setAdvContactOp} val={advContact} setVal={setAdvContact} placeholder="name or email…" />
                    <AdvRow label="Subject" op={advSubjectOp} setOp={setAdvSubjectOp} val={advSubject} setVal={setAdvSubject} placeholder="subject text…" />
                    <AdvRow label="Body" op={advBodyOp} setOp={setAdvBodyOp} val={advBody} setVal={setAdvBody} placeholder="body text…" />
                    <div className="ep-adv-row">
                      <span className="ep-adv-lbl">Date</span>
                      <input type="date" className="ep-adv-date" value={advFrom} onChange={(e) => setAdvFrom(e.target.value)} title="From" />
                      <span className="ep-adv-to">to</span>
                      <input type="date" className="ep-adv-date" value={advTo} onChange={(e) => setAdvTo(e.target.value)} title="To" />
                    </div>
                    <div className="ep-adv-foot">{advActive ? `${visible.length} result${visible.length === 1 ? '' : 's'}` : 'Fill any field to refine'}<span className="db-spacer" /><button className="btn sm" onClick={() => setAdv(false)}>Done</button></div>
                  </div>
                )}
              </div>
              {/* one filter menu replaces the old mailbox / smart-folder / Mine / Snoozed / Save clutter */}
              <div className="ep-filterwrap">
                <button className={'ep-filter-btn' + ((mailbox !== 'all' || smart || snoozedOnly) ? ' on' : '')} title="Filter & saved views" onClick={() => setFilterOpen((o) => !o)}>
                  <Icon name="sliders" size={14} />
                </button>
                {filterOpen && (
                  <>
                    <div className="cc-pop-scrim" onClick={() => setFilterOpen(false)} />
                    <div className="ep-filtermenu">
                      <label className="ep-fm-row"><span className="ep-fm-lbl">Mailbox</span>
                        <select value={mailbox} onChange={(e) => setMailbox(e.target.value)}>
                          <option value="all">All mailboxes</option>
                          {MAILBOXES.map((m) => <option key={m} value={m}>{m.split('@')[0]}@</option>)}
                        </select>
                      </label>
                      <label className="ep-fm-row"><span className="ep-fm-lbl">Show</span>
                        <select value={smart} onChange={(e) => setSmart(e.target.value)}>
                          <option value="">All conversations</option>
                          <option value="needsreply">Needs reply</option>
                        </select>
                      </label>
                      <label className="ep-fm-chk"><input type="checkbox" checked={snoozedOnly} onChange={(e) => setSnoozedOnly(e.target.checked)} /> Snoozed only{snoozedCount ? ` (${snoozedCount})` : ''}</label>
                      <div className="ep-fm-sec">Saved views</div>
                      {savedViews.length === 0 && <div className="ep-fm-empty">None saved yet.</div>}
                      {savedViews.map((v) => (
                        <button key={v.id} className="ep-fm-view" onClick={() => { setMailbox(v.q.mailbox ?? 'all'); setLaneFilter(v.q.lane ?? 'all'); setMine(!!v.q.mine); setText(v.q.text ?? ''); setSmart(''); setFilterOpen(false) }}>{v.name}</button>
                      ))}
                      {!savingView ? (
                        <button className="cm-link ep-fm-save" onClick={() => setSavingView(true)}>+ Save current as view</button>
                      ) : (
                        <input className="ep-search" autoFocus placeholder="View name + Enter" value={viewName} onChange={(e) => setViewName(e.target.value)}
                          onKeyDown={(e) => { if (e.key === 'Enter' && viewName.trim()) { addSavedView(viewName.trim(), { mailbox, lane, mine, text }); setViewName(''); setSavingView(false) } }} />
                      )}
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* two-level filter: scope (me / all) then sub-status */}
            <div className="ep-scope">
              {([['mine', 'Assigned to me'], ['all', 'All']] as const).map(([k, label]) => (
                <button key={k} className={'ep-scope-btn' + (scope === k ? ' on' : '')} onClick={() => { setScope(k); if (k === 'mine' && sub === 'unassigned') setSub('open') }}>{label}</button>
              ))}
            </div>
            <div className="ep-lanes ep-topfilter">
              {([['open', 'Open'], ['awaiting', 'Awaiting reply'], ['resolved', 'Resolved'],
                ...(scope === 'all' ? [['unassigned', 'Unassigned'] as const] : [])] as const).map(([key, label]) => (
                <button key={key} className={'ep-view ep-tf ep-tf-ico' + (sub === key ? ' on' : '')} onClick={() => setSub(key)} title={label} aria-label={label}>
                  <Icon name={SUB_ICON[key]} size={15} />
                  {subCount[key] ? <i>{subCount[key]}</i> : null}
                </button>
              ))}
            </div>

            {checked.length > 0 && (
              <div className="ep-bulk">
                <b>{checked.length}</b>
                <select className="ep-assign" value="" onChange={(e) => { if (e.target.value) { bulkApply(checked, { assigneeId: e.target.value }); setChecked([]) } }}>
                  <option value="">Assign…</option>
                  {users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
                </select>
                <select className="ep-assign" value="" onChange={(e) => { if (e.target.value) { bulkApply(checked, { lane: e.target.value as Lane }); setChecked([]) } }}>
                  <option value="">Lane…</option>
                  {LANES.map((l) => <option key={l}>{l}</option>)}
                </select>
                <button className="cm-link" onClick={() => { bulkApply(checked, { snoozeMs: 3_600_000, snoozeLabel: '1 hour' }); setChecked([]) }}>Snooze</button>
                <button className="cm-link" onClick={() => setChecked([])}>✕</button>
              </div>
            )}

            <div className="ep-list">
              {(advActive ? visible.slice(0, advShown) : visible).map((t) => {
                const last = t.msgs[t.msgs.length - 1]
                const assignee = userName(t.assigneeId)
                const sender = t.msgs.find((m) => !m.outbound)?.from.name ?? last.from.name
                const attachN = t.msgs.reduce((n, m) => n + (m.attachments?.length ?? 0), 0)
                return (
                  <div
                    key={t.id}
                    className={'ep-row' + (t.id === selectedId ? ' on' : '') + (t.read || t.muted ? '' : ' unread') + (t.muted ? ' muted' : '')}
                    draggable
                    onDragStart={(e) => e.dataTransfer.setData('text/thread', t.id)}
                    onClick={() => { selectThread(t.id); setShowAllMsgs(false); setCompose(null); setDraft(''); setComposeNew(null); setPanelState('full') }}
                  >
                    <input type="checkbox" className="ep-check" checked={checked.includes(t.id)} onClick={(e) => e.stopPropagation()} onChange={() => toggleCheck(t.id)} />
                    <span className="ep-row-when">
                      {t.status === 'Awaiting Customer' && t.chaseDueAt != null
                        ? (() => { const c = chaseInfo(t.chaseDueAt!); return <span className={'ep-chase ' + c.level} title="Chase deadline">⏳ {c.label}</span> })()
                        : <span className="ep-row-at" title={last.at}>{relTime(last.at)}</span>}
                    </span>
                    <div className="ep-rbody">
                      <span className="ep-row-line ep-line-top">
                        {!t.read && !t.muted && <span className="ep-unread-dot" title="Unseen" />}
                        {t.pinned && <span className="ep-mini" title="Pinned">📌</span>}
                        <span className="ep-row-from">{sender}</span>
                        <span className="ep-sep">›</span>
                        {t.assigneeId
                          ? <span className="ep-assignee">{assignee}</span>
                          : <span className="ep-unassigned">Unassigned</span>}
                        {t.reminderDue && <span className="ep-mini" title="Reminder due">⏰</span>}
                      </span>
                      <span className="ep-row-line ep-line-subj">
                        <span className="ep-row-subj">{t.subject}</span>
                        <span className="db-spacer" />
                        {SHOW_STATUS.has(t.status) && t.status !== 'Awaiting Customer' && <StatusChip status={t.status} />}
                        {attachN > 0 && <span className="ep-attn" title={`${attachN} attachment${attachN === 1 ? '' : 's'}`}>{attachN} 📎</span>}
                        {t.snoozedUntil && <span className="ep-snoozed">💤 {t.snoozedUntil}</span>}
                      </span>
                      {t.draftPresence && (
                        <span className="ep-typing" title="A colleague is drafting — click to view & edit their draft"
                          onClick={(e) => { e.stopPropagation(); selectThread(t.id); setShowAllMsgs(false); setPanelState('full') }}>
                          <span className="ep-typing-dots"><i /><i /><i /></span>
                          {t.draftPresence.by.split(' ')[0]} is replying…
                        </span>
                      )}
                    </div>
                  </div>
                )
              })}
              {!visible.length && <div className="ep-empty">Nothing here.</div>}
              {advActive && visible.length > advShown && (
                <button className="ep-sug-more ep-list-more" onClick={() => setAdvShown((n) => n + 3)}>
                  View next 3 · {visible.length - advShown} more
                </button>
              )}
            </div>
          </div>

          {/* ── right column: reader (hidden in list-only/partial-collapse state) ── */}
          {panelState === 'full' && (
          <div className="ep-readcol">
            {composeNew ? (
              <div className="ep-reader ep-newmail">
                <div className="ep-rhead">
                  <div className="ep-rtitle">
                    <Icon name="edit" size={14} /> <b>New email</b>
                    <span className="db-spacer" />
                    <button className="btn sm iconbtn ep-closebody" title="Discard" onClick={() => setComposeNew(null)}><Icon name="close" size={14} /></button>
                  </div>
                </div>
                <div className="ep-newmail-fields">
                  <label className="ep-nm-row"><span>To</span><input autoFocus placeholder="name@company.com" value={composeNew.to} onChange={(e) => setComposeNew({ ...composeNew, to: e.target.value })} /></label>
                  <label className="ep-nm-row"><span>Subject</span><input placeholder="Subject" value={composeNew.subject} onChange={(e) => setComposeNew({ ...composeNew, subject: e.target.value })} /></label>
                </div>
                <textarea className="ep-newmail-body" placeholder="Write your message…" value={composeNew.body} onChange={(e) => setComposeNew({ ...composeNew, body: e.target.value })} />
                <div className="ep-newmail-foot">
                  {templates.length > 0 && (
                    <select className="ep-tpl-pick" value="" onChange={(e) => { const t = templates.find((x) => x.id === e.target.value); if (t) setComposeNew((p) => p && ({ ...p, body: p.body ? p.body + '\n' + t.body : t.body })) }}>
                      <option value="">Template…</option>
                      {templates.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                    </select>
                  )}
                  <span className="db-spacer" />
                  <button className="btn" onClick={() => setComposeNew(null)}>Discard</button>
                  <button className="btn primary" disabled={!composeNew.to.trim() || !composeNew.body.trim()} onClick={() => { composeEmail(composeNew.to.trim(), composeNew.subject, composeNew.body); setComposeNew(null) }}>Send</button>
                </div>
              </div>
            ) : thread ? (
              <div className="ep-reader">
                {thread.reminderDue && (
                  <div className="ep-banner">⏰ Reminder due.<button className="cm-link" onClick={() => clearReminder(thread.id)}>Dismiss</button></div>
                )}
                {thread.status === 'Awaiting Customer' && thread.chaseDueAt != null && (() => {
                  const c = chaseInfo(thread.chaseDueAt)
                  return (
                    <div className={'ep-banner ep-chasebanner ' + c.level}>
                      ⏳ Awaiting customer — {c.label}.
                      <button className="cm-link" onClick={() => simulateInbound(thread.id)}>Simulate customer reply</button>
                    </div>
                  )
                })()}
                <div className="ep-rhead">
                  <div className="ep-rtitle">
                    <button className="ep-back" title="Back to inbox" onClick={() => useEmailsStore.setState({ selectedId: null })}>
                      <Icon name="chevron-up" size={16} />
                    </button>
                    <b>{thread.subject}</b>
                    <span className="db-spacer" />
                    <button className="btn sm iconbtn ep-closebody" title="Close email — back to the list" onClick={closeBody}>
                      <Icon name="close" size={14} />
                    </button>
                  </div>
                  <div className="ep-rmeta2">
                    <StatusChip status={thread.status} />
                    <span className={'cat-chip ' + CAT_CLASS[thread.category]}>{thread.category}</span>
                  </div>
                  <div className="ep-rtools">
                    <select className="ep-assign" value={thread.assigneeId ?? ''} onChange={(e) => assignThread(thread.id, e.target.value || null)} title="Assigned to">
                      <option value="">Unassigned</option>
                      {users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
                    </select>
                    <span className="ep-tagedit">
                      {thread.tags.map((x) => <span key={x} className="ep-tag">{x}<i onClick={() => removeTag(thread.id, x)}>×</i></span>)}
                      <input placeholder="+tag" value={tagDraft} onChange={(e) => setTagDraft(e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Enter' && tagDraft.trim()) { addTag(thread.id, tagDraft.trim()); setTagDraft('') } }} />
                    </span>
                    <span className="db-spacer" />
                    <span className="ep-menu-wrap">
                      <button className="btn sm" onClick={() => setMacroOpen((o) => !o)} title="Run a macro">⚡ Macro</button>
                      {macroOpen && (
                        <>
                          <div className="cc-pop-scrim" onClick={() => setMacroOpen(false)} />
                          <span className="ep-menu ep-menu-right">
                            <span className="ep-menu-sec">Run macro</span>
                            {macros.map((m) => (
                              <button key={m.id} onClick={() => { runMacro(m.id, thread.id); setMacroOpen(false) }}>{m.icon ?? '⚡'} {m.name}</button>
                            ))}
                            {!macros.length && <span className="ep-menu-sec">None — add some in Email Rules</span>}
                          </span>
                        </>
                      )}
                    </span>
                    <button className="btn sm" onClick={() => createJobFromEmail(thread)}><Icon name="plus" size={13} /> Job</button>
                    <span className="ep-menu-wrap">
                      <button className="btn sm" onClick={() => setMore((o) => !o)}>⋯</button>
                      {more && (
                        <>
                          <div className="cc-pop-scrim" onClick={() => setMore(false)} />
                          <span className="ep-menu ep-menu-right">
                            <span className="ep-menu-sec">Snooze</span>
                            {SNOOZE_OPTIONS.map(([label, ms]) => <button key={'s' + label} onClick={() => { snooze(thread.id, ms, label); setMore(false) }}>💤 {label}</button>)}
                            <span className="ep-menu-sec">Remind</span>
                            {SNOOZE_OPTIONS.map(([label, ms]) => <button key={'r' + label} onClick={() => { remind(thread.id, ms, label); setMore(false) }}>⏰ {label}</button>)}
                            <span className="ep-menu-sec">Conversation</span>
                            <button onClick={() => { toggleFlag(thread.id, 'pinned'); setMore(false) }}>{thread.pinned ? 'Unpin' : 'Pin'}</button>
                            <button onClick={() => { toggleFlag(thread.id, 'following'); setMore(false) }}>{thread.following ? 'Unfollow' : 'Follow'}</button>
                            <button onClick={() => { toggleFlag(thread.id, 'muted'); setMore(false) }}>{thread.muted ? 'Unmute' : 'Mute'}</button>
                            <button onClick={() => { markUnread(thread.id); setMore(false) }}>Mark unread</button>
                            <span className="ep-menu-sec">Merge into…</span>
                            {threads.filter((t) => t.id !== thread.id && !t.snoozedUntil).slice(0, 4).map((t) => (
                              <button key={t.id} onClick={() => { mergeThreads(thread.id, t.id); setMore(false) }}>{t.subject.slice(0, 28)}</button>
                            ))}
                            <span className="ep-menu-sec">Remove</span>
                            <button className="danger" onClick={() => { tryDelete(); setMore(false) }}>🗑 Delete (needs resolution)</button>
                          </span>
                        </>
                      )}
                    </span>
                  </div>
                </div>

                <JobStrip thread={thread} onInsertEta={(t) => setDraft((d) => (d ? d + '\n' + t : t))} />

                <div className="ep-msgs">
                  {collapsed && (
                    <button className="ep-collapse" onClick={() => setShowAllMsgs(true)}>Show {hiddenCount} earlier message{hiddenCount === 1 ? '' : 's'}</button>
                  )}
                  {shownMsgs.map((m) => (
                    <div key={m.id} id={'ep-msg-' + m.id} className={'ep-msg' + (m.outbound ? ' out' : '') + (flashMsg === m.id ? ' flash' : '')}>
                      <div className="ep-msg-head">
                        <span className="ep-msg-ava">{initials(m.from.name)}</span>
                        <span className="ep-msg-who">
                          <span className="ep-msg-name">
                            <span className="ep-namewrap">
                              <button className="ep-name-btn" onClick={(e) => { e.stopPropagation(); setOpenContact(openContact === m.id ? null : m.id) }}>{m.from.name}</button>
                              {openContact === m.id && <ContactPop name={m.from.name} email={m.from.email} onClose={() => setOpenContact(null)} onCompose={openCompose} />}
                            </span>
                            <span className="ep-msg-email">&lt;{m.from.email}&gt;</span>
                            {m.outbound && <span className="ep-msg-tag">You</span>}
                          </span>
                          <span className="ep-msg-addr">To: {recipientsFor(m)}</span>
                        </span>
                        <span className="db-spacer" />
                        <span className="ep-msg-time">{m.at}</span>
                        {thread.msgs[0]?.id !== m.id && (
                          <button className="ep-split" title="Split this and later messages into a new conversation" onClick={() => splitThread(thread.id, m.id)}>⎋</button>
                        )}
                      </div>
                      <div className="ep-msg-body"><RefText text={m.body} /></div>
                      {m.attachments?.map((a) => <span key={a.id} className="ep-att">📎 {a.name}</span>)}
                    </div>
                  ))}

                  {/* live shared draft, inline in the thread (Front-style): see a colleague
                      compose in real time and take it over to edit & send */}
                  {thread.draftPresence && !compose && (
                    <div className="ep-shared">
                      <div className="ep-shared-h">
                        <Icon name="users" size={12} /> <b>Shared draft</b>
                        <span className="ep-shared-sub">· editable by teammates</span>
                        <span className="db-spacer" />
                        <span className="ep-shared-editing"><span className="ep-typing-dots"><i /><i /><i /></span>{thread.draftPresence.by} is editing</span>
                        <button className="cm-link" onClick={() => { const d = thread.draftPresence!; startCompose('reply'); setDraft(d.body); clearDraftPresence(thread.id) }}>Take over</button>
                      </div>
                      <div className="ep-msg ep-shared-msg">
                        <div className="ep-msg-head">
                          <span className="ep-msg-ava">{initials(thread.draftPresence.by)}</span>
                          <span className="ep-msg-who">
                            <span className="ep-msg-name">{thread.draftPresence.by}<span className="ep-msg-tag">draft</span></span>
                            <span className="ep-msg-addr">drafting now…</span>
                          </span>
                        </div>
                        <div className="ep-msg-body">{thread.draftPresence.body}<span className="ep-draft-caret" /></div>
                      </div>
                    </div>
                  )}

                  {/* all internal comments collected at the foot of the thread — click one
                      to jump to the email it was left on */}
                  {thread.comments.length > 0 && (
                    <div className="ep-comments">
                      {[...thread.comments]
                        .sort((a, b) => atKey(a.at).localeCompare(atKey(b.at)))
                        .map((c) => (
                          <button key={c.id} className="ep-cnote" onClick={() => goToComment(c)} title="Click to jump to the email this was left on">
                            <span className="ep-cnote-head"><b>{c.by}</b><span className="ep-cnote-time">{c.at}</span></span>
                            <span className="ep-cnote-body">{c.text}</span>
                          </button>
                        ))}
                    </div>
                  )}
                </div>

                {!compose ? (
                  <div className="ep-actionbar">
                    <button className="btn sm" onClick={() => startCompose('reply')}>↩ Reply</button>
                    <button className="btn sm" onClick={() => startCompose('replyall')}>↩↩ Reply all</button>
                    <button className="btn sm" onClick={() => startCompose('forward')}>↪ Forward</button>
                    <span className="db-spacer" />
                    {thread.status === 'Resolved'
                      ? <button className="btn sm" title={`Resolved · ${thread.resolutionReason ?? ''}`} onClick={() => reopenThread(thread.id)}>Re-open</button>
                      : <button className="btn primary sm" title="Resolve this email" onClick={tryResolve}><Icon name="check" size={13} /> Resolve</button>}
                  </div>
                ) : (
                  <div className="ep-composer">
                    <div className="ep-composer-h">
                      <b>{compose.kind === 'reply' ? 'Reply' : compose.kind === 'replyall' ? 'Reply all' : 'Forward'}</b>
                      <input className="ep-to" placeholder="To…" value={compose.to} onChange={(e) => setCompose({ ...compose, to: e.target.value })} />
                      {templates.length > 0 && (
                        <select className="ep-tpl-pick" value="" onChange={(e) => { const t = templates.find((x) => x.id === e.target.value); if (t) setDraft((d) => (d ? d + '\n' + t.body : t.body)) }}>
                          <option value="">Template…</option>
                          {templates.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                        </select>
                      )}
                      <button className="btn sm iconbtn" title="Discard" onClick={() => { setCompose(null); setDraft(''); setExpect(false) }}><Icon name="close" size={14} /></button>
                    </div>
                    <div className="ep-composer-sub">{compose.subject}</div>
                    <textarea
                      ref={composeRef}
                      placeholder="Write your message…"
                      value={draft}
                      onChange={(e) => setDraft(e.target.value)}
                    />
                    <div className="ep-composer-f">
                      {/* Expecting a response → chase deadline (defaults to minutes) */}
                      <div className="ep-expect">
                        <label className="ep-expect-tog">
                          <input type="checkbox" checked={expecting} onChange={(e) => { setExpect(e.target.checked); if (e.target.checked) setExpectAt('') }} />
                          Expecting a response
                        </label>
                        {expecting && (
                          <span className="ep-expect-opts">
                            <span className="ep-expect-lbl">chase in</span>
                            {[10, 20, 30].map((n) => (
                              <button key={n} className={'ep-view ep-expect-preset' + (!expectAt && expectAmount === n ? ' on' : '')} onClick={() => { setExpectAt(''); setExpectAmount(n) }}>{n}</button>
                            ))}
                            <input type="number" min={1} className="ep-expect-num" value={expectAmount} title="Custom amount" onChange={(e) => { setExpectAt(''); setExpectAmount(Math.max(1, Math.round(+e.target.value) || 1)) }} />
                            <button className="ep-unit-toggle" title="Switch minutes / hours" onClick={() => setExpectUnit((u) => (u === 'min' ? 'hr' : 'min'))}>{expectUnit}</button>
                            <span className="ep-expect-or">or</span>
                            <label className={'ep-setdt' + (expectAt ? ' on' : '')} title="Set an exact date & time">
                              <Icon name="calendar" size={13} />
                              {expectAt ? <span>{new Date(expectAt).toLocaleString([], { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}</span> : <span>date/time</span>}
                              <input type="datetime-local" value={expectAt} onChange={(e) => setExpectAt(e.target.value)}
                                onClick={(e) => { const el = e.currentTarget as HTMLInputElement & { showPicker?: () => void }; try { el.showPicker?.() } catch { /* unsupported */ } }} />
                            </label>
                          </span>
                        )}
                      </div>
                      <span className="db-spacer" />
                      <button className="btn sm" disabled={!draft.trim()} onClick={() => send('keep')} title="Send and keep it in your queue">Send &amp; Keep</button>
                      <button className="btn primary sm" disabled={!draft.trim()} onClick={() => send('resolve')} title={expecting ? 'Send — will wait on the customer' : 'Send and resolve'}>{expecting ? 'Send & Await' : 'Send & Resolve'}</button>
                    </div>
                  </div>
                )}

                {/* always-on internal-comment composer — type + Enter, like a chat */}
                <div className="ep-cbar">
                  <input
                    className="ep-cbar-input"
                    placeholder="Add internal comment — visible to teammates…"
                    value={commentDraft}
                    onChange={(e) => setCommentDraft(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey && commentDraft.trim()) { e.preventDefault(); addComment(thread.id, commentDraft.trim()); setCommentDraft('') } }}
                  />
                  <button className="ep-cbar-send" disabled={!commentDraft.trim()} title="Add comment (Enter)" onClick={() => { if (commentDraft.trim()) { addComment(thread.id, commentDraft.trim()); setCommentDraft('') } }}>
                    <Icon name="check" size={15} />
                  </button>
                </div>
              </div>
            ) : (
              <div className="ep-empty">Select an email.</div>
            )}
          </div>
          )}
        </div>
    </aside>
  )
}

/** Thin strip shown on the right edge when the email section is fully closed —
 * click to reopen it (always available, on every screen). */
export function EmailReopenTab() {
  const setPanelState = useEmailsStore((s) => s.setPanelState)
  const unread = useEmailsStore((s) => s.threads.filter((t) => !t.read && !t.snoozedUntil && !t.muted).length)
  return (
    <button className="email-reopen" title="Open email" onClick={() => setPanelState('full')}>
      <Icon name="mail" size={16} />
      {unread > 0 && <span className="email-reopen-badge">{unread}</span>}
      <span className="email-reopen-lbl">Email</span>
    </button>
  )
}
