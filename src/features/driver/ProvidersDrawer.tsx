/**
 * Providers drawer (prototype renderProviders, lines 1341-1355): internal drivers
 * (interested / available) + CX bids, and the Courier Exchange posting block — the live
 * generated notes (buildCxNotes), editable until posted, then frozen (spec §8).
 */
import { useEffect, useState } from 'react'
import { Icon } from '@/app/Icon.tsx'
import { useApi } from '@/api/ApiProvider.tsx'
import { useBookingStore } from '@/store/bookingStore.ts'
import { useUiStore } from '@/store/uiStore.ts'
import { useGeneratedCxNotes } from '@/store/selectors.ts'
import { etaToClock } from '@/lib/index.ts'
import type { Bid, Driver } from '@/types/index.ts'

export function ProvidersDrawer() {
  const api = useApi()
  const open = useUiStore((s) => s.drawer === 'providers')
  const closeDrawers = useUiStore((s) => s.closeDrawers)
  const setProvSeen = useUiStore((s) => s.setProvSeen)

  const allocated = useBookingStore((s) => s.allocatedDriver)
  const setAllocatedDriver = useBookingStore((s) => s.setAllocatedDriver)
  const cx = useBookingStore((s) => s.cx)
  const setCxNotes = useBookingStore((s) => s.setCxNotes)
  const markCxDirty = useBookingStore((s) => s.markCxDirty)
  const markCxPosted = useBookingStore((s) => s.markCxPosted)
  const generated = useGeneratedCxNotes()

  const [drivers, setDrivers] = useState<Driver[]>([])
  const [bids, setBids] = useState<Bid[]>([])

  useEffect(() => {
    if (!open) return
    api.drivers.listDrivers().then(setDrivers)
    setProvSeen(8)
    if (api.drivers.subscribeBids) {
      return api.drivers.subscribeBids('job-1', setBids)
    }
    api.drivers.listBids('job-1').then(setBids)
  }, [open, api, setProvSeen])

  if (!open) return null

  const interested = drivers.filter((d) => d.interested)
  const avail = drivers.filter((d) => !d.interested)
  const notesValue = cx.dirty || cx.posted ? cx.text : generated

  function allocateDriver(name: string, vehicle: string, id: string, rate: string, eta: string) {
    setAllocatedDriver({ name, vehicle, id, rate, eta: etaToClock(eta) })
    closeDrawers()
  }

  return (
    <div className="drawer open" id="provDrawer">
      <div className="drawer-h">
        Service providers
        <span className="x" onClick={closeDrawers}>✕</span>
      </div>
      <div className="drawer-list" id="provList">
        {/* Internal drivers */}
        <div className="prov-sec">
          <div className="prov-h">Internal drivers</div>
          <div className="prov-sub">Interested in this job</div>
          {interested.length ? (
            interested.map((d) => (
              <DriverCard key={d.id} d={d} onAllocate={allocateDriver} />
            ))
          ) : (
            <div className="hint">None yet.</div>
          )}
          <div className="prov-sub">Available now</div>
          {avail.length ? (
            avail.map((d) => <DriverCard key={d.id} d={d} onAllocate={allocateDriver} />)
          ) : (
            <div className="hint">None available.</div>
          )}
        </div>

        {/* Courier Exchange */}
        <div className="prov-sec">
          <div className="prov-h">Third-party systems</div>
          <div className="cx">
            <div className="cx-h">
              <Icon name="truck" size={16} /> Courier Exchange (CX)
              {cx.posted && (
                <span className="itag" style={{ marginLeft: 'auto' }}>Posted</span>
              )}
            </div>
            <div className="prov-sub" style={{ margin: '12px 0 6px' }}>
              Bids received ({bids.length})
            </div>
            {bids.length ? (
              bids.map((b) => <BidCard key={b.id} b={b} onAccept={allocateDriver} />)
            ) : (
              <div className="hint">No bids yet.</div>
            )}

            <div className="fld" style={{ marginTop: 10 }}>
              <label>
                Posting notes{' '}
                <span
                  className="discl"
                  style={{ marginLeft: 8, fontWeight: 600 }}
                  onClick={() => {
                    setCxNotes(generated)
                    markCxDirty(false)
                  }}
                >
                  Rebuild from booking
                </span>
              </label>
              <textarea
                rows={10}
                value={notesValue}
                disabled={cx.posted}
                onChange={(e) => {
                  setCxNotes(e.target.value)
                  markCxDirty(true)
                }}
              />
            </div>
            <button
              className="btn primary"
              style={{ marginTop: 9 }}
              disabled={cx.posted}
              onClick={async () => {
                await api.cx.post({ jobId: 'job-1', notes: notesValue })
                markCxPosted()
              }}
            >
              {cx.posted ? 'Posted to Courier Exchange' : 'Post to Courier Exchange'}
            </button>
            {!allocated && (
              <div className="hint" style={{ textAlign: 'center', marginTop: 9 }}>
                Bids appear live; accept one to allocate.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

function DriverCard({
  d,
  onAllocate,
}: {
  d: Driver
  onAllocate: (n: string, v: string, id: string, rate: string, eta: string) => void
}) {
  return (
    <div className={'dcard' + (d.interested ? ' interested' : '')}>
      <div className="dc-top">
        <b>{d.name}</b>
        {d.interested && <span className="itag">Interested</span>}
        <button
          className="btn primary sm"
          onClick={() => onAllocate(d.name, d.vehicle, d.id || '', '', d.eta || '')}
        >
          Allocate
        </button>
      </div>
      <div className="dc-sub">
        {d.vehicle} · {d.loc} · ETA {d.eta}
      </div>
    </div>
  )
}

function BidCard({
  b,
  onAccept,
}: {
  b: Bid
  onAccept: (n: string, v: string, id: string, rate: string, eta: string) => void
}) {
  return (
    <div className="dcard">
      <div className="dc-top">
        <b>{b.name}</b>
        <span className="itag" style={{ background: '#fff4d6', color: '#7a5d00' }}>{b.price}</span>
        <button
          className="btn primary sm"
          onClick={() => onAccept(b.name, b.vehicle, b.id || '', b.price.replace(/[^0-9.]/g, ''), '')}
        >
          Accept
        </button>
      </div>
      <div className="dc-sub">
        {b.vehicle} · {b.loc} · ★ {b.rating}
      </div>
    </div>
  )
}
