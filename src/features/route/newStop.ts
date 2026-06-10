/** Build a fresh blank stop with id = max(ids)+1 (prototype addStop). */
import type { Stop } from '@/types/index.ts'

export function newStop(stops: Stop[]): Stop {
  const nid = stops.length ? Math.max(...stops.map((s) => s.id)) + 1 : 1
  return {
    id: nid,
    type: 'Delivery',
    q: '',
    addr: { co: '', address: '', city: '', pc: '', country: 'England', src: '', cls: 'manual' },
    contact: null,
    time: { mode: 'asap' },
    reference: '',
    note: '',
    goods: '',
    goodsTouched: false,
    alloc: [],
    allocTouched: false,
    svc: {},
    status: 'booked',
    eta: '',
    pod: null,
  }
}
