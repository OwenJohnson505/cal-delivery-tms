/**
 * Emails store — the Front-style inbox behind the right-hand email panel.
 *
 * CRM features (all mock, swappable for the real email integration):
 *  • Rules engine: keyword rules over subject+body classify every thread into a
 *    category (Urgent booking / ETA request / Driver details / General), set its
 *    priority, and can AUTO-ASSIGN it to a team member. Rules are editable in the
 *    panel's settings view and re-run on change.
 *  • Manual assignment (overrides auto-assign and is never stomped by rules).
 *  • Snooze (thread leaves the inbox, pops back unread when it wakes).
 *  • Reminders (thread flags itself when due).
 *  • Internal comments (never sent — shown amber in the timeline).
 *  • Templates/macros for replies.
 *  • Replying triggers a canned "customer" response so the back-and-forth shows.
 */
import { create } from 'zustand'
import { useUsersStore } from './usersStore.ts'

export type EmailCategory = 'Urgent booking' | 'ETA request' | 'Driver details' | 'General'

export interface EmailMsg {
  id: string
  from: { name: string; email: string }
  body: string
  at: string // dd-mm-yy HH:MM
  outbound?: boolean
}

export interface EmailComment {
  id: string
  by: string
  at: string
  text: string
}

export interface EmailThread {
  id: string
  subject: string
  msgs: EmailMsg[]
  comments: EmailComment[]
  read: boolean
  category: EmailCategory
  priority: 1 | 2 | 3 | 4
  assigneeId: string | null
  /** True once a human assigned it — rules then leave the assignee alone. */
  manuallyAssigned?: boolean
  /** Display label while snoozed (thread hidden from the inbox), else null. */
  snoozedUntil: string | null
  /** Display label for a set reminder, else null. */
  reminderAt: string | null
  reminderDue?: boolean
}

export interface EmailRule {
  id: string
  name: string
  enabled: boolean
  keywords: string[]
  category: EmailCategory
  priority: 1 | 2 | 3 | 4
  /** Auto-assign matching threads to this user ('' = don't assign). */
  assignToId: string
}

export interface EmailTemplate {
  id: string
  name: string
  body: string
}

const CANNED_REPLIES = [
  'Thanks — that works for us.',
  'Great, please book it in.',
  'Can you confirm the ETA once the driver is allocated?',
  'Perfect. PO to follow shortly.',
  'Understood — any chance of a slightly earlier collection?',
  'Thanks for the quick reply. Go ahead.',
]

function stampNow(): string {
  const d = new Date()
  const p = (n: number) => ('0' + n).slice(-2)
  return `${p(d.getDate())}-${p(d.getMonth() + 1)}-${String(d.getFullYear()).slice(-2)} ${p(d.getHours())}:${p(d.getMinutes())}`
}

const uid = () => crypto.randomUUID().slice(0, 8)

// ── seed rules (editable in settings) ──────────────────────────────────────────
function seedRules(): EmailRule[] {
  return [
    { id: 'rule-1', name: 'Urgent bookings', enabled: true, keywords: ['urgent', 'same day', 'same-day', 'asap'], category: 'Urgent booking', priority: 1, assignToId: 'USR-1004' },
    { id: 'rule-2', name: 'ETA requests', enabled: true, keywords: ['eta', 'on track', 'what time', 'running late'], category: 'ETA request', priority: 2, assignToId: 'USR-1005' },
    { id: 'rule-3', name: 'Driver details', enabled: true, keywords: ['driver', 'registration', 'reg number', 'vehicle details'], category: 'Driver details', priority: 3, assignToId: '' },
  ]
}

