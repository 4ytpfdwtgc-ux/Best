import type { Recurrence } from '../types'
import { addDays, addMonths, addYears, diffDays, fromISODate, weekdayOf } from './date.ts'

export function describeRecurrence(r: Recurrence | undefined): string {
  if (!r) return 'Never'
  const n = r.interval
  const unit = { daily: 'day', weekly: 'week', monthly: 'month', yearly: 'year' }[r.freq]
  const base = n === 1 ? `Every ${unit}` : `Every ${n} ${unit}s`
  if (r.freq === 'weekly' && r.byWeekday?.length) {
    const names = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
    return `${base} on ${r.byWeekday.slice().sort().map((d) => names[d]).join(', ')}`
  }
  return base
}

/** The next occurrence strictly after `from`, or `null` once the rule is exhausted. */
export function nextOccurrence(start: string, r: Recurrence, from: string): string | null {
  const interval = Math.max(1, r.interval)

  let next: string
  if (r.freq === 'weekly' && r.byWeekday?.length) {
    const days = [...new Set(r.byWeekday)].sort((a, b) => a - b)
    // Walk forward day by day; a week rule never skips more than 7*interval days.
    next = addDays(from, 1)
    const limit = 7 * interval + 7
    let found: string | null = null
    for (let i = 0; i < limit; i++) {
      const candidate = addDays(from, i + 1)
      if (!days.includes(weekdayOf(candidate))) continue
      // Respect the interval: count whole weeks elapsed since the start week.
      const weeks = Math.floor(diffDays(startOfRuleWeek(start), startOfRuleWeek(candidate)) / 7)
      if (weeks % interval === 0) {
        found = candidate
        break
      }
    }
    if (!found) return null
    next = found
  } else {
    // Advance from `start` in whole intervals until we pass `from`.
    let cursor = start
    let guard = 0
    while (cursor <= from && guard++ < 5000) {
      cursor =
        r.freq === 'daily'
          ? addDays(cursor, interval)
          : r.freq === 'weekly'
            ? addDays(cursor, 7 * interval)
            : r.freq === 'monthly'
              ? addMonths(cursor, interval)
              : addYears(cursor, interval)
    }
    next = cursor
  }

  if (r.until && next > r.until) return null
  return next
}

function startOfRuleWeek(iso: string): string {
  return addDays(iso, -weekdayOf(iso))
}

/**
 * Every date in `[rangeStart, rangeEnd]` on which an occurrence of the rule
 * beginning at `start` lands. Inclusive on both ends.
 */
export function occurrencesInRange(
  start: string,
  r: Recurrence | undefined,
  rangeStart: string,
  rangeEnd: string,
): string[] {
  if (!r) return start >= rangeStart && start <= rangeEnd ? [start] : []
  if (r.until && r.until < rangeStart) return []

  const out: string[] = []
  if (start >= rangeStart && start <= rangeEnd && matchesRule(start, start, r)) out.push(start)

  let cursor = start > rangeStart ? start : addDays(rangeStart, -1)
  let guard = 0
  while (guard++ < 2000) {
    const next = nextOccurrence(start, r, cursor)
    if (!next || next > rangeEnd) break
    if (next >= rangeStart) out.push(next)
    cursor = next
  }
  return [...new Set(out)].sort()
}

function matchesRule(date: string, start: string, r: Recurrence): boolean {
  if (r.freq === 'weekly' && r.byWeekday?.length) return r.byWeekday.includes(weekdayOf(date))
  return date === start || fromISODate(date) >= fromISODate(start)
}
