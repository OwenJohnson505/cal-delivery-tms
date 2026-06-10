/**
 * UsersScreen — the staff/users database. Users are referenced by Sales (converted /
 * lead-by) and assigned into departments & teams (Teams screen). List + create panel.
 */
import { useState } from 'react'
import { Icon } from '@/app/Icon.tsx'
import { useUsersStore, blankUser, type UserDraft } from '@/store/usersStore.ts'

const ROLES = ['Director', 'Sales', 'Operations', 'Accounts', 'Admin']

export function UsersScreen() {
  const users = useUsersStore((s) => s.users)
  const addUser = useUsersStore((s) => s.addUser)
  const deleteUser = useUsersStore((s) => s.deleteUser)
  const peekCode = useUsersStore((s) => s.peekCode())

  const [creating, setCreating] = useState(false)
  const [d, setD] = useState<UserDraft>(blankUser())
  const set = (patch: Partial<UserDraft>) => setD((p) => ({ ...p, ...patch }))

  function save() {
    if (!d.name.trim()) return
    addUser(d)
    setD(blankUser())
    setCreating(false)
  }

  return (
    <div className="list-app">
      <div className="list-work">
        <div className="list-head">
          <h1>Users</h1>
          {!creating && (
            <button className="btn primary" onClick={() => setCreating(true)}>
              <Icon name="plus" size={15} /> Add user
            </button>
          )}
        </div>

        {creating && (
          <div className="db-form">
            <div className="db-form-h">
              <span>New user</span>
              <span className="cf-hint">ID assigned on save: <b>{peekCode}</b></span>
            </div>
            <div className="db-grid">
              <div className="fld up"><label>Full name</label><input value={d.name} placeholder="e.g. Sarah Doyle" onChange={(e) => set({ name: e.target.value })} /></div>
              <div className="fld up"><label>Email</label><input value={d.email} placeholder="name@cal.delivery" onChange={(e) => set({ email: e.target.value })} /></div>
              <div className="fld up"><label>Phone</label><input value={d.phone} onChange={(e) => set({ phone: e.target.value })} /></div>
              <div className="fld up"><label>Role</label><select value={d.role} onChange={(e) => set({ role: e.target.value })}><option value="">—</option>{ROLES.map((r) => <option key={r}>{r}</option>)}</select></div>
            </div>
            <div className="db-form-actions">
              <label className="chk" style={{ marginRight: 'auto' }}><input type="checkbox" checked={d.active} onChange={(e) => set({ active: e.target.checked })} /> Active</label>
              <button className="btn" onClick={() => { setCreating(false); setD(blankUser()) }}>Cancel</button>
              <button className="btn primary" onClick={save} disabled={!d.name.trim()}>Save user</button>
            </div>
          </div>
        )}

        <div className="list-tablewrap">
          <table className="list-table">
            <thead><tr><th>ID</th><th>Name</th><th>Email</th><th>Phone</th><th>Role</th><th>Status</th><th></th></tr></thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id}>
                  <td><span className="itag itag-muted">{u.id}</span></td>
                  <td><b>{u.name}</b></td>
                  <td>{u.email}</td>
                  <td>{u.phone || '—'}</td>
                  <td>{u.role || '—'}</td>
                  <td><span className={'itag' + (u.active ? '' : ' itag-muted')}>{u.active ? 'Active' : 'Inactive'}</span></td>
                  <td className="list-actions">
                    <button className="btn sm iconbtn danger" title="Delete" onClick={() => { if (confirm(`Delete ${u.name}?`)) deleteUser(u.id) }}>
                      <Icon name="trash" size={14} />
                    </button>
                  </td>
                </tr>
              ))}
              {users.length === 0 && <tr><td className="empty" colSpan={7}>No users yet.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
