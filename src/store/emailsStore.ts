/**
 * Emails store — the Front-style inbox behind the right-hand email panel.
 * Modelled loosely on the MS Graph schema (conversationId, mailbox, participants) so
 * the real integration can swap in; everything here is dummy data.
 *
 * CRM features:
 *  • Unified multi-mailbox inbox (bookings@ / accounts@ / personal), filterable.
 *  • Rules engine: whole-word keyword rules classify threads (category + priority),
 *    auto-assign and auto-tag; editable in settings, re-run on change.
 *  • Triage lanes (Open → In progress → Waiting → Done), per-thread.
 *  • Manual assignment (sticks — rules never override it), pin / mute / follow,
 *    read/unread, conversation tags.
 *  • Snooze (pops back unread), reminders (flag when due).
 *  • Internal comments, reply templates, split & merge conversations.
 *  • Persistent thread ↔ job link (set by create-job / linking; survives follow-ups).
 *  • Saved views (named filter sets) on top of built-in smart folders.
 *  • Presence (dummy): who else is viewing a thread right now.
 */
import { create } from 'zustand'
import { useUsersStore } from './usersStore.ts'

export type EmailCategory = 'Urgent booking' | 'ETA request' | 'Driver details' | 'General'
export type Lane = 'Open' | 'In progress' | 'Waiting' | 'Done'
export const LANES: Lane[] = ['Open', 'In progress', 'Waiting', 'Done']

export interface EmailAttachment { id: string; name: string }

export interface EmailMsg {
  id: string
  from: { name: string; email: string }
  body: string
  at: string // dd-mm-yy HH:MM
  outbound?: boolean
  attachments?: EmailAttachment[]
}

export interface EmailComment {
  id: string
  by: string
  at: string
  text: string
}

export interface EmailThread {
  id: string
  /** Graph-style conversation id (threading key for the real integration). */
  conversationId: string
  /** Which of our mailboxes this landed in. */
  mailbox: string
  participants: string[]
  subject: string
  msgs: EmailMsg[]
  comments: EmailComment[]
  read: boolean
  category: EmailCategory
  priority: 1 | 2 | 3 | 4
  lane: Lane
  tags: string[]
  assigneeId: string | null
  manuallyAssigned?: boolean
  pinned?: boolean
  muted?: boolean
  following?: boolean
  snoozedUntil: string | null
  reminderAt: string | null
  reminderDue?: boolean
  /** Persistent thread ↔ job link (job ref). */
  linkedJobRef: string | null
  /** Presence (dummy): a colleague currently viewing this thread. */
  viewingBy?: string | null
}

export interface EmailRule {
  id: string
  name: string
  enabled: boolean
  keywords: string[]
  category: EmailCategory
  priority: 1 | 2 | 3 | 4
  assignToId: string
  /** Auto-applied conversation tags. */
  tags?: string[]
}

export interface EmailTemplate { id: string; name: string; body: string }

/** A saved view = a named filter set over the inbox. */
export interface SavedEmailView {
  id: string
  name: string
  q: { mailbox?: string; lane?: Lane | 'all'; mine?: boolean; text?: string }
}

export const MAILBOXES = ['bookings@cal.delivery', 'accounts@cal.delivery', 'sarah@cal.delivery']

const CANNED_REPLIES = [
  'Thanks — that works for us.',
  'Great, please book it in.',
  'Can you confirm the ETA once the driver is allocated?',
  'Perfect. PO to follow shortly.',
  'Understood — any chance of a slightly earlier collection?',
  'Thanks for the quick reply. Go ahead.',
]

const p2 = (n: number) => ('0' + n).slice(-2)
function fmtAt(d: Date): string {
  return `${p2(d.getDate())}-${p2(d.getMonth() + 1)}-${String(d.getFullYear()).slice(-2)} ${p2(d.getHours())}:${p2(d.getMinutes())}`
}
function stampNow(): string {
  return fmtAt(new Date())
}
// Seeds are timestamped relative to load time so the relative ("12m ago") display
// stays believable on any clock — replies use stampNow(), so it all lines up.
const SEED_NOW = Date.now()
const minsAgo = (n: number): string => fmtAt(new Date(SEED_NOW - n * 60_000))

