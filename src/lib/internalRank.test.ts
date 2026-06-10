import { describe, it, expect } from 'vitest'
import { internalRank, clean, fuzzy, type SavedAddress } from './internalRank.ts'

const saved: SavedAddress[] = [
  { co: 'Northgate Logistics', addr: 'Aire Valley Park', city: 'Leeds', pc: 'LS9 0PX', country: 'England', count: 14 },
  { co: 'Northern Foods', addr: 'Gelderd Road', city: 'Leeds', pc: 'LS12 6EX', country: 'England', count: 3 },
  { co: 'Tesco Extra', addr: 'Winwick Road', city: 'Warrington', pc: 'WA2 7NE', country: 'England', count: 8 },
]

describe('internalRank', () => {
  it('returns [] for queries under 2 (cleaned) chars', () => {
    expect(internalRank('n', saved)).toEqual([])
    expect(internalRank('.', saved)).toEqual([])
  })

  it('matches by company/address/city/pc and ranks by usage count desc', () => {
    const r = internalRank('nor', saved)
    expect(r.map((a) => a.co)).toEqual(['Northgate Logistics', 'Northern Foods'])
  })

  it('matches a city term', () => {
    expect(internalRank('warr', saved).map((a) => a.co)).toEqual(['Tesco Extra'])
  })

  it('caps results at 5', () => {
    const many = Array.from({ length: 9 }, (_, i) => ({
      co: 'Acme ' + i, addr: 'Rd', city: 'Leeds', pc: 'LS1 1AA', country: 'England', count: i,
    }))
    expect(internalRank('acme', many)).toHaveLength(5)
    // highest counts first
    expect(internalRank('acme', many)[0].co).toBe('Acme 8')
  })
})

describe('clean / fuzzy', () => {
  it('clean lowercases, strips punctuation, keeps spaces, trims', () => {
    expect(clean('  Tesco, Extra!  ')).toBe('tesco extra')
  })
  it('fuzzy matches substring or word-prefix', () => {
    expect(fuzzy('northgate logistics', 'gate')).toBe(true) // substring
    expect(fuzzy('northgate logistics', 'log')).toBe(true) // word prefix
    expect(fuzzy('northgate logistics', 'xyz')).toBe(false)
  })
})
