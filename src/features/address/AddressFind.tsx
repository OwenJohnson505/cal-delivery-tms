/**
 * Smart address find (spec §3): internal saved DB free on every keystroke, Google Places
 * on explicit Search (predictions cheap, Place Details billed on select), full-postcode
 * lookup. Selection writes a normalised address to the stop. Wired to the mock API.
 */
import { useState } from 'react'
import { Icon } from '@/app/Icon.tsx'
import { useApi } from '@/api/ApiProvider.tsx'
import { isFullPostcode } from '@/lib/index.ts'
import type { Address } from '@/types/index.ts'
import type { AddressPrediction } from '@/api/index.ts'

export function AddressFind({
  value,
  onPick,
}: {
  value: string
  onPick: (addr: Address) => void
}) {
  const api = useApi()
  const [q, setQ] = useState(value)
  const [internal, setInternal] = useState<AddressPrediction[]>([])
  const [places, setPlaces] = useState<AddressPrediction[]>([])
  const [postcodes, setPostcodes] = useState<Address[]>([])
  const [busy, setBusy] = useState('')

  async function onType(v: string) {
    setQ(v)
    setPlaces([])
    setPostcodes([])
    if (v.trim().length < 2 && !isFullPostcode(v)) {
      setInternal([])
      return
    }
    setInternal(await api.address.internal.search(v))
  }

  // After any selection: blank the search box and drop every suggestion list so the
  // user can move straight on (the chosen address shows in the fields below).
  function clearSearch() {
    setQ('')
    setInternal([])
    setPlaces([])
    setPostcodes([])
    setBusy('')
  }

  async function pickInternal(p: AddressPrediction) {
    const addr = await api.address.internal.resolve(p.id)
    await api.address.internal.recordUse(p.id)
    onPick(addr)
    clearSearch()
  }

  async function doPlaces() {
    setBusy('places')
    setPlaces(await api.address.places.predict(q, 'session-1'))
    setBusy('')
  }

  async function pickPrediction(p: AddressPrediction) {
    setBusy('details') // Place Details — the billed step
    const addr = await api.address.places.details(p.id, 'session-1')
    onPick(addr)
    clearSearch()
  }

  async function doPostcode() {
    if (!isFullPostcode(q)) return
    setBusy('postcode')
    setPostcodes(await api.address.postcode.lookup(q))
    setBusy('')
  }

  return (
    <div className="ac">
      <div className="lookup" style={{ display: 'flex', gap: 6 }}>
        <input
          type="text"
          placeholder="Find an address — company, street or postcode…"
          autoComplete="off"
          value={q}
          onChange={(e) => onType(e.target.value)}
        />
        <button
          className="af-search"
          onClick={() => { if (isFullPostcode(q)) doPostcode(); else doPlaces() }}
          title="Search — Google Places, or postcode lookup for a full postcode"
        >
          <Icon name="search" size={16} />
        </button>
      </div>

      {internal.length > 0 && (
        <div className="ac-menu open" style={{ position: 'static', marginTop: 6 }}>
          <div className="ac-sec">This customer's frequent &amp; saved</div>
          {internal.map((p) => (
            <div key={p.id} className="cb-opt" onMouseDown={() => pickInternal(p)}>
              <div className="co">{p.primary}</div>
              <div className="ad">{p.secondary}</div>
            </div>
          ))}
        </div>
      )}

      {busy === 'details' && <div className="hint">Fetching place details…</div>}

      {places.length > 0 && (
        <div className="ac-menu open" style={{ position: 'static', marginTop: 6 }}>
          <div className="ac-sec">Suggestions · Google Places</div>
          {places.map((p) => (
            <div key={p.id} className="cb-opt cb-sug" onMouseDown={() => pickPrediction(p)}>
              <div className="co">{p.primary}</div>
              <div className="ad">{p.secondary}</div>
            </div>
          ))}
          <div className="hint" style={{ padding: '6px 10px' }}>
            Predictions billed per session; details charged only on select.
          </div>
        </div>
      )}

      {postcodes.length > 0 && (
        <div className="ac-menu open" style={{ position: 'static', marginTop: 6 }}>
          <div className="ac-sec">Addresses at {q.toUpperCase()}</div>
          {postcodes.map((a, i) => (
            <div key={i} className="cb-opt" onMouseDown={() => { onPick(a); clearSearch() }}>
              <div className="co">{a.co}</div>
              <div className="ad">{a.address}, {a.city} {a.pc}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
