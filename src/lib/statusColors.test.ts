import { describe, it, expect } from 'vitest'
import { statusColor, normaliseStatus } from './statusColors.ts'

describe('statusColors', () => {
  it('gives each document status its own colour', () => {
    const draft = statusColor('Draft')
    const quote = statusColor('Quote')
    const booking = statusColor('Booking')
    expect(new Set([draft.bg, quote.bg, booking.bg]).size).toBe(3)
  })

  it('gives each job lifecycle status its own colour', () => {
    const labels = [
      'Waiting', 'Posted', 'Allocated', 'On route to collection', 'At collection',
      'Collected', 'On route to delivery', 'At delivery', 'Delivered',
    ]
    const bgs = labels.map((l) => statusColor(l).bg)
    expect(new Set(bgs).size).toBe(labels.length) // all distinct
  })

  it('partial states share their base status colour', () => {
    const base = statusColor('Collected')
    expect(statusColor('Collected 1 of 2')).toEqual(base)
    expect(statusColor('Collected 1 of 3')).toEqual(base)
    const del = statusColor('Delivered')
    expect(statusColor('Delivered 2 of 3')).toEqual(del)
  })

  it('normalises away the variable count', () => {
    expect(normaliseStatus('Collected 1 of 2')).toBe('collected')
    expect(normaliseStatus('Delivered 12 of 30')).toBe('delivered')
  })

  it('is case-insensitive and falls back gracefully', () => {
    expect(statusColor('DELIVERED')).toEqual(statusColor('delivered'))
    expect(statusColor('something unknown')).toBeTruthy()
  })
})
