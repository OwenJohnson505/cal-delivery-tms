/**
 * Org store — departments and teams. Hierarchy: a department is made up of teams, and
 * teams (and the department itself) hold member users (see usersStore). Staff can be
 * assigned at department level or team level, so views can be filtered accordingly
 * (later: the booking screen defaults to a team view for team-level staff, a
 * department view for department-level staff). In-memory + seeded.
 */
import { create } from 'zustand'

export interface Department {
  id: string // DEP-1001
  name: string
  /** Users assigned at department level (see the whole department). */
  memberUserIds: string[]
}

export interface Team {
  id: string // TEM-1001
  name: string
  departmentId: string
  /** Users assigned to this team. */
  memberUserIds: string[]
}

const SEED_DEPTS: Array<[id: string, name: string, members: string[]]> = [
  ['DEP-1001', 'Sales', ['USR-1001']],
  ['DEP-1002', 'Operations', ['USR-1004']],
]
const SEED_TEAMS: Array<[id: string, name: string, deptId: string, members: string[]]> = [
  ['TEM-1001', 'New business', 'DEP-1001', ['USR-1002']],
  ['TEM-1002', 'Account management', 'DEP-1001', ['USR-1003']],
  ['TEM-1003', 'Planning', 'DEP-1002', ['USR-1005']],
  ['TEM-1004', 'Invoicing', 'DEP-1002', ['USR-1006']],
]

interface OrgState {
  departments: Department[]
  teams: Team[]
  seqDept: number
  seqTeam: number
  addDepartment(name: string): Department
  updateDepartment(id: string, patch: Partial<Omit<Department, 'id'>>): void
  deleteDepartment(id: string): void
  addTeam(name: string, departmentId: string): Team
  updateTeam(id: string, patch: Partial<Omit<Team, 'id'>>): void
  deleteTeam(id: string): void
}

export const useOrgStore = create<OrgState>((set, get) => ({
  departments: SEED_DEPTS.map(([id, name, memberUserIds]) => ({ id, name, memberUserIds })),
  teams: SEED_TEAMS.map(([id, name, departmentId, memberUserIds]) => ({ id, name, departmentId, memberUserIds })),
  seqDept: 1002,
  seqTeam: 1004,

  addDepartment: (name) => {
    const seq = get().seqDept + 1
    const dep: Department = { id: `DEP-${seq}`, name, memberUserIds: [] }
    set((s) => ({ departments: [...s.departments, dep], seqDept: seq }))
    return dep
  },
  updateDepartment: (id, patch) =>
    set((s) => ({ departments: s.departments.map((d) => (d.id === id ? { ...d, ...patch } : d)) })),
  deleteDepartment: (id) =>
    set((s) => ({
      departments: s.departments.filter((d) => d.id !== id),
      teams: s.teams.filter((t) => t.departmentId !== id), // cascade
    })),

  addTeam: (name, departmentId) => {
    const seq = get().seqTeam + 1
    const team: Team = { id: `TEM-${seq}`, name, departmentId, memberUserIds: [] }
    set((s) => ({ teams: [...s.teams, team], seqTeam: seq }))
    return team
  },
  updateTeam: (id, patch) =>
    set((s) => ({ teams: s.teams.map((t) => (t.id === id ? { ...t, ...patch } : t)) })),
  deleteTeam: (id) => set((s) => ({ teams: s.teams.filter((t) => t.id !== id) })),
}))
