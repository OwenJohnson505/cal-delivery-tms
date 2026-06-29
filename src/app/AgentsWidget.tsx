/**
 * AgentsWidget — a floating presence panel for back-office staff. A headset bubble in the
 * bottom-right expands into a live roster: each person's call + email status (shown as a
 * live dot on the relevant phone / email icon, since someone can be on a call AND writing
 * at once), and today's activity counts. "View as" hands over to a full-screen monitor
 * (MonitorOverlay) that mirrors the screen they're working on, for coaching new starters.
 * All presence/activity is simulated (see agentsStore).
 */
import { useEffect, useState } from 'react'
import { Icon } from './Icon.tsx'
import { useUsersStore } from '@/store/usersStore.ts'
import { useAgentsStore, type AgentPresence, type ScreenKind } from '@/store/agentsStore.ts'

const initials = (name: string) => name.split(/\s+/).map((w) => w[0]).join('').slice(0, 2).toUpperCase()

/** "Available" when nothing is active; otherwise both active things, side by side. */
function statusText(p: AgentPresence): string {
  if (p.away) return 'Away'
  const parts: string[] = []
  if (p.call === 'in') parts.push('On an inbound call')
  if (p.call === 'out') parts.push('On an outbound call')
  if (p.writing) parts.push('Writing an email')
  return parts.length ? parts.join(' · ') : 'Available'
}
function presenceClass(p: AgentPresence): string {
  if (p.away) return 'st-away'
  if (p.call || p.writing) return 'st-active'
  return 'st-available'
}

/** The three day-counts, each with a live notification dot when that action is happening
 * right now (writing → email icon, on a call → the matching phone icon). */
function ActivityIcons({ p }: { p: AgentPresence }) {
  return (
    <span className="ag-stats">
      <span className={'ag-stat' + (p.writing ? ' live' : '')} title={p.writing ? 'Writing an email now' : 'Emails sent today'}>
        {p.writing && <i className="ag-live amber" />}
        <Icon name="mail" size={13} /> {p.activity.emailsSent}
      </span>
      <span className={'ag-stat' + (p.call === 'in' ? ' live' : '')} title={p.call === 'in' ? 'On an inbound call now' : 'Inbound calls answered today'}>
        {p.call === 'in' && <i className="ag-live blue" />}
        <Icon name="phone-in" size={13} /> {p.activity.callsIn}
      </span>
      <span className={'ag-stat' + (p.call === 'out' ? ' live' : '')} title={p.call === 'out' ? 'On an outbound call now' : 'Outbound calls made today'}>
        {p.call === 'out' && <i className="ag-live blue" />}
        <Icon name="phone-out" size={13} /> {p.activity.callsOut}
      </span>
    </span>
  )
}

export function AgentsWidget() {
  const users = useUsersStore((s) => s.users)
  const presence = useAgentsStore((s) => s.presence)
  const setShadowing = useAgentsStore((s) => s.setShadowing)
  const tick = useAgentsStore((s) => s.tick)

  const [open, setOpen] = useState(false)
  const [selectedId, setSelectedId] = useState<string | null>(null)

  useEffect(() => {
    const t = window.setInterval(() => tick(), 2600)
    return () => window.clearInterval(t)
  }, [tick])

  const userById = (id: string) => users.find((u) => u.id === id)
  const online = users.filter((u) => presence[u.id] && !presence[u.id].away).length
  const active = users.filter((u) => presence[u.id] && (presence[u.id].call || presence[u.id].writing)).length
  const detail = selectedId ? presence[selectedId] : null

  return (
    <>
      <button className={'agents-fab' + (open ? ' on' : '')} title="Agents — live staff presence" onClick={() => setOpen((o) => !o)}>
        <Icon name="headset" size={22} />
        {online > 0 && <span className="agents-fab-badge">{online}</span>}
      </button>

      {open && (
        <div className="agents-panel">
          {detail ? (
            <>
              <div className="agw-head">
                <button className="agw-back" title="Back" onClick={() => setSelectedId(null)}><Icon name="chevron-up" size={16} /></button>
                <span className="agw-title">{userById(detail.userId)?.name ?? '—'}</span>
                <span className="db-spacer" />
                <button className="agw-x" title="Close" onClick={() => setOpen(false)}><Icon name="close" size={14} /></button>
              </div>
              <div className="agw-detail">
                <div className="agd-id">
                  <span className="ag-ava lg">{initials(userById(detail.userId)?.name ?? '?')}<span className={'ag-dot ' + presenceClass(detail)} /></span>
                  <div>
                    <div className="agd-name">{userById(detail.userId)?.name}</div>
                    <div className="agd-role">{userById(detail.userId)?.role}</div>
                    <div className={'ag-status ' + presenceClass(detail)}>{statusText(detail)}</div>
                  </div>
                </div>
                <div className="agd-now"><Icon name="eye" size={13} /> Currently on: <b>{detail.screen}</b></div>
                <div className="agd-tiles">
                  <div className="agd-tile"><Icon name="mail" size={15} /><b>{detail.activity.emailsSent}</b><span>Emails sent</span></div>
                  <div className="agd-tile"><Icon name="phone-in" size={15} /><b>{detail.activity.callsIn}</b><span>Calls answered</span></div>
                  <div className="agd-tile"><Icon name="phone-out" size={15} /><b>{detail.activity.callsOut}</b><span>Calls made</span></div>
                </div>
                <button className="btn primary agd-shadow" onClick={() => setShadowing(detail.userId)}>
                  <Icon name="eye" size={14} /> View {(userById(detail.userId)?.name ?? '').split(' ')[0]}'s screen — live
                </button>
              </div>
            </>
          ) : (
            <>
              <div className="agw-head">
                <span className="agw-title"><Icon name="headset" size={15} /> Agents</span>
                <span className="agw-sub">{online} online · {active} active</span>
                <span className="db-spacer" />
                <button className="agw-x" title="Close" onClick={() => setOpen(false)}><Icon name="close" size={14} /></button>
              </div>
              <div className="agw-list">
                {users.map((u) => {
                  const p = presence[u.id]
                  if (!p) return null
                  return (
                    <button key={u.id} className="ag-row" onClick={() => setSelectedId(u.id)}>
                      <span className="ag-ava">{initials(u.name)}<span className={'ag-dot ' + presenceClass(p)} /></span>
                      <span className="ag-main">
                        <span className="ag-name">{u.name}</span>
                        <span className={'ag-status ' + presenceClass(p)}>{statusText(p)}</span>
                      </span>
                      <ActivityIcons p={p} />
                    </button>
                  )
                })}
              </div>
            </>
          )}
        </div>
      )}
    </>
  )
}

