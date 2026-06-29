/**
 * AgentsWidget — a floating presence panel for back-office staff. A headset bubble in the
 * bottom-right expands into a live roster: each person's status (on a call / writing an
 * email / busy / available), today's activity (emails sent · inbound calls · outbound
 * calls), and a "View as" monitor that shadows what they're doing in real time (for
 * coaching new starters). All presence/activity is simulated (see agentsStore).
 */
import { useEffect, useState } from 'react'
import { Icon } from './Icon.tsx'
import { useUsersStore } from '@/store/usersStore.ts'
import { useAgentsStore, type AgentStatus, type AgentPresence, type ScreenKind } from '@/store/agentsStore.ts'

const STATUS_META: Record<AgentStatus, { label: string; cls: string; icon: string }> = {
  'on-call': { label: 'On a call', cls: 'st-oncall', icon: 'phone' },
  drafting: { label: 'Writing an email', cls: 'st-drafting', icon: 'edit' },
  busy: { label: 'Busy', cls: 'st-busy', icon: 'file' },
  available: { label: 'Available', cls: 'st-available', icon: 'check' },
  away: { label: 'Away', cls: 'st-away', icon: 'clock' },
}

const initials = (name: string) => name.split(/\s+/).map((w) => w[0]).join('').slice(0, 2).toUpperCase()

function ago(at: number): string {
  const s = Math.max(0, Math.floor((Date.now() - at) / 1000))
  if (s < 10) return 'just now'
  if (s < 60) return `${s}s ago`
  const m = Math.floor(s / 60)
  if (m < 60) return `${m}m ago`
  return `${Math.floor(m / 60)}h ago`
}

/** A tiny skeleton of the screen the agent is on, so the monitor visibly changes as they
 * move around. Not a real mirror — a representative wireframe per screen kind. */
function ScreenWire({ kind }: { kind: ScreenKind }) {
  if (kind === 'idle') return <div className="agw-screen-empty">Away from desk</div>
  if (kind === 'email') return (
    <div className="agw-wire wire-email">
      <div className="wire-col">{[0, 1, 2, 3].map((i) => <span key={i} className={'wire-row' + (i === 1 ? ' on' : '')} />)}</div>
      <div className="wire-pane"><span className="wire-line w70" /><span className="wire-line w40" /><span className="wire-block" /></div>
    </div>
  )
  if (kind === 'editor') return (
    <div className="agw-wire wire-editor">
      <span className="wire-line w50" />
      <div className="wire-fields">{[0, 1, 2, 3].map((i) => <span key={i} className="wire-field" />)}</div>
      <div className="wire-actions"><span className="wire-btn" /><span className="wire-btn primary" /></div>
    </div>
  )
  if (kind === 'customer') return (
    <div className="agw-wire wire-customer">
      <div className="wire-callbar"><span className="agw-pulse" /> Live call</div>
      <span className="wire-line w60" /><span className="wire-line w30" />
      <div className="wire-grid">{[0, 1, 2, 3].map((i) => <span key={i} className="wire-cell" />)}</div>
    </div>
  )
  return (
    <div className="agw-wire wire-list">
      <div className="wire-head"><span className="wire-line w20" /><span className="wire-line w20" /><span className="wire-line w20" /></div>
      {[0, 1, 2, 3, 4].map((i) => <span key={i} className="wire-trow" />)}
    </div>
  )
}

