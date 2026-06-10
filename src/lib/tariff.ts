/**
 * Tariff pricing. A tariff has a per-mile rate, a minimum charge, and a number of
 * minimum miles that the minimum charge already covers.
 *
 * Worked example (spec): a 100-mile job on a £1/mile tariff with 30 min miles and a
 * £100 min charge →
 *   chargeable miles = 100 − 30 = 70
 *   mileage          = 70 × £1 = £70
 *   + min charge (covers the first 30) = £100
 *   total            = £170
 */
export interface TariffRate {
  costPerMile: number
  minCharge: number
  minMiles: number
}

/** Quote a job's price from its mileage and a tariff's rate. Never goes below the
 * minimum charge (a job under the minimum miles is just the min charge). */
export function quoteTariff(miles: number, t: TariffRate): number {
  const chargeable = Math.max(0, (miles || 0) - (t.minMiles || 0))
  return chargeable * (t.costPerMile || 0) + (t.minCharge || 0)
}
