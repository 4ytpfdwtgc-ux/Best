import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  convertWallTime, instantToZoned, isValidZone, offsetLabel, offsetMinutes, zoneLabel, zonedToInstant,
} from '../src/lib/timezone.ts'

test('an offset is read back out of Intl, so daylight saving is right', () => {
  // London is GMT in January and BST in July.
  assert.equal(offsetMinutes(new Date('2026-01-15T12:00:00Z'), 'Europe/London'), 0)
  assert.equal(offsetMinutes(new Date('2026-07-15T12:00:00Z'), 'Europe/London'), 60)
  assert.equal(offsetMinutes(new Date('2026-01-15T12:00:00Z'), 'America/New_York'), -300)
  assert.equal(offsetMinutes(new Date('2026-07-15T12:00:00Z'), 'America/New_York'), -240)
  // Not every zone is a whole hour from UTC.
  assert.equal(offsetMinutes(new Date('2026-01-15T12:00:00Z'), 'Asia/Kolkata'), 330)
})

test('a wall-clock time resolves to the right instant', () => {
  assert.equal(zonedToInstant('2026-01-15', '09:00', 'UTC').toISOString(), '2026-01-15T09:00:00.000Z')
  assert.equal(zonedToInstant('2026-01-15', '09:00', 'America/New_York').toISOString(), '2026-01-15T14:00:00.000Z')
  // In July New York is four hours behind, not five.
  assert.equal(zonedToInstant('2026-07-15', '09:00', 'America/New_York').toISOString(), '2026-07-15T13:00:00.000Z')
})

test('an instant reads back as the wall-clock time it is there', () => {
  assert.deepEqual(instantToZoned(new Date('2026-01-15T14:00:00Z'), 'America/New_York'), {
    date: '2026-01-15',
    time: '09:00',
  })
  assert.deepEqual(instantToZoned(new Date('2026-01-15T09:00:00Z'), 'Asia/Tokyo'), {
    date: '2026-01-15',
    time: '18:00',
  })
})

test('a nine-o-clock call in New York is two in the afternoon in London', () => {
  assert.deepEqual(convertWallTime('2026-01-15', '09:00', 'America/New_York', 'Europe/London'), {
    date: '2026-01-15',
    time: '14:00',
  })
})

test('converting can move the day, which is the point of doing it at all', () => {
  // A 9pm call in Los Angeles is the next afternoon in Tokyo.
  assert.deepEqual(convertWallTime('2026-01-15', '21:00', 'America/Los_Angeles', 'Asia/Tokyo'), {
    date: '2026-01-16',
    time: '14:00',
  })
  // And backwards across the line.
  assert.deepEqual(convertWallTime('2026-01-16', '08:00', 'Asia/Tokyo', 'America/Los_Angeles'), {
    date: '2026-01-15',
    time: '15:00',
  })
})

test('the same zone is left exactly alone', () => {
  assert.deepEqual(convertWallTime('2026-03-29', '01:30', 'Europe/London', 'Europe/London'), {
    date: '2026-03-29',
    time: '01:30',
  })
})

test('a round trip through an instant returns the same wall time', () => {
  for (const [date, time, zone] of [
    ['2026-01-15', '09:00', 'America/New_York'],
    ['2026-07-04', '23:45', 'Australia/Sydney'],
    ['2026-11-02', '06:15', 'Asia/Kolkata'],
    ['2026-12-31', '00:00', 'Pacific/Auckland'],
  ] as const) {
    assert.deepEqual(instantToZoned(zonedToInstant(date, time, zone), zone), { date, time })
  }
})

test('an hour that daylight saving skips still resolves to a real instant', () => {
  // London springs forward at 01:00 on 29 March 2026, so 01:30 does not exist.
  const instant = zonedToInstant('2026-03-29', '01:30', 'Europe/London')
  assert.equal(Number.isNaN(instant.getTime()), false)
  // It lands in the hour after the jump rather than somewhere in the previous day.
  assert.equal(instant.toISOString().startsWith('2026-03-29'), true)
})

test('an hour that daylight saving repeats resolves to one of the two', () => {
  // London falls back at 02:00 on 25 October 2026, so 01:30 happens twice.
  const instant = zonedToInstant('2026-10-25', '01:30', 'Europe/London')
  assert.deepEqual(instantToZoned(instant, 'Europe/London'), { date: '2026-10-25', time: '01:30' })
})

test('a zone is checked before it is trusted', () => {
  assert.equal(isValidZone('Europe/London'), true)
  assert.equal(isValidZone('Middle/Earth'), false)
})

test('zones and offsets are labelled for reading', () => {
  assert.equal(zoneLabel('America/New_York'), 'America / New York')
  assert.equal(offsetLabel(new Date('2026-01-15T12:00:00Z'), 'UTC'), 'GMT')
  assert.equal(offsetLabel(new Date('2026-07-15T12:00:00Z'), 'Europe/London'), 'GMT+1')
  assert.equal(offsetLabel(new Date('2026-01-15T12:00:00Z'), 'America/New_York'), 'GMT-5')
  assert.equal(offsetLabel(new Date('2026-01-15T12:00:00Z'), 'Asia/Kolkata'), 'GMT+5:30')
})
