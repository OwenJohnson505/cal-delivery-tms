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
function StatusChip({ status }: { status: EmailStatus }) {
  return <span className={'ep-status ' + STATUS_META[status].cls}>{STATUS_META[status].label}</span>
}
/** Compact "time since" for the assigned/idle clocks: 4m · 3h · 2d. */
const agoShort = (at: string): string => {
  const d = atDate(at)
  if (!d) return ''
  const mins = Math.floor(Math.max(0, Date.now() - d.getTime()) / 60_000)
  if (mins < 60) return `${mins}m`
  const h = Math.floor(mins / 60)
  return h < 24 ? `${h}h` : `${Math.floor(h / 24)}d`
}
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
          <div className="ep-job-h">
            <b>{detected.ref}</b>
            <span className="cf-hint">{detected.route} · {detected.vehicle || '—'} · {detected.supplierName || 'Unassigned'}</span>
            <span className="db-spacer" />
            {persisted
              ? <button className="cm-link" onClick={() => linkJob(thread.id, null)}>Linked ✓</button>
              : <button className="cm-link" onClick={() => linkJob(thread.id, detected.ref)}>Link</button>}
          </div>
          <div className="ep-job-grid">
            <span>Coll</span><b>{detected.collectAt || '—'}{detected.collectEta ? ` · ETA ${detected.collectEta}` : ''}</b>
            <span>Del</span><b>{detected.deliverAt || '—'}{detected.deliverEta ? ` · ETA ${detected.deliverEta}` : ''}</b>
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

