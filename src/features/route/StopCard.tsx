/**
 * Collapsed stop card (prototype stopCard): a head row (number, type selector, company,
 * status chip, POD/edit/delete actions) and a calm preview of address / contact / time /
 * goods. Double-clicking the card, or the edit button, opens the full stop editor.
 */
import { Icon } from '@/app/Icon.tsx'
import { useBookingStore } from '@/store/bookingStore.ts'
import { useUiStore } from '@/store/uiStore.ts'
import { useEffectiveAssign } from '@/store/selectors.ts'
import { previewGoods, whenLabel, whenValue } from './format.ts'
import type { Stop, StopType } from '@/types/index.ts'

const STATUS_LABEL: Record<string, string> = {
  booked: 'Booked',
  enroute: 'En route',
  arrived: 'Arrived',
  collected: 'Collected',
  delivered: 'Delivered',
}

export function StopCard({ stop, index }: { stop: Stop; index: number }) {
  const stops = useBookingStore((s) => s.stops)
  const updateStop = useBookingStore((s) => s.updateStop)
  const removeStop = useBookingStore((s) => s.removeStop)
  const editStop = useUiStore((s) => s.editStop)
  const viewPod = useUiStore((s) => s.viewPod)
  const assign = useEffectiveAssign()

  const a = stop.addr
  const goods = previewGoods(stop, stops, assign)
  const numColor =
    stop.type === 'Collection' ? 'var(--collect)' : stop.type === 'Delivery' ? 'var(--deliver)' : 'var(--accent)'

  return (
    <div className="stop">
      <div className="stop-head">
        <span className="num" style={{ background: numColor }}>{index + 1}</span>
        <select
          className="typesel"
          value={stop.type}
          onChange={(e) => updateStop(stop.id, { type: e.target.value as StopType })}
        >
          <option>Collection</option>
          <option>Delivery</option>
          <option>Both</option>
        </select>
        <h3>{a.co || a.pc || 'New address'}</h3>
        <div className="sh-actions">
          <span className="itag">{STATUS_LABEL[stop.status] || stop.status}</span>
          {stop.status === 'enroute' && stop.eta && <span className="cc-tag">ETA {stop.eta}</span>}
          {stop.pod && (
            <button className="btn sm iconbtn" title="View proof" onClick={() => viewPod(stop.id)}>
              <Icon name="camera" size={14} />
            </button>
          )}
          <button className="btn sm iconbtn" title="Edit stop" onClick={() => editStop(stop.id)}>
            <Icon name="edit" size={14} />
          </button>
          <button className="btn sm iconbtn" title="Remove stop" onClick={() => removeStop(stop.id)}>
            <Icon name="trash" size={14} />
          </button>
        </div>
      </div>

      <div className="pv" onDoubleClick={() => editStop(stop.id)}>
        <div className="prow">
          <div className="f">
            <span className="k">Address</span>
            <span className="v co">
              {a.address ? `${a.address}, ${a.city} ${a.pc}` : <span className="ph">Not set</span>}
            </span>
          </div>
          <div className="f">
            <span className="k">Contact</span>
            <span className="v">
              {stop.contact ? `${stop.contact.name} · ${stop.contact.tel}` : <span className="ph">None</span>}
            </span>
          </div>
        </div>
        <div className="prow">
          <div className="f">
            <span className="k">{whenLabel(stop.time)}</span>
            <span className="v">{whenValue(stop.time)}</span>
          </div>
          <div className="f">
            <span className="k">Goods</span>
            <span className="v">{goods || <span className="ph">—</span>}</span>
          </div>
        </div>
        {stop.note && (
          <div className="prow">
            <div className="f" style={{ flex: '1 1 100%' }}>
              <span className="k">Note</span>
              <span className="v">{stop.note}</span>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
