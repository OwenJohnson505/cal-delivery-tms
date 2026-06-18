/**
 * Automation store — the email Rules & Macros engine (Front-style WHEN/IF/THEN), extended
 * with TMS-connected triggers/conditions/actions because we're wired to the real booking
 * data. Design-reference only: the runtime evaluates the practical subset live; everything
 * else is selectable + saved as it would be for a real backend. The "AI describe" builder
 * is a mock — it pattern-matches the description and returns a structured rule + rationale.
 *   Real impl: POST/PATCH /rules; conditions/actions map to the backend catalog; AI build
 *   → Anthropic. Persistence here is localStorage.
 */
import { create } from 'zustand'
import { useEmailsStore, type EmailThread, type EmailStatus } from './emailsStore.ts'
import { useJobsStore } from './jobsStore.ts'
import { useUsersStore } from './usersStore.ts'

// ── catalogs (data-driven so the builder stays simple) ───────────────────────────
export interface Catalog { id: string; label: string; group: string; live?: boolean }

export const TRIGGERS: Catalog[] = [
  { id: 'inbound', label: 'Inbound message received', group: 'Message', live: true },
  { id: 'inbound_new', label: 'Inbound — new conversation', group: 'Message', live: true },
  { id: 'outbound_sent', label: 'Outbound reply sent', group: 'Message' },
  { id: 'status_changed', label: 'Email status changes to…', group: 'Status' },
  { id: 'assignee_changed', label: 'Assignee changes', group: 'Teammates' },
  { id: 'tag_added', label: 'Tag is added', group: 'Tags' },
  { id: 'snooze_expires', label: 'Snooze expires', group: 'Status' },
  { id: 'job_status', label: 'TMS · job status changes', group: 'TMS', live: true },
  { id: 'job_event', label: 'TMS · job event (Confirmed / Delivered / Delayed)', group: 'TMS', live: true },
  { id: 'no_reply_after', label: 'No reply sent after X min (SLA pre-warning)', group: 'TMS / Time', live: true },
  { id: 'customer_silent', label: 'Customer silent for X days', group: 'TMS / Time' },
  { id: 'duplicate', label: 'Duplicate of an open conversation', group: 'Advanced' },
]

export type Op = 'contains' | 'not_contains' | 'matches' | 'regex' | 'is' | 'is_not' | 'gt' | 'lt' | 'eq' | 'true' | 'false' | 'has' | 'none'
export const OP_LABEL: Record<Op, string> = {
  contains: 'contains', not_contains: 'does not contain', matches: 'matches (whole word)', regex: 'matches regex',
  is: 'is', is_not: 'is not', gt: '>', lt: '<', eq: '=', true: 'yes', false: 'no', has: 'has', none: 'has none',
}
export type ValueType = 'text' | 'tag' | 'user' | 'status' | 'jobstatus' | 'number' | 'none' | 'tier' | 'pickup' | 'sentiment' | 'newret' | 'mailbox' | 'template'
export interface CondField extends Catalog { ops: Op[]; valueType: ValueType }

