/**
 * Agents store — live presence + daily activity for back-office staff, shown in the
 * floating Agents widget. DESIGN MOCK: no telephony/heartbeat service, so tick() advances
 * a believable simulation. A person can be on a call AND writing an email at the same
 * time, so those are two independent flags (not one status). "Available" just means
 * neither is active. Real impl → a presence service fed by the softphone + app events.
 */
import { create } from 'zustand'
import { useUsersStore } from './usersStore.ts'

export type ScreenKind = 'list' | 'email' | 'editor' | 'customer' | 'idle'

export interface AgentActivity {
  emailsSent: number
  callsIn: number // inbound calls answered today
  callsOut: number // outbound calls made today
}
export interface AgentPresence {
  userId: string
  call: 'in' | 'out' | null // currently on an inbound / outbound call
  writing: boolean // currently drafting an email
  away: boolean // away from desk
  screen: string // label of the screen they're on (drives the monitor)
  screenKind: ScreenKind
  activity: AgentActivity
}

const CUSTOMERS = ['Brightway', 'Meridian', 'Orbit', 'Northgate', 'Vellum Foods']
const REFS = ['BK-2026-100482', 'BK-2026-100479', 'BK-2026-100471', 'QT-2026-0421']
const pick = <T,>(arr: readonly T[]): T => arr[Math.floor(Math.random() * arr.length)]

/** Pick a screen label + kind that matches what the person is doing right now. */
function deriveScreen(p: Pick<AgentPresence, 'call' | 'writing' | 'away'>): [string, ScreenKind] {
  if (p.away) return ['Away from desk', 'idle']
  if (p.writing) return [`Email inbox · drafting${p.call ? ' (on a call)' : ''}`, 'email']
  if (p.call) return [`On a call · ${pick(CUSTOMERS)}`, 'customer']
  return pick<[string, ScreenKind]>([
    ['Bookings list', 'list'],
    ['Quotes', 'list'],
    ['Email inbox', 'email'],
    [`Editing ${pick(REFS)}`, 'editor'],
    [`Customer · ${pick(CUSTOMERS)}`, 'customer'],
  ])
}

/** Deterministic starting state (no random at init) — stable on load, and deliberately
 * varied incl. one person who is BOTH on a call and writing an email. */
function seedPresence(): Record<string, AgentPresence> {
  const users = useUsersStore.getState().users
  const presets: Array<Omit<AgentPresence, 'userId'>> = [
    { call: 'in', writing: false, away: false, screen: 'On a call · Brightway', screenKind: 'customer', activity: { emailsSent: 12, callsIn: 9, callsOut: 5 } },
    { call: null, writing: true, away: false, screen: 'Email inbox · drafting to Meridian', screenKind: 'email', activity: { emailsSent: 9, callsIn: 4, callsOut: 11 } },
    { call: 'out', writing: true, away: false, screen: 'Email inbox · drafting (on a call)', screenKind: 'email', activity: { emailsSent: 15, callsIn: 13, callsOut: 6 } },
    { call: null, writing: false, away: false, screen: 'Bookings list', screenKind: 'list', activity: { emailsSent: 6, callsIn: 7, callsOut: 3 } },
    { call: 'in', writing: false, away: false, screen: 'Editing BK-2026-100482', screenKind: 'editor', activity: { emailsSent: 4, callsIn: 2, callsOut: 9 } },
    { call: null, writing: false, away: true, screen: 'Away from desk', screenKind: 'idle', activity: { emailsSent: 2, callsIn: 1, callsOut: 0 } },
  ]
  const map: Record<string, AgentPresence> = {}
  users.forEach((u, i) => { map[u.id] = { userId: u.id, ...presets[i % presets.length] } })
  return map
}

interface AgentsState {
  presence: Record<string, AgentPresence>
  /** User being monitored full-screen ("view as"), or null. */
  shadowingId: string | null
  setShadowing(id: string | null): void
  tick(): void
}

export const useAgentsStore = create<AgentsState>((set) => ({
  presence: seedPresence(),
  shadowingId: null,
  setShadowing: (id) => set({ shadowingId: id }),

  tick: () => set((s) => {
    const presence = { ...s.presence }
    const ids = Object.keys(presence)
    if (!ids.length) return {}
    const targets = new Set<string>()
    const howMany = 1 + Math.floor(Math.random() * 2)
    for (let k = 0; k < howMany; k++) targets.add(pick(ids))
    if (s.shadowingId && presence[s.shadowingId]) targets.add(s.shadowingId) // keep the monitored screen moving

    targets.forEach((id) => {
      const p = { ...presence[id], activity: { ...presence[id].activity } }
      if (p.away) { if (Math.random() < 0.5) p.away = false }
      else if (Math.random() < 0.04) { p.away = true; p.call = null; p.writing = false }
      if (!p.away) {
        // calls — end the current one (banking the count) or start a new one
        if (p.call) { if (Math.random() < 0.45) { p.activity[p.call === 'in' ? 'callsIn' : 'callsOut'] += 1; p.call = null } }
        else if (Math.random() < 0.3) p.call = Math.random() < 0.55 ? 'in' : 'out'
        // emails — finish drafting (sent) or start drafting
        if (p.writing) { if (Math.random() < 0.45) { p.activity.emailsSent += 1; p.writing = false } }
        else if (Math.random() < 0.3) p.writing = true
      }
      const [screen, kind] = deriveScreen(p)
      p.screen = screen; p.screenKind = kind
      presence[id] = p
    })
    return { presence }
  }),
}))
