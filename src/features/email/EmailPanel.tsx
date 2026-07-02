/**
 * EmailPanel — the reskinned Front-style inbox.
 *
 * Presentation is the new `nx-` layer from ./email.css (ported from the desktop mockups):
 *   • LIST  (panelState 'list')  — inbox cards with spend-tier metal avatars
 *                                   (email-designs.html).
 *   • READER(panelState 'full')  — peek bar (email-reader-inbox.html #4) + envelope header
 *                                   (email-reader-v2.html) + opens-at-newest chronological
 *                                   thread (email-reader-peek.html #2) + pinned composer.
 *   • 'mini' — nothing (App hides the whole panel).
 *
 * The shell layout glue (index.css) still positions .email-panel / .ep-body / .ep-listcol /
 * .ep-readcol / .ep-list, so those structural class names are kept; everything inside is `nx-`.
 *
 * Every behaviour from the previous panel is preserved: search + predictive suggestions,
 * advanced search, filter menu + saved views, scope/sub-status tabs with counts, bulk
 * actions, sort + row indicators, reader assign/tags/macros/create-job/snooze/remind/
 * pin/follow/mute/mark-unread/merge/split, job strip, contact popover, comments with
 * click-to-jump, reply/reply-all/forward, templates, expecting-response chase picker,
 * Send & Keep / Resolve / Await, compose-new, reminder/awaiting banners with Simulate
 * customer reply, and the resolve/delete integrity guard.
 */
import './email.css'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Icon } from '@/app/Icon.tsx'
import { useEmailsStore, relTime, LANES, MAILBOXES, type EmailThread, type EmailMsg, type Lane } from '@/store/emailsStore.ts'
import { useJobsStore, type SavedJob } from '@/store/jobsStore.ts'
import { useBookingStore } from '@/store/bookingStore.ts'
import { useViewStore } from '@/store/viewStore.ts'
import { useCustomersStore, type Customer } from '@/store/customersStore.ts'
import { useTariffsStore } from '@/store/tariffsStore.ts'
import { useUsersStore } from '@/store/usersStore.ts'
import { useAutomationStore } from '@/store/automationStore.ts'

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

const SNOOZE_OPTIONS: Array<[label: string, ms: number]> = [
  ['10 sec (demo)', 10_000],
  ['1 hour', 3_600_000],
  ['Tomorrow 09:00', 16 * 3_600_000],
]

const initials = (name: string) => name.split(/\s+/).map((w) => w[0]).join('').slice(0, 2).toUpperCase()
/** Company → the 2-letter monogram used on the metal avatar. */
const companyInitials = (company: string) => {
  const words = company.replace(/[·].*/, '').trim().split(/\s+/).filter(Boolean)
  if (words.length >= 2) return (words[0][0] + words[1][0]).toUpperCase()
  return (company.slice(0, 2) || '?').toUpperCase()
}
/** Employee avatars get a stable, saturated colour (white initials on grey were hard to
 * read). Hash the user id → a fixed palette entry so the same person is always one colour. */
const EMP_COLORS = ['#0a84ff', '#8944ab', '#1a7f37', '#c1901c', '#d0353a', '#2b8fd6', '#5e5ce6', '#c0396b']
const empColor = (id: string | null): string => {
  if (!id) return '#8e8e93'
  let h = 0
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0
  return EMP_COLORS[h % EMP_COLORS.length]
}
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
/** Neat timestamp: 'HH:MM' if today, '3 Jul · HH:MM' earlier this year, else '3 Jul 25'. */
const shortWhen = (at: string): string => {
  const m = /^(\d{2})-(\d{2})-(\d{2}) (\d{2}):(\d{2})/.exec(at)
  if (!m) return at
  const d = new Date(2000 + +m[3], +m[2] - 1, +m[1], +m[4], +m[5])
  const now = new Date()
  const time = `${m[4]}:${m[5]}`
  if (d.getDate() === now.getDate() && d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()) return time
  if (d.getFullYear() === now.getFullYear()) return `${+m[1]} ${MON[+m[2] - 1]} · ${time}`
  return `${+m[1]} ${MON[+m[2] - 1]} ${m[3]}`
}
const atKey = (at: string) => `${at.slice(6, 8)}-${at.slice(3, 5)}-${at.slice(0, 2)} ${at.slice(9)}`
const threadText = (t: EmailThread) =>
  `${t.subject} ${t.msgs.map((m) => `${m.from.name} ${m.from.email} ${m.body}`).join(' ')}`.toLowerCase()

// ── search helpers ───────────────────────────────────────────────────────────────
const haystack = (t: EmailThread) => `${threadText(t)} ${t.tags.join(' ')} ${t.linkedJobRef ?? ''}`.toLowerCase()
const contactHay = (t: EmailThread) => t.msgs.map((m) => `${m.from.name} ${m.from.email}`).join(' ').toLowerCase()
const bodyHay = (t: EmailThread) => t.msgs.map((m) => m.body).join(' ').toLowerCase()
/** Last real EMAIL time — job events don't count as new activity (they inter-thread only). */
const lastAtOf = (t: EmailThread) => (([...t.msgs].reverse().find((m) => !m.event)) ?? t.msgs[t.msgs.length - 1]).at
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
/** Minutes between two 'dd-mm-yy HH:MM' stamps (b − a); null if either is unparseable. */
const minutesBetween = (a: string, b: string): number | null => {
  const da = atDate(a), db = atDate(b)
  if (!da || !db) return null
  return Math.round((db.getTime() - da.getTime()) / 60_000)
}
const elapsedLabel = (mins: number): string =>
  mins < 60 ? `+${mins}m` : mins < 1440 ? `+${Math.round(mins / 60)}h` : `+${Math.round(mins / 1440)}d`

// ── spend tier ───────────────────────────────────────────────────────────────────
// TODO: this should later be driven by real spend data (invoiced revenue / run-rate).
// For now: prefer the customer's declared estAnnualSpend; otherwise derive a tier from
// how many jobs the account has (a stand-in for spend). Unknown senders → grey.
type Tier = 'plat' | 'gold' | 'silver' | 'bronze' | 'grey' | 'driver' | 'me'
const TIER_CLASS: Record<Tier, string> = {
  plat: 'nx-m-plat', gold: 'nx-m-gold', silver: 'nx-m-silver',
  bronze: 'nx-m-bronze', grey: 'nx-m-grey', driver: 'nx-m-driver', me: 'nx-me',
}
const METAL_TIERS = new Set<Tier>(['plat', 'gold', 'silver', 'bronze'])
const tierFromSpend = (spend: number): Tier =>
  spend >= 250_000 ? 'plat' : spend >= 100_000 ? 'gold' : spend >= 30_000 ? 'silver' : spend >= 5_000 ? 'bronze' : 'grey'
const tierFromJobCount = (n: number): Tier =>
  n >= 12 ? 'plat' : n >= 7 ? 'gold' : n >= 3 ? 'silver' : n >= 1 ? 'bronze' : 'grey'

