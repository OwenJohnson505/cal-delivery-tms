/**
 * Tariffs store — the rate-card database. Each tariff has a generated id (so two
 * tariffs can share a name and still be told apart), a system name + portal name +
 * mapping, and the pricing inputs (cost per mile, minimum charge, minimum miles).
 * In-memory + seeded for now (real impl → a tariffs service, §5). Pricing maths lives
 * in lib/tariff (quoteTariff).
 */
import { create } from 'zustand'

export interface Tariff {
  id: string // generated, e.g. TAR-1001
  name: string // system name
  portalName: string // name shown on the customer portal
  mapping: string // tariff mapping key (integration)
  costPerMile: number
  minCharge: number
  minMiles: number
}

export type TariffDraft = Omit<Tariff, 'id'>

export function blankTariff(): TariffDraft {
  return { name: '', portalName: '', mapping: '', costPerMile: 0, minCharge: 0, minMiles: 0 }
}

const SEED: Array<[name: string, portal: string, mapping: string, cpm: number, minCh: number, minMi: number]> = [
  ['Standard', 'Standard delivery', 'STD', 1.2, 35, 10],
  ['Small van', 'Small van', 'SMV', 1.0, 30, 10],
  ['Luton', 'Luton tail-lift', 'LUT', 1.6, 60, 15],
  ['7.5t', '7.5 tonne', 'T75', 2.1, 90, 20],
  ['18t', '18 tonne', 'T18', 2.8, 140, 25],
  ['Artic', 'Articulated', 'ART', 3.4, 220, 30],
]

function seed(): Tariff[] {
  return SEED.map(([name, portalName, mapping, costPerMile, minCharge, minMiles], i) => ({
    id: `TAR-${1001 + i}`, name, portalName, mapping, costPerMile, minCharge, minMiles,
  }))
}

interface TariffsState {
  tariffs: Tariff[]
  seq: number
  peekCode(): string
  addTariff(draft: TariffDraft): Tariff
  updateTariff(id: string, patch: Partial<TariffDraft>): void
  deleteTariff(id: string): void
}

export const useTariffsStore = create<TariffsState>((set, get) => ({
  tariffs: seed(),
  seq: 1000 + SEED.length,

  peekCode: () => `TAR-${get().seq + 1}`,

  addTariff: (draft) => {
    const seq = get().seq + 1
    const tariff: Tariff = { ...draft, id: `TAR-${seq}` }
    set((s) => ({ tariffs: [tariff, ...s.tariffs], seq }))
    return tariff
  },

  updateTariff: (id, patch) =>
    set((s) => ({ tariffs: s.tariffs.map((t) => (t.id === id ? { ...t, ...patch } : t)) })),

  deleteTariff: (id) => set((s) => ({ tariffs: s.tariffs.filter((t) => t.id !== id) })),
}))
