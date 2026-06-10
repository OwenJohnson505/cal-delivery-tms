import { describe, it, expect, beforeEach } from 'vitest'
import { useBookingStore } from './bookingStore.ts'

const reset = () => useBookingStore.getState().reset()

describe('bookingStore', () => {
  beforeEach(reset)

  it('starts as an empty Draft', () => {
    const s = useBookingStore.getState()
    expect(s.stops).toEqual([])
    expect(s.jobStatus).toBe('Draft')
    expect(s.cx).toEqual({ text: '', dirty: false, posted: false })
  })

  it('assigns and unassigns a unit to a delivery stop (exclusive)', () => {
    const { assignUnit, unassignUnit } = useBookingStore.getState()
    assignUnit(3, 'stop-del')
    expect(useBookingStore.getState().assign[3]).toBe('stop-del')
    assignUnit(3, 'stop-other') // re-assign overwrites (exclusive ownership)
    expect(useBookingStore.getState().assign[3]).toBe('stop-other')
    unassignUnit(3)
    expect(useBookingStore.getState().assign[3]).toBeUndefined()
  })

  it('freezes CX notes once posted (handover §1/§6)', () => {
    const { setCxNotes, markCxPosted } = useBookingStore.getState()
    setCxNotes('live text')
    expect(useBookingStore.getState().cx.text).toBe('live text')
    markCxPosted()
    setCxNotes('should be ignored after posting')
    const cx = useBookingStore.getState().cx
    expect(cx.posted).toBe(true)
    expect(cx.dirty).toBe(false)
    expect(cx.text).toBe('live text')
  })
})
