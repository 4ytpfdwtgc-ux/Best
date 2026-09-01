import type { CalendarEvent, Recurrence } from '../types.ts'
import { addDays } from './date.ts'

/**
 * iCalendar (RFC 5545) output, so an event can be handed to iOS Calendar.
 *
 * Times are written as *floating* local values — no `Z`, no `TZID` — which is
 * exactly what the app stores: a wall-clock time with no zone attached. A
 * floating time is displayed in the reader's own zone, so no VTIMEZONE block
 * has to be shipped along with it.
 */

const PRODID = '-//Cadence//Reminders Calendar Notes//EN'
const WEEKDAYS = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA']

/** Escape a TEXT value: backslash, semicolon, comma and newlines (RFC 5545 §3.3.11). */
export function escapeText(value: string): string {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\;')
    .replace(/,/g, '\\,')
    .replace(/\r?\n/g, '\\n')
}

/**
 * Fold a content line to 75 octets, continuing with a leading space
 * (RFC 5545 §3.1). Folding counts octets, not characters, so an emoji in a
 * title must not be split down the middle.
 */
export function foldLine(line: string): string {
  const encoder = new TextEncoder()
  if (encoder.encode(line).length <= 75) return line

  const out: string[] = []
  let current = ''
  let octets = 0
  // The continuation space costs an octet, so later lines get 74 of content.
  let limit = 75

  for (const char of line) {
    const size = encoder.encode(char).length
    if (octets + size > limit) {
      out.push(current)
      current = ''
      octets = 0
      limit = 74
    }
    current += char
    octets += size
  }
  if (current) out.push(current)
  return out.join('\r\n ')
}

function dateValue(iso: string): string {
  return iso.replace(/-/g, '')
}

function dateTimeValue(iso: string, time: string | undefined): string {
  const [h, m] = (time ?? '00:00').split(':')
  return `${dateValue(iso)}T${h.padStart(2, '0')}${m.padStart(2, '0')}00`
}

/** UTC stamp for DTSTAMP, which must be absolute. */
function utcStamp(date = new Date()): string {
  return date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')
}

export function toRRule(recurrence: Recurrence, allDay: boolean): string {
  const freq = { daily: 'DAILY', weekly: 'WEEKLY', monthly: 'MONTHLY', yearly: 'YEARLY' }[recurrence.freq]
  const parts = [`FREQ=${freq}`]
  if (recurrence.interval > 1) parts.push(`INTERVAL=${recurrence.interval}`)
  if (recurrence.freq === 'weekly' && recurrence.byWeekday?.length) {
    parts.push(`BYDAY=${recurrence.byWeekday.slice().sort().map((d) => WEEKDAYS[d]).join(',')}`)
  }
  if (recurrence.until) {
    // UNTIL has to match DTSTART's value type.
    parts.push(`UNTIL=${allDay ? dateValue(recurrence.until) : `${dateValue(recurrence.until)}T235959`}`)
  }
  return `RRULE:${parts.join(';')}`
}

/** The VEVENT lines for one event, unfolded. */
function eventLines(event: CalendarEvent, stamp: string): string[] {
  const lines = ['BEGIN:VEVENT', `UID:${event.id}@cadence.app`, `DTSTAMP:${stamp}`]

  if (event.allDay) {
    lines.push(`DTSTART;VALUE=DATE:${dateValue(event.startDate)}`)
    // DTEND is exclusive for all-day events, so a one-day event ends tomorrow.
    lines.push(`DTEND;VALUE=DATE:${dateValue(addDays(event.endDate, 1))}`)
  } else {
    lines.push(`DTSTART:${dateTimeValue(event.startDate, event.startTime)}`)
    const endTime = event.endTime ?? event.startTime
    lines.push(`DTEND:${dateTimeValue(event.endDate, endTime)}`)
  }

  lines.push(`SUMMARY:${escapeText(event.title || 'Untitled event')}`)
  if (event.location) lines.push(`LOCATION:${escapeText(event.location)}`)
  if (event.notes) lines.push(`DESCRIPTION:${escapeText(event.notes)}`)
  if (event.url) lines.push(`URL:${escapeText(event.url)}`)
  if (event.recurrence) lines.push(toRRule(event.recurrence, event.allDay))

  if (event.alertMinutesBefore != null) {
    lines.push(
      'BEGIN:VALARM',
      'ACTION:DISPLAY',
      `TRIGGER:-PT${Math.max(0, Math.round(event.alertMinutesBefore))}M`,
      `DESCRIPTION:${escapeText(event.title || 'Reminder')}`,
      'END:VALARM',
    )
  }

  lines.push('END:VEVENT')
  return lines
}

/** A complete .ics document for one or more events. */
export function buildICS(events: CalendarEvent[], now = new Date()): string {
  const stamp = utcStamp(now)
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    `PRODID:${PRODID}`,
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    ...events.flatMap((event) => eventLines(event, stamp)),
    'END:VCALENDAR',
  ]
  // RFC 5545 requires CRLF line endings.
  return lines.map(foldLine).join('\r\n') + '\r\n'
}

/** A filename-safe slug for the downloaded file. */
export function icsFilename(title: string): string {
  const slug = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40)
  return `${slug || 'event'}.ics`
}
