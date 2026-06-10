/**
 * TariffsScreen — the rate-card database. List of tariffs (with their generated id, so
 * same-named tariffs are still identifiable) + a create panel with a live price preview
 * driven by lib/tariff (quoteTariff). Created tariffs become assignable on a customer's
 * Tariffs tab.
 */
import { useState } from 'react'
import { Icon } from '@/app/Icon.tsx'
import { useTariffsStore, blankTariff, type TariffDraft } from '@/store/tariffsStore.ts'
import { quoteTariff } from '@/lib/index.ts'

export function TariffsScreen() {
  const tariffs = useTariffsStore((s) => s.tariffs)
  const addTariff = useTariffsStore((s) => s.addTariff)
  const deleteTariff = useTariffsStore((s) => s.deleteTariff)
  const peekCode = useTariffsStore((s) => s.peekCode())

  const [creating, setCreating] = useState(false)
  const [d, setD] = useState<TariffDraft>(blankTariff())
  const [testMiles, setTestMiles] = useState(100)
  const set = (patch: Partial<TariffDraft>) => setD((p) => ({ ...p, ...patch }))
  const num = (v: string) => (v === '' ? 0 : parseFloat(v) || 0)

  function save() {
    if (!d.name.trim()) return
    addTariff(d)
    setD(blankTariff())
    setCreating(false)
  }

  const preview = quoteTariff(testMiles, d)

  return (
    <div className="list-app">
      <div className="list-work">
        <div className="list-head">
          <h1>Tariffs</h1>
          {!creating && (
            <button className="btn primary" onClick={() => setCreating(true)}>
              <Icon name="plus" size={15} /> Add tariff
            </button>
          )}
        </div>

        {creating && (
          <div className="db-form">
            <div className="db-form-h">
              <span>New tariff</span>
              <span className="cf-hint">ID assigned on save: <b>{peekCode}</b></span>
            </div>
            <div className="db-grid">
              <div className="fld up"><label>Tariff name (system)</label><input value={d.name} placeholder="e.g. Standard" onChange={(e) => set({ name: e.target.value })} /></div>
              <div className="fld up"><label>Portal name</label><input value={d.portalName} placeholder="shown to customers" onChange={(e) => set({ portalName: e.target.value })} /></div>
              <div className="fld up"><label>Tariff mapping</label><input value={d.mapping} placeholder="integration key" onChange={(e) => set({ mapping: e.target.value })} /></div>
              <div className="fld up"><label>Cost per mile (£)</label><input type="number" step="0.01" value={d.costPerMile || ''} onChange={(e) => set({ costPerMile: num(e.target.value) })} /></div>
              <div className="fld up"><label>Minimum charge (£)</label><input type="number" step="1" value={d.minCharge || ''} onChange={(e) => set({ minCharge: num(e.target.value) })} /></div>
              <div className="fld up"><label>Minimum miles</label><input type="number" step="1" value={d.minMiles || ''} onChange={(e) => set({ minMiles: num(e.target.value) })} /></div>
            </div>
            <div className="db-calc">
              <span className="cf-hint">Price check —</span>
              <input type="number" className="db-calc-miles" value={testMiles} onChange={(e) => setTestMiles(num(e.target.value))} /> miles
              <span className="db-calc-eq">
                ({testMiles} − {d.minMiles || 0} min) × £{(d.costPerMile || 0).toFixed(2)} + £{(d.minCharge || 0).toFixed(0)} min ={' '}
                <b>£{preview.toFixed(2)}</b>
              </span>
            </div>
            <div className="db-form-actions">
              <button className="btn" onClick={() => { setCreating(false); setD(blankTariff()) }}>Cancel</button>
              <button className="btn primary" onClick={save} disabled={!d.name.trim()}>Save tariff</button>
            </div>
          </div>
        )}

        <div className="list-tablewrap">
          <table className="list-table">
            <thead>
              <tr><th>ID</th><th>Name</th><th>Portal name</th><th>Mapping</th><th className="num">£/mile</th><th className="num">Min charge</th><th className="num">Min miles</th><th></th></tr>
            </thead>
            <tbody>
              {tariffs.map((t) => (
                <tr key={t.id}>
                  <td><span className="itag itag-muted">{t.id}</span></td>
                  <td><b>{t.name}</b></td>
                  <td>{t.portalName || '—'}</td>
                  <td>{t.mapping || '—'}</td>
                  <td className="num">£{t.costPerMile.toFixed(2)}</td>
                  <td className="num">£{t.minCharge.toFixed(0)}</td>
                  <td className="num">{t.minMiles}</td>
                  <td className="list-actions">
                    <button className="btn sm iconbtn danger" title="Delete" onClick={() => { if (confirm(`Delete tariff ${t.name} (${t.id})?`)) deleteTariff(t.id) }}>
                      <Icon name="trash" size={14} />
                    </button>
                  </td>
                </tr>
              ))}
              {tariffs.length === 0 && <tr><td className="empty" colSpan={8}>No tariffs yet.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
