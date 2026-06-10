/**
 * Requirements rollup panel (prototype renderReqs / #reqBox). Renders the [label, scope]
 * rows from the three scopes, deduped via lib/requirements (with the §5.3 casing fix, so
 * product equipment such as Straps now appears).
 */
import { Icon } from '@/app/Icon.tsx'
import { useRequirements } from '@/store/selectors.ts'

export function RequirementsPanel() {
  const rows = useRequirements()

  return (
    <div className="panelbox">
      <div className="sechead">
        <Icon name="check" size={15} /> Requirements
      </div>
      <div id="reqBox">
        {rows.length === 0 ? (
          <div className="hint">No special requirements.</div>
        ) : (
          rows.map((r, i) => (
            <div className="req-line" key={r.label + i}>
              <span className="req-l">{r.label}</span>
              <span className="req-s">{r.scope}</span>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
