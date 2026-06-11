/**
 * EmailPanel — Front-style inbox in the right panel.
 *  • Triage: rules classify threads (Urgent booking / ETA request / Driver details /
 *    General); the inbox sorts by that priority. Category chips on every row.
 *  • Assignment: auto via rules, manual via the Assigned select (sticks).
 *  • Snooze / reminders / internal comments / reply templates.
 *  • Settings view (gear) edits the rules + templates.
 *  • Booking links: refs in bodies open the job; "Create job from email" pre-fills
 *    a booking (company by sender, vehicle + postcodes from text, account note).
 */
import { useState } from 'react'
import { Icon } from '@/app/Icon.tsx'
import { useEmailsStore, type EmailCategory, type EmailThread } from '@/store/emailsStore.ts'
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

/** Open a saved job in the left-hand area (the email panel stays open). */
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

/** Pre-fill a booking from the thread (company by sender, vehicle + postcodes from
 * the text, account note onto the job) for the user to approve. */
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

/** Sortable key for 'dd-mm-yy HH:MM'. */
const atKey = (at: string) => `${at.slice(6, 8)}-${at.slice(3, 5)}-${at.slice(0, 2)} ${at.slice(9)}`

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
      <div className="ep-set-h">
        <button className="cm-link" onClick={onBack}>‹ Back to inbox</button>
      </div>

      <div className="ep-set-sec">
        <div className="ep-set-title">Rules <span className="cf-hint">keywords → category · priority · auto-assign (re-run on change)</span></div>
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
          </div>
        ))}
        <div className="ep-rule ep-rule-new">
          <div className="ep-rule-row">
            <input placeholder="Rule name…" value={rName} onChange={(e) => setRName(e.target.value)} />
            <select value={rCat} onChange={(e) => setRCat(e.target.value as EmailCategory)}>
              {CATS.map((c) => <option key={c}>{c}</option>)}
            </select>
          </div>
          <div className="ep-rule-row">
            <input placeholder="Keywords, comma-separated…" value={rKeywords} onChange={(e) => setRKeywords(e.target.value)} />
            <select value={rAssign} onChange={(e) => setRAssign(e.target.value)}>
              <option value="">No auto-assign</option>
              {users.map((u) => <option key={u.id} value={u.id}>→ {u.name}</option>)}
            </select>
          </div>
          <button
            className="btn sm primary"
            disabled={!rName.trim() || !rKeywords.trim()}
            onClick={() => {
              addRule({ name: rName.trim(), enabled: true, keywords: rKeywords.split(',').map((k) => k.trim()).filter(Boolean), category: rCat, priority: PRIO[rCat], assignToId: rAssign })
              setRName(''); setRKeywords(''); setRAssign('')
            }}
          >
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
          <button className="btn sm primary" disabled={!tName.trim() || !tBody.trim()} onClick={() => { addTemplate(tName.trim(), tBody); setTName(''); setTBody('') }}>
            Add template
          </button>
        </div>
      </div>
    </div>
  )
}

// ── main panel ──────────────────────────────────────────────────────────────────
type InboxView = 'inbox' | 'mine' | 'snoozed'