/** Relative arrival time for SLA visibility: 'now' / '12m ago' / '3h ago' / '2d ago'. */
export function relTime(at: string): string {
  const m = /^(\d{2})-(\d{2})-(\d{2}) (\d{2}):(\d{2})/.exec(at)
  if (!m) return at
  const d = new Date(2000 + +m[3], +m[2] - 1, +m[1], +m[4], +m[5])
  const mins = Math.floor(Math.max(0, Date.now() - d.getTime()) / 60_000)
  if (mins < 1) return 'now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}

const uid = () => crypto.randomUUID().slice(0, 8)

function seedRules(): EmailRule[] {
  return [
    { id: 'rule-1', name: 'Urgent bookings', enabled: true, keywords: ['urgent', 'same day', 'same-day', 'asap'], category: 'Urgent booking', priority: 1, assignToId: 'USR-1004', tags: ['priority'] },
    { id: 'rule-2', name: 'ETA requests', enabled: true, keywords: ['eta', 'on track', 'what time', 'running late'], category: 'ETA request', priority: 2, assignToId: 'USR-1005' },
    { id: 'rule-3', name: 'Driver details', enabled: true, keywords: ['driver', 'registration', 'reg number', 'vehicle details'], category: 'Driver details', priority: 3, assignToId: '', tags: ['driver-info'] },
  ]
}

function seedTemplates(): EmailTemplate[] {
  return [
    { id: 'tpl-1', name: 'ETA update', body: 'Hi,\n\nQuick update — the driver is on schedule and the current ETA is [TIME]. We will confirm on arrival.\n\nThanks,\nCal Delivery' },
    { id: 'tpl-2', name: 'Booking confirmed', body: 'Hi,\n\nThat is booked in — your reference is [REF]. You will receive tracking once the driver is allocated.\n\nThanks,\nCal Delivery' },
    { id: 'tpl-3', name: 'Driver details', body: 'Hi,\n\nDriver details for your delivery:\nName: [NAME]\nVehicle reg: [REG]\nContact: via our office on 0113 555 0001.\n\nThanks,\nCal Delivery' },
  ]
}

/** First enabled rule whose keyword appears (whole-word) in subject or inbound bodies. */
function classify(subject: string, msgs: EmailMsg[], rules: EmailRule[]): EmailRule | null {
  const text = `${subject} ${msgs.filter((m) => !m.outbound).map((m) => m.body).join(' ')}`
  const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return (
    rules.find((r) =>
      r.enabled && r.keywords.some((k) => k.trim() && new RegExp(`\\b${esc(k.trim())}\\b`, 'i').test(text)),
    ) ?? null
  )
}

function applyRulesTo(t: EmailThread, rules: EmailRule[]): EmailThread {
  const rule = classify(t.subject, t.msgs, rules)
  return {
    ...t,
    category: rule?.category ?? 'General',
    priority: rule?.priority ?? 4,
    assigneeId: t.manuallyAssigned ? t.assigneeId : (rule?.assignToId || t.assigneeId),
    tags: [...new Set([...t.tags, ...(rule?.tags ?? [])])],
  }
}

// ── seed threads ────────────────────────────────────────────────────────────────
type ThreadSeed = Omit<EmailThread, 'category' | 'priority' | 'assigneeId' | 'comments' | 'snoozedUntil' | 'reminderAt' | 'conversationId' | 'participants' | 'tags' | 'lane' | 'linkedJobRef'> &
  Partial<Pick<EmailThread, 'tags' | 'lane' | 'linkedJobRef' | 'viewingBy'>>

function seedThreads(rules: EmailRule[]): EmailThread[] {
  const base = (t: ThreadSeed): EmailThread =>
    applyRulesTo(
      {
        comments: [], category: 'General', priority: 4, assigneeId: null,
        snoozedUntil: null, reminderAt: null,
        conversationId: `AAQk-${t.id}`,
        participants: [...new Set(t.msgs.map((m) => m.from.email))],
        tags: t.tags ?? [], lane: t.lane ?? 'Open', linkedJobRef: t.linkedJobRef ?? null,
        ...t,
      },
      rules,
    )
  return [
    base({
      id: 'th-0', read: false, mailbox: 'bookings@cal.delivery', subject: 'URGENT — same-day Luton needed',
      msgs: [{ id: uid(), from: { name: 'Sarah Doyle', email: 'sarah@meridianfoods.com' }, at: minsAgo(8),
        body: 'Hi — urgent one, sorry. We need a Luton TODAY, collection M15 4FN before 13:00, delivery L7 9PG. Can you help?\n\nSarah (Meridian)' }],
    }),
    base({
      id: 'th-1', read: false, mailbox: 'bookings@cal.delivery', subject: 'Re: BK-100482 — delivery today', linkedJobRef: 'BK-100482', viewingBy: 'James Hill',
      msgs: [{ id: uid(), from: { name: 'Sarah Doyle', email: 's.doyle@brightway.co.uk' }, at: minsAgo(35),
        body: 'Morning,\n\nQuick check on BK-100482 (our ref PO-7781) — is the 14:15 delivery into WA2 still on track? Site closes at 16:00 today.\n\nThanks,\nSarah' }],
    }),
    base({
      id: 'th-2', read: false, mailbox: 'bookings@cal.delivery', subject: '18t needed Friday — LS9 to Bradford',
      msgs: [{ id: uid(), from: { name: 'James Hill', email: 'j.hill@brightway.co.uk' }, at: minsAgo(52),
        body: 'Hi team,\n\nWe need an 18t on Friday. Collection from our depot LS9 0PX, delivering to the Bradford store BD1 2AB. Curtain side if possible, tail lift not needed.\n\nRef will be PO-9920.\n\nJames' }],
    }),
    base({
      id: 'th-3', read: true, mailbox: 'bookings@cal.delivery', subject: 'Driver details for BK-100479', linkedJobRef: 'BK-100479',
      msgs: [{ id: uid(), from: { name: 'Priya Shah', email: 'priya@orbitretail.com' }, at: minsAgo(78),
        body: 'Morning — site security needs the driver name and vehicle registration for BK-100479 before arrival. Could you send the driver details over?\n\nPriya',
        attachments: [{ id: uid(), name: 'site-access-form.pdf' }] }],
    }),
    base({
      id: 'th-4', read: true, mailbox: 'sarah@cal.delivery', subject: 'Re: QU-100501', lane: 'Waiting',
      msgs: [
        { id: uid(), from: { name: 'Priya Shah', email: 'priya@orbitretail.com' }, at: minsAgo(320),
          body: 'Hi Sarah,\n\nCould you quote a 7.5t Leeds to Warrington for next week? Roughly 8 pallets.\n\nPriya' },
        { id: uid(), from: { name: 'Sarah Doyle', email: 'sarah@cal.delivery' }, at: minsAgo(300), outbound: true,
          body: 'Hi Priya,\n\nOf course — quote QU-100501 attached, £180 all-in. Valid for 7 days.\n\nSarah' },
        { id: uid(), from: { name: 'Priya Shah', email: 'priya@orbitretail.com' }, at: minsAgo(155),
          body: 'Hi,\n\nFollowing up on quote QU-100501 — if you can hold that price we will confirm this week under ORB-90.\n\nPriya' },
        { id: uid(), from: { name: 'Sarah Doyle', email: 'sarah@cal.delivery' }, at: minsAgo(150), outbound: true,
          body: 'Hi Priya,\n\nNo problem — QU-100501 is held until Friday. Just reply with the go-ahead and we will book it in.\n\nSarah' },
      ],
    }),
    base({
      id: 'th-5', read: true, mailbox: 'accounts@cal.delivery', subject: 'Pallet rates enquiry', lane: 'Done',
      msgs: [{ id: uid(), from: { name: 'Gary Mills', email: 'gary@millswholesale.example' }, at: minsAgo(300),
        body: 'Hi, do you do ad-hoc pallet work out of Leeds? Looking for a price list. Cheers, Gary' }],
    }),
  ]
}

/** Email section collapse level: 'full' = inbox list + reader; 'list' = inbox list
 * only (reader collapsed); 'mini' = fully closed (no email chrome — reopened from the
 * left-rail Emails button). */
export type EmailPanelState = 'full' | 'list' | 'mini'

interface EmailsState {
  panelState: EmailPanelState
  threads: EmailThread[]
  selectedId: string | null
  rules: EmailRule[]
  templates: EmailTemplate[]
  savedViews: SavedEmailView[]

  setPanelState(s: EmailPanelState): void
  selectThread(id: string): void
  reply(threadId: string, body: string): void
  addComment(threadId: string, text: string): void
  assign(threadId: string, userId: string | null): void
  setLane(threadId: string, lane: Lane): void
  toggleFlag(threadId: string, flag: 'pinned' | 'muted' | 'following'): void
  markUnread(threadId: string): void
  addTag(threadId: string, tag: string): void
  removeTag(threadId: string, tag: string): void
  linkJob(threadId: string, ref: string | null): void
  snooze(threadId: string, ms: number, label: string): void
  unsnooze(threadId: string): void
  remind(threadId: string, ms: number, label: string): void
  clearReminder(threadId: string): void
  /** Split: the given message and everything after it move to a new thread. */
  splitThread(threadId: string, msgId: string): void
  /** Merge src into dest (msgs + comments + tags), deleting src. */
  mergeThreads(srcId: string, destId: string): void
  /** Bulk apply to many threads at once. */
  bulkApply(ids: string[], action: { lane?: Lane; assigneeId?: string | null; tag?: string; snoozeMs?: number; snoozeLabel?: string }): void

  addRule(rule: Omit<EmailRule, 'id'>): void
  updateRule(id: string, patch: Partial<Omit<EmailRule, 'id'>>): void
  deleteRule(id: string): void
  addTemplate(name: string, body: string): void
  deleteTemplate(id: string): void
  addSavedView(name: string, q: SavedEmailView['q']): void
  deleteSavedView(id: string): void
}

const patchThread = (threads: EmailThread[], id: string, patch: Partial<EmailThread>) =>
  threads.map((t) => (t.id === id ? { ...t, ...patch } : t))

export const useEmailsStore = create<EmailsState>((set, get) => {
  const initialRules = seedRules()
  const reapply = () => set((s) => ({ threads: s.threads.map((t) => applyRulesTo(t, s.rules)) }))
  const me = () => {
    const us = useUsersStore.getState()
    return us.users.find((u) => u.id === us.currentUserId)?.name ?? 'Cal Delivery'
  }
  const doSnooze = (threadId: string, ms: number, label: string) => {
    set((s) => ({ threads: patchThread(s.threads, threadId, { snoozedUntil: label }), selectedId: s.selectedId === threadId ? null : s.selectedId }))
    window.setTimeout(() => {
      set((s) => ({ threads: patchThread(s.threads, threadId, { snoozedUntil: null, read: false }) }))
    }, ms)
  }
  return {
    panelState: 'mini',
    threads: seedThreads(initialRules),
    selectedId: 'th-0',
    rules: initialRules,
    templates: seedTemplates(),
    savedViews: [],

    setPanelState: (panelState) => set({ panelState }),

    selectThread: (id) =>
      set((s) => ({ selectedId: id, threads: patchThread(s.threads, id, { read: true }) })),

    reply: (threadId, body) => {
      set((s) => ({
        threads: s.threads.map((t) =>
          t.id === threadId
            ? { ...t, lane: t.lane === 'Open' ? 'Waiting' : t.lane, msgs: [...t.msgs, { id: uid(), from: { name: me(), email: 'bookings@cal.delivery' }, body, at: stampNow(), outbound: true }] }
            : t,
        ),
      }))
      const sender = get().threads.find((t) => t.id === threadId)?.msgs.find((m) => !m.outbound)?.from
      window.setTimeout(() => {
        const canned = CANNED_REPLIES[Math.floor(Math.random() * CANNED_REPLIES.length)]
        set((s) => ({
          threads: s.threads.map((t) =>
            t.id === threadId
              ? { ...t, read: false, msgs: [...t.msgs, { id: uid(), from: sender ?? { name: 'Customer', email: 'customer@example.com' }, body: canned, at: stampNow() }] }
              : t,
          ),
        }))
      }, 1800)
    },

    addComment: (threadId, text) =>
      set((s) => ({
        threads: s.threads.map((t) =>
          t.id === threadId ? { ...t, comments: [...t.comments, { id: uid(), by: me(), at: stampNow(), text }] } : t,
        ),
      })),

    assign: (threadId, userId) =>
      set((s) => ({ threads: patchThread(s.threads, threadId, { assigneeId: userId, manuallyAssigned: true }) })),

    setLane: (threadId, lane) => set((s) => ({ threads: patchThread(s.threads, threadId, { lane }) })),

    toggleFlag: (threadId, flag) =>
      set((s) => ({ threads: s.threads.map((t) => (t.id === threadId ? { ...t, [flag]: !t[flag] } : t)) })),

    markUnread: (threadId) => set((s) => ({ threads: patchThread(s.threads, threadId, { read: false }) })),

    addTag: (threadId, tag) =>
      set((s) => ({
        threads: s.threads.map((t) =>
          t.id === threadId && tag.trim() && !t.tags.includes(tag.trim()) ? { ...t, tags: [...t.tags, tag.trim()] } : t,
        ),
      })),
    removeTag: (threadId, tag) =>
      set((s) => ({ threads: s.threads.map((t) => (t.id === threadId ? { ...t, tags: t.tags.filter((x) => x !== tag) } : t)) })),

    linkJob: (threadId, ref) => set((s) => ({ threads: patchThread(s.threads, threadId, { linkedJobRef: ref }) })),

    snooze: doSnooze,
    unsnooze: (threadId) => set((s) => ({ threads: patchThread(s.threads, threadId, { snoozedUntil: null }) })),

    remind: (threadId, ms, label) => {
      set((s) => ({ threads: patchThread(s.threads, threadId, { reminderAt: label, reminderDue: false }) }))
      window.setTimeout(() => {
        set((s) => ({ threads: patchThread(s.threads, threadId, { reminderDue: true, read: false }) }))
      }, ms)
    },
    clearReminder: (threadId) => set((s) => ({ threads: patchThread(s.threads, threadId, { reminderAt: null, reminderDue: false }) })),

    splitThread: (threadId, msgId) =>
      set((s) => {
        const src = s.threads.find((t) => t.id === threadId)
        if (!src) return {}
        const ix = src.msgs.findIndex((m) => m.id === msgId)
        if (ix <= 0) return {} // can't split the first message out
        const moved = src.msgs.slice(ix)
        const newThread: EmailThread = applyRulesTo(
          {
            ...src,
            id: `th-${uid()}`,
            conversationId: `AAQk-split-${uid()}`,
            subject: `Split: ${src.subject}`,
            msgs: moved,
            comments: [],
            read: true,
            pinned: false,
            manuallyAssigned: src.manuallyAssigned,
            tags: [...src.tags],
          },
          s.rules,
        )
        return {
          threads: [
            ...s.threads.map((t) => (t.id === threadId ? { ...t, msgs: t.msgs.slice(0, ix) } : t)),
            newThread,
          ],
          selectedId: newThread.id,
        }
      }),

    mergeThreads: (srcId, destId) =>
      set((s) => {
        const src = s.threads.find((t) => t.id === srcId)
        const dest = s.threads.find((t) => t.id === destId)
        if (!src || !dest || srcId === destId) return {}
        const merged: EmailThread = {
          ...dest,
          msgs: [...dest.msgs, ...src.msgs],
          comments: [...dest.comments, ...src.comments, { id: uid(), by: me(), at: stampNow(), text: `Merged in “${src.subject}”.` }],
          tags: [...new Set([...dest.tags, ...src.tags])],
          participants: [...new Set([...dest.participants, ...src.participants])],
          linkedJobRef: dest.linkedJobRef ?? src.linkedJobRef,
        }
        return {
          threads: s.threads.filter((t) => t.id !== srcId).map((t) => (t.id === destId ? merged : t)),
          selectedId: destId,
        }
      }),

    bulkApply: (ids, action) => {
      set((s) => ({
        threads: s.threads.map((t) => {
          if (!ids.includes(t.id)) return t
          let next = { ...t }
          if (action.lane) next.lane = action.lane
          if (action.assigneeId !== undefined) { next.assigneeId = action.assigneeId; next.manuallyAssigned = true }
          if (action.tag?.trim() && !next.tags.includes(action.tag.trim())) next.tags = [...next.tags, action.tag.trim()]
          return next
        }),
      }))
      if (action.snoozeMs && action.snoozeLabel) ids.forEach((id) => doSnooze(id, action.snoozeMs!, action.snoozeLabel!))
    },

    addRule: (rule) => { set((s) => ({ rules: [...s.rules, { ...rule, id: `rule-${uid()}` }] })); reapply() },
    updateRule: (id, patch) => { set((s) => ({ rules: s.rules.map((r) => (r.id === id ? { ...r, ...patch } : r)) })); reapply() },
    deleteRule: (id) => { set((s) => ({ rules: s.rules.filter((r) => r.id !== id) })); reapply() },

    addTemplate: (name, body) => set((s) => ({ templates: [...s.templates, { id: `tpl-${uid()}`, name, body }] })),
    deleteTemplate: (id) => set((s) => ({ templates: s.templates.filter((t) => t.id !== id) })),

    addSavedView: (name, q) => set((s) => ({ savedViews: [...s.savedViews, { id: `sv-${uid()}`, name, q }] })),
    deleteSavedView: (id) => set((s) => ({ savedViews: s.savedViews.filter((v) => v.id !== id) })),
  }
})
