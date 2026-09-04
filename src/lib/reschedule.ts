import type { CalendarEvent } from '../types.ts'
import { addDays, diffDays, timeFromMinutes } from './date.ts'

/** Dragging snaps to this, so an event never lands at 9:07. */
export const SNAP_MINUTES = 15
const DAY_MINUTES = 24 * 60
/** An event dragged shorter than this stops shrinking. */
export const MIN_MINUTES = 15

export interface Reschedule {
  startDate: string
  startTime: string
  endDate: string
  endTime: string
}

export function snap(minutes: number): number {
  return Math.round(minutes / SNAP_MINUTES) * SNAP_MINUTES
}

/**
 * Where an event lands after a drag.
 *
 * Kept apart from the grid that draws it so the arithmetic — the clamping, the
 * snapping, a drag that would run past midnight, an event that spans days —
 * can be reasoned about and tested on its own.
 */
export function moveEvent(
  event: CalendarEvent,
  { minuteDelta, dayDelta }: { minuteDelta: number; dayDelta: number },
): Reschedule {
  const startMinutes = minutesOf(event.startTime, 9 * 60)
  const endMinutes = minutesOf(event.endTime, startMinutes + 60)
  const length = Math.max(MIN_MINUTES, endMinutes - startMinutes)

  // Snap the destination rather than the delta, so a dragged event lands on the
  // grid even when it did not start on it.
  let start = snap(startMinutes + minuteDelta)
  let carry = 0
  // Dragged off the top or bottom of a day, it moves to the next day rather
  // than piling up against midnight.
  while (start < 0) {
    start += DAY_MINUTES
    carry -= 1
  }
  while (start >= DAY_MINUTES) {
    start -= DAY_MINUTES
    carry += 1
  }

  const startDate = addDays(event.startDate, dayDelta + carry)
  const end = start + length
  return {
    startDate,
    startTime: timeFromMinutes(start),
    // An event running past midnight ends on the following day.
    endDate: addDays(startDate, Math.floor(end / DAY_MINUTES)),
    endTime: timeFromMinutes(end % DAY_MINUTES),
  }
}

/** Where an event's end lands after its bottom edge is dragged. */
export function resizeEvent(event: CalendarEvent, minuteDelta: number): Reschedule {
  const startMinutes = minutesOf(event.startTime, 9 * 60)
  const spanDays = Math.max(0, diffDays(event.startDate, event.endDate))
  const endMinutes = minutesOf(event.endTime, startMinutes + 60) + spanDays * DAY_MINUTES

  // Never shorter than the minimum, never longer than a day from its start.
  const end = Math.min(
    startMinutes + DAY_MINUTES,
    Math.max(startMinutes + MIN_MINUTES, snap(endMinutes + minuteDelta)),
  )

  return {
    startDate: event.startDate,
    startTime: timeFromMinutes(startMinutes),
    endDate: addDays(event.startDate, Math.floor(end / DAY_MINUTES)),
    endTime: timeFromMinutes(end % DAY_MINUTES),
  }
}

/**
 * A repeating event's day is set by its rule, not by one occurrence, so a drag
 * changes only its time. Moving it to another weekday would silently rewrite
 * the rule for every other occurrence too.
 */
export function limitToTime(event: CalendarEvent, next: Reschedule): Reschedule {
  if (!event.recurrence) return next
  const shift = diffDays(next.startDate, event.startDate)
  return {
    ...next,
    startDate: event.startDate,
    endDate: addDays(next.endDate, shift),
  }
}

function minutesOf(time: string | undefined, fallback: number): number {
  if (!time) return fallback
  const [h, m] = time.split(':').map(Number)
  if (Number.isNaN(h) || Number.isNaN(m)) return fallback
  return h * 60 + m
}
