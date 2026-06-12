/**
 * JobTabs — a top-bar inside the job column (email-open mode) to switch the job view
 * between the booking form, Service providers, and History, without leaving the box
 * (so the email panel stays visible). The active tab is driven by the same drawer
 * state the right rail uses: null → Job details, 'providers', 'history'.
 */
import { useUiStore } from '@/store/uiStore.ts'

export function JobTabs() {
  const drawer = useUiStore((s) => s.drawer)
  const openDrawer = useUiStore((s) => s.openDrawer)
  const closeDrawers = useUiStore((s) => s.closeDrawers)
  const provSeen = useUiStore((s) => s.provSeen)
  const badge = Math.max(0, 5 + 3 - provSeen) // internal drivers + CX bids (mock)
  const active = drawer === 'providers' ? 'providers' : drawer === 'history' ? 'history' : 'details'

  return (
    <div className="jobtabs">
      <button className={'jobtab' + (active === 'details' ? ' on' : '')} onClick={closeDrawers}>
        Job details
      </button>
      <button className={'jobtab' + (active === 'providers' ? ' on' : '')} onClick={() => openDrawer('providers')}>
        Service providers
        {badge > 0 && <span className="jobtab-badge">{badge}</span>}
      </button>
      <button className={'jobtab' + (active === 'history' ? ' on' : '')} onClick={() => openDrawer('history')}>
        History
      </button>
    </div>
  )
}
