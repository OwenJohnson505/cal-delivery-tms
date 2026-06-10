/**
 * TeamsScreen — departments and teams. A department is made up of teams; teams (and the
 * department itself) hold member users. Staff assigned at department level see the whole
 * department; team-level staff see their team (drives the booking screen's default view
 * later). Build users first (Users screen), then create departments/teams and assign
 * users into them here.
 */
import { useState } from 'react'
import { Icon } from '@/app/Icon.tsx'
import { useOrgStore } from '@/store/orgStore.ts'
import { useUsersStore } from '@/store/usersStore.ts'

/** Chips of assigned users + a dropdown to add another. */
function MemberPicker({ ids, onChange }: { ids: string[]; onChange: (next: string[]) => void }) {
  const users = useUsersStore((s) => s.users)
  const available = users.filter((u) => !ids.includes(u.id))
  return (
    <div className="mp">
      {ids.length === 0 && <span className="cf-hint">No members yet</span>}
      {ids.map((id) => {
        const u = users.find((x) => x.id === id)
        if (!u) return null
        return (
          <span key={id} className="cf-chip">{u.name}<i onClick={() => onChange(ids.filter((x) => x !== id))}>×</i></span>
        )
      })}
      <select className="mp-add" value="" onChange={(e) => { if (e.target.value) onChange([...ids, e.target.value]) }}>
        <option value="">+ Add member…</option>
        {available.map((u) => <option key={u.id} value={u.id}>{u.name}{u.role ? ` · ${u.role}` : ''}</option>)}
      </select>
    </div>
  )
}

export function TeamsScreen() {
  const departments = useOrgStore((s) => s.departments)
  const teams = useOrgStore((s) => s.teams)
  const addDepartment = useOrgStore((s) => s.addDepartment)
  const updateDepartment = useOrgStore((s) => s.updateDepartment)
  const deleteDepartment = useOrgStore((s) => s.deleteDepartment)
  const addTeam = useOrgStore((s) => s.addTeam)
  const updateTeam = useOrgStore((s) => s.updateTeam)
  const deleteTeam = useOrgStore((s) => s.deleteTeam)

  const [newDept, setNewDept] = useState('')
  const [newTeam, setNewTeam] = useState<Record<string, string>>({})

  return (
    <div className="list-app">
      <div className="list-work">
        <div className="list-head">
          <h1>Teams &amp; departments</h1>
          <div className="row" style={{ gap: 6 }}>
            <input className="db-inline-input" placeholder="New department name…" value={newDept} onChange={(e) => setNewDept(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && newDept.trim()) { addDepartment(newDept.trim()); setNewDept('') } }} />
            <button className="btn primary" disabled={!newDept.trim()} onClick={() => { addDepartment(newDept.trim()); setNewDept('') }}>
              <Icon name="plus" size={15} /> Add department
            </button>
          </div>
        </div>

        <div className="org-wrap">
          {departments.map((dep) => (
            <div className="org-dept" key={dep.id}>
              <div className="org-dept-h">
                <Icon name="building" size={16} /> <b>{dep.name}</b>
                <span className="itag itag-muted">{dep.id}</span>
                <span className="grow" />
                <button className="btn sm iconbtn danger" title="Delete department" onClick={() => { if (confirm(`Delete ${dep.name} and its teams?`)) deleteDepartment(dep.id) }}>
                  <Icon name="trash" size={14} />
                </button>
              </div>

              <div className="org-members">
                <span className="org-lbl">Department members</span>
                <MemberPicker ids={dep.memberUserIds} onChange={(ids) => updateDepartment(dep.id, { memberUserIds: ids })} />
              </div>

              <div className="org-teams">
                {teams.filter((t) => t.departmentId === dep.id).map((t) => (
                  <div className="org-team" key={t.id}>
                    <div className="org-team-h">
                      <Icon name="users" size={14} /> <b>{t.name}</b>
                      <span className="itag itag-muted">{t.id}</span>
                      <span className="grow" />
                      <button className="btn sm iconbtn danger" title="Delete team" onClick={() => { if (confirm(`Delete team ${t.name}?`)) deleteTeam(t.id) }}>
                        <Icon name="trash" size={13} />
                      </button>
                    </div>
                    <MemberPicker ids={t.memberUserIds} onChange={(ids) => updateTeam(t.id, { memberUserIds: ids })} />
                  </div>
                ))}
                <div className="org-addteam">
                  <input
                    className="db-inline-input"
                    placeholder="New team name…"
                    value={newTeam[dep.id] || ''}
                    onChange={(e) => setNewTeam((p) => ({ ...p, [dep.id]: e.target.value }))}
                    onKeyDown={(e) => { const v = (newTeam[dep.id] || '').trim(); if (e.key === 'Enter' && v) { addTeam(v, dep.id); setNewTeam((p) => ({ ...p, [dep.id]: '' })) } }}
                  />
                  <button className="btn sm" disabled={!(newTeam[dep.id] || '').trim()} onClick={() => { const v = (newTeam[dep.id] || '').trim(); addTeam(v, dep.id); setNewTeam((p) => ({ ...p, [dep.id]: '' })) }}>
                    <Icon name="plus" size={13} /> Add team
                  </button>
                </div>
              </div>
            </div>
          ))}
          {departments.length === 0 && <div className="cf-empty">No departments yet — add one above.</div>}
        </div>
      </div>
    </div>
  )
}
