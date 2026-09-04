import { timeFromMinutes, toISODate } from './date.ts'

/**
 * Time zones for events that have one.
 *
 * The app stores wall-clock times with no zone, which is right for most of a
 * personal calendar: lunch at noon is noon wherever you happen to be. It is
 * wrong for the things people actually get caught out by — a flight, a call
 * with someone three time zones away — where the event happens at one instant
 * and should move on the clock when you do.
 *
 * So a zone is opt-in. Without one an event floats, exactly as before. With
 * one, the stored time is the wall time *in that zone*, and it is converted
 * for whoever is looking.
 */

/** What the device is set to. */
export function deviceZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'
  } catch {
    return 'UTC'
  }
}

export function isValidZone(zone: string): boolean {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: zone })
    return true
  } catch {
    return false
  }
}

/** Every zone the browser knows, or a workable handful if it will not say. */
export function knownZones(): string[] {
  try {
    const all = (Intl as { supportedValuesOf?: (key: string) => string[] }).supportedValuesOf?.('timeZone')
    if (all?.length) return all
  } catch {
    // Older Safari has no supportedValuesOf.
  }
  return [
    'UTC', 'Europe/London', 'Europe/Dublin', 'Europe/Paris', 'Europe/Berlin', 'Europe/Madrid',
    'Europe/Rome', 'Europe/Amsterdam', 'Europe/Stockholm', 'Europe/Moscow',
    'America/New_York', 'America/Chicago', 'America/Denver', 'America/Los_Angeles',
    'America/Toronto', 'America/Vancouver', 'America/Mexico_City', 'America/Sao_Paulo',
    'Africa/Cairo', 'Africa/Lagos', 'Africa/Johannesburg',
    'Asia/Dubai', 'Asia/Karachi', 'Asia/Kolkata', 'Asia/Bangkok', 'Asia/Shanghai',
    'Asia/Hong_Kong', 'Asia/Singapore', 'Asia/Tokyo', 'Asia/Seoul',
    'Australia/Perth', 'Australia/Sydney', 'Pacific/Auckland',
  ]
}

/** "Europe/London" reads better as "Europe / London". */
export function zoneLabel(zone: string): string {
  return zone.replace(/_/g, ' ').replace('/', ' / ')
}

/* ------------------------------------------------------------------ */
/* Conversion                                                          */
/* ------------------------------------------------------------------ */

/**
 * How far `zone` is from UTC at a given instant, in minutes.
 *
 * Read back out of Intl rather than from a table, so it is right across every
 * daylight-saving change without shipping a zone database.
 */
export function offsetMinutes(instant: Date, zone: string): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: zone,
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(instant)

  const at = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? '0')
  // formatToParts can give hour 24 for midnight in some engines.
  const asIfUTC = Date.UTC(at('year'), at('month') - 1, at('day'), at('hour') % 24, at('minute'), at('second'))
  return Math.round((asIfUTC - instant.getTime()) / 60000)
}

/**
 * The instant at which a wall-clock time occurs in a zone.
 *
 * The offset depends on the instant, and the instant is what is being worked
 * out, so the first guess is corrected once — enough for every real zone,
 * including the hours that daylight saving skips or repeats.
 */
export function zonedToInstant(date: string, time: string, zone: string): Date {
  const [y, m, d] = date.split('-').map(Number)
  const [hh, mm] = time.split(':').map(Number)
  const wall = Date.UTC(y, (m || 1) - 1, d || 1, hh || 0, mm || 0)

  const first = offsetMinutes(new Date(wall), zone)
  const corrected = offsetMinutes(new Date(wall - first * 60000), zone)
  return new Date(wall - corrected * 60000)
}

/** The wall-clock date and time an instant reads as, in a zone. */
export function instantToZoned(instant: Date, zone: string): { date: string; time: string } {
  const offset = offsetMinutes(instant, zone)
  const shifted = new Date(instant.getTime() + offset * 60000)
  return {
    // The shifted value is UTC-shaped, so read it back in UTC.
    date: toISODate(new Date(shifted.getUTCFullYear(), shifted.getUTCMonth(), shifted.getUTCDate())),
    time: timeFromMinutes(shifted.getUTCHours() * 60 + shifted.getUTCMinutes()),
  }
}

/**
 * A wall-clock time moved from one zone to another.
 *
 * This is the whole feature in one function: a 09:00 call in New York is what
 * time here, on what day.
 */
export function convertWallTime(
  date: string,
  time: string,
  from: string,
  to: string,
): { date: string; time: string } {
  if (from === to) return { date, time }
  return instantToZoned(zonedToInstant(date, time, from), to)
}

/** "GMT+1", for showing beside a zone name. */
export function offsetLabel(instant: Date, zone: string): string {
  const minutes = offsetMinutes(instant, zone)
  if (minutes === 0) return 'GMT'
  const sign = minutes < 0 ? '-' : '+'
  const abs = Math.abs(minutes)
  const hours = Math.floor(abs / 60)
  const rest = abs % 60
  return `GMT${sign}${hours}${rest ? `:${String(rest).padStart(2, '0')}` : ''}`
}
