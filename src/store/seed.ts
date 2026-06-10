/**
 * Seed booking — the prototype's initial two-stop booking (reference lines 615-628),
 * so the app opens with the same demo content as the reference build.
 */
import type { ProductEquipment, Stop } from '@/types/index.ts'

export function seedStops(): Stop[] {
  return [
    {
      id: 1,
      type: 'Collection',
      q: 'Northgate Logistics',
      addr: {
        co: 'Northgate Logistics',
        address: 'Unit 7, Aire Valley Park',
        city: 'Leeds',
        pc: 'LS9 0PX',
        country: 'England',
        src: 'Saved · internal',
        cls: 'internal',
      },
      contact: { name: 'John Carter', tel: '0113 496 0021', email: 'j.carter@northgate.co.uk' },
      time: { mode: 'between', from: '06-06-2026 18:54', to: '06-06-2026 19:39' },
      reference: '',
      note: 'Goods in loading bay 3 - ask for Dave on arrival',
      goods: '2 pallets at 400kg total, 1 box',
      goodsTouched: true,
      alloc: [],
      allocTouched: false,
      svc: {},
      status: 'collected',
      eta: '',
      pod: { type: 'POB', via: 'Manual', by: 'Owen Johnson', at: '06-06-2026 19:05', name: 'D. Whitaker', sig: true, photos: 1 },
    },
    {
      id: 2,
      type: 'Delivery',
      q: "Tesco's Warrington",
      addr: {
        co: 'Tesco Extra',
        address: 'Winwick Road',
        city: 'Warrington',
        pc: 'WA2 7NE',
        country: 'England',
        src: 'Google Places',
        cls: 'places',
      },
      contact: { name: 'Sarah Doyle', tel: '0161 220 7788', email: 's.doyle@tesco.com' },
      time: { mode: 'asap' },
      reference: '',
      note: 'Booking ref needed at gate - call site 30 mins before arrival',
      goods: '',
      goodsTouched: false,
      alloc: [0, 1],
      allocTouched: false,
      svc: { twoman: true },
      status: 'enroute',
      eta: '14:25',
      pod: null,
    },
  ]
}

/** Seed EQ: stop 1, item index 1 (the box) has straps (lowercase — the §5.3 seed). */
export function seedEq(): ProductEquipment {
  return { '1:1': { straps: true } }
}
