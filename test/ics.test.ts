import assert from 'node:assert/strict'
import { test } from 'node:test'
import { buildICS, escapeText, foldLine, icsFilename, toRRule } from '../src/lib/ics.ts'
import type { CalendarEvent } from '../src/types.ts'

const NOW = new Date('2026-09-01T12:00:00.000Z')

const event = (partial: Partial<CalendarEvent> = {}): CalendarEvent => ({
  id: 'evt_1',
  calendarId: 'cal_1',
  title: 'Design review',
  allDay: false,
  startDate: '2026-09-01',
  endDate: '2026-09-01',
  startTime: '13:00',
  endTime: '14:00',
  createdAt: NOW.toISOString(),
  updatedAt: NOW.toISOString(),
  ...partial,
})

/** The unfolded logical lines of a built calendar. */
function lines(ics: string): string[] {
  return ics.replace(/\r\n /g, '').split('\r\n').filter(Boolean)
}

test('a calendar carries the required envelope', () => {
  const out = lines(buildICS([event()], NOW))
  assert.equal(out[0], 'BEGIN:VCALENDAR')
  assert.equal(out.at(-1), 'END:VCALENDAR')
  assert.ok(out.includes('VERSION:2.0'))
  assert.ok(out.some((l) => l.startsWith('PRODID:')))
})

test('every line ends CRLF, as the spec requires', () => {
  const ics = buildICS([event()], NOW)
  assert.ok(ics.endsWith('\r\n'))
  assert.equal(ics.split('\n').length - 1, ics.split('\r\n').length - 1)
})

test('a timed event is written as a floating local time', () => {
  const out = lines(buildICS([event()], NOW))
  assert.ok(out.includes('DTSTART:20260901T130000'), 'no Z suffix and no TZID')
  assert.ok(out.includes('DTEND:20260901T140000'))
  assert.ok(out.includes('SUMMARY:Design review'))
  assert.ok(out.includes('UID:evt_1@cadence.app'))
  assert.ok(out.includes('DTSTAMP:20260901T120000Z'))
})

test('an all-day event uses DATE values with an exclusive end', () => {
  const out = lines(buildICS([event({ allDay: true, startDate: '2026-09-04', endDate: '2026-09-05' })], NOW))
  assert.ok(out.includes('DTSTART;VALUE=DATE:20260904'))
  assert.ok(out.includes('DTEND;VALUE=DATE:20260906'), 'DTEND is the day after the last day')
})

test('a single all-day event still ends on the following day', () => {
  const out = lines(buildICS([event({ allDay: true, startDate: '2026-09-04', endDate: '2026-09-04' })], NOW))
  assert.ok(out.includes('DTEND;VALUE=DATE:20260905'))
})

test('optional fields appear only when set', () => {
  const bare = lines(buildICS([event()], NOW))
  assert.ok(!bare.some((l) => l.startsWith('LOCATION')))
  assert.ok(!bare.some((l) => l.startsWith('DESCRIPTION')))
  assert.ok(!bare.some((l) => l.startsWith('RRULE')))
  assert.ok(!bare.includes('BEGIN:VALARM'))

  const full = lines(buildICS([event({ location: 'Studio B', notes: 'Bring the deck', url: 'https://x.test' })], NOW))
  assert.ok(full.includes('LOCATION:Studio B'))
  assert.ok(full.includes('DESCRIPTION:Bring the deck'))
  assert.ok(full.includes('URL:https://x.test'))
})

test('an alert becomes a VALARM with a negative trigger', () => {
  const out = lines(buildICS([event({ alertMinutesBefore: 15 })], NOW))
  assert.ok(out.includes('BEGIN:VALARM'))
  assert.ok(out.includes('TRIGGER:-PT15M'))
  assert.ok(out.includes('ACTION:DISPLAY'))
  assert.ok(out.includes('END:VALARM'))
})

test('an alert at the time of the event triggers at zero', () => {
  assert.ok(lines(buildICS([event({ alertMinutesBefore: 0 })], NOW)).includes('TRIGGER:-PT0M'))
})

test('recurrence maps onto RRULE', () => {
  assert.equal(toRRule({ freq: 'daily', interval: 1 }, false), 'RRULE:FREQ=DAILY')
  assert.equal(toRRule({ freq: 'daily', interval: 3 }, false), 'RRULE:FREQ=DAILY;INTERVAL=3')
  assert.equal(
    toRRule({ freq: 'weekly', interval: 1, byWeekday: [1, 3, 5] }, false),
    'RRULE:FREQ=WEEKLY;BYDAY=MO,WE,FR',
  )
  assert.equal(toRRule({ freq: 'monthly', interval: 2 }, false), 'RRULE:FREQ=MONTHLY;INTERVAL=2')
  assert.equal(toRRule({ freq: 'yearly', interval: 1 }, false), 'RRULE:FREQ=YEARLY')
})

test('UNTIL matches the value type of DTSTART', () => {
  assert.match(toRRule({ freq: 'daily', interval: 1, until: '2026-12-31' }, false), /UNTIL=20261231T235959$/)
  assert.match(toRRule({ freq: 'daily', interval: 1, until: '2026-12-31' }, true), /UNTIL=20261231$/)
})

test('TEXT values escape the characters that would break parsing', () => {
  assert.equal(escapeText('a,b;c\\d'), 'a\\,b\;c\\\\d')
  assert.equal(escapeText('line one\nline two'), 'line one\\nline two')
  const out = lines(buildICS([event({ title: 'Lunch, then; talk', notes: 'one\ntwo' })], NOW))
  assert.ok(out.includes('SUMMARY:Lunch\\, then\; talk'))
  assert.ok(out.includes('DESCRIPTION:one\\ntwo'))
})

test('long lines fold at 75 octets and continue with a space', () => {
  const folded = foldLine('SUMMARY:' + 'x'.repeat(200))
  const parts = folded.split('\r\n')
  assert.ok(parts.length > 1)
  assert.ok(parts.slice(1).every((p) => p.startsWith(' ')))
  for (const part of parts) {
    assert.ok(new TextEncoder().encode(part).length <= 75, `line too long: ${part.length}`)
  }
  // Unfolding restores the original.
  assert.equal(folded.replace(/\r\n /g, ''), 'SUMMARY:' + 'x'.repeat(200))
})

test('folding counts octets, so multi-byte characters stay intact', () => {
  const folded = foldLine('SUMMARY:' + '🎉'.repeat(40))
  for (const part of folded.split('\r\n')) {
    assert.ok(new TextEncoder().encode(part).length <= 75)
  }
  assert.equal(folded.replace(/\r\n /g, ''), 'SUMMARY:' + '🎉'.repeat(40))
})

test('several events share one calendar', () => {
  const out = lines(buildICS([event(), event({ id: 'evt_2', title: 'Gym' })], NOW))
  assert.equal(out.filter((l) => l === 'BEGIN:VEVENT').length, 2)
  assert.equal(out.filter((l) => l === 'END:VEVENT').length, 2)
})

test('filenames are slugged and bounded', () => {
  assert.equal(icsFilename('Lunch with Sam'), 'lunch-with-sam.ics')
  assert.equal(icsFilename('  ???  '), 'event.ics')
  assert.ok(icsFilename('x'.repeat(120)).length <= 44)
})
