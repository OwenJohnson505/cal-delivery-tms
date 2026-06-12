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
import { useEmailsStore, relTime, LANES, MAILBOXES, type EmailCategory, type EmailThread, type Lane } from '@/store/emailsStore.ts'
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

// ── main panel ──────────────────────────────────────────────────────────────────
export function EmailPanel() {
  const threads = useEmailsStore((s) => s.threads)
  const selectedId = useEmailsStore((s) => s.selectedId)
  const selectThread = useEmailsStore((s) => s.selectThread)
  const reply = useEmailsStore((s) => s.reply)
  const addComment = useEmailsStore((s) => s.addComment)
  const assignThread = useEmailsStore((s) => s.assign)
  const setLane = useEmailsStore((s) => s.setLane)
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
  const [pending, setPending] = useState<{ threadId: string; body: string; timer: number; compose: ComposeState } | null>(null)
  const composeRef = useRef<HTMLTextAreaElement>(null)

  const userName = (id: string | null) => users.find((u) => u.id === id)?.name ?? ''

  const visible = useMemo(() => {
    let list = threads.filter((t) => (snoozedOnly ? !!t.snoozedUntil : !t.snoozedUntil))
    if (mailbox !== 'all') list = list.filter((t) => t.mailbox === mailbox)
    if (lane !== 'all') list = list.filter((t) => t.lane === lane)
    if (mine) list = list.filter((t) => t.assigneeId === currentUserId)
    if (smart === 'needsreply') list = list.filter((t) => !t.msgs[t.msgs.length - 1].outbound && t.lane !== 'Done')
    if (smart === 'unassigned') list = list.filter((t) => !t.assigneeId)
    const q = text.trim().toLowerCase()
    if (q) list = list.filter((t) => threadText(t).includes(q) || t.tags.some((x) => x.toLowerCase().includes(q)))
    return [...list].sort((a, b) =>
      Number(!!b.pinned) - Number(!!a.pinned) ||
      Number(!!a.muted) - Number(!!b.muted) ||
      a.priority - b.priority ||
      atKey(b.msgs[b.msgs.length - 1].at).localeCompare(atKey(a.msgs[a.msgs.length - 1].at)),
    )
  }, [threads, snoozedOnly, mailbox, lane, mine, smart, text, currentUserId])

  const thread = threads.find((t) => t.id === selectedId) ?? null
  const unread = threads.filter((t) => !t.read && !t.snoozedUntil && !t.muted).length
  const snoozedCount = threads.filter((t) => !!t.snoozedUntil).length
  const laneCount = (l: Lane) => threads.filter((t) => t.lane === l && !t.snoozedUntil).length
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
    window.setTimeout(() => composeRef.current?.focus(), 50)
  }

  const send = () => {
    if (!thread || !draft.trim() || !compose) return
    const body = draft.trim()
    const composeSnapshot = compose
    const timer = window.setTimeout(() => { reply(thread.id, body); setPending(null) }, 5000)
    setPending({ threadId: thread.id, body, timer, compose: composeSnapshot })
    setDraft('')
    setCompose(null)
  }
  const undoSend = () => {
    if (!pending) return
    window.clearTimeout(pending.timer)
    setDraft(pending.body)
    setCompose(pending.compose)
    setPending(null)
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

  const toggleCheck = (id: string) =>
    setChecked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]))

  const msgs = thread?.msgs ?? []
  const collapsed = !showAllMsgs && msgs.length > 3
  const shownMsgs = collapsed ? msgs.slice(-3) : msgs
  const hiddenCount = msgs.length - shownMsgs.length

  return (
    <aside className="email-panel">
      <div className="ep-head">
        <Icon name="mail" size={16} /> <b>Email</b>
        {unread > 0 && <span className="ep-unread">{unread}</span>}
        <span className="db-spacer" />
        <span className="ep-kbd" title={'Keyboard: j/k next/prev · r reply · s snooze 1h · a assign me · u unread · p pin'}>⌨</span>
        <button className={'btn sm iconbtn' + (settings ? ' on' : '')} title="Email settings — rules & templates" onClick={() => setSettings((o) => !o)}>
          <Icon name="wheel" size={15} />
        </button>
        {panelState === 'full' ? (
          <button className="btn sm iconbtn" title="Collapse reader — keep the inbox list" onClick={() => setPanelState('list')}>›</button>
        ) : (
          <button className="btn sm iconbtn" title="Expand — show the reader" onClick={() => setPanelState('full')}>‹</button>
        )}
        <button className="btn sm iconbtn" title="Minimise email to a rail" onClick={() => setPanelState('mini')}>
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
              <input className="ep-search" placeholder="Search…" value={text} onChange={(e) => setText(e.target.value)} />
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

            <div className="ep-lanes">
              <button className={'ep-view' + (lane === 'all' ? ' on' : '')} onClick={() => setLaneFilter('all')}>All</button>
              {LANES.map((l) => (
                <button
                  key={l}
                  className={'ep-view ep-lane' + (lane === l ? ' on' : '')}
                  onClick={() => setLaneFilter(l)}
                  onDragOver={(e) => { e.preventDefault(); e.currentTarget.classList.add('drop-hot') }}
                  onDragLeave={(e) => e.currentTarget.classList.remove('drop-hot')}
                  onDrop={(e) => {
                    e.preventDefault()
                    e.currentTarget.classList.remove('drop-hot')
                    const id = e.dataTransfer.getData('text/thread')
                    if (id) setLane(id, l)
                  }}
                >
                  {l === 'In progress' ? 'Doing' : l} <i>{laneCount(l)}</i>
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
              {visible.map((t) => {
                const last = t.msgs[t.msgs.length - 1]
                const assignee = userName(t.assigneeId)
                const cust = customerFor(t)
                return (
                  <div
                    key={t.id}
                    className={'ep-row' + (t.id === selectedId ? ' on' : '') + (t.read || t.muted ? '' : ' unread') + (t.muted ? ' muted' : '')}
                    draggable
                    onDragStart={(e) => e.dataTransfer.setData('text/thread', t.id)}
                    onClick={() => { selectThread(t.id); setShowAllMsgs(false); setComments(false); setCompose(null); setDraft('') }}
                  >
                    <span className="ep-row-line">
                      <input type="checkbox" className="ep-check" checked={checked.includes(t.id)} onClick={(e) => e.stopPropagation()} onChange={() => toggleCheck(t.id)} />
                      <span className={'ep-catdot ' + CAT_CLASS[t.category]} title={t.category} />
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
                  </div>
                )
              })}
              {!visible.length && <div className="ep-empty">Nothing here.</div>}
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
                <div className="ep-rhead">
                  <div className="ep-rtitle">
                    <b>{thread.subject}</b>
                    <span className={'cat-chip ' + CAT_CLASS[thread.category]}>{thread.category}</span>
                    {thread.viewingBy && <span className="ep-mini" title={`${thread.viewingBy} is viewing now`}>👁 {thread.viewingBy}</span>}
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

                {pending && (
                  <div className="ep-banner ep-banner-undo">Sending… <button className="cm-link" onClick={undoSend}>Undo</button></div>
                )}

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
                      <button className="btn sm iconbtn" title="Discard" onClick={() => { setCompose(null); setDraft('') }}><Icon name="close" size={14} /></button>
                    </div>
                    <div className="ep-composer-sub">{compose.subject}</div>
                    <textarea
                      ref={composeRef}
                      placeholder="Write your message…"
                      value={draft}
                      onChange={(e) => setDraft(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) send() }}
                    />
                    <div className="ep-composer-f">
                      <span className="ep-hint">Ctrl/⌘ + Enter to send · 5s undo window after sending</span>
                      <span className="db-spacer" />
                      <button className="btn primary sm" disabled={!draft.trim() || !!pending} onClick={send}>Send</button>
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