const TEXT_OPS: Op[] = ['contains', 'not_contains', 'matches']
export const COND_FIELDS: CondField[] = [
  { id: 'body', label: 'Message body', group: 'Content', ops: [...TEXT_OPS, 'regex'], valueType: 'text' },
  { id: 'subject', label: 'Subject', group: 'Content', ops: TEXT_OPS, valueType: 'text' },
  { id: 'from', label: '“From” address', group: 'Recipient', ops: ['contains'], valueType: 'text' },
  { id: 'to', label: '“To / Cc” address', group: 'Recipient', ops: ['contains'], valueType: 'text' },
  { id: 'has_tag', label: 'Tag', group: 'Tags', ops: ['has', 'none'], valueType: 'tag' },
  { id: 'attachments', label: 'Attachments', group: 'Content', ops: ['has', 'none'], valueType: 'none' },
  { id: 'attach_count', label: 'Attachment count', group: 'Content', ops: ['gt', 'lt', 'eq'], valueType: 'number' },
  { id: 'assignee', label: 'Assignee', group: 'Assignment', ops: ['is', 'is_not'], valueType: 'user' },
  { id: 'unassigned', label: 'Is unassigned', group: 'Assignment', ops: ['true'], valueType: 'none' },
  { id: 'status', label: 'Email status', group: 'Status', ops: ['is', 'is_not'], valueType: 'status' },
  { id: 'job_status', label: 'TMS · job status', group: 'TMS', ops: ['is', 'is_not'], valueType: 'jobstatus' },
  { id: 'pickup', label: 'TMS · pickup date', group: 'TMS', ops: ['is'], valueType: 'pickup' },
  { id: 'driver_assigned', label: 'TMS · driver assigned', group: 'TMS', ops: ['true', 'false'], valueType: 'none' },
  { id: 'customer_tier', label: 'TMS · customer tier', group: 'TMS', ops: ['is'], valueType: 'tier' },
  { id: 'reply_count', label: 'Messages in thread', group: 'Advanced', ops: ['gt', 'lt', 'eq'], valueType: 'number' },
  { id: 'sentiment', label: 'Sentiment (AI)', group: 'Advanced', ops: ['is'], valueType: 'sentiment' },
  { id: 'new_customer', label: 'Customer is new / returning', group: 'Advanced', ops: ['is'], valueType: 'newret' },
]

export interface ActionDef extends Catalog { valueType: ValueType }
export const ACTION_DEFS: ActionDef[] = [
  { id: 'add_tag', label: 'Add tag', group: 'Organise', valueType: 'tag' },
  { id: 'remove_tag', label: 'Remove tag', group: 'Organise', valueType: 'tag' },
  { id: 'move_inbox', label: 'Move to mailbox', group: 'Organise', valueType: 'mailbox' },
  { id: 'assign', label: 'Assign to teammate', group: 'Teammates', valueType: 'user' },
  { id: 'assign_me', label: 'Assign to me', group: 'Teammates', valueType: 'none' },
  { id: 'unassign', label: 'Unassign', group: 'Teammates', valueType: 'none' },
  { id: 'notify', label: 'Notify teammate', group: 'Teammates', valueType: 'user' },
  { id: 'set_status', label: 'Set email status', group: 'Status', valueType: 'status' },
  { id: 'archive', label: 'Archive / resolve', group: 'Status', valueType: 'none' },
  { id: 'reply_template', label: 'Reply using template', group: 'Message', valueType: 'template' },
  { id: 'ai_autopilot', label: 'Reply with AI Autopilot', group: 'Message', valueType: 'text' },
  { id: 'add_comment', label: 'Add internal comment', group: 'Comment', valueType: 'text' },
  { id: 'reply_goal', label: 'Set reply-time goal (min)', group: 'Accelerate', valueType: 'number' },
  { id: 'send_app_request', label: 'TMS · send app request', group: 'TMS', valueType: 'text' },
  { id: 'webhook', label: 'Send to webhook', group: 'Integrations', valueType: 'text' },
]

// ── model ────────────────────────────────────────────────────────────────────────
export interface Cond { field: string; op: Op; value?: string }
export interface Act { type: string; value?: string }
export interface Branch { id: string; name: string; conditions: Cond[]; actions: Act[] }
export interface AutoRule {
  id: string
  name: string
  enabled: boolean
  trigger: string
  match: 'all' | 'any'
  conditions: Cond[]
  actions: Act[]
  branches?: Branch[]
  source?: 'template' | 'ai' | 'manual'
}
export interface Macro { id: string; name: string; icon?: string; actions: Act[] }

const uid = (p: string) => `${p}-${Math.random().toString(36).slice(2, 8)}`
const KEY = 'cd-automation-v1'

