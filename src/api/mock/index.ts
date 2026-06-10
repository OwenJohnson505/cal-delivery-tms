/**
 * Mock API — implements every §5 seam from the prototype's in-memory stubs + simulated
 * latency, so the design reference behaves exactly like the real thing with dummy data.
 *
 * No network calls. Mutations are kept in module-local copies of the fixtures, so the
 * demo behaves statefully within a session (add a contact, upload a doc, post to CX) and
 * resets on reload. To go live, implement the same interfaces against real services and
 * pass them via createApi({ impl }) — see src/api/config.ts. The UI never changes.
 */
import type { Api, AddressPrediction, AuditEntry, BookingDocument, CustomerAccount, CustomerContact, JobSnapshot, StopUpdate } from '../index.ts'
import type { Address, Bid, Driver } from '@/types/index.ts'
import { internalRank, clean, fuzzy, pcKey, type SavedAddress } from '@/lib/index.ts'
import { DEFAULT_LATENCY, type MockLatency } from '../config.ts'
import {
  SAVED, GOOGLE_PREDICT, POSTCODES, DRIVERS, CXBIDS, SIMULATED_BID,
  CUSTOMERS, CONTACTS, DOCS, AUDIT,
} from './data.ts'

/** Resolve after `ms` (0 = next microtask). */
function delay(ms: number): Promise<void> {
  return ms > 0 ? new Promise((r) => setTimeout(r, ms)) : Promise.resolve()
}

function toAddress(
  r: { co: string; addr: string; city: string; pc: string; country: string },
  src: string,
  cls: Address['cls'],
): Address {
  return { co: r.co, address: r.addr, city: r.city, pc: r.pc, country: r.country, src, cls }
}