function seedTemplates(): EmailTemplate[] {
  return [
    { id: 'tpl-1', name: 'ETA update', body: 'Hi,\n\nQuick update — the driver is on schedule and the current ETA is [TIME]. We will confirm on arrival.\n\nThanks,\nCal Delivery' },
    { id: 'tpl-2', name: 'Booking confirmed', body: 'Hi,\n\nThat is booked in — your reference is [REF]. You will receive tracking once the driver is allocated.\n\nThanks,\nCal Delivery' },
    { id: 'tpl-3', name: 'Driver details', body: 'Hi,\n\nDriver details for your delivery:\nName: [NAME]\nVehicle reg: [REG]\nContact: via our office on 0113 555 0001.\n\nThanks,\nCal Delivery' },
  ]
}

/** First enabled rule whose keyword appears (whole-word — 'eta' must not match
 * 'details') in the subject or any inbound body. */
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
  }
}

// ── seed threads ────────────────────────────────────────────────────────────────
function seedThreads(rules: EmailRule[]): EmailThread[] {
  const base = (t: Omit<EmailThread, 'category' | 'priority' | 'assigneeId' | 'comments' | 'snoozedUntil' | 'reminderAt'>): EmailThread =>
    applyRulesTo({ ...t, comments: [], category: 'General', priority: 4, assigneeId: null, snoozedUntil: null, reminderAt: null }, rules)
  return [
    base({
      id: 'th-0', read: false, subject: 'URGENT — same-day Luton needed',
      msgs: [{ id: uid(), from: { name: 'Sarah Doyle', email: 'sarah@meridianfoods.com' }, at: '11-06-26 10:02',
        body: 'Hi — urgent one, sorry. We need a Luton TODAY, collection M15 4FN before 13:00, delivery L7 9PG. Can you help?\n\nSarah (Meridian)' }],
    }),
    base({
      id: 'th-1', read: false, subject: 'Re: BK-100482 — delivery today',
      msgs: [{ id: uid(), from: { name: 'Sarah Doyle', email: 's.doyle@brightway.co.uk' }, at: '11-06-26 08:12',
        body: 'Morning,\n\nQuick check on BK-100482 (our ref PO-7781) — is the 14:15 delivery into WA2 still on track? Site closes at 16:00 today.\n\nThanks,\nSarah' }],
    }),
    base({
      id: 'th-2', read: false, subject: '18t needed Friday — LS9 to Bradford',
      msgs: [{ id: uid(), from: { name: 'James Hill', email: 'j.hill@brightway.co.uk' }, at: '11-06-26 09:47',
        body: 'Hi team,\n\nWe need an 18t on Friday. Collection from our depot LS9 0PX, delivering to the Bradford store BD1 2AB. Curtain side if possible, tail lift not needed.\n\nRef will be PO-9920.\n\nJames' }],
    }),
    base({
      id: 'th-3', read: true, subject: 'Driver details for BK-100479',
      msgs: [{ id: uid(), from: { name: 'Priya Shah', email: 'priya@orbitretail.com' }, at: '11-06-26 07:55',
        body: 'Morning — site security needs the driver name and vehicle registration for BK-100479 before arrival. Could you send the driver details over?\n\nPriya' }],
    }),
    base({
      id: 'th-4', read: true, subject: 'Re: QU-100501',
      msgs: [
        { id: uid(), from: { name: 'Priya Shah', email: 'priya@orbitretail.com' }, at: '10-06-26 11:05',
          body: 'Hi,\n\nFollowing up on quote QU-100501 — if you can hold that price we will confirm this week under ORB-90.\n\nPriya' },
        { id: uid(), from: { name: 'Sarah Doyle', email: 'bookings@cal.delivery' }, at: '10-06-26 11:40', outbound: true,
          body: 'Hi Priya,\n\nNo problem — QU-100501 is held until Friday. Just reply with the go-ahead and we will book it in.\n\nSarah' },
      ],
    }),
    base({
      id: 'th-5', read: true, subject: 'Pallet rates enquiry',
      msgs: [{ id: uid(), from: { name: 'Gary Mills', email: 'gary@millswholesale.example' }, at: '09-06-26 14:20',
        body: 'Hi, do you do ad-hoc pallet work out of Leeds? Looking for a price list. Cheers, Gary' }],
    }),
  ]
}

