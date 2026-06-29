/**
 * Agents store — live presence + daily activity for back-office staff, shown in the
 * floating Agents widget. This is a DESIGN MOCK: there's no telephony/heartbeat service,
 * so a tick() advances a believable simulation (status changes, call/email counters,
 * which screen each person is on). Real impl → a presence service (websocket) fed by the
 * softphone (call events) and the app (page + draft events).
 */
import { create } from 'zustand'
import { useUsersStore } from './usersStore.ts'

export type AgentStatus = 'available' | 'on-call' | 'busy' | 'drafting' | 'away'

export interface AgentActivity {
  emailsSent: number
  callsIn: number // inbound calls answered
  callsOut: number // outbound calls made
}
export interface AgentLogEntry { id: number; at: number; text: string }
export interface AgentPresence {
  userId: string
  status: AgentStatus
  statusSince: number
  /** Human label of the screen they're currently on (drives the shadow monitor). */
  screen: string
  /** A coarse "kind" of screen so the monitor can draw a matching wireframe. */
  screenKind: ScreenKind
  activity: AgentActivity
  log: AgentLogEntry[]
}

export type ScreenKind = 'list' | 'email' | 'editor' | 'customer' | 'idle'

const CUSTOMERS = ['Brightway', 'Meridian', 'Orbit', 'Northgate', 'Vellum Foods']
const REFS = ['BK-2026-100482', 'BK-2026-100479', 'BK-2026-100471', 'QT-2026-0421']
const SCREENS: Array<[label: string, kind: ScreenKind]> = [
  ['Bookings list', 'list'],
  ['Quotes', 'list'],
  ['Drafts', 'list'],
  ['Email inbox', 'email'],
  ['Drivers board', 'list'],
  ['Tariffs', 'list'],
]
const pick = <T,>(arr: readonly T[]): T => arr[Math.floor(Math.random() * arr.length)]

let logSeq = 1
function addLog(log: AgentLogEntry[], at: number, text: string): AgentLogEntry[] {
  return [{ id: logSeq++, at, text }, ...log].slice(0, 14)
}

/** Seeded starting state — deterministic (no random at init) so it's stable on load. */
function seedPresence(now: number): Record<string, AgentPresence> {
  const users = useUsersStore.getState().users
  const presets: Array<{ status: AgentStatus; screen: string; kind: ScreenKind; act: AgentActivity; ago: number }> = [
    { status: 'on-call', screen: 'On a call · Brightway', kind: 'customer', act: { emailsSent: 12, callsIn: 9, callsOut: 5 }, ago: 130 },
    { status: 'drafting', screen: 'Email inbox · replying to Meridian', kind: 'email', act: { emailsSent: 9, callsIn: 4, callsOut: 11 }, ago: 40 },
    { status: 'available', screen: 'Bookings list', kind: 'list', act: { emailsSent: 6, callsIn: 7, callsOut: 3 }, ago: 25 },
    { status: 'busy', screen: 'Editing BK-2026-100482', kind: 'editor', act: { emailsSent: 4, callsIn: 2, callsOut: 9 }, ago: 200 },
    { status: 'on-call', screen: 'On a call · outbound to Orbit', kind: 'customer', act: { emailsSent: 15, callsIn: 13, callsOut: 6 }, ago: 75 },
    { status: 'away', screen: 'Away from desk', kind: 'idle', act: { emailsSent: 2, callsIn: 1, callsOut: 0 }, ago: 600 },
  ]
  const map: Record<string, AgentPresence> = {}
  users.forEach((u, i) => {
    const p = presets[i % presets.length]
    map[u.id] = {
      userId: u.id,
      status: p.status,
      statusSince: now - p.ago * 1000,
      screen: p.screen,
      screenKind: p.kind,
      activity: { ...p.act },
      log: [
        { id: logSeq++, at: now - p.ago * 1000, text: statusVerb(p.status) },
        { id: logSeq++, at: now - (p.ago + 180) * 1000, text: 'Signed in' },
      ],
    }
  })
  return map
}

function statusVerb(s: AgentStatus): string {
  switch (s) {
    case 'on-call': return 'Answered a call'
    case 'drafting': return 'Started drafting an email'
    case 'busy': return 'Opened a booking to edit'
    case 'away': return 'Stepped away from desk'
    default: return 'Came back to available'
  }
}

interface AgentsState {
  presence: Record<string, AgentPresence>
  /** User being shadowed in the "view as" monitor, or null. */
  shadowingId: string | null
  setShadowing(id: string | null): void
  /** Advance the simulation one step (called on an interval by the widget). */
  tick(): void
}

export const useAgentsStore = create<AgentsState>((set) => ({
  presence: seedPresence(Date.now()),
  shadowingId: null,
  setShadowing: (id) => set({ shadowingId: id }),

  tick: () => set((s) => {
    const now = Date.now()
    const presence = { ...s.presence }
    const ids = Object.keys(presence)
    if (!ids.length) return {}
    // Evolve a couple of random agents, plus always nudge the shadowed agent so the
    // monitor visibly "moves" while you're watching them.
    const targets = new Set<string>()
    const howMany = 1 + Math.floor(Math.random() * 2)
    for (let k = 0; k < howMany; k++) targets.add(pick(ids))
    if (s.shadowingId && presence[s.shadowingId]) targets.add(s.shadowingId)

    targets.forEach((id) => {
      const p = { ...presence[id], activity: { ...presence[id].activity }, log: presence[id].log }
      const roll = Math.random()
      if (roll < 0.22) {
        p.activity.callsIn += 1
        p.status = 'on-call'; p.screen = `On a call · ${pick(CUSTOMERS)}`; p.screenKind = 'customer'
        p.log = addLog(p.log, now, `Answered an inbound call from ${pick(CUSTOMERS)}`)
      } else if (roll < 0.4) {
        p.activity.callsOut += 1
        p.status = 'on-call'; p.screen = `On a call · outbound to ${pick(CUSTOMERS)}`; p.screenKind = 'customer'
        p.log = addLog(p.log, now, `Called ${pick(CUSTOMERS)} to chase a quote`)
      } else if (roll < 0.6) {
        p.activity.emailsSent += 1
        p.status = 'available'; p.screen = 'Email inbox'; p.screenKind = 'email'
        p.log = addLog(p.log, now, `Sent an email re: ${pick(REFS)}`)
      } else if (roll < 0.78) {
        p.status = 'drafting'; p.screen = `Email inbox · drafting to ${pick(CUSTOMERS)}`; p.screenKind = 'email'
        p.log = addLog(p.log, now, 'Started drafting an email')
      } else if (roll < 0.9) {
        p.status = 'busy'; p.screen = `Editing ${pick(REFS)}`; p.screenKind = 'editor'
        p.log = addLog(p.log, now, `Opened ${pick(REFS)} to edit`)
      } else {
        const [label, kind] = pick(SCREENS)
        p.status = 'available'; p.screen = label; p.screenKind = kind
        p.log = addLog(p.log, now, `Opened ${label}`)
      }
      p.statusSince = now
      presence[id] = p
    })
    return { presence }
  }),
}))