interface SenderInfo { company: string; contact: string; tier: Tier; isNew: boolean; email: string }

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
  const jobs = useJobsStore((s) => s.jobs)
  const macros = useAutomationStore((s) => s.macros)
  const runMacro = useAutomationStore((s) => s.runMacro)

  // ── list filters / search state ──
  const [text, setText] = useState('')
  const [mailbox, setMailbox] = useState<'all' | string>('all')
  const [lane, setLaneFilter] = useState<'all' | Lane>('all')
  const [mine, setMine] = useState(false)
  const [snoozedOnly, setSnoozedOnly] = useState(false)
  const [smart, setSmart] = useState('')
  const [checked, setChecked] = useState<string[]>([])
  const [savingView, setSavingView] = useState(false)
  const [viewName, setViewName] = useState('')
  const [scope, setScope] = useState<'mine' | 'all'>('all')
  const [sub, setSub] = useState<'open' | 'awaiting' | 'resolved' | 'unassigned'>('open')

  const [searchFocused, setSearchFocused] = useState(false)
  const [adv, setAdv] = useState(false)
  const [filterOpen, setFilterOpen] = useState(false)
  const [advContact, setAdvContact] = useState(''); const [advContactOp, setAdvContactOp] = useState<SearchOp>('contains')
  const [advSubject, setAdvSubject] = useState(''); const [advSubjectOp, setAdvSubjectOp] = useState<SearchOp>('contains')
  const [advBody, setAdvBody] = useState(''); const [advBodyOp, setAdvBodyOp] = useState<SearchOp>('contains')
  const [advFrom, setAdvFrom] = useState(''); const [advTo, setAdvTo] = useState('')
  const [cShown, setCShown] = useState(3)
  const [eShown, setEShown] = useState(3)
  const [advShown, setAdvShown] = useState(6)
  useEffect(() => { setCShown(3); setEShown(3) }, [text])
  useEffect(() => { setAdvShown(6) }, [advContact, advContactOp, advSubject, advSubjectOp, advBody, advBodyOp, advFrom, advTo])
  const advActive = adv && !!(advContact.trim() || advSubject.trim() || advBody.trim() || advFrom || advTo)

  // ── reader state ──
  const [draft, setDraft] = useState('')
  const [commentDraft, setCommentDraft] = useState('')
  const [tagDraft, setTagDraft] = useState('')
  const [addingTag, setAddingTag] = useState(false)
  const [openContact, setOpenContact] = useState<string | null>(null)
  const [macroOpen, setMacroOpen] = useState(false)
  const [more, setMore] = useState(false)
  const [peekMenu, setPeekMenu] = useState<'snooze' | null>(null)
  const [flashMsg, setFlashMsg] = useState<string | null>(null)
  const [expandAll, setExpandAll] = useState(false)
  const [expandedMsgs, setExpandedMsgs] = useState<string[]>([])
  const [inview, setInview] = useState<Set<string>>(new Set())
  const [peekOpen, setPeekOpen] = useState(false)
  const [composeNew, setComposeNew] = useState<{ to: string; subject: string; body: string } | null>(null)
  type ComposeTab = 'reply' | 'replyall' | 'forward' | 'note'
  const [tab, setTab] = useState<ComposeTab>('reply')
  // the inline write area stays folded away until reply / reply all / forward is picked
  const [replyOpen, setReplyOpen] = useState(false)
  const [composeTo, setComposeTo] = useState('')
  const [expecting, setExpect] = useState(false)
  const [expectAmount, setExpectAmount] = useState(10)
  const [expectUnit, setExpectUnit] = useState<'min' | 'hr'>('min')

  const composeRef = useRef<HTMLTextAreaElement>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const historyRef = useRef<HTMLDivElement>(null)
  const panelRef = useRef<HTMLElement>(null)

  const openCompose = (to = '') => { setComposeNew({ to, subject: '', body: '' }); setPanelState('full') }

  const userName = (id: string | null) => users.find((u) => u.id === id)?.name ?? ''

  // ── spend-tier derivation (keyed by an inbound sender's email) ──
  const jobCountByCustomer = useMemo(() => {
    const m = new Map<string, number>()
    jobs.forEach((j) => { const c = j.snapshot.book.cust; if (c) m.set(c, (m.get(c) ?? 0) + 1) })
    return m
  }, [jobs])
  const customerForEmail = (email: string): Customer | undefined => {
    const e = email.toLowerCase()
    return customers.find((c) => c.contacts.some((ct) => ct.email.toLowerCase() === e))
  }
  /** Resolve the situational sender (company · contact · tier · new) for a thread. */
  const senderInfo = (t: EmailThread): SenderInfo => {
    const first = t.msgs.find((m) => !m.outbound) ?? t.msgs[0]
    const email = first.from.email
    const cust = customerForEmail(email)
    if (email.toLowerCase().endsWith('@hauliers.co.uk')) {
      return { company: first.from.name, contact: 'driver', tier: 'driver', isNew: false, email }
    }
    if (!cust) return { company: first.from.name, contact: '', tier: 'grey', isNew: true, email }
    const company = cust.displayName || cust.companyName || first.from.name
    const jobN = jobCountByCustomer.get(cust.id) ?? 0
    const tier: Tier = cust.sales.estAnnualSpend != null ? tierFromSpend(cust.sales.estAnnualSpend) : tierFromJobCount(jobN)
    return { company, contact: first.from.name, tier, isNew: jobN <= 1, email }
  }

  // ── filtered + sorted list ──
  const visible = useMemo(() => {
    let list = threads.filter((t) => !t.archived && (snoozedOnly ? !!t.snoozedUntil : !t.snoozedUntil))
    if (scope === 'mine') list = list.filter((t) => t.assigneeId === currentUserId)
    if (sub === 'awaiting') list = list.filter((t) => t.status === 'Awaiting Customer')
    else if (sub === 'resolved') list = list.filter((t) => t.status === 'Resolved')
    else if (sub === 'unassigned') list = list.filter((t) => !t.assigneeId && t.status !== 'Resolved')
    else list = list.filter((t) => t.status !== 'Resolved' && t.status !== 'Awaiting Customer')
    if (mailbox !== 'all') list = list.filter((t) => t.mailbox === mailbox)
    if (lane !== 'all') list = list.filter((t) => t.lane === lane)
    if (mine) list = list.filter((t) => t.assigneeId === currentUserId)
    if (smart === 'needsreply') list = list.filter((t) => !t.msgs[t.msgs.length - 1].outbound && t.lane !== 'Done')
    if (smart === 'unassigned') list = list.filter((t) => !t.assigneeId)
    const query = text.trim().toLowerCase()
    if (query) list = list.filter((t) => haystack(t).includes(query))
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

  // ── predictive suggestions ──
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
  const scoped = threads.filter((t) => !t.archived && (scope === 'mine' ? t.assigneeId === currentUserId : true))
  const subCount = {
    open: scoped.filter((t) => t.status !== 'Resolved' && t.status !== 'Awaiting Customer').length,
    awaiting: scoped.filter((t) => t.status === 'Awaiting Customer').length,
    resolved: scoped.filter((t) => t.status === 'Resolved').length,
    unassigned: scoped.filter((t) => !t.assigneeId && t.status !== 'Resolved').length,
  }
  const lastInbound = thread?.msgs.filter((m) => !m.outbound).slice(-1)[0]

  const nameForEmail = (email: string): string => {
    const e = email.toLowerCase()
    if (e.endsWith('@cal.delivery')) return email.split('@')[0] + '@'
    for (const c of customers) {
      const ct = c.contacts.find((x) => x.email.toLowerCase() === e)
      if (ct?.name) return ct.name
    }
    return email.split('@')[0]
  }
  const recipientsFor = (m: EmailMsg): string => {
    if (!thread) return ''
    const out: string[] = []
    if (!m.outbound) out.push(thread.mailbox.split('@')[0] + '@')
    thread.participants
      .filter((p) => p.toLowerCase() !== m.from.email.toLowerCase() && !p.endsWith('@cal.delivery'))
      .forEach((p) => out.push(nameForEmail(p)))
    return [...new Set(out)].join(', ') || '—'
  }

  // ── selecting a thread ──
  const openThread = (id: string) => {
    selectThread(id)
    setDraft(''); setComposeNew(null); setTab('reply'); setComposeTo(''); setReplyOpen(false)
    setExpandAll(false); setExpandedMsgs([]); setInview(new Set()); setExpect(false)
    setPanelState('full')
  }
  const backToList = () => setPanelState('list')

  // ── compose ──
  const startCompose = (kind: ComposeTab) => {
    if (!thread) return
    setTab(kind)
    if (kind !== 'note') setReplyOpen(true)
    if (kind === 'note') { window.setTimeout(() => composeRef.current?.focus(), 40); return }
    const sender = lastInbound?.from.email ?? ''
    const others = thread.participants.filter((p) => !p.endsWith('@cal.delivery'))
    if (kind === 'reply') setComposeTo(sender)
    else if (kind === 'replyall') setComposeTo(others.join(', '))
    else if (kind === 'forward') {
      setComposeTo('')
      const quoted = lastInbound
        ? `\n\n---------- Forwarded message ----------\nFrom: ${lastInbound.from.name} <${lastInbound.from.email}>\nSent: ${lastInbound.at}\n\n${lastInbound.body}`
        : ''
      setDraft(quoted)
    }
    if (thread.status === 'New' || thread.status === 'Assigned' || thread.status === 'Action Ready') setStatus(thread.id, 'In Progress')
    window.setTimeout(() => composeRef.current?.focus(), 40)
  }

  const chaseDeadlineMs = (): number => {
    const amt = Math.max(1, expectAmount || 1)
    return Date.now() + amt * (expectUnit === 'hr' ? 3600_000 : 60_000)
  }

  const send = (mode: 'resolve' | 'keep') => {
    if (!thread) return
    if (tab === 'note') {
      if (!draft.trim()) return
      addComment(thread.id, draft.trim()); setDraft(''); setTab('reply'); return
    }
    if (!draft.trim()) return
    postOutbound(thread.id, draft.trim())
    if (expecting) setExpectingStore(thread.id, chaseDeadlineMs())
    else if (mode === 'resolve') resolveThread(thread.id, 'Responded')
    else setStatus(thread.id, thread.assigneeId ? 'Assigned' : 'New')
    setDraft(''); setExpect(false); setReplyOpen(false)
  }

  const hasOutbound = !!thread?.msgs.some((m) => m.outbound)
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

  const insertTemplate = (id: string) => {
    const tpl = templates.find((x) => x.id === id)
    if (!tpl) return
    if (!replyOpen) startCompose('reply')
    setDraft((d) => (d ? d + '\n' + tpl.body : tpl.body))
  }
  const insertEta = (etaText: string) => setDraft((d) => (d ? d + '\n' + etaText : etaText))

  const goToComment = (c: { afterMsgId?: string }) => {
    const mid = c.afterMsgId ?? thread?.msgs[thread.msgs.length - 1]?.id
    if (!mid) return
    setExpandedMsgs((p) => (p.includes(mid) ? p : [...p, mid]))
    window.setTimeout(() => {
      document.getElementById('nx-msg-' + mid)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      setFlashMsg(mid)
      window.setTimeout(() => setFlashMsg(null), 1200)
    }, 30)
  }

  const toggleCheck = (id: string) =>
    setChecked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]))

  const msgs = thread?.msgs ?? []
  // The thread opens scrolled to the newest message; the extended line (nx-gap) sits just
  // before it, and everything above rests greyed until scrolled into view.
  // The newest EMAIL is the prominent one (job events are quiet inline markers, never the focus).
  const newestId = ([...msgs].reverse().find((m) => !m.event)?.id) ?? msgs[msgs.length - 1]?.id
  const newestIdx = msgs.findIndex((m) => m.id === newestId)
  const olderCutoff = newestIdx < 0 ? msgs.length - 1 : newestIdx // emails before the newest are "older" (greyed)
  // Previous communication is grouped into a greyed, scroll-up box; the newest email (the one
  // we're working on) sits below it in a clean white container with the reply controls.
  const historyMsgs = newestIdx <= 0 ? [] : msgs.slice(0, newestIdx)
  const currentMsgs = newestIdx < 0 ? msgs : msgs.slice(newestIdx)

  // Open with the newest email high in view: the history box is pinned to its newest (bottom)
  // so scrolling up reveals older mail, while the outer column rests at the top.
  useEffect(() => {
    if (panelState !== 'full' || !thread || composeNew) return
    window.setTimeout(() => {
      if (scrollRef.current) scrollRef.current.scrollTop = 0
      if (historyRef.current) historyRef.current.scrollTop = historyRef.current.scrollHeight
    }, 0)
  }, [selectedId, panelState, composeNew, thread])

  // IntersectionObserver: greyed older messages fade to full colour as they scroll in.
  useEffect(() => {
    const root = scrollRef.current
    if (panelState !== 'full' || !root || !thread) return
    const obs = new IntersectionObserver(
      (entries) => {
        setInview((prev) => {
          let next = prev
          for (const e of entries) {
            const id = (e.target as HTMLElement).dataset.mid
            if (!id) continue
            if (e.isIntersecting && !next.has(id)) { next = new Set(next); next.add(id) }
          }
          return next
        })
      },
      { root, threshold: 0.4 },
    )
    root.querySelectorAll('[data-mid]').forEach((n) => obs.observe(n))
    return () => obs.disconnect()
  }, [selectedId, panelState, thread, expandAll])

  const isExpanded = (m: EmailMsg, idx: number) =>
    expandAll || m.id === newestId || idx >= olderCutoff || expandedMsgs.includes(m.id)

  // ── LIST ROW ──
  const ListRow = (t: EmailThread) => {
    const si = senderInfo(t)
    // The inbox reflects the latest EMAIL — job events only live inside the thread.
    const last = [...t.msgs].reverse().find((m) => !m.event) ?? t.msgs[t.msgs.length - 1]
    const assignee = userName(t.assigneeId)
    const attachN = t.msgs.reduce((n, m) => n + (m.attachments?.length ?? 0), 0)
    const replied = !!last.outbound
    const linkedJob = jobs.find((j) => j.ref.toUpperCase() === t.linkedJobRef?.toUpperCase())
    const revenue = linkedJob?.revenue
    // SLA colour from how long an unanswered inbound has waited (arrival → now).
    const arrived = atDate(last.at)
    const waitMins = replied || !arrived ? null : Math.round((Date.now() - arrived.getTime()) / 60_000)
    const waitLevel = waitMins == null ? 'ok' : waitMins > 240 ? 'late' : waitMins > 60 ? 'warn' : 'ok'
    return (
      <button
        key={t.id}
        className={'nx-card' + (t.id === selectedId ? ' on' : '') + (t.read || t.muted ? '' : ' unread') + (t.muted ? ' muted' : '')}
        onClick={() => openThread(t.id)}
      >
        <input type="checkbox" className="nx-check" checked={checked.includes(t.id)}
          onClick={(e) => e.stopPropagation()} onChange={() => toggleCheck(t.id)} title="Select" />
        <div className="nx-hline">
          <span className="nx-avw">
            <span className={'nx-avatar' + (METAL_TIERS.has(si.tier) ? ' nx-metal ' : ' ') + TIER_CLASS[si.tier]}>
              {si.company === si.contact ? initials(si.contact) : companyInitials(si.company)}
            </span>
            {si.isNew && <span className="nx-newdot" title="New customer" />}
          </span>
          <span className="nx-who">{si.company}{si.contact && si.contact !== si.company && <span className="nx-cx"> · {si.contact}</span>}</span>
          <span className="nx-sp" />
          {t.assigneeId
            ? <span className="nx-apill"><span className="nx-avatar nx-emp" style={{ background: empColor(t.assigneeId) }} title={assignee}>{initials(assignee)}</span>{assignee.split(' ')[0]}</span>
            : <span className="nx-apill none"><span className="nx-avatar dash">?</span>Unassigned</span>}
          <span className={'nx-wait ' + waitLevel}><Icon name="clock" size={12} /> {relTime(last.at)}</span>
        </div>
        <div className="nx-subj">{t.subject}</div>
        <div className="nx-snip">{(last.body || '').replace(/\s+/g, ' ').slice(0, 90)}</div>
        {t.draftPresence && (
          <div className="nx-typing">
            <span className="nx-typing-dots"><i /><i /><i /></span>
            {t.draftPresence.by.split(' ')[0]} is replying…
          </div>
        )}
        <div className="nx-foot">
          {(() => {
            const readers = users.filter((u) => t.readBy[u.id])
            if (readers.length > 0) {
              return (
                <span className="nx-seen">
                  <span className="nx-seenlbl">Seen</span>
                  <span className="nx-seenby">
                    {readers.slice(0, 4).map((u) => (
                      <span key={u.id} className="nx-seenav" style={{ background: empColor(u.id) }} title={`Seen by ${u.name}`}>{initials(u.name)}</span>
                    ))}
                    {readers.length > 4 && <span className="nx-seenav more" title={readers.slice(4).map((u) => u.name).join(', ')}>+{readers.length - 4}</span>}
                  </span>
                </span>
              )
            }
            return (
              <span className={'nx-seen' + (replied ? ' replied' : '')}>
                <Icon name={replied ? 'check' : 'mail'} size={13} />
                {replied ? 'Replied' : 'Unseen'}
              </span>
            )
          })()}
          {t.reminderDue && <span className="nx-chip nx-c-urgent">⏰ Reminder</span>}
          {t.snoozedUntil && <span className="nx-chip nx-c-mut">💤 {t.snoozedUntil}</span>}
          <span className="nx-fsp" />
          {revenue != null && <span className="nx-val">£{revenue}</span>}
          {attachN > 0 && <span className="nx-chip nx-c-mut">{attachN} 📎</span>}
          {linkedJob && <span className={'nx-chip ' + (linkedJob.progress === 'Failed' ? 'nx-c-late' : linkedJob.progress ? 'nx-c-live' : 'nx-c-assigned')}>{linkedJob.ref}{linkedJob.progress ? ` · ${linkedJob.progress}` : ''}</span>}
          {t.tags[0] && <span className="nx-chip nx-c-quote">{t.tags[0]}</span>}
        </div>
      </button>
    )
  }

  // ── the LIST column (panelState 'list') ──
  const listCol = (
    <div className="ep-listcol">
      <div className="nx-phead">
        <Icon name="mail" size={16} />
        <span className="nx-t">Inbox</span>
        {unread > 0 && <span className="nx-n">· {unread} new</span>}
        <span className="nx-sp" />
        <button className="nx-new-btn" title="Compose a new email" onClick={() => openCompose()}>
          <Icon name="edit" size={13} /> New
        </button>
      </div>

      <div className="nx-filters">
        <div className="nx-searchrow">
          <div className="nx-searchbox">
            <Icon name="search" size={13} />
            <input
              className="nx-search"
              placeholder="Search people, subjects, bodies, refs…"
              value={text}
              onChange={(e) => setText(e.target.value)}
              onFocus={() => setSearchFocused(true)}
              onBlur={() => window.setTimeout(() => setSearchFocused(false), 160)}
            />
            {text && <button className="nx-search-x" title="Clear" onClick={() => setText('')}>×</button>}

            {showSuggest && (contactSuggest.length > 0 || emailSuggest.length > 0) && (
              <div className="nx-suggest" onMouseDown={(e) => e.preventDefault()}>
                {contactSuggest.length > 0 && (
                  <div className="nx-sug-sec">
                    <div className="nx-sug-h">People</div>
                    {contactSuggest.slice(0, cShown).map((c) => (
                      <button key={c.email} className="nx-sug-row" onClick={() => { setText(c.email); setSearchFocused(false) }}>
                        <span className="nx-avatar nx-m-grey">{initials(c.name)}</span>
                        <span className="nx-sug-main"><b>{c.name}</b>{c.company && <span className="nx-sug-sub">{c.company}</span>}</span>
                        <span className="nx-sug-meta">{c.score} email{c.score === 1 ? '' : 's'}</span>
                      </button>
                    ))}
                    {contactSuggest.length > cShown && (
                      <button className="nx-sug-more" onClick={() => setCShown((n) => n + 3)}>View next 3 people · {contactSuggest.length - cShown} more</button>
                    )}
                  </div>
                )}
                {emailSuggest.length > 0 && (
                  <div className="nx-sug-sec">
                    <div className="nx-sug-h">Emails</div>
                    {emailSuggest.slice(0, eShown).map((t) => (
                      <button key={t.id} className="nx-sug-row" onClick={() => { openThread(t.id); setSearchFocused(false) }}>
                        <span className="nx-sug-main"><b>{t.subject}</b><span className="nx-sug-sub">{t.msgs.find((m) => !m.outbound)?.from.name ?? ''}{t.linkedJobRef ? ` · ${t.linkedJobRef}` : ''}</span></span>
                        <span className="nx-sug-meta">{relTime(lastAtOf(t))}</span>
                      </button>
                    ))}
                    {emailSuggest.length > eShown && (
                      <button className="nx-sug-more" onClick={() => setEShown((n) => n + 3)}>View next 3 emails · {emailSuggest.length - eShown} more</button>
                    )}
                  </div>
                )}
              </div>
            )}

            {adv && (
              <>
                <div className="nx-pop-scrim" onClick={() => setAdv(false)} />
                <div className="nx-adv" onClick={(e) => e.stopPropagation()}>
                  <div className="nx-adv-h">Advanced search<span className="nx-sp" /><button className="nx-fm-save" onClick={() => { setAdvContact(''); setAdvSubject(''); setAdvBody(''); setAdvFrom(''); setAdvTo('') }}>Clear</button></div>
                  {([
                    ['Contact', advContactOp, setAdvContactOp, advContact, setAdvContact, 'name or email…'],
                    ['Subject', advSubjectOp, setAdvSubjectOp, advSubject, setAdvSubject, 'subject text…'],
                    ['Body', advBodyOp, setAdvBodyOp, advBody, setAdvBody, 'body text…'],
                  ] as const).map(([label, op, setOp, val, setVal, ph]) => (
                    <div className="nx-adv-row" key={label}>
                      <span className="nx-adv-lbl">{label}</span>
                      <select className="nx-adv-op" value={op} onChange={(e) => setOp(e.target.value as SearchOp)}>
                        <option value="contains">contains</option>
                        <option value="matches">matches</option>
                      </select>
                      <input className="nx-adv-val" value={val} onChange={(e) => setVal(e.target.value)} placeholder={ph} />
                    </div>
                  ))}
                  <div className="nx-adv-row">
                    <span className="nx-adv-lbl">Date</span>
                    <input type="date" className="nx-adv-date" value={advFrom} onChange={(e) => setAdvFrom(e.target.value)} title="From" />
                    <span className="nx-adv-to">to</span>
                    <input type="date" className="nx-adv-date" value={advTo} onChange={(e) => setAdvTo(e.target.value)} title="To" />
                  </div>
                  <div className="nx-adv-foot">{advActive ? `${visible.length} result${visible.length === 1 ? '' : 's'}` : 'Fill any field to refine'}</div>
                </div>
              </>
            )}
          </div>
          <button className={'nx-iconbtn' + (adv ? ' on' : '')} title="Advanced search" onClick={() => setAdv((o) => !o)}>
            <Icon name="filter" size={14} />
          </button>
          <div style={{ position: 'relative' }}>
            <button className={'nx-iconbtn' + ((mailbox !== 'all' || smart || snoozedOnly) ? ' on' : '')} title="Filter & saved views" onClick={() => setFilterOpen((o) => !o)}>
              <Icon name="sliders" size={14} />
            </button>
            {filterOpen && (
              <>
                <div className="nx-pop-scrim" onClick={() => setFilterOpen(false)} />
                <div className="nx-filtermenu" onClick={(e) => e.stopPropagation()}>
                  <div className="nx-fm-row"><span className="nx-fm-lbl">Mailbox</span>
                    <select value={mailbox} onChange={(e) => setMailbox(e.target.value)}>
                      <option value="all">All mailboxes</option>
                      {MAILBOXES.map((m) => <option key={m} value={m}>{m.split('@')[0]}@</option>)}
                    </select>
                  </div>
                  <div className="nx-fm-row"><span className="nx-fm-lbl">Lane</span>
                    <select value={lane} onChange={(e) => setLaneFilter(e.target.value as 'all' | Lane)}>
                      <option value="all">All lanes</option>
                      {LANES.map((l) => <option key={l} value={l}>{l}</option>)}
                    </select>
                  </div>
                  <div className="nx-fm-row"><span className="nx-fm-lbl">Show</span>
                    <select value={smart} onChange={(e) => setSmart(e.target.value)}>
                      <option value="">All conversations</option>
                      <option value="needsreply">Needs reply</option>
                      <option value="unassigned">Unassigned</option>
                    </select>
                  </div>
                  <label className="nx-fm-chk"><input type="checkbox" checked={mine} onChange={(e) => setMine(e.target.checked)} /> Assigned to me</label>
                  <label className="nx-fm-chk"><input type="checkbox" checked={snoozedOnly} onChange={(e) => setSnoozedOnly(e.target.checked)} /> Snoozed only{snoozedCount ? ` (${snoozedCount})` : ''}</label>
                  <div className="nx-fm-sec">Saved views</div>
                  {savedViews.length === 0 && <div className="nx-fm-empty">None saved yet.</div>}
                  {savedViews.map((v) => (
                    <button key={v.id} className="nx-fm-view" onClick={() => { setMailbox(v.q.mailbox ?? 'all'); setLaneFilter(v.q.lane ?? 'all'); setMine(!!v.q.mine); setText(v.q.text ?? ''); setSmart(''); setFilterOpen(false) }}>{v.name}</button>
                  ))}
                  {!savingView ? (
                    <button className="nx-fm-save" onClick={() => setSavingView(true)}>+ Save current as view</button>
                  ) : (
                    <input autoFocus placeholder="View name + Enter" value={viewName} onChange={(e) => setViewName(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter' && viewName.trim()) { addSavedView(viewName.trim(), { mailbox, lane, mine, text }); setViewName(''); setSavingView(false) } }} />
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      <div className="nx-scope">
        {([['mine', 'Assigned to me'], ['all', 'All']] as const).map(([k, label]) => (
          <button key={k} className={'nx-scope-btn' + (scope === k ? ' on' : '')} onClick={() => { setScope(k); if (k === 'mine' && sub === 'unassigned') setSub('open') }}>{label}</button>
        ))}
      </div>
      <div className="nx-subtabs">
        {([['open', 'Open', 'inbox'], ['awaiting', 'Awaiting', 'clock'], ['resolved', 'Resolved', 'check-circle'],
          ...(scope === 'all' ? [['unassigned', 'Unassigned', 'user-plus'] as const] : [])] as const).map(([key, label, icon]) => (
          <button key={key} className={'nx-subtab' + (sub === key ? ' on' : '')} onClick={() => setSub(key)} title={label}>
            <Icon name={icon} size={15} />
            {subCount[key] ? <i>{subCount[key]}</i> : null}
          </button>
        ))}
      </div>

      {checked.length > 0 && (
        <div className="nx-bulk">
          <b>{checked.length}</b> selected
          <select value="" onChange={(e) => { if (e.target.value) { bulkApply(checked, { assigneeId: e.target.value }); setChecked([]) } }}>
            <option value="">Assign…</option>
            {users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
          </select>
          <select value="" onChange={(e) => { if (e.target.value) { bulkApply(checked, { lane: e.target.value as Lane }); setChecked([]) } }}>
            <option value="">Lane…</option>
            {LANES.map((l) => <option key={l}>{l}</option>)}
          </select>
          <button className="nx-bulk-link" onClick={() => { bulkApply(checked, { snoozeMs: 3_600_000, snoozeLabel: '1 hour' }); setChecked([]) }}>Snooze</button>
          <button className="nx-bulk-link" onClick={() => setChecked([])}>Clear</button>
        </div>
      )}

      <div className="ep-list">
        {(advActive ? visible.slice(0, advShown) : visible).map(ListRow)}
        {!visible.length && <div className="nx-empty">Nothing here.</div>}
        {advActive && visible.length > advShown && (
          <button className="nx-sug-more" onClick={() => setAdvShown((n) => n + 3)}>
            View next 3 · {visible.length - advShown} more
          </button>
        )}
      </div>
    </div>
  )

  // ── READER column (panelState 'full') ──
  const si = thread ? senderInfo(thread) : null
  const peekThreads = threads.filter((t) => !t.archived && !t.snoozedUntil && t.id !== selectedId).slice(0, 8)

  // One message row — a compact audit event, or a full email (collapsed to a snippet when older).
  const renderMsg = (m: EmailMsg, idx: number) => {
    if (!thread) return null
    if (m.event) {
      return (
        <div key={m.id} id={'nx-msg-' + m.id} data-mid={m.id} className={'nx-msg nx-event' + (flashMsg === m.id ? ' flash' : '')}>
          <div className="nx-mnode"><span className="nx-enode"><Icon name={m.icon || 'check'} size={11} /></span></div>
          <div className="nx-eline">
            <span className="nx-elabel">{m.body}</span>
            {m.from.name && <span className="nx-eactor">{m.from.name}</span>}
            <span className="nx-tt nx-etime" title={m.at}>{shortWhen(m.at)}</span>
          </div>
        </div>
      )
    }
    const cust = customerForEmail(m.from.email)
    const older = idx < olderCutoff && !expandAll
    const expanded = isExpanded(m, idx)
    // elapsed badge: response time between the previous inbound and this outbound
    let elapsed: string | null = null
    if (m.outbound && idx > 0 && !msgs[idx - 1].outbound && !msgs[idx - 1].event) {
      const mins = minutesBetween(msgs[idx - 1].at, m.at)
      if (mins != null && mins >= 0) elapsed = elapsedLabel(mins)
    }
    const mTier: Tier = m.outbound ? 'me' : (m.from.email.toLowerCase().endsWith('@hauliers.co.uk') ? 'driver' : (cust ? senderInfo(thread).tier : 'grey'))
    return (
      <div
        key={m.id}
        id={'nx-msg-' + m.id}
        data-mid={m.id}
        className={'nx-msg' + (older ? ' older' : '') + (older && inview.has(m.id) ? ' inview' : '') + (expanded ? '' : ' collapsed') + (flashMsg === m.id ? ' flash' : '')}
      >
        <div className="nx-mnode">
          <span className={'nx-avatar' + (METAL_TIERS.has(mTier) ? ' nx-metal ' : ' ') + TIER_CLASS[mTier]}>{initials(m.from.name)}</span>
        </div>
        <div className="nx-mmain">
          <div className="nx-mhead-btn" onClick={() => setExpandedMsgs((p) => (p.includes(m.id) ? p.filter((x) => x !== m.id) : [...p, m.id]))}>
            <div className="nx-mtop">
              <div style={{ position: 'relative' }}>
                <button className="nx-name-btn" onClick={(e) => { e.stopPropagation(); setOpenContact(openContact === m.id ? null : m.id) }}>{m.from.name}</button>
                {openContact === m.id && <ContactPop name={m.from.name} email={m.from.email} onClose={() => setOpenContact(null)} onCompose={openCompose} />}
              </div>
              {m.outbound && <span className="nx-ilab" style={{ background: 'var(--nx-blue-tint)', color: 'var(--nx-blue)' }}>You</span>}
              <span className="nx-mto">To: {recipientsFor(m)}</span>
              <span className="nx-mt">
                <span className="nx-tt" title={m.at}>{shortWhen(m.at)}</span>
                {elapsed && <span className="nx-elapsed"><Icon name="clock" size={9} /> {elapsed}</span>}
              </span>
            </div>
            <div className="nx-msnip">{(m.body || '').replace(/\s+/g, ' ').slice(0, 120)}</div>
          </div>
          <div className="nx-mfull">
            <div className="nx-mbody"><RefText text={m.body} /></div>
            {!!m.attachments?.length && (
              <div className="nx-atts">
                {m.attachments.map((a) => (
                  <span key={a.id} className="nx-att"><span className="ico2">PDF</span><span className="fnm">{a.name}</span></span>
                ))}
              </div>
            )}
          </div>
        </div>
        {idx > 0 && (
          <button className="nx-split" title="Split this and later messages into a new conversation" onClick={() => splitThread(thread.id, m.id)}>⎋</button>
        )}
      </div>
    )
  }

  const readerCol = (
    <div className="ep-readcol">
      {composeNew ? (
        <div className="nx-newmail">
          <div className="nx-phead">
            <Icon name="edit" size={15} /> <span className="nx-t">New email</span>
            <span className="nx-sp" />
            <button className="nx-abtn" title="Discard" onClick={() => setComposeNew(null)}><Icon name="close" size={16} /></button>
          </div>
          <div className="nx-nm-fields">
            <label className="nx-nm-row"><span>To</span><input autoFocus placeholder="name@company.com" value={composeNew.to} onChange={(e) => setComposeNew({ ...composeNew, to: e.target.value })} /></label>
            <label className="nx-nm-row"><span>Subject</span><input placeholder="Subject" value={composeNew.subject} onChange={(e) => setComposeNew({ ...composeNew, subject: e.target.value })} /></label>
          </div>
          <textarea className="nx-nm-body" placeholder="Write your message…" value={composeNew.body} onChange={(e) => setComposeNew({ ...composeNew, body: e.target.value })} />
          <div className="nx-ctoolbar">
            {templates.length > 0 && (
              <select className="nx-tpl-pick" value="" onChange={(e) => { const t = templates.find((x) => x.id === e.target.value); if (t) setComposeNew((p) => p && ({ ...p, body: p.body ? p.body + '\n' + t.body : t.body })) }}>
                <option value="">Templates…</option>
                {templates.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            )}
            <span className="nx-sp" />
            <button className="nx-send keep" onClick={() => setComposeNew(null)}>Discard</button>
            <button className="nx-send" disabled={!composeNew.to.trim() || !composeNew.body.trim()} onClick={() => { composeEmail(composeNew.to.trim(), composeNew.subject, composeNew.body); setComposeNew(null) }}>
              <Icon name="mail" size={14} /> Send
            </button>
          </div>
        </div>
      ) : thread && si ? (
        <div className="nx-reader">
          {/* peek bar (email-reader-inbox.html #4) */}
          <div className={'nx-peek' + (peekOpen ? ' on' : '')}>
            <div className="nx-peekhd" onClick={() => setPeekOpen((o) => !o)}>
              <span className="pk-c">Inbox</span>
              <span className="pk-n">{peekThreads.length} more conversation{peekThreads.length === 1 ? '' : 's'}</span>
              <span className="pk-ch"><Icon name="chevron-down" size={14} /></span>
            </div>
            {peekOpen && (
              <div className="nx-peekbody">
                {peekThreads.map((t) => {
                  const psi = senderInfo(t)
                  const last = t.msgs[t.msgs.length - 1]
                  return (
                    <button key={t.id} className="nx-irow" onClick={() => openThread(t.id)}>
                      <span className={'nx-avatar' + (METAL_TIERS.has(psi.tier) ? ' nx-metal ' : ' ') + TIER_CLASS[psi.tier]}>
                        {psi.company === psi.contact ? initials(psi.contact) : companyInitials(psi.company)}
                      </span>
                      <span className="nx-iw">
                        <span className="nx-ico">{psi.company}</span>
                        <span className="nx-isub">{t.subject}</span>
                      </span>
                      <span className="nx-it">{relTime(last.at)}</span>
                    </button>
                  )
                })}
                {!peekThreads.length && <div className="nx-empty">Inbox clear.</div>}
              </div>
            )}
          </div>

          {/* banners */}
          {thread.reminderDue && (
            <div className="nx-banner reminder">⏰ Reminder due.<span className="nx-sp" /><button className="nx-banner-link" onClick={() => clearReminder(thread.id)}>Dismiss</button></div>
          )}
          {thread.status === 'Awaiting Customer' && thread.chaseDueAt != null && (
            <div className={'nx-banner ' + (thread.chaseDueAt - Date.now() < 0 ? 'amber' : '')}>
              ⏳ Awaiting customer{thread.chaseDueAt - Date.now() < 0 ? ' — chase overdue' : ''}.
              <span className="nx-sp" />
              <button className="nx-banner-link" onClick={() => simulateInbound(thread.id)}>Simulate customer reply</button>
            </div>
          )}

          {/* envelope header (email-reader-v2.html) */}
          <div className="nx-rhead">
            <div className="nx-r1">
              <button className="nx-back" title="Back to inbox" onClick={backToList}><Icon name="chevron-up" size={18} /></button>
              <span className={'nx-avatar' + (METAL_TIERS.has(si.tier) ? ' nx-metal ' : ' ') + TIER_CLASS[si.tier]}>
                {si.company === si.contact ? initials(si.contact) : companyInitials(si.company)}
              </span>
              <span className="nx-cid">
                <div className="nx-cco">{si.company}</div>
                <div className="nx-cct">{si.contact ? `${si.contact} · ` : ''}{si.email}</div>
              </span>
              <span className="nx-cstat">
                <select className="nx-assign-sel" value={thread.assigneeId ?? ''} onChange={(e) => assignThread(thread.id, e.target.value || null)} title="Assigned to">
                  <option value="">Unassigned</option>
                  {users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
                </select>
                <span className="nx-sla">{thread.status}</span>
              </span>
            </div>
            <h2 className="nx-csubj">{thread.subject}</h2>
            <div className="nx-cbar">
              <span className="nx-tags">
                {thread.tags.map((x) => <span key={x} className="nx-tag">{x}<i onClick={() => removeTag(thread.id, x)}>×</i></span>)}
                {addingTag ? (
                  <input className="nx-tagadd-input" autoFocus placeholder="tag…" value={tagDraft}
                    onChange={(e) => setTagDraft(e.target.value)}
                    onBlur={() => setAddingTag(false)}
                    onKeyDown={(e) => { if (e.key === 'Enter' && tagDraft.trim()) { addTag(thread.id, tagDraft.trim()); setTagDraft(''); setAddingTag(false) } }} />
                ) : (
                  <button className="nx-tagadd" onClick={() => setAddingTag(true)}>+ Tag</button>
                )}
              </span>
              <span className="nx-sp" />
              <button className={'nx-abtn' + (thread.pinned ? ' on' : '')} title={thread.pinned ? 'Unpin' : 'Pin'} onClick={() => toggleFlag(thread.id, 'pinned')}><Icon name="pin" size={16} /></button>
              <div className="nx-menu-wrap">
                <button className="nx-abtn" title="Snooze / remind" onClick={() => { setMore(false); setMacroOpen(false); setPeekMenu((p) => (p === 'snooze' ? null : 'snooze')) }}><Icon name="clock" size={16} /></button>
                {peekMenu === 'snooze' && (
                  <>
                    <div className="nx-pop-scrim" onClick={() => setPeekMenu(null)} />
                    <div className="nx-menu">
                      <div className="nx-menu-sec">Snooze</div>
                      {SNOOZE_OPTIONS.map(([label, ms]) => <button key={'s' + label} onClick={() => { snooze(thread.id, ms, label); setPeekMenu(null) }}>💤 {label}</button>)}
                      <div className="nx-menu-sec">Remind</div>
                      {SNOOZE_OPTIONS.map(([label, ms]) => <button key={'r' + label} onClick={() => { remind(thread.id, ms, label); setPeekMenu(null) }}>⏰ {label}</button>)}
                    </div>
                  </>
                )}
              </div>
              <button className={'nx-abtn' + (thread.following ? ' on' : '')} title={thread.following ? 'Unfollow' : 'Follow'} onClick={() => toggleFlag(thread.id, 'following')}><Icon name="flag" size={16} /></button>
              <span className="nx-vsep" />
              <div className="nx-menu-wrap">
                <button className="nx-macro" onClick={() => { setMacroOpen((o) => !o); setPeekMenu(null) }} title="Run a macro"><Icon name="cog" size={13} /> Macros</button>
                {macroOpen && (
                  <>
                    <div className="nx-pop-scrim" onClick={() => setMacroOpen(false)} />
                    <div className="nx-menu">
                      <div className="nx-menu-sec">Run macro</div>
                      {macros.map((m) => <button key={m.id} onClick={() => { runMacro(m.id, thread.id); setMacroOpen(false) }}>{m.icon ?? '⚡'} {m.name}</button>)}
                      {!macros.length && <div className="nx-menu-sec">None — add some in Email Rules</div>}
                    </div>
                  </>
                )}
              </div>
              {thread.status === 'Resolved'
                ? <button className="nx-reopen" title={`Resolved · ${thread.resolutionReason ?? ''}`} onClick={() => reopenThread(thread.id)}>Re-open</button>
                : <button className="nx-resolve" title="Resolve this email" onClick={tryResolve}><Icon name="check" size={13} /> Resolve</button>}
              <div className="nx-menu-wrap">
                <button className="nx-abtn" onClick={() => { setMore((o) => !o); setPeekMenu(null); setMacroOpen(false) }} title="More"><Icon name="more" size={16} /></button>
                {more && (
                  <>
                    <div className="nx-pop-scrim" onClick={() => setMore(false)} />
                    <div className="nx-menu">
                      <button onClick={() => { createJobFromEmail(thread); setMore(false) }}>+ Create job</button>
                      <button onClick={() => { markUnread(thread.id); setMore(false) }}>Mark unread</button>
                      <button onClick={() => { toggleFlag(thread.id, 'muted'); setMore(false) }}>{thread.muted ? 'Unmute' : 'Mute'}</button>
                      <div className="nx-menu-sec">Merge into…</div>
                      {threads.filter((t) => t.id !== thread.id && !t.snoozedUntil).slice(0, 4).map((t) => (
                        <button key={t.id} onClick={() => { mergeThreads(thread.id, t.id); setMore(false) }}>{t.subject.slice(0, 28)}</button>
                      ))}
                      <div className="nx-menu-sec">Remove</div>
                      <button className="danger" onClick={() => { tryDelete(); setMore(false) }}>🗑 Delete (needs resolution)</button>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>

          <JobStrip thread={thread} onInsertEta={insertEta} />

          {/* thread scroll — opens at newest (email-reader-peek.html #2) */}
          <div className="nx-rscroll" ref={scrollRef}>
            <div className="nx-threadbar">
              Conversation
              <button className="exall" onClick={() => setExpandAll((o) => !o)}>{expandAll ? 'Collapse older' : 'Expand all'}</button>
            </div>
            {/* previous communication — grouped in a greyed box; scroll up inside it for older mail */}
            {historyMsgs.length > 0 && (
              <div className="nx-history" ref={historyRef}>
                {historyMsgs.map((m) => renderMsg(m, msgs.indexOf(m)))}
              </div>
            )}

            {/* the email we're working on — a clean white container with the reply controls */}
            <div className="nx-current">
              {currentMsgs.map((m) => renderMsg(m, msgs.indexOf(m)))}

              {/* shared live draft (a colleague drafting) — take it over to edit + send */}
              {thread.draftPresence && (
                <div className="nx-msg internal">
                  <div className="nx-mnode"><span className="nx-avatar nx-pp">{initials(thread.draftPresence.by)}</span></div>
                  <div className="nx-mmain">
                    <div className="nx-mtop">
                      <span className="nx-mn">{thread.draftPresence.by}</span>
                      <span className="nx-ilab">Draft</span>
                      <span className="nx-sp" />
                      <button className="nx-name-btn" onClick={() => { const d = thread.draftPresence!; startCompose('reply'); setDraft(d.body); clearDraftPresence(thread.id) }}>Take over</button>
                    </div>
                    <div className="nx-mbody" style={{ marginTop: 6 }}>{thread.draftPresence.body}</div>
                  </div>
                </div>
              )}

              {replyOpen ? (
                /* the composer only unfolds once a mode is picked — then we show who's replying */
                <div className="nx-msg nx-replybox open">
                  <div className="nx-mnode"><span className="nx-avatar me">{initials(users.find((u) => u.id === currentUserId)?.name ?? 'You')}</span></div>
                  <div className="nx-mmain">
                    <div className="nx-rb-head">
                      <span className="nx-mn">You</span>
                      <span className="nx-rb-tabs">
                        {([['reply', 'Reply', 'reply'], ['replyall', 'Reply all', 'reply-all'], ['forward', 'Forward', 'forward']] as const).map(([k, label, icon]) => (
                          <button key={k} className={'nx-rb-tab' + (tab === k ? ' on' : '')} title={label} aria-label={label} onClick={() => startCompose(k)}>
                            <Icon name={icon} size={17} />
                          </button>
                        ))}
                      </span>
                    </div>
                    <div className="nx-rb-to"><span>To</span><input value={composeTo} placeholder="recipients…" onChange={(e) => setComposeTo(e.target.value)} /></div>
                    <textarea className="nx-rb-text" ref={composeRef} placeholder="Write your reply…" value={draft} onChange={(e) => setDraft(e.target.value)} />
                  </div>
                </div>
              ) : (
                /* nothing but the reply arrows until one is clicked (no name shown yet) */
                <div className="nx-replybar">
                  {([['reply', 'Reply', 'reply'], ['replyall', 'Reply all', 'reply-all'], ['forward', 'Forward', 'forward']] as const).map(([k, label, icon]) => (
                    <button key={k} className="nx-rb-tab" title={label} aria-label={label} onClick={() => startCompose(k)}>
                      <Icon name={icon} size={17} />
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* internal comments — click one to jump to the email it was left on */}
            {thread.comments.length > 0 && (
              <div className="nx-comments">
                {[...thread.comments].sort((a, b) => atKey(a.at).localeCompare(atKey(b.at))).map((c) => (
                  <button key={c.id} className="nx-cnote" onClick={() => goToComment(c)} title="Jump to the email this was left on">
                    <span className="nx-cnote-head"><b>{c.by}</b><span className="nx-cnote-time">{c.at}</span></span>
                    <span className="nx-cnote-body">{c.text}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* compact send bar — the writing happens up in the thread */}
          <div className="nx-composer nx-sendbar">
            <div className="nx-expect">
              <label className="nx-expect-tog">
                <input type="checkbox" checked={expecting} onChange={(e) => setExpect(e.target.checked)} />
                Expecting a response
              </label>
              {expecting && (
                <>
                  <span className="nx-expect-lbl">chase in</span>
                  {[10, 20, 30].map((n) => (
                    <button key={n} className={'nx-expect-preset' + (expectAmount === n ? ' on' : '')} onClick={() => setExpectAmount(n)}>{n}</button>
                  ))}
                  <input type="number" min={1} className="nx-expect-num" value={expectAmount} onChange={(e) => setExpectAmount(Math.max(1, Math.round(+e.target.value) || 1))} />
                  <button className="nx-unit" title="Switch minutes / hours" onClick={() => setExpectUnit((u) => (u === 'min' ? 'hr' : 'min'))}>{expectUnit}</button>
                </>
              )}
              <span className="nx-sp" />
              {templates.length > 0 && (
                <select className="nx-tpl-pick" value="" title="Insert a template" onChange={(e) => { insertTemplate(e.target.value); e.currentTarget.value = '' }}>
                  <option value="">Templates…</option>
                  {templates.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
              )}
              <button className="nx-cicon" title="Attach (mock)"><Icon name="file" size={16} /></button>
              <button className="nx-cicon" title="Create job from this email" onClick={() => createJobFromEmail(thread)}><Icon name="plus" size={16} /></button>
            </div>
            <div className="nx-sendrow">
              <button className="nx-send keep" disabled={!draft.trim()} onClick={() => send('keep')} title="Send and keep it in your queue">Send &amp; Keep</button>
              <button className="nx-send" disabled={!draft.trim()} onClick={() => send('resolve')} title={expecting ? 'Send — will wait on the customer' : 'Send and resolve'}>
                <Icon name="mail" size={14} /> {expecting ? 'Send & Await' : 'Send & Resolve'}
              </button>
            </div>
          </div>

          {/* always-on internal-comment quick bar */}
          <div className="nx-cbar">
            <input
              className="nx-cbar-input"
              placeholder="Add internal comment — visible to teammates…"
              value={commentDraft}
              onChange={(e) => setCommentDraft(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey && commentDraft.trim()) { e.preventDefault(); addComment(thread.id, commentDraft.trim()); setCommentDraft('') } }}
            />
            <button className="nx-cbar-send" disabled={!commentDraft.trim()} title="Add comment (Enter)" onClick={() => { if (commentDraft.trim()) { addComment(thread.id, commentDraft.trim()); setCommentDraft('') } }}>
              <Icon name="check" size={15} />
            </button>
          </div>
        </div>
      ) : (
        <div className="nx-empty">Select an email.</div>
      )}
    </div>
  )

  return (
    <aside className="email-panel" ref={panelRef}>
      <div className={'ep-body' + (panelState === 'full' ? ' has-thread' : '')}>
        {panelState === 'full' ? readerCol : listCol}
      </div>
    </aside>
  )
}

/** Contact popover — shows the address and, if it maps to a saved contact, their details. */
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
      <div className="nx-cpop-scrim" onClick={onClose} />
      <div className="nx-cpop" onClick={(ev) => ev.stopPropagation()}>
        <div className="nx-cpop-h">{contact?.name ?? name}{company && <span className="sub">{company}</span>}</div>
        <button className="nx-cpop-row" onClick={() => { onCompose(email); onClose() }} title="New email to this address">
          <Icon name="mail" size={14} /> <span>{email}</span>
          <i className="copy" onClick={(ev) => { ev.stopPropagation(); copy(email) }} title="Copy">⧉</i>
        </button>
        {contact?.phone && (
          <a className="nx-cpop-row" href={`tel:${contact.phone}`} title="Call">
            <Icon name="phone" size={14} /> <span>{contact.phone}</span>
            <i className="copy" onClick={(ev) => { ev.preventDefault(); ev.stopPropagation(); copy(contact!.phone!) }} title="Copy">⧉</i>
          </a>
        )}
        {company && (
          <button className="nx-cpop-row" onClick={() => copy(company)} title="Copy">
            <Icon name="building" size={14} /> <span>{company}</span>
          </button>
        )}
        {!contact && <div className="nx-cpop-note">Not a saved contact — address only. Click the email to write to them.</div>}
      </div>
    </>
  )
}

/** Email body text with job / customer refs highlighted as clickable chips. */
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
          <button key={i} className="nx-js-ref" title={`Open ${job.ref}`} onClick={() => openJob(job)}>{part}</button>
        ) : (
          <span key={i}>{part}</span>
        )
      })}
    </>
  )
}

function openJob(job: SavedJob) {
  useBookingStore.getState().loadSnapshot(job.snapshot)
  useViewStore.getState().openWizard(job.id)
}

/** Port of the old create-job-from-email flow: prefill a booking from the thread. */
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
    <div className="nx-jobwrap">
      <div className="nx-jobstrip">
        {account && <span className="nx-js-acct"><Icon name="building" size={13} /> {account.displayName || account.companyName} <i>· {accountJobs} job{accountJobs === 1 ? '' : 's'}</i></span>}
        {detected && (
          <>
            <button className="nx-js-ref" onClick={() => openJob(detected)}>{detected.ref}</button>
            {detected.progress && <span className="nx-chip nx-c-live">{detected.progress}</span>}
            <span className="nx-js-eta">ETA {detected.collectEta || '—'} / {detected.deliverEta || '—'}</span>
          </>
        )}
        {detected && (
          <button className="nx-js-toggle" onClick={() => setOpen((o) => !o)} title="Job details & actions">{open ? '▴' : '▾'}</button>
        )}
      </div>
      {open && detected && (
        <div className="nx-job">
          <div className="nx-job-h">
            <span>{detected.route} · {detected.vehicle || '—'} · {detected.supplierName || 'Unassigned'}</span>
            <span className="nx-sp" />
            {persisted
              ? <button className="nx-job-link" onClick={() => linkJob(thread.id, null)}>Linked ✓</button>
              : <button className="nx-job-link" onClick={() => linkJob(thread.id, detected.ref)}>Link</button>}
          </div>
          <div className="nx-job-grid">
            <span>Coll booked</span><b>{detected.collectAt || '—'}</b>
            <span>Del booked</span><b>{detected.deliverAt || '—'}</b>
          </div>
          <div className="nx-job-actions">
            <select value={detected.progress || ''} onChange={(e) => setProgress(detected.id, e.target.value)} title="Update job status">
              <option value="">Status…</option>
              {STATUSES.map((st) => <option key={st}>{st}</option>)}
            </select>
            <button className="nx-gbtn" onClick={() => onInsertEta(`Hi,\n\nUpdate on ${detected.ref}: collection ETA ${detected.collectEta || 'TBC'}, delivery ETA ${detected.deliverEta || 'TBC'}.\n\nThanks,\nCal Delivery`)}>
              Insert ETA reply
            </button>
            <span className="nx-job-note">
              <input placeholder="Add job note + Enter…" value={noteDraft} onChange={(e) => setNoteDraft(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' && noteDraft.trim()) { appendJobNote(detected.id, noteDraft.trim()); addComment(thread.id, `Note added to ${detected.ref}: ${noteDraft.trim()}`); setNoteDraft('') } }} />
            </span>
          </div>
          {thread.msgs.some((m) => m.attachments?.length) && (
            <div className="nx-job-files">
              {thread.msgs.flatMap((m) => m.attachments ?? []).map((a) => (
                <span key={a.id} className="nx-job-att">
                  📎 {a.name}
                  <button className="nx-gbtn" onClick={() => { appendJobNote(detected.id, `Attachment filed from email: ${a.name}`); addComment(thread.id, `📎 ${a.name} filed to ${detected.ref}`) }}>
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

/** Thin strip shown on the right edge when the email section is fully closed —
 * click to reopen it. */
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