// ── settings view (rules + templates) ──────────────────────────────────────────
function SettingsView({ onBack }: { onBack: () => void }) {
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
      <div className="ep-set-h"><button className="cm-link" onClick={onBack}>‹ Back to inbox</button></div>
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
  const users = useUsersStore((s) => s.users)
  const currentUserId = useUsersStore((s) => s.currentUserId)
  const customers = useCustomersStore((s) => s.customers)

  // Match an inbound sender to a known customer account (by contact email), so we can
  // show "who emailed us" at a glance.
  const customerFor = (t: EmailThread) => {
    const sender = (t.msgs.find((m) => !m.outbound)?.from.email ?? '').toLowerCase()
    if (!sender) return null
    return customers.find((c) => c.contacts.some((ct) => ct.email.toLowerCase() === sender)) ?? null
  }

  const [settings, setSettings] = useState(false)
  const [text, setText] = useState('')
  const [mailbox, setMailbox] = useState<'all' | string>('all')
  const [lane, setLaneFilter] = useState<'all' | Lane>('all')
  const [mine, setMine] = useState(false)
  const [snoozedOnly, setSnoozedOnly] = useState(false)
  const [smart, setSmart] = useState('')
  const [draft, setDraft] = useState('')
  const [more, setMore] = useState(false)
  const [comments, setComments] = useState(false)
  const [commentDraft, setCommentDraft] = useState('')
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
  const [topFilter, setTopFilter] = useState<'all' | 'mine' | 'awaiting' | 'action' | 'unassigned'>('all')
  const [expecting, setExpect] = useState(false)
  const [expectWhen, setExpectWhen] = useState<'1h' | '3h' | '1d' | 'custom'>('3h')
  const [expectCustom, setExpectCustom] = useState('')

  // ── search: predictive suggestions + advanced query ──
  const [searchFocused, setSearchFocused] = useState(false)
  const [adv, setAdv] = useState(false)
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
    // top-bar status filter (spec §8). 'all' shows the active queue (hides Resolved).
    if (topFilter === 'mine') list = list.filter((t) => t.assigneeId === currentUserId && t.status !== 'Resolved')
    else if (topFilter === 'awaiting') list = list.filter((t) => t.status === 'Awaiting Customer')
    else if (topFilter === 'action') list = list.filter((t) => t.status === 'Action Ready')
    else if (topFilter === 'unassigned') list = list.filter((t) => !t.assigneeId && t.status !== 'Resolved')
    else list = list.filter((t) => t.status !== 'Resolved')
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
  }, [threads, snoozedOnly, mailbox, lane, mine, smart, text, currentUserId, topFilter,
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
  const active = threads.filter((t) => !t.archived)
  const tfCount = {
    mine: active.filter((t) => t.assigneeId === currentUserId && t.status !== 'Resolved').length,
    awaiting: active.filter((t) => t.status === 'Awaiting Customer').length,
    action: active.filter((t) => t.status === 'Action Ready').length,
    unassigned: active.filter((t) => !t.assigneeId && t.status !== 'Resolved').length,
  }
  const lastInbound = thread?.msgs.filter((m) => !m.outbound).slice(-1)[0]
  const lastAt = thread?.msgs[thread.msgs.length - 1]?.at

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
    if (expectWhen === 'custom') return expectCustom ? new Date(expectCustom).getTime() : Date.now() + 3600_000
    return Date.now() + (expectWhen === '1h' ? 3600_000 : expectWhen === '3h' ? 3 * 3600_000 : 24 * 3600_000)
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

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName
      if (settings || ['INPUT', 'TEXTAREA', 'SELECT'].includes(tag) || e.ctrlKey || e.metaKey || e.altKey) return
      const ix = visible.findIndex((t) => t.id === selectedId)
      if (e.key === 'j' && visible.length) selectThread(visible[Math.min(ix + 1, visible.length - 1)]?.id ?? visible[0].id)
      else if (e.key === 'k' && visible.length) selectThread(visible[Math.max(ix - 1, 0)]?.id ?? visible[0].id)
      else if (e.key === 'r' && thread) { e.preventDefault(); startCompose('reply') }
      else if (e.key === 's' && thread) snooze(thread.id, 3_600_000, '1 hour')
      else if (e.key === 'a' && thread) assignThread(thread.id, currentUserId)
      else if (e.key === 'u' && thread) markUnread(thread.id)
      else if (e.key === 'p' && thread) toggleFlag(thread.id, 'pinned')
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [visible, selectedId, thread, settings]) // eslint-disable-line react-hooks/exhaustive-deps

  // With the body open, a click anywhere outside the email panel collapses the reader
  // back to the list (the draft guard in closeBody handles an in-progress reply).
  useEffect(() => {
    if (panelState !== 'full') return
    const onDown = (e: MouseEvent) => {
      const el = panelRef.current
      if (!el || el.contains(e.target as Node)) return
      closeBody()
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [panelState, compose, draft]) // eslint-disable-line react-hooks/exhaustive-deps

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
        <span className="ep-kbd" title={'Keyboard: j/k next/prev · r reply · s snooze 1h · a assign me · u unread · p pin'}>⌨</span>
        <button className={'btn sm iconbtn' + (settings ? ' on' : '')} title="Email settings — rules & templates" onClick={() => setSettings((o) => !o)}>
          <Icon name="wheel" size={15} />
        </button>
        <button className="btn sm iconbtn" title="Close email" onClick={() => setPanelState('mini')}>
          <Icon name="close" size={15} />
        </button>
      </div>

      {settings ? (
        <SettingsView onBack={() => setSettings(false)} />
      ) : (
        <div className="ep-body">
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
              <select className="ep-assign" value={mailbox} onChange={(e) => setMailbox(e.target.value)} title="Mailbox">
                <option value="all">All mailboxes</option>
                {MAILBOXES.map((m) => <option key={m}>{m.split('@')[0]}@</option>)}
              </select>
            </div>
            <div className="ep-filters">
              <select
                className="ep-assign"
                value={smart}
                title="Smart folders & saved views"
                onChange={(e) => {
                  const v = e.target.value
                  if (v.startsWith('sv:')) {
                    const sv = savedViews.find((x) => x.id === v.slice(3))
                    if (sv) { setMailbox(sv.q.mailbox ?? 'all'); setLaneFilter(sv.q.lane ?? 'all'); setMine(!!sv.q.mine); setText(sv.q.text ?? ''); setSmart('') }
                  } else setSmart(v)
                }}
              >
                <option value="">All conversations</option>
                <option value="needsreply">Needs reply</option>
                <option value="unassigned">Unassigned</option>
                {savedViews.map((v) => <option key={v.id} value={'sv:' + v.id}>{v.name}</option>)}
              </select>
              {!savingView ? (
                <button className="cm-link" onClick={() => setSavingView(true)}>Save</button>
              ) : (
                <input className="ep-search" autoFocus placeholder="View name…" value={viewName} onChange={(e) => setViewName(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter' && viewName.trim()) { addSavedView(viewName.trim(), { mailbox, lane, mine, text }); setViewName(''); setSavingView(false) } }} />
              )}
              <span className="db-spacer" />
              <button className={'ep-view' + (mine ? ' on' : '')} onClick={() => setMine((o) => !o)}>Mine</button>
              <button className={'ep-view' + (snoozedOnly ? ' on' : '')} onClick={() => setSnoozedOnly((o) => !o)} title="Snoozed">
                💤{snoozedCount ? ` ${snoozedCount}` : ''}
              </button>
            </div>

            {/* top-bar status filters (spec §8). Drag a row onto a chip to set that
                state (Awaiting / Action Ready) or claim/unassign it. */}
            <div className="ep-lanes ep-topfilter">
              {([['all', 'All'], ['mine', 'My Items'], ['awaiting', 'Awaiting'], ['action', 'Action Ready'], ['unassigned', 'Unassigned']] as const).map(([key, label]) => {
                const n = key === 'all' ? 0 : tfCount[key]
                return (
                  <button
                    key={key}
                    className={'ep-view ep-tf' + (topFilter === key ? ' on' : '')}
                    onClick={() => setTopFilter(key)}
                    onDragOver={key === 'all' ? undefined : (e) => { e.preventDefault(); e.currentTarget.classList.add('drop-hot') }}
                    onDragLeave={(e) => e.currentTarget.classList.remove('drop-hot')}
                    onDrop={key === 'all' ? undefined : (e) => {
                      e.preventDefault(); e.currentTarget.classList.remove('drop-hot')
                      const id = e.dataTransfer.getData('text/thread'); if (!id) return
                      if (key === 'awaiting') setStatus(id, 'Awaiting Customer')
                      else if (key === 'action') setStatus(id, 'Action Ready')
                      else if (key === 'mine') assignThread(id, currentUserId)
                      else if (key === 'unassigned') assignThread(id, null)
                    }}
                  >
                    {label}{n ? <i>{n}</i> : null}
                  </button>
                )
              })}
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
                const cust = customerFor(t)
                return (
                  <div
                    key={t.id}
                    className={'ep-row' + (t.id === selectedId ? ' on' : '') + (t.read || t.muted ? '' : ' unread') + (t.muted ? ' muted' : '')}
                    draggable
                    onDragStart={(e) => e.dataTransfer.setData('text/thread', t.id)}
                    onClick={() => { selectThread(t.id); setShowAllMsgs(false); setComments(false); setCompose(null); setDraft(''); setPanelState('full') }}
                  >
                    <span className="ep-row-line">
                      <input type="checkbox" className="ep-check" checked={checked.includes(t.id)} onClick={(e) => e.stopPropagation()} onChange={() => toggleCheck(t.id)} />
                      {t.pinned && <span className="ep-mini" title="Pinned">📌</span>}
                      <span className="ep-row-from">{t.msgs.find((m) => !m.outbound)?.from.name ?? last.from.name}</span>
                      {t.viewingBy && <span className="ep-mini" title={`${t.viewingBy} is viewing`}>👁</span>}
                      {t.reminderDue && <span className="ep-mini" title="Reminder due">⏰</span>}
                      <span className="db-spacer" />
                      {assignee && <span className="ep-ava" title={`Assigned to ${assignee}`}>{initials(assignee)}</span>}
                      <span className="ep-row-at" title={last.at}>{relTime(last.at)}</span>
                    </span>
                    <span className="ep-row-line">
                      {cust && <span className="ep-custchip" title={`Account: ${cust.companyName || cust.displayName}`}>{cust.displayName || cust.companyName}</span>}
                      <span className="ep-row-subj">{t.subject}</span>
                      {t.snoozedUntil && <span className="ep-snoozed">💤 {t.snoozedUntil}</span>}
                    </span>
                    <span className="ep-row-line ep-row-wf">
                      <StatusChip status={t.status} />
                      {t.assigneeId
                        ? <span className="ep-clk" title={`Assigned to ${assignee}`}>{assignee.split(' ')[0]} · {agoShort(t.assignedAt ?? t.lastActivityAt)}</span>
                        : <span className="ep-clk">idle {agoShort(t.lastActivityAt)}</span>}
                      {t.status === 'Awaiting Customer' && t.chaseDueAt != null && (() => {
                        const c = chaseInfo(t.chaseDueAt)
                        return <span className={'ep-chase ' + c.level} title="Chase deadline">⏳ {c.label}</span>
                      })()}
                      <span className="db-spacer" />
                      {Object.keys(t.readBy).length > 0 && (
                        <span className="ep-readby" title={`Read by ${Object.keys(t.readBy).map(userName).filter(Boolean).join(', ')}`}>👁 {Object.keys(t.readBy).length}</span>
                      )}
                    </span>
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
            {thread ? (
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
                    <StatusChip status={thread.status} />
                    <b>{thread.subject}</b>
                    <span className={'cat-chip ' + CAT_CLASS[thread.category]}>{thread.category}</span>
                    {thread.viewingBy && <span className="ep-mini" title={`${thread.viewingBy} is viewing now`}>👁 {thread.viewingBy}</span>}
                    <span className="db-spacer" />
                    {thread.status === 'Resolved'
                      ? <button className="btn sm" title={`Resolved · ${thread.resolutionReason ?? ''}`} onClick={() => reopenThread(thread.id)}>Re-open</button>
                      : <button className="btn sm" title="Resolve this email" onClick={tryResolve}><Icon name="check" size={13} /> Resolve</button>}
                    <button className="btn sm iconbtn ep-closebody" title="Close email — back to the list" onClick={closeBody}>
                      <Icon name="close" size={14} />
                    </button>
                  </div>
                  <div className="ep-rmeta">
                    {lastInbound ? `${lastInbound.from.name} <${lastInbound.from.email}>` : '—'} · {thread.mailbox} · {lastAt}
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
                    <button className={'btn sm' + (comments ? ' primary' : '')} onClick={() => setComments((o) => !o)} title="Internal comments">
                      💬 {thread.comments.length || ''}
                    </button>
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
                  {shownMsgs.map((m, ix) => (
                    <div key={m.id} className={'ep-msg' + (m.outbound ? ' out' : '')}>
                      <div className="ep-msg-meta">
                        {m.from.name} · {m.at}
                        {(collapsed ? ix + hiddenCount : ix) > 0 && (
                          <button className="ep-split" title="Split this and later messages into a new conversation" onClick={() => splitThread(thread.id, m.id)}>⎋ split</button>
                        )}
                      </div>
                      <div className="ep-msg-body"><RefText text={m.body} /></div>
                      {m.attachments?.map((a) => <span key={a.id} className="ep-att">📎 {a.name}</span>)}
                    </div>
                  ))}
                </div>

                {!compose ? (
                  <div className="ep-actionbar">
                    <button className="btn sm" onClick={() => startCompose('reply')}>↩ Reply</button>
                    <button className="btn sm" onClick={() => startCompose('replyall')}>↩↩ Reply all</button>
                    <button className="btn sm" onClick={() => startCompose('forward')}>↪ Forward</button>
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
                      onKeyDown={(e) => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) send('keep') }}
                    />
                    {/* Expecting a response → pick when to chase (spec §4.6 + your custom deadline) */}
                    <div className="ep-expect">
                      <label className="ep-expect-tog">
                        <input type="checkbox" checked={expecting} onChange={(e) => setExpect(e.target.checked)} />
                        Expecting a response
                      </label>
                      {expecting && (
                        <>
                          <span className="ep-expect-lbl">chase me in</span>
                          {([['1h', '1 hour'], ['3h', '3 hours'], ['1d', '1 day'], ['custom', 'Custom']] as const).map(([k, lbl]) => (
                            <button key={k} className={'ep-view' + (expectWhen === k ? ' on' : '')} onClick={() => setExpectWhen(k)}>{lbl}</button>
                          ))}
                          {expectWhen === 'custom' && (
                            <input type="datetime-local" className="ep-expect-when" value={expectCustom} onChange={(e) => setExpectCustom(e.target.value)} title="Chase me at…" />
                          )}
                        </>
                      )}
                    </div>
                    <div className="ep-composer-f">
                      <span className="ep-hint">Ctrl/⌘ + Enter = Send &amp; Keep</span>
                      <span className="db-spacer" />
                      <button className="btn sm" disabled={!draft.trim()} onClick={() => send('keep')} title="Send and keep it in your queue">Send &amp; Keep</button>
                      <button className="btn primary sm" disabled={!draft.trim()} onClick={() => send('resolve')} title={expecting ? 'Send — will wait on the customer' : 'Send and resolve'}>{expecting ? 'Send & Await' : 'Send & Resolve'}</button>
                    </div>
                  </div>
                )}

                {/* pop-out comments drawer */}
                {comments && (
                  <div className="ep-cdrawer">
                    <div className="ep-cdrawer-h">
                      <b>Internal comments</b>
                      <button className="btn sm iconbtn" onClick={() => setComments(false)}><Icon name="close" size={14} /></button>
                    </div>
                    <div className="ep-cdrawer-list">
                      {thread.comments.map((c) => (
                        <div key={c.id} className="ep-msg note">
                          <div className="ep-msg-meta">{c.by} · {c.at}</div>
                          <div className="ep-msg-body">{c.text}</div>
                        </div>
                      ))}
                      {!thread.comments.length && <div className="ep-empty">No comments yet — visible to the team only.</div>}
                    </div>
                    <div className="ep-cdrawer-add">
                      <textarea rows={2} placeholder="Comment — @mention a colleague…" value={commentDraft} onChange={(e) => setCommentDraft(e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey) && commentDraft.trim()) { addComment(thread.id, commentDraft.trim()); setCommentDraft('') } }} />
                      <button className="btn primary sm" disabled={!commentDraft.trim()} onClick={() => { addComment(thread.id, commentDraft.trim()); setCommentDraft('') }}>Add</button>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="ep-empty">Select an email.</div>
            )}
          </div>
          )}
        </div>
      )}
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