export function EmailPanel() {
  const threads = useEmailsStore((s) => s.threads)
  const selectedId = useEmailsStore((s) => s.selectedId)
  const selectThread = useEmailsStore((s) => s.selectThread)
  const reply = useEmailsStore((s) => s.reply)
  const addComment = useEmailsStore((s) => s.addComment)
  const assignThread = useEmailsStore((s) => s.assign)
  const snooze = useEmailsStore((s) => s.snooze)
  const unsnooze = useEmailsStore((s) => s.unsnooze)
  const remind = useEmailsStore((s) => s.remind)
  const clearReminder = useEmailsStore((s) => s.clearReminder)
  const templates = useEmailsStore((s) => s.templates)
  const togglePanel = useEmailsStore((s) => s.togglePanel)
  const users = useUsersStore((s) => s.users)
  const currentUserId = useUsersStore((s) => s.currentUserId)

  const [view, setView] = useState<InboxView>('inbox')
  const [settings, setSettings] = useState(false)
  const [draft, setDraft] = useState('')
  const [mode, setMode] = useState<'reply' | 'comment'>('reply')
  const [menu, setMenu] = useState<'snooze' | 'remind' | null>(null)

  const userName = (id: string | null) => users.find((u) => u.id === id)?.name ?? ''

  const visible = threads
    .filter((t) => (view === 'snoozed' ? !!t.snoozedUntil : !t.snoozedUntil))
    .filter((t) => (view === 'mine' ? t.assigneeId === currentUserId : true))
    .sort((a, b) => a.priority - b.priority || atKey(b.msgs[b.msgs.length - 1].at).localeCompare(atKey(a.msgs[a.msgs.length - 1].at)))

  const thread = threads.find((t) => t.id === selectedId && (view === 'snoozed' ? true : !t.snoozedUntil)) ?? null
  const unread = threads.filter((t) => !t.read && !t.snoozedUntil).length
  const snoozedCount = threads.filter((t) => !!t.snoozedUntil).length
  const lastInbound = thread?.msgs.filter((m) => !m.outbound).slice(-1)[0]

  const send = () => {
    if (!thread || !draft.trim()) return
    if (mode === 'reply') reply(thread.id, draft.trim())
    else addComment(thread.id, draft.trim())
    setDraft('')
  }

  // merged timeline: messages + internal comments, by time
  const timeline = thread
    ? [
        ...thread.msgs.map((m) => ({ kind: 'msg' as const, at: m.at, m })),
        ...thread.comments.map((c) => ({ kind: 'comment' as const, at: c.at, c })),
      ].sort((a, b) => atKey(a.at).localeCompare(atKey(b.at)))
    : []

  return (
    <aside className="email-panel">
      <div className="ep-head">
        <Icon name="mail" size={16} /> <b>Email</b>
        {unread > 0 && <span className="ep-unread">{unread}</span>}
        <span className="db-spacer" />
        <button className={'btn sm iconbtn' + (settings ? ' on' : '')} title="Email settings — rules & templates" onClick={() => setSettings((o) => !o)}>
          <Icon name="wheel" size={15} />
        </button>
        <button className="btn sm iconbtn" title="Close panel" onClick={togglePanel}>
          <Icon name="close" size={15} />
        </button>
      </div>

      {settings ? (
        <SettingsView onBack={() => setSettings(false)} />
      ) : (
        <>
          <div className="ep-views">
            {(['inbox', 'mine', 'snoozed'] as InboxView[]).map((v) => (
              <button key={v} className={'ep-view' + (view === v ? ' on' : '')} onClick={() => setView(v)}>
                {v === 'inbox' ? 'Inbox' : v === 'mine' ? 'Mine' : `Snoozed${snoozedCount ? ` ${snoozedCount}` : ''}`}
              </button>
            ))}
          </div>

          <div className="ep-list">
            {visible.map((t) => {
              const last = t.msgs[t.msgs.length - 1]
              const assignee = userName(t.assigneeId)
              return (
                <button key={t.id} className={'ep-row' + (t.id === selectedId ? ' on' : '') + (t.read ? '' : ' unread')} onClick={() => selectThread(t.id)}>
                  <span className="ep-row-top">
                    <span className="ep-row-from">{t.msgs.find((m) => !m.outbound)?.from.name ?? last.from.name}</span>
                    <span className="ep-row-right">
                      {t.reminderDue && <span className="ep-flag" title="Reminder due">⏰</span>}
                      {assignee && <span className="ep-ava" title={`Assigned to ${assignee}`}>{initials(assignee)}</span>}
                      <span className="ep-row-at">{last.at}</span>
                    </span>
                  </span>
                  <span className="ep-row-subj">{t.subject}</span>
                  <span className="ep-row-tags">
                    <span className={'cat-chip ' + CAT_CLASS[t.category]}>{t.category}</span>
                    {t.snoozedUntil && <span className="ep-snoozed">Snoozed · {t.snoozedUntil}</span>}
                    {t.reminderAt && !t.reminderDue && <span className="ep-remind-tag">⏰ {t.reminderAt}</span>}
                  </span>
                </button>
              )
            })}
            {!visible.length && <div className="ep-empty">Nothing here.</div>}
          </div>

          {thread ? (
            <div className="ep-reader">
              {thread.reminderDue && (
                <div className="ep-banner">
                  ⏰ Reminder due on this email.
                  <button className="cm-link" onClick={() => clearReminder(thread.id)}>Dismiss</button>
                </div>
              )}
              <div className="ep-fields">
                <div className="ep-frow"><span>From</span><b>{lastInbound ? `${lastInbound.from.name} <${lastInbound.from.email}>` : '—'}</b></div>
                <div className="ep-frow"><span>Subject</span><b>{thread.subject}</b></div>
                <div className="ep-frow">
                  <span>Assigned</span>
                  <select className="ep-assign" value={thread.assigneeId ?? ''} onChange={(e) => assignThread(thread.id, e.target.value || null)}>
                    <option value="">Unassigned</option>
                    {users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
                  </select>
                </div>
                <div className="ep-tools">
                  <button className="btn sm" onClick={() => createJobFromEmail(thread)}><Icon name="plus" size={13} /> Create job</button>
                  <span className="ep-menu-wrap">
                    <button className="btn sm" onClick={() => setMenu(menu === 'snooze' ? null : 'snooze')}>Snooze ▾</button>
                    {menu === 'snooze' && (
                      <span className="ep-menu">
                        {SNOOZE_OPTIONS.map(([label, ms]) => (
                          <button key={label} onClick={() => { snooze(thread.id, ms, label); setMenu(null) }}>{label}</button>
                        ))}
                        {thread.snoozedUntil && <button onClick={() => { unsnooze(thread.id); setMenu(null) }}>Unsnooze now</button>}
                      </span>
                    )}
                  </span>
                  <span className="ep-menu-wrap">
                    <button className="btn sm" onClick={() => setMenu(menu === 'remind' ? null : 'remind')}>Remind ▾</button>
                    {menu === 'remind' && (
                      <span className="ep-menu">
                        {SNOOZE_OPTIONS.map(([label, ms]) => (
                          <button key={label} onClick={() => { remind(thread.id, ms, label); setMenu(null) }}>{label}</button>
                        ))}
                        {thread.reminderAt && <button onClick={() => { clearReminder(thread.id); setMenu(null) }}>Clear reminder</button>}
                      </span>
                    )}
                  </span>
                </div>
              </div>

              <div className="ep-msgs">
                {timeline.map((item) =>
                  item.kind === 'msg' ? (
                    <div key={item.m.id} className={'ep-msg' + (item.m.outbound ? ' out' : '')}>
                      <div className="ep-msg-meta">{item.m.from.name} · {item.m.at}</div>
                      <div className="ep-msg-body"><RefText text={item.m.body} /></div>
                    </div>
                  ) : (
                    <div key={item.c.id} className="ep-msg note">
                      <div className="ep-msg-meta">Internal · {item.c.by} · {item.c.at}</div>
                      <div className="ep-msg-body">{item.c.text}</div>
                    </div>
                  ),
                )}
              </div>

              <div className="ep-compose-bar">
                <span className="ep-mode">
                  <button className={mode === 'reply' ? 'on' : ''} onClick={() => setMode('reply')}>Reply</button>
                  <button className={mode === 'comment' ? 'on' : ''} onClick={() => setMode('comment')}>Comment</button>
                </span>
                {mode === 'reply' && templates.length > 0 && (
                  <select
                    className="ep-tpl-pick"
                    value=""
                    onChange={(e) => {
                      const t = templates.find((x) => x.id === e.target.value)
                      if (t) setDraft((d) => (d ? d + '\n' + t.body : t.body))
                    }}
                  >
                    <option value="">Insert template…</option>
                    {templates.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                  </select>
                )}
              </div>
              <div className={'ep-compose' + (mode === 'comment' ? ' commenting' : '')}>
                <textarea
                  rows={3}
                  placeholder={mode === 'reply' ? 'Reply…' : 'Internal comment — not sent to the customer…'}
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) send() }}
                />
                <button className="btn primary sm" disabled={!draft.trim()} onClick={send}>{mode === 'reply' ? 'Send' : 'Add note'}</button>
              </div>
            </div>
          ) : (
            <div className="ep-empty">Select an email above.</div>
          )}
        </>
      )}
    </aside>
  )
}
