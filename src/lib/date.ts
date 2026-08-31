/**
 * Date helpers.
 *
 * Dates are passed around as ISO day strings (`yyyy-mm-dd`) and times as
 * `HH:mm`, both in the user's local zone. Working in strings avoids the
 * timezone drift you get from serializing `Date` objects, and makes day
 * comparison a string comparison.
 */

export const MS_DAY = 86_400_000

export function toISODate(d: Date): string {
  const y = d.getFullYear()
  const m = `${d.getMonth() + 1}`.padStart(2, '0')
  const day = `${d.getDate()}`.padStart(2, '0')
  return `${y}-${m}-${day}`
}

/** Parse `yyyy-mm-dd` into a local-midnight Date. */
export function fromISODate(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, (m ?? 1) - 1, d ?? 1)
}

export function todayISO(): string {
  return toISODate(new Date())
}

export function addDays(iso: string, n: number): string {
  const d = fromISODate(iso)
  d.setDate(d.getDate() + n)
  return toISODate(d)
}

export function addMonths(iso: string, n: number): string {
  const d = fromISODate(iso)
  const day = d.getDate()
  d.setDate(1)
  d.setMonth(d.getMonth() + n)
  // Clamp to the last valid day (Jan 31 + 1 month => Feb 28/29).
  d.setDate(Math.min(day, daysInMonth(d.getFullYear(), d.getMonth())))
  return toISODate(d)
}

export function addYears(iso: string, n: number): string {
  const d = fromISODate(iso)
  d.setFullYear(d.getFullYear() + n)
  return toISODate(d)
}

export function daysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate()
}

export function diffDays(a: string, b: string): number {
  return Math.round((fromISODate(b).getTime() - fromISODate(a).getTime()) / MS_DAY)
}

export function weekdayOf(iso: string): number {
  return fromISODate(iso).getDay()
}

export function startOfWeek(iso: string, weekStartsOn: 0 | 1): string {
  const wd = weekdayOf(iso)
  const delta = (wd - weekStartsOn + 7) % 7
  return addDays(iso, -delta)
}

export function startOfMonth(iso: string): string {
  return iso.slice(0, 8) + '01'
}

export function endOfMonth(iso: string): string {
  const d = fromISODate(iso)
  return toISODate(new Date(d.getFullYear(), d.getMonth() + 1, 0))
}

/** The 6x7 grid of days a month view shows, including leading/trailing days. */
export function monthGrid(iso: string, weekStartsOn: 0 | 1): string[] {
  const first = startOfWeek(startOfMonth(iso), weekStartsOn)
  return Array.from({ length: 42 }, (_, i) => addDays(first, i))
}

export function isSameMonth(a: string, b: string): boolean {
  return a.slice(0, 7) === b.slice(0, 7)
}

/* ---------------------------------------------------------------- */
/* Time-of-day                                                       */
/* ---------------------------------------------------------------- */

export function minutesFromTime(time: string | undefined, fallback = 0): number {
  if (!time) return fallback
  const [h, m] = time.split(':').map(Number)
  return (h || 0) * 60 + (m || 0)
}

export function timeFromMinutes(mins: number): string {
  const wrapped = ((mins % 1440) + 1440) % 1440
  const h = Math.floor(wrapped / 60)
  const m = wrapped % 60
  return `${`${h}`.padStart(2, '0')}:${`${m}`.padStart(2, '0')}`
}

/* ---------------------------------------------------------------- */
/* Formatting                                                        */
/* ---------------------------------------------------------------- */

const cache = new Map<string, Intl.DateTimeFormat>()
function fmt(opts: Intl.DateTimeFormatOptions): Intl.DateTimeFormat {
  const key = JSON.stringify(opts)
  let f = cache.get(key)
  if (!f) {
    f = new Intl.DateTimeFormat(undefined, opts)
    cache.set(key, f)
  }
  return f
}

export function formatTime(time: string | undefined, use24: boolean): string {
  if (!time) return ''
  const [h, m] = time.split(':').map(Number)
  const d = new Date(2000, 0, 1, h || 0, m || 0)
  return fmt({ hour: 'numeric', minute: '2-digit', hour12: !use24 }).format(d)
}

export function formatHourLabel(hour: number, use24: boolean): string {
  const d = new Date(2000, 0, 1, hour, 0)
  return use24
    ? `${`${hour}`.padStart(2, '0')}:00`
    : fmt({ hour: 'numeric', hour12: true }).format(d)
}

export function formatMonthYear(iso: string): string {
  return fmt({ month: 'long', year: 'numeric' }).format(fromISODate(iso))
}

export function formatWeekdayShort(iso: string): string {
  return fmt({ weekday: 'short' }).format(fromISODate(iso))
}

export function formatMediumDate(iso: string): string {
  return fmt({ weekday: 'short', month: 'short', day: 'numeric' }).format(fromISODate(iso))
}

export function formatLongDate(iso: string): string {
  return fmt({ weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }).format(
    fromISODate(iso),
  )
}

/** "Today", "Tomorrow", "Yesterday", a weekday within the week, else a date. */
export function friendlyDate(iso: string, today = todayISO()): string {
  const delta = diffDays(today, iso)
  if (delta === 0) return 'Today'
  if (delta === 1) return 'Tomorrow'
  if (delta === -1) return 'Yesterday'
  if (delta > 1 && delta < 7) return fmt({ weekday: 'long' }).format(fromISODate(iso))
  const sameYear = iso.slice(0, 4) === today.slice(0, 4)
  return fmt(
    sameYear
      ? { month: 'short', day: 'numeric' }
      : { month: 'short', day: 'numeric', year: 'numeric' },
  ).format(fromISODate(iso))
}

/** Relative label for note lists: time today, weekday this week, else a date. */
export function relativeStamp(isoTimestamp: string): string {
  const d = new Date(isoTimestamp)
  if (Number.isNaN(d.getTime())) return ''
  const day = toISODate(d)
  const delta = diffDays(day, todayISO())
  if (delta === 0) return fmt({ hour: 'numeric', minute: '2-digit' }).format(d)
  if (delta === 1) return 'Yesterday'
  if (delta < 7) return fmt({ weekday: 'long' }).format(d)
  return fmt({ month: 'numeric', day: 'numeric', year: '2-digit' }).format(d)
}

export function nowISO(): string {
  return new Date().toISOString()
}