// ── seed rules & macros (Front templates + TMS T-01…T-14) ────────────────────────
function seedRules(): AutoRule[] {
  return [
    { id: uid('r'), name: 'Cancellation request → escalate', enabled: true, trigger: 'inbound', match: 'all', source: 'template',
      conditions: [{ field: 'body', op: 'contains', value: 'cancel' }],
      actions: [{ type: 'add_tag', value: 'Cancellation' }, { type: 'set_status', value: 'Action Ready' }, { type: 'reply_goal', value: '15' }, { type: 'send_app_request', value: 'Flag job for review in TMS' }] },
    { id: uid('r'), name: 'Quote request → task + tag', enabled: true, trigger: 'inbound_new', match: 'any', source: 'template',
      conditions: [{ field: 'body', op: 'contains', value: 'quote' }, { field: 'body', op: 'contains', value: 'how much' }],
      actions: [{ type: 'add_tag', value: 'Quote' }, { type: 'add_comment', value: 'Auto: prepare & send quote' }] },
    { id: uid('r'), name: 'Job Delivered → request feedback', enabled: true, trigger: 'job_event', match: 'all', source: 'template',
      conditions: [{ field: 'job_status', op: 'is', value: 'Delivered' }],
      actions: [{ type: 'reply_template', value: 'Booking confirmed' }, { type: 'add_tag', value: 'Awaiting CSAT' }, { type: 'set_status', value: 'Awaiting Customer' }] },
    { id: uid('r'), name: 'Damage / claim → Claims handler', enabled: false, trigger: 'inbound', match: 'any', source: 'template',
      conditions: [{ field: 'body', op: 'contains', value: 'damage' }, { field: 'body', op: 'contains', value: 'claim' }, { field: 'body', op: 'contains', value: 'accident' }],
      actions: [{ type: 'add_tag', value: 'Damage Claim' }, { type: 'reply_goal', value: '60' }, { type: 'send_app_request', value: 'Flag job record in TMS' }] },
    { id: uid('r'), name: 'VIP customer → priority', enabled: false, trigger: 'inbound', match: 'all', source: 'template',
      conditions: [{ field: 'customer_tier', op: 'is', value: 'VIP' }],
      actions: [{ type: 'add_tag', value: 'VIP' }, { type: 'reply_goal', value: '20' }] },
    // a branching example
    { id: uid('r'), name: 'Classify & route inbound (branching)', enabled: true, trigger: 'inbound', match: 'all', source: 'template',
      conditions: [],
      actions: [],
      branches: [
        { id: uid('b'), name: 'New booking', conditions: [{ field: 'body', op: 'contains', value: 'new booking' }], actions: [{ type: 'add_tag', value: 'Booking' }] },
        { id: uid('b'), name: 'Amendment', conditions: [{ field: 'body', op: 'contains', value: 'amend' }], actions: [{ type: 'add_tag', value: 'Amendment' }] },
        { id: uid('b'), name: 'Finance', conditions: [{ field: 'body', op: 'contains', value: 'invoice' }], actions: [{ type: 'add_tag', value: 'Finance' }] },
      ] },
  ]
}
function seedMacros(): Macro[] {
  return [
    { id: uid('m'), name: 'Reply & resolve', icon: '✅', actions: [{ type: 'reply_template', value: 'Booking confirmed' }, { type: 'archive' }] },
    { id: uid('m'), name: 'Escalate to manager', icon: '⛑', actions: [{ type: 'set_status', value: 'Action Ready' }, { type: 'notify', value: '' }, { type: 'add_comment', value: 'Escalated to manager.' }] },
    { id: uid('m'), name: 'Send POD', icon: '📄', actions: [{ type: 'send_app_request', value: 'Fetch POD document URL from TMS' }, { type: 'reply_template', value: 'Driver details' }, { type: 'archive' }] },
    { id: uid('m'), name: 'Route to Claims', icon: '🚧', actions: [{ type: 'add_tag', value: 'Damage Claim' }, { type: 'move_inbox', value: 'accounts@cal.delivery' }] },
  ]
}

