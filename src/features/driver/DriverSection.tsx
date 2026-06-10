/**
 * Driver section in the rail (prototype lines 534-537 / renderDriver). Shows the allocated
 * driver card (id/rate/ETA, copy id) or an inline search to allocate. "Browse options"
 * opens the Providers drawer.
 */
import { useState } from 'react'
import { Icon } from '@/app/Icon.tsx'
import { useApi } from '@/api/ApiProvider.tsx'
import { useBookingStore } from '@/store/bookingStore.ts'
import { useUiStore } from '@/store/uiStore.ts'
import { etaToClock } from '@/lib/index.ts'
import type { Driver } from '@/types/index.ts'

export function DriverSection() {
  const api = useApi()
  const allocated = useBookingStore((s) => s.allocatedDriver)
  const setAllocatedDriver = useBookingStore((s) => s.setAllocatedDriver)
  const openDrawer = useUiStore((s) => s.openDrawer)

  const [q, setQ] = useState('')
  const [matches, setMatches] = useState<Driver[]>([])

  async function search(value: string) {
    setQ(value)
    if (!value.trim()) {
      setMatches([])
      return
    }
    setMatches((await api.drivers.searchDrivers(value)).slice(0, 8))
  }

  function allocate(d: Driver) {
    setAllocatedDriver({
      name: d.name,
      vehicle: d.vehicle,
      id: d.id || '',
      rate: '',
      eta: etaToClock(d.eta || ''),
    })
    setQ('')
    setMatches([])
  }

  return (
    <div className="rsec" id="drvSec">
      <h3>
        Driver{' '}
        <span
          className="dsec-eye"
          title="Search to allocate a driver directly, or use “Browse options” to see interested drivers and CX bids."
        >
          <Icon name="eye" size={13} />
        </span>
        <span className="r">
          <span className="discl" onClick={() => openDrawer('providers')}>Browse options</span>
        </span>
      </h3>
      <div id="driverBox">
        {allocated ? (
          <div className="dcard interested">
            <div className="dc-top">
              <b>{allocated.name}</b>
              {allocated.id && (
                <span
                  className="cc-tag cpx"
                  title="Click to copy ID"
                  onClick={() => navigator.clipboard?.writeText(allocated.id)}
                >
                  {allocated.id}
                </span>
              )}
              <button className="btn sm" onClick={() => setAllocatedDriver(null)}>Unallocate</button>
            </div>
            <div className="dc-sub">
              {allocated.vehicle}
              {allocated.eta && ` · ETA ${allocated.eta}`}
              {allocated.rate && ` · £${allocated.rate}`}
            </div>
          </div>
        ) : (
          <div className="drv-find">
            <div className="ac">
              <input
                type="text"
                placeholder="Search driver name or ID…"
                autoComplete="off"
                value={q}
                onChange={(e) => search(e.target.value)}
              />
              {matches.length > 0 && (
                <div className="ac-menu open">
                  {matches.map((d) => (
                    <div key={d.id} className="cb-opt" onMouseDown={() => allocate(d)}>
                      <div className="co">
                        {d.name} <span className="cc-tag">{d.id}</span>
                      </div>
                      <div className="ad">
                        {d.vehicle} · {d.loc} · ETA {d.eta}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
