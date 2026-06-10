/**
 * Users store — staff accounts referenced by Sales (converted/lead-by), and assigned
 * into departments/teams (see orgStore). In-memory + seeded for now (real impl → an
 * identity/users service, §5).
 */
import { create } from 'zustand'

export interface User {
  id: string // generated, e.g. USR-1001
  name: string
  email: string
  phone: string
  role: string // free text for now (e.g. Sales, Operations, Admin)
  active: boolean
}

export type UserDraft = Omit<User, 'id'>

export function blankUser(): UserDraft {
  return { name: '', email: '', phone: '', role: '', active: true }
}

const SEED: Array<[name: string, email: string, phone: string, role: string]> = [
  ['Owen Johnson', 'owen@cal.delivery', '0113 555 0001', 'Director'],
  ['Sarah Doyle', 'sarah@cal.delivery', '0113 555 0002', 'Sales'],
  ['James Hill', 'james@cal.delivery', '0113 555 0003', 'Sales'],
  ['Priya Shah', 'priya@cal.delivery', '0161 555 0004', 'Operations'],
  ['Tom Baker', 'tom@cal.delivery', '0151 555 0005', 'Operations'],
  ['Emma Watts', 'emma@cal.delivery', '0161 555 0006', 'Accounts'],
]

function seed(): User[] {
  return SEED.map(([name, email, phone, role], i) => ({
    id: `USR-${1001 + i}`, name, email, phone, role, active: true,
  }))
}

interface UsersState {
  users: User[]
  seq: number
  peekCode(): string
  addUser(draft: UserDraft): User
  updateUser(id: string, patch: Partial<UserDraft>): void
  deleteUser(id: string): void
}

export const useUsersStore = create<UsersState>((set, get) => ({
  users: seed(),
  seq: 1000 + SEED.length,

  peekCode: () => `USR-${get().seq + 1}`,

  addUser: (draft) => {
    const seq = get().seq + 1
    const user: User = { ...draft, id: `USR-${seq}` }
    set((s) => ({ users: [user, ...s.users], seq }))
    return user
  },

  updateUser: (id, patch) =>
    set((s) => ({ users: s.users.map((u) => (u.id === id ? { ...u, ...patch } : u)) })),

  deleteUser: (id) => set((s) => ({ users: s.users.filter((u) => u.id !== id) })),
}))
