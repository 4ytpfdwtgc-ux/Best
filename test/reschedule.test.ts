import assert from 'node:assert/strict'
import { test } from 'node:test'
import { limitToTime, moveEvent, resizeEvent, snap } from '../src/lib/reschedule.ts'
import type { CalendarEvent } from '../src/types.ts'

const event = (patch: Partial<CalendarEvent> = {}): CalendarEvent => ({
  id: 'e1', calendarId: 'c1', title: 'Standup', allDay: false,
  startDate: '2026-09-04', startTime: '09:00',
  endDate: '2026-09-04', endTime: '10:00',
  createdAt: '', updatedAt: '', ...patch,
})

test('a drag snaps to the quarter hour', () => {
  assert.equal(snap(7), 0)
  assert.equal(snap(8), 15)
  assert.equal(snap(-8), -15)
})

test('moving keeps the length and lands on the grid', () => {
  // 09:00 + 97 minutes is 10:37, which snaps back to 10:30.
  const next = moveEvent(event(), { minuteDelta: 97, dayDelta: 0 })
  assert.deepEqual(next, {
    startDate: '2026-09-04', startTime: '10:30',
    endDate: '2026-09-04', endTime: '11:30',
  })
})

test('an event that did not start on the grid is snapped onto it', () => {
  // Snapping the destination, not the delta, is what makes this land at 09:15.
  const next = moveEvent(event({ startTime: '09:07', endTime: '09:37' }), { minuteDelta: 10, dayDelta: 0 })
  assert.equal(next.startTime, '09:15')
  assert.equal(next.endTime, '09:45')
})

test('moving across days moves the date', () => {
  const next = moveEvent(event(), { minuteDelta: 0, dayDelta: 2 })
  assert.equal(next.startDate, '2026-09-06')
  assert.equal(next.endDate, '2026-09-06')
})

test('dragged off the bottom it rolls into the next day, not into midnight', () => {
  const next = moveEvent(event({ startTime: '23:00', endTime: '23:30' }), { minuteDelta: 120, dayDelta: 0 })
  assert.equal(next.startDate, '2026-09-05')
  assert.equal(next.startTime, '01:00')
  assert.equal(next.endTime, '01:30')
})

test('dragged off the top it rolls into the previous day', () => {
  const next = moveEvent(event({ startTime: '00:30', endTime: '01:00' }), { minuteDelta: -60, dayDelta: 0 })
  assert.equal(next.startDate, '2026-09-03')
  assert.equal(next.startTime, '23:30')
})

test('an event running past midnight ends on the following day', () => {
  const next = moveEvent(event({ startTime: '22:00', endTime: '23:00' }), { minuteDelta: 150, dayDelta: 0 })
  assert.equal(next.startTime, '00:30')
  assert.equal(next.startDate, '2026-09-05')
  assert.equal(next.endDate, '2026-09-05')
  assert.equal(next.endTime, '01:30')
})

test('resizing moves only the end', () => {
  const next = resizeEvent(event(), 45)
  assert.equal(next.startTime, '09:00')
  assert.equal(next.endTime, '10:45')
})

test('an event cannot be dragged shorter than a quarter of an hour', () => {
  const next = resizeEvent(event(), -600)
  assert.equal(next.endTime, '09:15')
})

test('an event cannot be dragged longer than a day', () => {
  const next = resizeEvent(event(), 10_000)
  assert.equal(next.endDate, '2026-09-05')
  assert.equal(next.endTime, '09:00')
})

test('a repeating event can be moved in time but not onto another day', () => {
  // Its day comes from the rule; dragging one occurrence to Friday would
  // silently rewrite every other occurrence too.
  const repeating = event({ recurrence: { freq: 'weekly', interval: 1 } })
  const moved = moveEvent(repeating, { minuteDelta: 60, dayDelta: 3 })
  const limited = limitToTime(repeating, moved)
  assert.equal(limited.startDate, '2026-09-04')
  assert.equal(limited.startTime, '10:00')
  assert.equal(limited.endDate, '2026-09-04')
})

test('a one-off event is not limited', () => {
  const plain = event()
  const moved = moveEvent(plain, { minuteDelta: 0, dayDelta: 1 })
  assert.deepEqual(limitToTime(plain, moved), moved)
})
