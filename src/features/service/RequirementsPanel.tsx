/**
 * Requirements rollup — a grey section with a 2-column grid of [name, scope] derived
 * from the selected equipment + service. Scope is coloured green (whole job) / blue
 * (stop-specific), per the redesign reference.
 */
import { useRequirements } from '@/store/selectors.ts'

export function RequirementsPanel() {
  const rows = useRequirements()

  return (
    <div className="section">
      <div className="sec-head">
        <span className="sec-title">Requirements</span>
        <div className="spacer" />
        <span className="sec-note">auto from service</span>
      </div>
      {rows.length === 0 ? (
        <div className="req-empty">No requirements.</div>
      ) : (
        <div className="req-grid">
          {rows.map((r, i) => (
            <div className="req" key={r.label + i}>
              <div className="req-name">{r.label}</div>
              <div className={'req-scope ' + (/whole job/i.test(r.scope) ? 'wj' : 'sp')}>{r.scope}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
