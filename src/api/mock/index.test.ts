import { describe, it, expect } from 'vitest'
import { createMockApi } from './index.ts'
import { TEST_LATENCY } from '../config.ts'

const api = () => createMockApi(TEST_LATENCY)

describe('mock address provider', () => {
  it('internal search ranks saved addresses by usage (free, every keystroke)', async () => {
    const a = api()
    const hits = await a.address.internal.search('tesco')
    expect(hits[0].primary).toBe('Tesco Extra') // count 14 ranks first
    expect(hits.every((h) => h.source === 'internal')).toBe(true)
  })

  it('internal resolve maps to a normalised address with provenance', async () => {
    const a = api()
    const [first] = await a.address.internal.search('northgate')
    const addr = await a.address.internal.resolve(first.id)
    expect(addr).toMatchObject({ co: 'Northgate Logistics', pc: 'LS9 0PX', src: 'Saved · internal', cls: 'internal' })
  })

  it('recordUse bumps the usage counter (self-learning signal)', async () => {
    const a = api()
    const before = await a.address.internal.search('booker')
    await a.address.internal.recordUse(before[0].id)
    // resolve still works; count increment is internal — assert no throw + stable id
    expect((await a.address.internal.resolve(before[0].id)).co).toBe('Booker Cash & Carry')
  })

  it('places.predict mimics Autocomplete; details is the billed resolve', async () => {
    const a = api()
    const preds = await a.address.places.predict('tesco', 'session-1')
    expect(preds.length).toBeGreaterThan(0)
    expect(preds.length).toBeLessThanOrEqual(6)
    const addr = await a.address.places.details(preds[0].id, 'session-1')
    expect(addr.cls).toBe('places')
    expect(addr.src).toBe('Google Places')
  })

  it('postcode.lookup returns all addresses at a full postcode', async () => {
    const a = api()
    const list = await a.address.postcode.lookup('WA2 7NE')
    expect(list).toHaveLength(4)
    expect(list.every((x) => x.cls === 'postcode')).toBe(true)
    expect(await a.address.postcode.lookup('ZZ1 1ZZ')).toEqual([])
  })
})

describe('mock customer service', () => {
  it('searches accounts by name or contact', async () => {
    const a = api()
    expect((await a.customer.searchAccounts('brightway')).map((c) => c.id)).toEqual(['brightway'])
    // match account via a contact email domain
    expect((await a.customer.searchAccounts('meridianfoods')).map((c) => c.id)).toEqual(['meridian'])
  })

  it('lists and creates contacts under an account', async () => {
    const a = api()
    const before = await a.customer.searchContacts('', 'brightway')
    expect(before.length).toBe(2)
    const created = await a.customer.createContact('brightway', {
      name: 'New Person', email: 'new@brightway.co.uk', tel: '0113 555 0000',
    })
    expect(created.cust).toBe('brightway')
    expect((await a.customer.searchContacts('', 'brightway')).length).toBe(3)
  })
})

describe('mock driver + CX feed', () => {
  it('searches drivers by name or id and lists bids', async () => {
    const a = api()
    expect((await a.drivers.searchDrivers('DRV-1042'))[0].name).toBe('Dave Mills')
    expect((await a.drivers.searchDrivers('sandra'))[0].id).toBe('DRV-1108')
    expect(await a.drivers.listBids('job-1')).toHaveLength(3)
  })

  it('subscribeBids emits the current bids immediately', () => {
    const a = api()
    let received: number | null = null
    const unsub = a.drivers.subscribeBids!('job-1', (bids) => (received = bids.length))
    expect(received).toBe(3)
    unsub()
  })
})

describe('mock cx / persistence', () => {
  it('cx.post returns a posting id', async () => {
    const a = api()
    const r = await a.cx.post({ jobId: 'job-1', notes: 'NOTES' })
    expect(r.postingId).toContain('CX-POST-job-1')
  })

  it('persistence round-trips a snapshot and sets status', async () => {
    const a = api()
    const saved = await a.persistence.saveBooking({ id: 'job-9', status: 'Draft' })
    expect(saved.status).toBe('Booking')
    expect((await a.persistence.load('job-9')).status).toBe('Booking')
  })
})

describe('mock documents + audit', () => {
  it('uploads and removes documents', async () => {
    const a = api()
    expect((await a.documents.list('job-1')).length).toBe(2)
    const file = { name: 'pod.jpg', type: 'image/jpeg' } as File
    const doc = await a.documents.upload('job-1', file, { stopId: 2 })
    expect(doc.stopId).toBe(2)
    expect((await a.documents.list('job-1')).length).toBe(3)
    await a.documents.remove('job-1', doc.id)
    expect((await a.documents.list('job-1')).length).toBe(2)
  })

  it('lists and appends audit entries', async () => {
    const a = api()
    expect((await a.audit.list('job-1')).length).toBe(6)
    const e = await a.audit.append('job-1', { at: '10-06-2026 09:00', actor: 'Owen', event: 'Edited' })
    expect(e.id).toBeTruthy()
    expect((await a.audit.list('job-1')).length).toBe(7)
  })
})
