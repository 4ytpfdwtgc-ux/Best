import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  addDays, addMonths, diffDays, monthGrid, startOfWeek, timeFromMinutes, minutesFromTime,
} from '../src/lib/date.ts'
import { nextOccurrence, occurrencesInRange } from '../src/lib/recurrence.ts'

test('addDays crosses month and year boundaries', () => {
  assert.equal(addDays('2026-01-31', 1), '2026-02-01')
  assert.equal(addDays('2026-12-31', 1), '2027-01-01')
  assert.equal(addDays('2026-03-01', -1), '2026-02-28')
})

test('addMonths clamps to the last day of a short month', () => {
  assert.equal(addMonths('2026-01-31', 1), '2026-02-28')
  assert.equal(addMonths('2024-01-31', 1), '2024-02-29') // leap year
  assert.equal(addMonths('2026-11-15', 3), '2027-02-15')
})

test('diffDays is signed and inclusive of DST-free arithmetic', () => {
  assert.equal(diffDays('2026-01-01', '2026-01-08'), 7)
  assert.equal(diffDays('2026-01-08', '2026-01-01'), -7)
})

test('startOfWeek honours the week-start preference', () => {
  // 2026-08-31 is a Monday.
  assert.equal(startOfWeek('2026-08-31', 0), '2026-08-30')
  assert.equal(startOfWeek('2026-08-31', 1), '2026-08-31')
})

test('monthGrid always yields six aligned weeks', () => {
  const grid = monthGrid('2026-08-15', 0)
  assert.equal(grid.length, 42)
  assert.equal(grid[0], '2026-07-26')
  assert.equal(grid[41], '2026-09-05')
})

test('time helpers round-trip', () => {
  assert.equal(minutesFromTime('09:30'), 570)
  assert.equal(timeFromMinutes(570), '09:30')
  assert.equal(timeFromMinutes(0), '00:00')
  assert.equal(minutesFromTime(undefined, 42), 42)
})

test('daily rules step by their interval', () => {
  const rule = { freq: 'daily', interval: 3 } as const
  assert.equal(nextOccurrence('2026-08-31', rule, '2026-08-31'), '2026-09-03')
  assert.equal(nextOccurrence('2026-08-31', rule, '2026-09-03'), '2026-09-06')
})

test('weekly rules with weekdays hit each selected day', () => {
  // Mondays, Wednesdays and Fridays starting Monday 2026-08-31.
  const rule = { freq: 'weekly', interval: 1, byWeekday: [1, 3, 5] } as const
  const dates = occurrencesInRange('2026-08-31', rule, '2026-08-31', '2026-09-06')
  assert.deepEqual(dates, ['2026-08-31', '2026-09-02', '2026-09-04'])
})

test('bi-weekly rules skip the intervening week', () => {
  const rule = { freq: 'weekly', interval: 2, byWeekday: [1] } as const
  const dates = occurrencesInRange('2026-08-31', rule, '2026-08-31', '2026-10-01')
  assert.deepEqual(dates, ['2026-08-31', '2026-09-14', '2026-09-28'])
})

test('monthly and yearly rules land on the same day number', () => {
  assert.deepEqual(
    occurrencesInRange('2026-01-15', { freq: 'monthly', interval: 1 }, '2026-01-01', '2026-04-30'),
    ['2026-01-15', '2026-02-15', '2026-03-15', '2026-04-15'],
  )
  assert.deepEqual(
    occurrencesInRange('2026-03-09', { freq: 'yearly', interval: 1 }, '2026-01-01', '2028-12-31'),
    ['2026-03-09', '2027-03-09', '2028-03-09'],
  )
})

test('an until date ends the series', () => {
  const rule = { freq: 'daily', interval: 1, until: '2026-09-02' } as const
  assert.deepEqual(
    occurrencesInRange('2026-08-31', rule, '2026-08-31', '2026-09-10'),
    ['2026-08-31', '2026-09-01', '2026-09-02'],
  )
  assert.equal(nextOccurrence('2026-08-31', rule, '2026-09-02'), null)
})

test('a one-off event only appears inside the range', () => {
  assert.deepEqual(occurrencesInRange('2026-08-31', undefined, '2026-08-01', '2026-08-31'), ['2026-08-31'])
  assert.deepEqual(occurrencesInRange('2026-08-31', undefined, '2026-09-01', '2026-09-30'), [])
})

test('occurrences before the range start are not emitted', () => {
  const rule = { freq: 'daily', interval: 1 } as const
  const dates = occurrencesInRange('2026-08-01', rule, '2026-08-29', '2026-08-31')
  assert.deepEqual(dates, ['2026-08-29', '2026-08-30', '2026-08-31'])
})
