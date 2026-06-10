/** Other charges panel (prototype lines 539-547) — additional line-item charges. */
export function OtherCharges() {
  return (
    <div className="rsec">
      <h3>Other charges</h3>
      <div style={{ display: 'flex', gap: 6, alignItems: 'end' }}>
        <div className="fld" style={{ flex: 1 }}>
          <label>Charge</label>
          <select>
            <option>— Select —</option>
            <option>Waiting time</option>
            <option>Congestion charge</option>
            <option>Tail-lift surcharge</option>
          </select>
        </div>
        <div className="fld" style={{ width: 64 }}>
          <label>Rate £</label>
          <input type="text" defaultValue="0.00" />
        </div>
        <button className="btn primary sm" style={{ marginBottom: 1 }}>Add</button>
      </div>
      <table>
        <tbody>
          <tr>
            <td className="empty">No charges added</td>
          </tr>
        </tbody>
      </table>
    </div>
  )
}
