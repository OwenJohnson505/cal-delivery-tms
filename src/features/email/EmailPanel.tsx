/**
 * EmailPanel — the right-hand email client. Inbox list on top; the open thread below
 * (fields, messages, reply composer). Any job ref or customer ref appearing in a body is
 * highlighted and clickable — it opens that job in the left-hand area while the panel
 * stays put. "Create job from email" identifies the company from the sender address,
 * extracts vehicle + postcodes from the text, pre-fills a booking for approval, and
 * carries the account note onto the job.
 */
import { useState } from 'react'
import { Icon } from '@/app/Icon.tsx'
import { useEmailsStore, type EmailThread } from '@/store/emailsStore.ts'
import { useJobsStore, type SavedJob } from '@/store/jobsStore.ts'
import { useBookingStore } from '@/store/bookingStore.ts'
import { useViewStore } from '@/store/viewStore.ts'
import { useCustomersStore } from '@/store/customersStore.ts'
import { useTariffsStore } from '@/store/tariffsStore.ts'

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

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

/** Build a pre-filled booking from the thread: company by sender, vehicle + postcodes
 * from the text, account note onto the job. The user approves it in the wizard. */
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
  // Carry the account note onto the job so the operator sees it immediately.
  if (cust?.notes) b.setJobNotes(`Account note: ${cust.notes}`)
  useViewStore.getState().openWizard(null)
}

export function EmailPanel() {
  const threads = useEmailsStore((s) => s.threads)
  const selectedId = useEmailsStore((s) => s.selectedId)
  const selectThread = useEmailsStore((s) => s.selectThread)
  const reply = useEmailsStore((s) => s.reply)
  const togglePanel = useEmailsStore((s) => s.togglePanel)
  const [draft, setDraft] = useState('')

  const thread = threads.find((t) => t.id === selectedId) ?? null
  const unread = threads.filter((t) => !t.read).length
  const lastInbound = thread?.msgs.filter((m) => !m.outbound).slice(-1)[0]

  const send = () => {
    if (!thread || !draft.trim()) return
    reply(thread.id, draft.trim())
    setDraft('')
  }

  return (
    <aside className="email-panel">
      <div className="ep-head">
        <Icon name="mail" size={16} /> <b>Email</b>
        {unread > 0 && <span className="ep-unread">{unread}</span>}
        <span className="db-spacer" />
        <button className="btn sm iconbtn" title="Close panel" onClick={togglePanel}>
          <Icon name="close" size={15} />
        </button>
      </div>

      <div className="ep-list">
        {threads.map((t) => {
          const last = t.msgs[t.msgs.length - 1]
          return (
            <button key={t.id} className={'ep-row' + (t.id === selectedId ? ' on' : '') + (t.read ? '' : ' unread')} onClick={() => selectThread(t.id)}>
              <span className="ep-row-top">
                <span className="ep-row-from">{t.msgs.find((m) => !m.outbound)?.from.name ?? last.from.name}</span>
                <span className="ep-row-at">{last.at}</span>
              </span>
              <span className="ep-row-subj">{t.subject}</span>
            </button>
          )
        })}
      </div>

      {thread ? (
        <div className="ep-reader">
          <div className="ep-fields">
            <div className="ep-frow"><span>From</span><b>{lastInbound ? `${lastInbound.from.name} <${lastInbound.from.email}>` : '—'}</b></div>
            <div className="ep-frow"><span>To</span><b>bookings@cal.delivery</b></div>
            <div className="ep-frow"><span>Subject</span><b>{thread.subject}</b></div>
            <div className="ep-tools">
              <button className="btn sm" onClick={() => createJobFromEmail(thread)} title="Pre-fill a booking from this email for approval">
                <Icon name="plus" size={13} /> Create job from email
              </button>
            </div>
          </div>

          <div className="ep-msgs">
            {thread.msgs.map((m) => (
              <div key={m.id} className={'ep-msg' + (m.outbound ? ' out' : '')}>
                <div className="ep-msg-meta">{m.from.name} · {m.at}</div>
                <div className="ep-msg-body"><RefText text={m.body} /></div>
              </div>
            ))}
          </div>

          <div className="ep-compose">
            <textarea
              rows={3}
              placeholder="Reply…"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) send() }}
            />
            <button className="btn primary sm" disabled={!draft.trim()} onClick={send}>Send</button>
          </div>
        </div>
      ) : (
        <div className="ep-empty">Select an email above.</div>
      )}
    </aside>
  )
}
