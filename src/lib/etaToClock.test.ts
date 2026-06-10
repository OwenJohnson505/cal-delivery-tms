import { describe, it, expect } from 'vitest'
import { etaToClock } from './etaToClock.ts'

describe('etaToClock', () => {
  const now = new Date('2026-06-10T17:40:00')

  it('keeps an HH:MM value as-is', () => {
    expect(etaToClock('14:25', now)).toBe('14:25')
  })

  it('resolves "N minutes" to an absolute clock time against injected now', () => {
    expect(etaToClock('15 mins', now)).toBe('17:55')
    expect(etaToClock('12 min', now)).toBe('17:52')
    expect(etaToClock('20', now)).toBe('18:00')
  })

  it('pads hours and minutes', () => {
    expect(etaToClock('5', new Date('2026-06-10T09:03:00'))).toBe('09:08')
  })

  it('returns empty for empty input and passes unknown text through', () => {
    expect(etaToClock('', now)).toBe('')
    expect(etaToClock('whenever', now)).toBe('whenever')
  })

  it('is pure — same inputs always produce the same result', () => {
    expect(etaToClock('15', now)).toBe(etaToClock('15', now))
  })
})
