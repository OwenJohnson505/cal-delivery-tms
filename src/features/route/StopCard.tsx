/**
 * Collapsed stop — matches the redesign reference: a dot+stem rail then a place line
 * (company · postcode · city) with time / contact / goods beneath. Clicking the place
 * (or goods) opens the full stop editor. No inner card — it sits inside the grey Route
 * section.
 */
import { useBookingStore } from '@/store/bookingStore.ts'
import { useEffectiveAssign } from '@/store/selectors.ts'
import { previewGoods, whenLabel, whenValue } from './format.ts'
import type { Stop } from '@/types/index.ts'

export function StopCard({ stop, index, last, onEdit }: { stop: Stop; index: number; last: boolean; onEdit: () => void }) {
  const stops = useBookingStore((s) => s.stops)
  const assign = useEffectiveAssign()

  const a = stop.addr
  const c = stop.contact
  const isColl = stop.type === 'Collection' || stop.type === 'Both'
  const goods = previewGoods(stop, stops, assign)
  const loc = [a.pc, a.city].filter(Boolean).join(' · ')

  return (
    <div className="stop">
      <div className="rail">
        <div className={'dot ' + (isColl ? 'pickup' : 'drop')}>{index + 1}</div>
        {!last && <div className="stem" />}
      </div>
      <div className="stop-content">
        <div className="stop-top">
          <span className="kind">{isColl ? 'Collection' : 'Delivery'}</span>
          <div className="spacer" />
          {stop.reference && <span className="chip">{stop.reference}</span>}
        </div>
        <div className="place" onClick={onEdit}>
          <span className="name">{a.co || 'Add address'}</span>
          {loc && <span className="pc">· {loc}</span>}
          <span className="chev">›</span>
        </div>
        <div className="ml">{whenLabel(stop.time)} · <b>{whenValue(stop.time)}</b></div>
        {c && (c.name || c.tel) && (
          <div className="ml">{c.name}{c.tel ? <> · <a href={`tel:${c.tel}`} onClick={(e) => e.stopPropagation()}>{c.tel}</a></> : null}</div>
        )}
        <div className="ml">
          {goods ? <><span>{goods}</span> · <a onClick={onEdit}>edit</a></> : <a onClick={onEdit}>+ Add goods</a>}
        </div>
      </div>
    </div>
  )
}