// ── mock AI: describe → structured rule / macro (+ rationale) ─────────────────────
function pick(text: string, ...kw: string[]) { const t = text.toLowerCase(); return kw.some((k) => t.includes(k)) }
export function aiBuildRule(text: string): { rule: AutoRule; rationale: string } {
  const t = text.toLowerCase()
  const conditions: Cond[] = []
  const actions: Act[] = []
  let trigger = 'inbound'
  let name = 'New rule'
  const why: string[] = []

  if (pick(t, 'delivered', 'collected', 'job status', 'confirmed', 'delayed')) {
    trigger = 'job_event'; why.push('a TMS job event drives this, so I used the job-event trigger')
    const st = pick(t, 'delivered') ? 'Delivered' : pick(t, 'collected') ? 'Collected' : pick(t, 'confirmed') ? 'Posted' : ''
    if (st) conditions.push({ field: 'job_status', op: 'is', value: st })
  }
  if (pick(t, 'cancel')) { conditions.push({ field: 'body', op: 'contains', value: 'cancel' }); actions.push({ type: 'add_tag', value: 'Cancellation' }, { type: 'set_status', value: 'Action Ready' }); name = 'Cancellation → escalate'; why.push('“cancel” in the body flags a cancellation, so I tag + set Action Ready') }
  if (pick(t, 'quote', 'how much', 'price')) { conditions.push({ field: 'body', op: 'contains', value: 'quote' }); actions.push({ type: 'add_tag', value: 'Quote' }); name = 'Quote request' }
  if (pick(t, 'pod', 'proof of delivery')) { conditions.push({ field: 'body', op: 'contains', value: 'POD' }); actions.push({ type: 'send_app_request', value: 'Fetch POD URL from TMS' }, { type: 'reply_template', value: 'Driver details' }); name = 'POD request' }
  if (pick(t, 'vip', 'priority', 'important customer')) { conditions.push({ field: 'customer_tier', op: 'is', value: 'VIP' }); actions.push({ type: 'add_tag', value: 'VIP' }); name = 'VIP priority' }
  if (pick(t, 'damage', 'claim', 'broken', 'incident')) { conditions.push({ field: 'body', op: 'contains', value: 'damage' }); actions.push({ type: 'add_tag', value: 'Damage Claim' }); name = 'Damage claim' }
  if (pick(t, 'same day', 'same-day', 'urgent', 'today')) { conditions.push({ field: 'pickup', op: 'is', value: 'today' }); actions.push({ type: 'add_tag', value: 'Urgent — Same Day' }, { type: 'reply_goal', value: '30' }); name = 'Same-day urgency' }
  // assignment / reply intents
  if (pick(t, 'assign to me', 'give it to me')) actions.push({ type: 'assign_me' })
  else if (pick(t, 'assign', 'route to', 'send to team')) actions.push({ type: 'assign', value: '' })
  if (pick(t, 'reply', 'auto-reply', 'send template', 'respond')) actions.push({ type: 'reply_template', value: 'Booking confirmed' })
  if (pick(t, 'archive', 'resolve', 'close')) actions.push({ type: 'archive' })
  if (pick(t, 'within', 'minutes', 'reply goal', 'sla', 'chase')) { const m = t.match(/(\d+)\s*(min|hour|hr)/); actions.push({ type: 'reply_goal', value: m ? String(m[2].startsWith('h') ? +m[1] * 60 : +m[1]) : '30' }) }
  if (pick(t, 'webhook', 'zapier')) actions.push({ type: 'webhook', value: 'https://hooks.example/tms' })

  if (!conditions.length) conditions.push({ field: 'body', op: 'contains', value: text.split(' ').slice(0, 2).join(' ') })
  if (!actions.length) actions.push({ type: 'add_tag', value: 'Review' })
  const rationale = why.length ? `I read your description and ${why.join('; ')}.` : 'I matched the keywords in your description to the closest trigger, conditions and actions. Tweak anything below before saving.'
  return { rule: { id: uid('r'), name, enabled: true, trigger, match: 'all', conditions, actions, source: 'ai' }, rationale }
}
export function aiBuildMacro(text: string): { macro: Macro; rationale: string } {
  const { rule } = aiBuildRule(text)
  return { macro: { id: uid('m'), name: rule.name, icon: '⚡', actions: rule.actions }, rationale: 'Built a one-click macro from your description — it applies these actions to the open conversation.' }
}

