/**
 * Dummy datasets — extracted verbatim from the prototype's in-memory stubs so the mock
 * API behaves exactly like the reference build. Source lines in
 * reference/booking-form-modern.html: SAVED 580, GOOGLE_PREDICT 587, POSTCODES 597,
 * DRIVERS 1224, CXBIDS 1231, DOCS 1237, CUSTINFO 1241, AUDIT 1247, CUSTOMERS 1408,
 * CONTACTS 1414.
 *
 * This is the single place a developer edits to change the demo data. When wiring real
 * services, these become the fallback/seed only — see src/api/config.ts.
 */
import type { SavedAddress } from '@/lib/index.ts'
import type { Bid, Driver } from '@/types/index.ts'
import type {
  AuditEntry,
  BookingDocument,
  CustomerAccount,
  CustomerContact,
} from '../index.ts'

/** A Google Places-style two-line prediction with its resolvable full address. */
export interface GooglePrediction {
  main: string
  sec: string
  co: string
  addr: string
  city: string
  pc: string
  country: string
}

/** A postcode-lookup candidate (no usage count). */
export interface PostcodeAddress {
  co: string
  addr: string
  city: string
  pc: string
  country: string
}

export const SAVED: SavedAddress[] = [
  { co: 'Tesco Extra', addr: 'Winwick Road', city: 'Warrington', pc: 'WA2 7NE', country: 'England', count: 14 },
  { co: 'Northgate Logistics', addr: 'Unit 7, Aire Valley Park', city: 'Leeds', pc: 'LS9 0PX', country: 'England', count: 9 },
  { co: 'Forsyth Retail Group', addr: '19 Maple Court Estate', city: 'Manchester', pc: 'M15 4FN', country: 'England', count: 6 },
  { co: 'Tesco Express', addr: 'Kirkstall Road', city: 'Leeds', pc: 'LS4 2AB', country: 'England', count: 3 },
  { co: 'Booker Cash & Carry', addr: 'Loushers Lane', city: 'Warrington', pc: 'WA4 1PX', country: 'England', count: 2 },
]

export const GOOGLE_PREDICT: GooglePrediction[] = [
  { main: 'Tesco Warrington', sec: 'Winwick Road, Warrington', co: 'Tesco Extra', addr: 'Winwick Road', city: 'Warrington', pc: 'WA2 7NE', country: 'England' },
  { main: 'Tesco Extra Warrington', sec: 'Cromwell Avenue, Warrington', co: 'Tesco Extra', addr: 'Cromwell Avenue', city: 'Warrington', pc: 'WA2 7PT', country: 'England' },
  { main: 'Tesco Express', sec: 'Kirkstall Road, Leeds', co: 'Tesco Express', addr: 'Kirkstall Road', city: 'Leeds', pc: 'LS4 2AB', country: 'England' },
  { main: 'Tesco Petrol Station', sec: 'Winwick Road, Warrington', co: 'Tesco Petrol Station', addr: 'Winwick Road', city: 'Warrington', pc: 'WA2 8LT', country: 'England' },
  { main: 'Tesla Supercharger', sec: 'Gemini Retail Park, Warrington', co: 'Tesla Supercharger', addr: 'Gemini Retail Park', city: 'Warrington', pc: 'WA5 7TY', country: 'England' },
  { main: 'IKEA Warrington', sec: 'Gemini Retail Park, Westbrook', co: 'IKEA Warrington', addr: 'Gemini Retail Park, Westbrook', city: 'Warrington', pc: 'WA5 7TY', country: 'England' },
  { main: 'Greggs', sec: 'Bridge Street, Warrington', co: 'Greggs', addr: 'Bridge Street', city: 'Warrington', pc: 'WA1 2RN', country: 'England' },
  { main: 'B&Q Liverpool', sec: 'Edge Lane, Liverpool', co: 'B&Q Liverpool', addr: 'Auckland Road, Edge Lane', city: 'Liverpool', pc: 'L7 9PG', country: 'England' },
]

export const POSTCODES: Record<string, PostcodeAddress[]> = {
  WA27NE: [
    { co: 'Tesco Extra', addr: 'Winwick Road', city: 'Warrington', pc: 'WA2 7NE', country: 'England' },
    { co: 'Unit 1, Winwick Trade Park', addr: 'Winwick Road', city: 'Warrington', pc: 'WA2 7NE', country: 'England' },
    { co: 'Unit 2, Winwick Trade Park', addr: 'Winwick Road', city: 'Warrington', pc: 'WA2 7NE', country: 'England' },
    { co: 'Northgate House', addr: 'Winwick Road', city: 'Warrington', pc: 'WA2 7NE', country: 'England' },
  ],
  LS90PX: [
    { co: 'Northgate Logistics', addr: 'Unit 7, Aire Valley Park', city: 'Leeds', pc: 'LS9 0PX', country: 'England' },
    { co: 'Unit 5, Aire Valley Park', addr: 'Aire Valley Park', city: 'Leeds', pc: 'LS9 0PX', country: 'England' },
  ],
  M154FN: [
    { co: 'Forsyth Retail Group', addr: '19 Maple Court Estate', city: 'Manchester', pc: 'M15 4FN', country: 'England' },
    { co: 'Maple Court Reception', addr: 'Maple Court Estate', city: 'Manchester', pc: 'M15 4FN', country: 'England' },
  ],
}

