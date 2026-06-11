/**
 * Emails store — the mock inbox behind the right-hand email panel. Threads of messages
 * (inbound from customers, outbound from us). Replying triggers a canned "customer"
 * response after a short delay so the back-and-forth UI can be exercised. In-memory +
 * seeded (real impl → the email client integration).
 */
import { create } from 'zustand'
import { useUsersStore } from './usersStore.ts'

export interface EmailMsg {
  id: string
  from: { name: string; email: string }
  body: string
  at: string // dd-mm-yy HH:MM
  /** True when sent by us (staff). */
  outbound?: boolean
}

export interface EmailThread {
  id: string
  subject: string
  msgs: EmailMsg[]
  read: boolean
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

function seedThreads(): EmailThread[] {
  return [
    {
      id: 'th-1', read: false, subject: 'Re: BK-100482 — delivery today',
      msgs: [
        { id: uid(), from: { name: 'Sarah Doyle', email: 's.doyle@brightway.co.uk' }, at: '11-06-26 08:12',
          body: 'Morning,\n\nQuick check on BK-100482 (our ref PO-7781) — is the 14:15 delivery into WA2 still on track? Site closes at 16:00 today.\n\nThanks,\nSarah' },
      ],
    },
    {
      id: 'th-2', read: false, subject: '18t needed Friday — LS9 to Bradford',
      msgs: [
        { id: uid(), from: { name: 'James Hill', email: 'j.hill@brightway.co.uk' }, at: '11-06-26 09:47',
          body: 'Hi team,\n\nWe need an 18t on Friday. Collection from our depot LS9 0PX, delivering to the Bradford store BD1 2AB. Curtain side if possible, tail lift not needed.\n\nRef will be PO-9920.\n\nJames' },
      ],
    },
    {
      id: 'th-3', read: true, subject: 'Luton tomorrow — Manchester to Liverpool',
      msgs: [
        { id: uid(), from: { name: 'Sarah Doyle', email: 'sarah@meridianfoods.com' }, at: '10-06-26 16:30',
          body: 'Hello,\n\nCould you price a Luton for tomorrow morning? M15 4FN collection, delivery L7 9PG before end of day. Roughly 4 pallets, nothing heavy.\n\nBest,\nSarah (Meridian)' },
      ],
    },
    {
      id: 'th-4', read: true, subject: 'Re: QU-100501',
      msgs: [
        { id: uid(), from: { name: 'Priya Shah', email: 'priya@orbitretail.com' }, at: '10-06-26 11:05',
          body: 'Hi,\n\nFollowing up on quote QU-100501 — if you can hold that price we will confirm this week under ORB-90.\n\nPriya' },
        { id: uid(), from: { name: 'Sarah Doyle', email: 'bookings@cal.delivery' }, at: '10-06-26 11:40', outbound: true,
          body: 'Hi Priya,\n\nNo problem — QU-100501 is held until Friday. Just reply with the go-ahead and we will book it in.\n\nSarah' },
      ],
    },
    {
      id: 'th-5', read: true, subject: 'Pallet rates enquiry',
      msgs: [
        { id: uid(), from: { name: 'Gary Mills', email: 'gary@millswholesale.example' }, at: '09-06-26 14:20',
          body: 'Hi, do you do ad-hoc pallet work out of Leeds? Looking for a price list. Cheers, Gary' },
      ],
    },
  ]
}

interface EmailsState {
  /** Whether the right-hand email panel is open (shared across screens). */
  panelOpen: boolean
  threads: EmailThread[]
  selectedId: string | null
  togglePanel(): void
  selectThread(id: string): void
  /** Send a staff reply; a canned customer response arrives a moment later. */
  reply(threadId: string, body: string): void
}

export const useEmailsStore = create<EmailsState>((set, get) => ({
  panelOpen: true,
  threads: seedThreads(),
  selectedId: 'th-1',

  togglePanel: () => set((s) => ({ panelOpen: !s.panelOpen })),

  selectThread: (id) =>
    set((s) => ({
      selectedId: id,
      threads: s.threads.map((t) => (t.id === id ? { ...t, read: true } : t)),
    })),

  reply: (threadId, body) => {
    const us = useUsersStore.getState()
    const me = us.users.find((u) => u.id === us.currentUserId)
    set((s) => ({
      threads: s.threads.map((t) =>
        t.id === threadId
          ? { ...t, msgs: [...t.msgs, { id: uid(), from: { name: me?.name ?? 'Cal Delivery', email: 'bookings@cal.delivery' }, body, at: stampNow(), outbound: true }] }
          : t,
      ),
    }))
    // Simulated customer response (random canned text) so the back-and-forth can be seen.
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
}))