// ── runtime (evaluates the live subset against a thread + its linked job) ─────────
function linkedJob(thread: EmailThread) {
  const jobs = useJobsStore.getState().jobs
  const txt = `${thread.subject} ${thread.msgs.map((m) => m.body).join(' ')}`.toUpperCase()
  return jobs.find((j) => j.ref.toUpperCase() === thread.linkedJobRef?.toUpperCase())
    ?? jobs.find((j) => txt.includes(j.ref.toUpperCase()) || (j.custRef && txt.includes(j.custRef.toUpperCase())))
}
function bodyText(t: EmailThread) { return `${t.subject} ${t.msgs.map((m) => m.body).join(' ')}`.toLowerCase() }
function evalCond(c: Cond, t: EmailThread): boolean {
  const v = (c.value ?? '').toLowerCase()
  const job = linkedJob(t)
  switch (c.field) {
    case 'body': case 'subject': {
      const hay = c.field === 'subject' ? t.subject.toLowerCase() : bodyText(t)
      if (c.op === 'not_contains') return !hay.includes(v)
      if (c.op === 'matches') return new RegExp(`\\b${v.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`).test(hay)
      if (c.op === 'regex') { try { return new RegExp(c.value ?? '', 'i').test(hay) } catch { return false } }
      return hay.includes(v)
    }
    case 'from': return (t.msgs.find((m) => !m.outbound)?.from.email ?? '').toLowerCase().includes(v)
    case 'to': return t.participants.join(' ').toLowerCase().includes(v)
    case 'has_tag': return c.op === 'none' ? !t.tags.some((x) => x.toLowerCase() === v) : t.tags.some((x) => x.toLowerCase() === v)
    case 'attachments': return c.op === 'none' ? !t.msgs.some((m) => m.attachments?.length) : t.msgs.some((m) => m.attachments?.length)
    case 'attach_count': { const n = t.msgs.reduce((a, m) => a + (m.attachments?.length ?? 0), 0); const k = +(c.value ?? 0); return c.op === 'gt' ? n > k : c.op === 'lt' ? n < k : n === k }
    case 'unassigned': return !t.assigneeId
    case 'status': return c.op === 'is_not' ? t.status !== c.value : t.status === c.value
    case 'reply_count': { const n = t.msgs.length; const k = +(c.value ?? 0); return c.op === 'gt' ? n > k : c.op === 'lt' ? n < k : n === k }
    case 'job_status': return c.op === 'is_not' ? (job?.progress ?? '') !== c.value : (job?.progress ?? '') === c.value
    case 'driver_assigned': return c.op === 'true' ? !!job?.supplierName : !job?.supplierName
    case 'pickup': { if (!job?.collectAt) return false; const d = job.collectAt.slice(0, 8); const now = new Date(); const p = (x: number) => ('0' + x).slice(-2); const today = `${p(now.getDate())}-${p(now.getMonth() + 1)}-${String(now.getFullYear()).slice(-2)}`; return v === 'today' ? d === today : true }
    default: return true // conditions we don't evaluate live (sentiment, tier, etc.) pass through
  }
}
/** Apply a list of actions to a thread via the emails store; returns short labels run. */
function runActions(acts: Act[], threadId: string): string[] {
  const es = useEmailsStore.getState()
  const meId = useUsersStore.getState().currentUserId
  const templates = es.templates
  const done: string[] = []
  for (const a of acts) {
    switch (a.type) {
      case 'add_tag': if (a.value) { es.addTag(threadId, a.value); done.push(`tagged ${a.value}`) } break
      case 'remove_tag': if (a.value) { es.removeTag(threadId, a.value); done.push(`removed ${a.value}`) } break
      case 'assign': es.assign(threadId, a.value || meId); done.push('assigned'); break
      case 'assign_me': es.assign(threadId, meId); done.push('assigned to me'); break
      case 'unassign': es.assign(threadId, null); done.push('unassigned'); break
      case 'set_status': if (a.value) { es.setStatus(threadId, a.value as EmailStatus); done.push(`status → ${a.value}`) } break
      case 'archive': es.archiveThread(threadId, 'Responded'); done.push('archived'); break
      case 'reply_goal': es.setExpecting(threadId, Date.now() + (+(a.value ?? 30)) * 60_000); done.push(`reply goal ${a.value}m`); break
      case 'reply_template': { const tpl = templates.find((x) => x.name === a.value) ?? templates[0]; if (tpl) { es.postOutbound(threadId, tpl.body); done.push(`replied “${tpl.name}”`) } break }
      case 'add_comment': if (a.value) { es.addComment(threadId, a.value); done.push('commented') } break
      case 'notify': es.addComment(threadId, '🔔 Notified teammate.'); done.push('notified'); break
      case 'send_app_request': es.addComment(threadId, `↗ TMS app request: ${a.value ?? 'sent'} (mock OK)`); done.push('TMS request'); break
      case 'webhook': es.addComment(threadId, `↗ Webhook fired → ${a.value ?? 'endpoint'} (mock 200)`); done.push('webhook'); break
      case 'ai_autopilot': es.addComment(threadId, '🤖 Autopilot drafted a reply (mock).'); done.push('autopilot'); break
      default: break
    }
  }
  return done
}