export function createMockApi(latency: MockLatency = DEFAULT_LATENCY): Api {
  // Session-local mutable copies so the demo is stateful within a load.
  const saved: SavedAddress[] = SAVED.map((a) => ({ ...a }))
  const contacts: CustomerContact[] = CONTACTS.map((c) => ({ ...c }))
  const docs: BookingDocument[] = DOCS.map((d) => ({ ...d }))
  const audit: AuditEntry[] = AUDIT.map((a) => ({ ...a }))
  const snapshots = new Map<string, JobSnapshot>()
  let postSeq = 0
  let auditSeq = audit.length

  async function saveSnapshot(
    snapshot: JobSnapshot,
    status: JobSnapshot['status'],
  ): Promise<JobSnapshot> {
    await delay(latency.generic)
    const next = { ...snapshot, status }
    snapshots.set(next.id, next)
    return next
  }

  return {
    // ── Address find (spec §3) ──────────────────────────────────────────────
    address: {
      internal: {
        async search(query: string): Promise<AddressPrediction[]> {
          await delay(latency.internal)
          return internalRank(query, saved).map((a) => ({
            id: String(saved.indexOf(a)),
            primary: a.co,
            secondary: `${a.addr}, ${a.city} ${a.pc}`,
            source: 'internal',
          }))
        },
        async resolve(id: string): Promise<Address> {
          await delay(latency.internal)
          return toAddress(saved[+id], 'Saved · internal', 'internal')
        },
        async recordUse(id: string): Promise<void> {
          // Production: increment a persisted per-customer usage counter (spec §3.2/§10).
          const a = saved[+id]
          if (a) a.count = (a.count || 0) + 1
        },
      },
      places: {
        async predict(query: string): Promise<AddressPrediction[]> {
          // Mock of Places Autocomplete (prototype googlePredict). sessionToken is
          // ignored here; a real impl reuses it across keystrokes to bill once/session.
          await delay(latency.places)
          const q = clean(query)
          if (!q) return []
          return GOOGLE_PREDICT.filter((p) => fuzzy(p.main + ' ' + p.sec, q))
            .slice(0, 6)
            .map((p) => ({
              id: String(GOOGLE_PREDICT.indexOf(p)),
              primary: p.main,
              secondary: p.sec,
              source: 'places',
            }))
        },
        async details(placeId: string): Promise<Address> {
          // Mock of Place Details — the BILLED step (prototype pickPred delay).
          await delay(latency.places)
          return toAddress(GOOGLE_PREDICT[+placeId], 'Google Places', 'places')
        },
      },
      postcode: {
        async lookup(postcode: string): Promise<Address[]> {
          await delay(latency.postcode)
          return (POSTCODES[pcKey(postcode)] || []).map((r) =>
            toAddress(r, 'Postcode lookup', 'postcode'),
          )
        },
      },
    },

    // ── Customer / accounts (spec §2.3) ─────────────────────────────────────
    customer: {
      async searchAccounts(query: string): Promise<CustomerAccount[]> {
        await delay(latency.generic)
        const q = clean(query)
        if (!q) return []
        return CUSTOMERS.filter((acc) => {
          if (fuzzy(acc.name, q)) return true
          // also match an account by any of its contacts' name/email (spec §2.3)
          return contacts.some((c) => c.cust === acc.id && fuzzy(c.name + ' ' + c.email, q))
        })
      },
      async searchContacts(query: string, accountId?: string): Promise<CustomerContact[]> {
        await delay(latency.generic)
        const q = clean(query)
        const accName = (id: string) => CUSTOMERS.find((a) => a.id === id)?.name || ''
        return contacts.filter((c) => {
          if (accountId && c.cust !== accountId) return false
          if (!q) return !!accountId // empty query: list the account's contacts
          return fuzzy(c.name + ' ' + c.email + ' ' + accName(c.cust), q)
        })
      },
      async createContact(
        accountId: string,
        contact: Omit<CustomerContact, 'cust'>,
      ): Promise<CustomerContact> {
        await delay(latency.generic)
        const created: CustomerContact = { ...contact, cust: accountId }
        contacts.push(created)
        return created
      },
    },

    // ── Driver availability + CX bid feed (spec §9) ─────────────────────────
    drivers: {
      async searchDrivers(query: string): Promise<Driver[]> {
        // Prototype drvInput: lowercased substring over "name id", capped at 8.
        await delay(latency.generic)
        const q = (query || '').toLowerCase().trim()
        if (!q) return DRIVERS.slice()
        return DRIVERS.filter(
          (d) => (d.name + ' ' + (d.id || '')).toLowerCase().indexOf(q) >= 0,
        ).slice(0, 8)
      },
      async listDrivers(): Promise<Driver[]> {
        await delay(latency.generic)
        return DRIVERS.slice()
      },
      async listBids(): Promise<Bid[]> {
        await delay(latency.generic)
        return CXBIDS.slice()
      },
      subscribeBids(_jobId: string, onBids: (bids: Bid[]) => void): () => void {
        // Real impl: poll or open a websocket to the CX bid feed. Here we emit the
        // current bids, then (optionally) one simulated incoming bid after a delay.
        const bids = CXBIDS.slice()
        onBids(bids.slice())
        let timer: ReturnType<typeof setTimeout> | undefined
        if (latency.bidSimulationMs > 0) {
          timer = setTimeout(() => {
            bids.push(SIMULATED_BID)
            onBids(bids.slice())
          }, latency.bidSimulationMs)
        }
        return () => {
          if (timer) clearTimeout(timer)
        }
      },
    },

    // ── Courier Exchange posting (spec §8) ──────────────────────────────────
    cx: {
      async post(input): Promise<{ postingId: string }> {
        // Real impl: POST buildCxNotes() output (input.notes) to the CX API.
        await delay(latency.generic)
        return { postingId: `CX-POST-${input.jobId}-${++postSeq}` }
      },
    },

    // ── Ops: inbound status/ETA/POD webhooks (spec §7) ──────────────────────
    ops: {
      subscribeStopUpdates(_jobId: string, _onUpdate: (u: StopUpdate) => void): () => void {
        // Real impl: subscribe to driver-app webhooks/websocket; run incoming ETAs
        // through lib/etaToClock before applying. The mock emits nothing by default
        // (drive UI demos from the seed pod/status on the stops instead).
        return () => {}
      },
    },

    // ── Documents (spec §9) ─────────────────────────────────────────────────
    documents: {
      async list(): Promise<BookingDocument[]> {
        await delay(latency.generic)
        return docs.slice()
      },
      async upload(_jobId, file, opts): Promise<BookingDocument> {
        await delay(latency.generic)
        const created: BookingDocument = {
          id: `doc-${docs.length + 1}`,
          name: file.name,
          mime: file.type || 'application/octet-stream',
          stopId: opts?.stopId,
          url: '#',
        }
        docs.push(created)
        return created
      },
      async remove(_jobId, documentId): Promise<void> {
        await delay(latency.generic)
        const i = docs.findIndex((d) => d.id === documentId)
        if (i >= 0) docs.splice(i, 1)
      },
    },

    // ── Audit log (spec §9) ─────────────────────────────────────────────────
    audit: {
      async list(): Promise<AuditEntry[]> {
        await delay(latency.generic)
        return audit.slice()
      },
      async append(_jobId, entry): Promise<AuditEntry> {
        await delay(latency.generic)
        const created: AuditEntry = { ...entry, id: `a${++auditSeq}` }
        audit.push(created)
        return created
      },
    },

    // ── Persistence: Draft/Quote/Booking (spec §10) ─────────────────────────
    persistence: {
      async load(jobId): Promise<JobSnapshot> {
        await delay(latency.generic)
        return snapshots.get(jobId) || { id: jobId, status: 'Draft' }
      },
      saveDraft(snapshot): Promise<JobSnapshot> {
        return saveSnapshot(snapshot, 'Draft')
      },
      saveQuote(snapshot): Promise<JobSnapshot> {
        return saveSnapshot(snapshot, 'Quote')
      },
      saveBooking(snapshot): Promise<JobSnapshot> {
        return saveSnapshot(snapshot, 'Booking')
      },
    },
  }
}