interface EmailsState {
  panelOpen: boolean
  threads: EmailThread[]
  selectedId: string | null
  rules: EmailRule[]
  templates: EmailTemplate[]

  togglePanel(): void
  selectThread(id: string): void
  reply(threadId: string, body: string): void
  addComment(threadId: string, text: string): void
  /** Manual assignment — sticks even when rules re-run. null = unassign. */
  assign(threadId: string, userId: string | null): void
  /** Snooze for ms; the thread leaves the inbox and pops back unread. */
  snooze(threadId: string, ms: number, label: string): void
  unsnooze(threadId: string): void
  /** Set a reminder for ms; flags the thread when due. */
  remind(threadId: string, ms: number, label: string): void
  clearReminder(threadId: string): void

  addRule(rule: Omit<EmailRule, 'id'>): void
  updateRule(id: string, patch: Partial<Omit<EmailRule, 'id'>>): void
  deleteRule(id: string): void
  addTemplate(name: string, body: string): void
  deleteTemplate(id: string): void
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
  return {
    panelOpen: true,
    threads: seedThreads(initialRules),
    selectedId: 'th-0',
    rules: initialRules,
    templates: seedTemplates(),

    togglePanel: () => set((s) => ({ panelOpen: !s.panelOpen })),

    selectThread: (id) =>
      set((s) => ({ selectedId: id, threads: patchThread(s.threads, id, { read: true }) })),

    reply: (threadId, body) => {
      set((s) => ({
        threads: s.threads.map((t) =>
          t.id === threadId
            ? { ...t, msgs: [...t.msgs, { id: uid(), from: { name: me(), email: 'bookings@cal.delivery' }, body, at: stampNow(), outbound: true }] }
            : t,
        ),
      }))
      const sender = get().threads.find((t) => t.id === threadId)?.msgs.find((m) => !m.outbound)?.from
      window.setTimeout(() => {
        const canned = CANNED_REPLIES[Math.floor(Math.random() * CANNED_REPLIES.length)]
        set((s) => ({
          threads: s.threads.map((t) =>
            t.id === threadId
              ? { ...t, msgs: [...t.msgs, { id: uid(), from: sender ?? { name: 'Customer', email: 'customer@example.com' }, body: canned, at: stampNow() }] }
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

    snooze: (threadId, ms, label) => {
      set((s) => ({ threads: patchThread(s.threads, threadId, { snoozedUntil: label }), selectedId: s.selectedId === threadId ? null : s.selectedId }))
      window.setTimeout(() => {
        set((s) => ({ threads: patchThread(s.threads, threadId, { snoozedUntil: null, read: false }) }))
      }, ms)
    },
    unsnooze: (threadId) => set((s) => ({ threads: patchThread(s.threads, threadId, { snoozedUntil: null }) })),

    remind: (threadId, ms, label) => {
      set((s) => ({ threads: patchThread(s.threads, threadId, { reminderAt: label, reminderDue: false }) }))
      window.setTimeout(() => {
        set((s) => ({ threads: patchThread(s.threads, threadId, { reminderDue: true, read: false }) }))
      }, ms)
    },
    clearReminder: (threadId) => set((s) => ({ threads: patchThread(s.threads, threadId, { reminderAt: null, reminderDue: false }) })),

    addRule: (rule) => { set((s) => ({ rules: [...s.rules, { ...rule, id: `rule-${uid()}` }] })); reapply() },
    updateRule: (id, patch) => { set((s) => ({ rules: s.rules.map((r) => (r.id === id ? { ...r, ...patch } : r)) })); reapply() },
    deleteRule: (id) => { set((s) => ({ rules: s.rules.filter((r) => r.id !== id) })); reapply() },

    addTemplate: (name, body) => set((s) => ({ templates: [...s.templates, { id: `tpl-${uid()}`, name, body }] })),
    deleteTemplate: (id) => set((s) => ({ templates: s.templates.filter((t) => t.id !== id) })),
  }
})
