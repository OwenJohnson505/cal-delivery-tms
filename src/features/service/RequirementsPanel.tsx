/**
 * Requirements rollup panel (prototype renderReqs / #reqBox). Renders the [label, scope]
 * rows from the three scopes, deduped via lib/requirements (with the §5.3 casing fix, so
 * product equipment such as Straps now appears).
 */
import { useEffect, useRef, useState } from 'react'
import { Icon } from '@/app/Icon.tsx'
import { useRequirements } from '@/store/selectors.ts'
import { useEmailsStore } from '@/store/emailsStore.ts'

export function RequirementsPanel() {
  const rows = useRequirements()
  // collapsed by default in the narrow email-job view; open in the full wizard
  const emailFull = useEmailsStore((s) => s.panelState === 'full')
  const [open, setOpen] = useState(!emailFull)

  // Count how many requirement rows sit below the visible area, so we can show a
  // "+N more" hint. The box scrolls internally; the rest of the page stays put.
  const boxRef = useRef<HTMLDivElement>(null)
  const [hidden, setHidden] = useState(0)
  useEffect(() => {
    const box = boxRef.current
    if (!box) return
    const update = () => {
      const bb = box.getBoundingClientRect()
      let visible = 0
      box.querySelectorAll('.req-line').forEach((l) => {
        if (l.getBoundingClientRect().bottom <= bb.bottom + 1) visible += 1
      })
      setHidden(Math.max(0, box.querySelectorAll('.req-line').length - visible))
    }
    update()
    box.addEventListener('scroll', update)
    const ro = new ResizeObserver(update)
    ro.observe(box)
    return () => { box.removeEventListener('scroll', update); ro.disconnect() }
  }, [rows.length, open])

  return (
    <div className={'panelbox' + (open ? '' : ' collapsed')}>
      <button className="sechead sechead-toggle" onClick={() => setOpen((o) => !o)}>
        <span className="sh-chev">{open ? '▾' : '▸'}</span>
        <Icon name="check" size={15} /> Requirements
        {rows.length > 0 && <span className="sh-count">{rows.length}</span>}
      </button>
      {open && (
        <div className="reqbox-wrap">
          <div id="reqBox" ref={boxRef}>
            {rows.length === 0 ? (
              <div className="hint">No special requirements.</div>
            ) : (
              rows.map((r, i) => (
                <div className="req" key={r.label + i}>
                  <div className="req-name">{r.label}</div>
                  <div className={'req-scope ' + (/whole job/i.test(r.scope) ? 'wj' : 'sp')}>{r.scope}</div>
                </div>
              ))
            )}
          </div>
          {hidden > 0 && <div className="req-more">+{hidden} more · scroll</div>}
        </div>
      )}
    </div>
  )
}