export const DRIVERS: Driver[] = [
  { id: 'DRV-1042', name: 'Dave Mills', vehicle: '18t curtain-side', loc: 'Leeds · 4 mi', eta: '12 min', interested: true },
  { id: 'DRV-1108', name: 'Sandra Bell', vehicle: 'Luton + tail-lift', loc: 'Bradford · 9 mi', eta: '25 min', interested: true },
  { id: 'DRV-1190', name: 'Mark Twose', vehicle: '7.5t box', loc: 'Wakefield · 14 mi', eta: '30 min', interested: false },
  { id: 'DRV-1205', name: 'Priya N.', vehicle: 'Small van', loc: 'Leeds · 6 mi', eta: '15 min', interested: false },
  { id: 'DRV-1233', name: 'Owen R.', vehicle: '40ft artic', loc: 'Castleford · 18 mi', eta: '40 min', interested: false },
]

export const CXBIDS: Bid[] = [
  { id: 'CX-7741', name: 'Pinnacle Logistics', vehicle: '18t curtain-side', loc: 'Leeds · 1,250 jobs', rating: '4.9', price: '£420' },
  { id: 'CX-6620', name: 'RapidFreight Ltd', vehicle: 'Luton + tail-lift', loc: 'Manchester · 980 jobs', rating: '4.7', price: '£395' },
  { id: 'CX-8033', name: 'Northern Haulage Co', vehicle: '7.5t box', loc: 'Wakefield · 540 jobs', rating: '4.8', price: '£450' },
]

/** A demo bid the UI can inject to mimic an incoming CX bid (prototype simulateBid). */
export const SIMULATED_BID: Bid = {
  id: 'CX-9120',
  name: 'Crossflight Express',
  vehicle: 'Small van',
  loc: 'Leeds · 310 jobs',
  rating: '4.6',
  price: '£365',
}

export const CUSTOMERS: CustomerAccount[] = [
  { id: 'brightway', name: 'Brightway Trading Ltd', refs: ['BW-2025-0481', 'BW-2025-0479', 'BW-2025-0466'] },
  { id: 'meridian', name: 'Meridian Foods', refs: ['PO 88213', 'PO 88010', 'PO 87765'] },
  { id: 'cal', name: 'Cal Logistics', refs: [] },
  { id: 'orbit', name: 'Orbit Retail', refs: ['Xmas reorder', 'store 14 restock', 'sample run'] },
]

export const CONTACTS: CustomerContact[] = [
  { name: 'Sarah Doyle', email: 's.doyle@brightway.co.uk', tel: '0113 555 0148', cust: 'brightway' },
  { name: 'James Hill', email: 'j.hill@brightway.co.uk', tel: '0113 555 0150', cust: 'brightway' },
  { name: 'Sarah Doyle', email: 'sarah@meridianfoods.com', tel: '0161 555 7781', cust: 'meridian' },
  { name: 'Tom Baker', email: 'tom@callogistics.co.uk', tel: '0151 555 2200', cust: 'cal' },
  { name: 'Priya Shah', email: 'priya@orbitretail.com', tel: '0161 555 9001', cust: 'orbit' },
]

/** Customer info pack (prototype CUSTINFO). */
export const CUSTINFO = {
  open: [
    ['Monday', '06:00 – 20:00'], ['Tuesday', '06:00 – 20:00'], ['Wednesday', '06:00 – 20:00'],
    ['Thursday', '06:00 – 20:00'], ['Friday', '06:00 – 20:00'], ['Saturday', '07:00 – 14:00'],
    ['Sunday', 'Closed'],
  ] as Array<[string, string]>,
  goodsIn: '07:00 – 16:30 · booking required',
  ooh: { name: 'Site security · Gate 2', tel: '07700 900221' },
  notes: 'No deliveries 12:00–13:00 (shift change). Max vehicle 18t on site. Report to Gate 2 on arrival.',
}

export const DOCS: BookingDocument[] = [
  { id: 'doc-1', name: 'Customer PO - 88421.pdf', mime: 'application/pdf', url: '#', /* global */ },
  { id: 'doc-2', name: 'Hazard data sheet.pdf', mime: 'application/pdf', url: '#', stopId: 1 },
]

export const AUDIT: AuditEntry[] = [
  { id: 'a1', at: '06-06-2026 18:40', actor: 'Owen Johnson', event: 'Quote created', meta: { icon: 'note', detail: 'Initial quote £420 raised for Brightway Trading Ltd.' } },
  { id: 'a2', at: '06-06-2026 18:53', actor: 'Owen Johnson', event: 'Booked in', meta: { icon: 'check', detail: 'Quote converted to a confirmed booking · Our Ref BK-2026-100482.' } },
  { id: 'a3', at: '06-06-2026 19:02', actor: 'Owen Johnson', event: 'Posted to Courier Exchange', meta: { icon: 'truck', detail: 'Job advertised to the CX network.' } },
  { id: 'a4', at: '06-06-2026 19:20', actor: 'CX network', event: 'Driver allocated', meta: { icon: 'user', detail: 'Dave Mills (18t curtain-side) accepted the job via CX.' } },
  { id: 'a5', at: '06-06-2026 19:05', actor: 'Owen Johnson', event: 'Proof of collection added', meta: { icon: 'camera', detail: 'Added manually at LS9 0PX, signed by D. Whitaker.', pod: { type: 'POB', via: 'Manual', by: 'Owen Johnson', at: '06-06-2026 19:05', name: 'D. Whitaker', sig: true, photos: 1 } } },
  { id: 'a6', at: '07-06-2026 09:42', actor: 'Courier Exchange', event: 'Proof of delivery added', meta: { icon: 'camera', detail: 'Received via the CX API at WA2 7NE, signed by S. Doyle.', pod: { type: 'POD', via: 'CX API', by: 'Courier Exchange', at: '07-06-2026 09:42', name: 'S. Doyle', sig: true, photos: 2 } } },
]
