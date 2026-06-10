/**
 * Dummy company + credit lookups. Stand in for:
 *  - an HMRC / Companies House style lookup (by trading name OR company reg number)
 *    that pre-fills the registered name + address (§ "Company Address" / reg number).
 *  - a CreditSafe-style credit lookup (by reg number) for score + limit.
 *
 * All data is fabricated. Replace with the real services later (same function shapes).
 */

export interface CompanyAddress {
  postcode: string
  line1: string
  line2: string
  city: string
  town: string
  country: string
}

export interface CompanyLookupResult {
  tradingName: string
  companyRegNumber: string
  address: CompanyAddress
}

/** A few canned companies; any other query returns a generated stub so search always "works". */
const KNOWN: CompanyLookupResult[] = [
  { tradingName: 'Owen Transport Limited', companyRegNumber: '04561238', address: { postcode: 'LS9 0PX', line1: 'Unit 7, Aire Valley Park', line2: '', city: 'Leeds', town: 'West Yorkshire', country: 'United Kingdom' } },
  { tradingName: 'Brightway Trading Ltd', companyRegNumber: '07788219', address: { postcode: 'M15 4FN', line1: '19 Maple Court Estate', line2: '', city: 'Manchester', town: 'Greater Manchester', country: 'United Kingdom' } },
  { tradingName: 'Meridian Foods Ltd', companyRegNumber: '05231904', address: { postcode: 'WA2 7NE', line1: 'Winwick Road', line2: 'Trade Park', city: 'Warrington', town: 'Cheshire', country: 'United Kingdom' } },
]

function genReg(seed: string): string {
  let n = 0
  for (let i = 0; i < seed.length; i++) n = (n * 31 + seed.charCodeAt(i)) % 100000000
  return String(10000000 + (n % 89999999))
}

/** Look a company up by trading name (fuzzy) or exact-ish reg number. */
export function lookupCompany(query: string): CompanyLookupResult | null {
  const q = query.trim().toLowerCase()
  if (!q) return null
  const byReg = KNOWN.find((c) => c.companyRegNumber === query.trim())
  if (byReg) return byReg
  const byName = KNOWN.find((c) => c.tradingName.toLowerCase().includes(q))
  if (byName) return byName
  // generated stub so any search returns something to demo the pre-fill
  const titled = query.trim().replace(/\b\w/g, (m) => m.toUpperCase())
  return {
    tradingName: /ltd|limited|plc/i.test(titled) ? titled : `${titled} Ltd`,
    companyRegNumber: genReg(q),
    address: { postcode: '', line1: '', line2: '', city: '', town: '', country: 'United Kingdom' },
  }
}

export interface CreditResult {
  creditScore: number
  creditLimit: number
}

/** Dummy credit lookup keyed off the reg number (deterministic). */
export function lookupCredit(regNumber: string): CreditResult {
  let n = 0
  for (let i = 0; i < regNumber.length; i++) n = (n * 17 + regNumber.charCodeAt(i)) % 100000
  const score = 40 + (n % 60) // 40–99
  const limit = (5 + (n % 20)) * 1000 // £5k–£24k
  return { creditScore: score, creditLimit: limit }
}