// ── Full-screen monitor ("view as") ───────────────────────────────────────────────────

/** A full-size, app-like rendering of the screen the agent is on — updates live as they
 * move around. Not a real session mirror (this is a design mock), but it looks like the
 * actual screens so you can shadow what a new starter is doing. */
function MonitorScreen({ kind, p }: { kind: ScreenKind; p: AgentPresence }) {
  if (kind === 'idle') return <div className="mon-empty"><Icon name="clock" size={28} /><div>Away from desk</div></div>

  const railIcons = ['calendar', 'mail', 'user', 'grid', 'cog']
  const rail = (
    <div className="mon-rail">
      <div className="mon-logo">CD</div>
      {railIcons.map((n, i) => <div key={n} className={'mon-rail-i' + (i === 0 ? ' on' : '')}><Icon name={n} size={17} /></div>)}
    </div>
  )

  let body
  if (kind === 'email') body = (
    <div className="mon-email">
      <div className="mon-elist">
        {['Sarah Doyle · URGENT — same-day Luton', 'Tom Baker · Re: BK-100482', 'Priya Shah · Driver details', 'James Hill · 18t needed Friday'].map((t, i) => (
          <div key={t} className={'mon-erow' + (i === 0 ? ' on' : '')}>{t}</div>
        ))}
      </div>
      <div className="mon-ereader">
        <div className="mon-h2">URGENT — same-day Luton needed</div>
        <div className="mon-line w70" /><div className="mon-line w90" /><div className="mon-line w50" />
        <div className="mon-compose">{p.writing ? <span className="mon-typing"><i /><i /><i /> typing…</span> : 'Reply'}</div>
      </div>
    </div>
  )
  else if (kind === 'editor') body = (
    <div className="mon-editor">
      <div className="mon-h2">Brightway · {p.screen.replace('Editing ', '')}</div>
      {['Collection · LS9 — Unit 4, Holbeck', 'Delivery · WA2 — Crompton Park'].map((s) => (
        <div key={s} className="mon-stop"><span className="mon-stop-t">{s}</span><div className="mon-line w40" /></div>
      ))}
      <div className="mon-foot"><span className="mon-line w20" /><span className="db-spacer" /><span className="mon-btn" /><span className="mon-btn primary" /></div>
    </div>
  )
  else if (kind === 'customer') body = (
    <div className="mon-customer">
      <div className="mon-callbar"><span className="agw-pulse" /> Live call in progress · 02:14</div>
      <div className="mon-h2">{p.screen.replace('On a call · ', '')}</div>
      <div className="mon-grid">{[0, 1, 2, 3].map((i) => <div key={i} className="mon-card"><div className="mon-line w50" /><div className="mon-line w80" /></div>)}</div>
    </div>
  )
  else body = ( // list
    <div className="mon-list">
      <div className="mon-tabs"><span className="on">Bookings</span><span>Quotes</span><span>Drafts</span></div>
      <table className="mon-table"><thead><tr><th>Customer</th><th>Status</th><th>Route</th><th>Supplier</th></tr></thead>
        <tbody>
          {[['Brightway', 'Collected', 'LS9 → WA2', 'Dave Foster'], ['Brightway', 'Unallocated', 'LS9 → BD1', 'Unassigned'], ['Orbit', 'Part DEL', 'LS4 → M1', 'Rob Niles'], ['Meridian', 'En route', 'M15 → L7', 'Aisha Khan']].map((r, i) => (
            <tr key={i}><td>{r[0]}</td><td><span className="mon-pill">{r[1]}</span></td><td>{r[2]}</td><td>{r[3]}</td></tr>
          ))}
        </tbody>
      </table>
    </div>
  )

  return <div className="mon-app">{rail}<div className="mon-content">{body}</div></div>
}

export function MonitorOverlay() {
  const shadowingId = useAgentsStore((s) => s.shadowingId)
  const presence = useAgentsStore((s) => s.presence)
  const setShadowing = useAgentsStore((s) => s.setShadowing)
  const users = useUsersStore((s) => s.users)

  if (!shadowingId || !presence[shadowingId]) return null
  const p = presence[shadowingId]
  const u = users.find((x) => x.id === shadowingId)

  return (
    <div className="monitor">
      <div className="monitor-bar">
        <span className="monitor-rec"><span className="agw-pulse" /> MONITORING</span>
        <span className="monitor-who">{u?.name} <span className="monitor-screen-label">· {p.screen}</span></span>
        <span className="db-spacer" />
        <button className="monitor-stop" onClick={() => setShadowing(null)}><Icon name="close" size={15} /> Stop monitoring</button>
      </div>
      <div className="monitor-stage">
        <MonitorScreen kind={p.screenKind} p={p} />
      </div>
    </div>
  )
}
