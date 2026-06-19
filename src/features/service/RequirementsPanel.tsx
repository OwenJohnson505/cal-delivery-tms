/**
 * Requirements rollup panel (prototype renderReqs / #reqBox). Renders the [label, scope]
 * rows from the three scopes, deduped via lib/requirements (with the §5.3 casing fix, so
 * product equipment such as Straps now appears).
 */
import { useState } from 'react'
import { Icon } from '@/app/Icon.tsx'
import { useRequirements } from '@/store/selectors.ts'
import { useEmailsStore } from '@/store/emailsStore.ts'

export function RequirementsPanel() {
  const rows = useRequirements()
  // collapsed by default in the narrow email-job view; open in the full wizard
  const emailFull = useEmailsStore((s) => s.panelState === 'full')
  const [open, setOpen] = useState(!emailFull)

  return (
    <div className={'panelbox' + (open ? '' : ' collapsed')}>
      <button className="sechead sechead-toggle" onClick={() => setOpen((o) => !o)}>
        <span className="sh-chev">{open ? '▾' : '▸'}</span>
        <Icon name="check" size={15} /> Requirements
        {rows.length > 0 && <span className="sh-count">{rows.length}</span>}
      </button>
      {open && (
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
      )}
    </div>
  )
}