export function AgentsWidget() {
  const users = useUsersStore((s) => s.users)
  const presence = useAgentsStore((s) => s.presence)
  const shadowingId = useAgentsStore((s) => s.shadowingId)
  const setShadowing = useAgentsStore((s) => s.setShadowing)
  const tick = useAgentsStore((s) => s.tick)

  const [open, setOpen] = useState(false)
  const [selectedId, setSelectedId] = useState<string | null>(null)

  // advance the simulated presence on a steady tick while mounted
  useEffect(() => {
    const t = window.setInterval(() => tick(), 2600)
    return () => window.clearInterval(t)
  }, [tick])

  const userById = (id: string) => users.find((u) => u.id === id)
  const online = users.filter((u) => presence[u.id] && presence[u.id].status !== 'away').length
  const onCall = users.filter((u) => presence[u.id]?.status === 'on-call').length

  const shadow = shadowingId ? presence[shadowingId] : null
  const detail = selectedId ? presence[selectedId] : null

  return (
    <>
      <button className={'agents-fab' + (open ? ' on' : '')} title="Agents — live staff presence" onClick={() => setOpen((o) => !o)}>
        <Icon name="headset" size={22} />
        {online > 0 && <span className="agents-fab-badge">{online}</span>}
      </button>

      {open && (
        <div className="agents-panel">
          {shadow ? (
            <ShadowMonitor presence={shadow} name={userById(shadow.userId)?.name ?? '—'} role={userById(shadow.userId)?.role ?? ''} onBack={() => setShadowing(null)} onClose={() => setOpen(false)} />
          ) : detail ? (
            <AgentDetail presence={detail} user={userById(detail.userId)} onBack={() => setSelectedId(null)} onShadow={() => setShadowing(detail.userId)} onClose={() => setOpen(false)} />
          ) : (
            <>
              <div className="agw-head">
                <span className="agw-title"><Icon name="headset" size={15} /> Agents</span>
                <span className="agw-sub">{online} online · {onCall} on a call</span>
                <span className="db-spacer" />
                <button className="agw-x" title="Close" onClick={() => setOpen(false)}><Icon name="close" size={14} /></button>
              </div>
              <div className="agw-list">
                {users.map((u) => {
                  const p = presence[u.id]
                  if (!p) return null
                  const meta = STATUS_META[p.status]
                  return (
                    <button key={u.id} className="ag-row" onClick={() => setSelectedId(u.id)}>
                      <span className="ag-ava">{initials(u.name)}<span className={'ag-dot ' + meta.cls} /></span>
                      <span className="ag-main">
                        <span className="ag-name">{u.name}</span>
                        <span className={'ag-status ' + meta.cls}><Icon name={meta.icon} size={11} /> {meta.label}</span>
                      </span>
                      <span className="ag-stats">
                        <span title="Emails sent today"><Icon name="mail" size={12} /> {p.activity.emailsSent}</span>
                        <span title="Inbound calls answered today"><Icon name="phone-in" size={12} /> {p.activity.callsIn}</span>
                        <span title="Outbound calls made today"><Icon name="phone-out" size={12} /> {p.activity.callsOut}</span>
                      </span>
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

function AgentDetail({ presence: p, user, onBack, onShadow, onClose }: {
  presence: AgentPresence
  user?: { name: string; role: string; email: string }
  onBack: () => void
  onShadow: () => void
  onClose: () => void
}) {
  const meta = STATUS_META[p.status]
  return (
    <>
      <div className="agw-head">
        <button className="agw-back" title="Back" onClick={onBack}><Icon name="chevron-up" size={16} /></button>
        <span className="agw-title">{user?.name ?? '—'}</span>
        <span className="db-spacer" />
        <button className="agw-x" title="Close" onClick={onClose}><Icon name="close" size={14} /></button>
      </div>
      <div className="agw-detail">
        <div className="agd-id">
          <span className="ag-ava lg">{initials(user?.name ?? '?')}<span className={'ag-dot ' + meta.cls} /></span>
          <div>
            <div className="agd-name">{user?.name}</div>
            <div className="agd-role">{user?.role}</div>
            <div className={'ag-status ' + meta.cls}><Icon name={meta.icon} size={12} /> {meta.label} · {ago(p.statusSince)}</div>
          </div>
        </div>
        <div className="agd-now"><Icon name="eye" size={13} /> Currently: <b>{p.screen}</b></div>
        <div className="agd-tiles">
          <div className="agd-tile"><Icon name="mail" size={15} /><b>{p.activity.emailsSent}</b><span>Emails sent</span></div>
          <div className="agd-tile"><Icon name="phone-in" size={15} /><b>{p.activity.callsIn}</b><span>Calls answered</span></div>
          <div className="agd-tile"><Icon name="phone-out" size={15} /><b>{p.activity.callsOut}</b><span>Calls made</span></div>
        </div>
        <button className="btn primary agd-shadow" onClick={onShadow}><Icon name="eye" size={14} /> View as {(user?.name ?? '').split(' ')[0]} — live</button>
        <div className="agd-log-h">Today's activity</div>
        <div className="agd-log">
          {p.log.map((e) => (
            <div key={e.id} className="agd-log-row"><span className="agd-log-dot" /><span className="agd-log-txt">{e.text}</span><span className="agd-log-at">{ago(e.at)}</span></div>
          ))}
        </div>
      </div>
    </>
  )
}

function ShadowMonitor({ presence: p, name, role, onBack, onClose }: {
  presence: AgentPresence
  name: string
  role: string
  onBack: () => void
  onClose: () => void
}) {
  const meta = STATUS_META[p.status]
  return (
    <>
      <div className="agw-head shadow">
        <button className="agw-back" title="Back" onClick={onBack}><Icon name="chevron-up" size={16} /></button>
        <span className="agw-title"><span className="agw-pulse" /> Shadowing {name}</span>
        <span className="db-spacer" />
        <button className="agw-x" title="Stop shadowing" onClick={onBack}><Icon name="close" size={14} /></button>
      </div>
      <div className="agw-shadow">
        <div className="agw-monitor">
          <div className="agw-mon-bar"><span className="agw-mon-dots"><i /><i /><i /></span><span className="agw-mon-url">{p.screen}</span><span className="agw-live">LIVE</span></div>
          <div className="agw-mon-screen"><ScreenWire kind={p.screenKind} /></div>
        </div>
        <div className={'ag-status big ' + meta.cls}><Icon name={meta.icon} size={13} /> {meta.label} · {role}</div>
        <div className="agd-log-h">Live activity feed</div>
        <div className="agd-log stream">
          {p.log.map((e) => (
            <div key={e.id} className="agd-log-row"><span className="agd-log-dot" /><span className="agd-log-txt">{e.text}</span><span className="agd-log-at">{ago(e.at)}</span></div>
          ))}
        </div>
        <button className="btn agw-stop" onClick={onClose}>Done</button>
      </div>
    </>
  )
}