interface AutoState {
  rules: AutoRule[]
  macros: Macro[]
  lastRun: string | null
  addRule(r: AutoRule): void
  updateRule(id: string, patch: Partial<AutoRule>): void
  deleteRule(id: string): void
  addMacro(m: Macro): void
  updateMacro(id: string, patch: Partial<Macro>): void
  deleteMacro(id: string): void
  /** Apply enabled inbound rules across the active inbox; returns how many fired. */
  runRulesOnInbox(): number
  /** Run a single macro on a conversation. */
  runMacro(macroId: string, threadId: string): string[]
}

function load(): { rules: AutoRule[]; macros: Macro[] } {
  try { const raw = localStorage.getItem(KEY); if (raw) return JSON.parse(raw) } catch { /* ignore */ }
  return { rules: seedRules(), macros: seedMacros() }
}

export const useAutomationStore = create<AutoState>((set, get) => {
  const persist = () => { try { localStorage.setItem(KEY, JSON.stringify({ rules: get().rules, macros: get().macros })) } catch { /* ignore */ } }
  const init = load()
  return {
    rules: init.rules,
    macros: init.macros,
    lastRun: null,
    addRule: (r) => { set((s) => ({ rules: [...s.rules, r] })); persist() },
    updateRule: (id, patch) => { set((s) => ({ rules: s.rules.map((r) => (r.id === id ? { ...r, ...patch } : r)) })); persist() },
    deleteRule: (id) => { set((s) => ({ rules: s.rules.filter((r) => r.id !== id) })); persist() },
    addMacro: (m) => { set((s) => ({ macros: [...s.macros, m] })); persist() },
    updateMacro: (id, patch) => { set((s) => ({ macros: s.macros.map((m) => (m.id === id ? { ...m, ...patch } : m)) })); persist() },
    deleteMacro: (id) => { set((s) => ({ macros: s.macros.filter((m) => m.id !== id) })); persist() },
    runRulesOnInbox: () => {
      const threads = useEmailsStore.getState().threads.filter((t) => !t.archived)
      const rules = get().rules.filter((r) => r.enabled && (r.trigger === 'inbound' || r.trigger === 'inbound_new' || r.trigger === 'job_event' || r.trigger === 'job_status'))
      let fired = 0
      for (const t of threads) {
        for (const r of rules) {
          // branching rule: run the first matching branch
          if (r.branches?.length) {
            for (const b of r.branches) {
              if (b.conditions.every((c) => evalCond(c, t))) { runActions(b.actions, t.id); fired++; break }
            }
            continue
          }
          const ok = r.conditions.length === 0
            ? false // a non-branching rule with no conditions does nothing on a bulk run
            : r.match === 'all' ? r.conditions.every((c) => evalCond(c, t)) : r.conditions.some((c) => evalCond(c, t))
          if (ok) { const ran = runActions(r.actions, t.id); useEmailsStore.getState().addComment(t.id, `⚙ Rule “${r.name}” ran: ${ran.join(', ') || 'no-op'}`); fired++ }
        }
      }
      const now = new Date()
      set({ lastRun: `${('0' + now.getHours()).slice(-2)}:${('0' + now.getMinutes()).slice(-2)}` })
      return fired
    },
    runMacro: (macroId, threadId) => {
      const m = get().macros.find((x) => x.id === macroId)
      if (!m) return []
      const ran = runActions(m.actions, threadId)
      useEmailsStore.getState().addComment(threadId, `⚡ Macro “${m.name}” ran: ${ran.join(', ') || 'no-op'}`)
      return ran
    },
  }
})
