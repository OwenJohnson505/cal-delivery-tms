/**
 * Service & Vehicle section — matches the redesign reference: a Vehicle KV row
 * (tariff · body) plus full-width Equipment / Service chip stacks. Chips carry an
 * × to remove; "+ Add" opens an inline picker of options. No dropdown boxes.
 * Selections write to the store, driving the requirements rollup + CX.
 */
import { useState } from 'react'
import { useBookingStore } from '@/store/bookingStore.ts'

const TARIFFS = ['Small van', 'SWB van', 'LWB van', 'Luton', '7.5t', '18t', 'Artic']
const AMBER = new Set(['ADR', 'Hazardous'])

type Group = 'equip' | 'service'
type Picker = 'vehicle' | Group | null

export function ServiceRail() {
  const tariff = useBookingStore((s) => s.tariff)
  const setTariff = useBookingStore((s) => s.setTariff)
  const ms = useBookingStore((s) => s.ms)
  const setMsSelection = useBookingStore((s) => s.setMsSelection)
  const [picker, setPicker] = useState<Picker>(null)

  const toggleIn = (list: string[], v: string) =>
    list.includes(v) ? list.filter((x) => x !== v) : [...list, v]

  const tagCls = (g: Group, v: string) =>
    AMBER.has(v) ? ' amber' : g === 'service' ? ' blue' : ''

  const vehVal = [tariff.q, ...ms.body.sel].filter(Boolean).join(' · ')

  const stack = (g: Group, label: string) => (
    <>
      <div className="stack">
        <div className="stack-head"><span className="stack-label">{label}</span></div>
        <div className="chips">
          {ms[g].sel.map((v) => (
            <span key={v} className={'tag' + tagCls(g, v)}>
              {v}
              <span className="x" onClick={() => setMsSelection(g, ms[g].sel.filter((x) => x !== v))}>×</span>
            </span>
          ))}
          <button className="add-pill" onClick={() => setPicker(picker === g ? null : g)}>+ Add</button>
        </div>
      </div>
      {picker === g && (
        <div className="picker open">
          <div className="picker-inner">
            <div className="picker-title">Select {label.toLowerCase()}</div>
            <div className="opts">
              {ms[g].o.map((v) => {
                const on = ms[g].sel.includes(v)
                return (
                  <button
                    key={v}
                    className={'opt' + (on ? ' selected' : '') + (on && AMBER.has(v) ? ' amber' : '')}
                    onClick={() => setMsSelection(g, toggleIn(ms[g].sel, v))}
                  >
                    {on && <span className="ck">✓</span>}{v}
                  </button>
                )
              })}
            </div>
            <div className="picker-foot"><span className="picker-done" onClick={() => setPicker(null)}>Done</span></div>
          </div>
        </div>
      )}
    </>
  )

  return (
    <div className="section">
      <div className="sec-head"><span className="sec-title">Service &amp; Vehicle</span></div>

      <div className="kv kv-tap" onClick={() => setPicker(picker === 'vehicle' ? null : 'vehicle')}>
        <span className="k">Vehicle</span>
        <span className={'v' + (vehVal ? '' : ' muted')}>{vehVal || 'Select a vehicle'}</span>
      </div>
      {picker === 'vehicle' && (
        <div className="picker open">
          <div className="picker-inner">
            <div className="picker-title">Vehicle / tariff</div>
            <div className="opts">
              {TARIFFS.map((v) => (
                <button key={v} className={'opt' + (tariff.q === v ? ' selected' : '')} onClick={() => setTariff(v)}>
                  {tariff.q === v && <span className="ck">✓</span>}{v}
                </button>
              ))}
            </div>
            <div className="picker-title" style={{ marginTop: 10 }}>Body type</div>
            <div className="opts">
              {ms.body.o.map((v) => {
                const on = ms.body.sel.includes(v)
                return (
                  <button key={v} className={'opt' + (on ? ' selected' : '')} onClick={() => setMsSelection('body', toggleIn(ms.body.sel, v))}>
                    {on && <span className="ck">✓</span>}{v}
                  </button>
                )
              })}
            </div>
            <div className="picker-foot"><span className="picker-done" onClick={() => setPicker(null)}>Done</span></div>
          </div>
        </div>
      )}

      {stack('equip', 'Equipment')}
      {stack('service', 'Service')}
    </div>
  )
}
