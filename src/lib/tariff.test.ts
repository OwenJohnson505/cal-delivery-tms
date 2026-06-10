import { describe, it, expect } from 'vitest'
import { quoteTariff } from './tariff.ts'

describe('quoteTariff', () => {
  it('matches the worked £170 example', () => {
    // 100 miles, £1/mile, 30 min miles, £100 min charge → (100-30)*1 + 100 = 170
    expect(quoteTariff(100, { costPerMile: 1, minMiles: 30, minCharge: 100 })).toBe(170)
  })

  it('charges only the minimum when under the minimum miles', () => {
    expect(quoteTariff(20, { costPerMile: 1, minMiles: 30, minCharge: 100 })).toBe(100)
    expect(quoteTariff(30, { costPerMile: 1, minMiles: 30, minCharge: 100 })).toBe(100)
  })

  it('handles a higher rate', () => {
    // 50 miles, £2.5/mile, 10 min miles, £40 min → (50-10)*2.5 + 40 = 140
    expect(quoteTariff(50, { costPerMile: 2.5, minMiles: 10, minCharge: 40 })).toBe(140)
  })
})
