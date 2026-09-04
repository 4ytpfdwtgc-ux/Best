import { useMemo, useRef, useState } from 'react'
import type { AppState, EventOccurrence } from '../../types'
import { occurrencesOnDay } from '../../state/selectors'
import { moveEvent } from '../../lib/reschedule'
import { updateEvent } from '../../state/actions'
import { diffDays } from '../../lib/date'
import {
  formatTime, fromISODate, isSameMonth, monthGrid, startOfMonth, timeFromMinutes, todayISO, weekdayOf,
} from '../../lib/date'

const WEEKDAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const MAX_CHIPS = 3

export function MonthView({
  state,
  occurrences,
  onOpenEvent,
  onOpenDay,
  onNewEvent,
  compact = false,
}: {
  state: AppState
  occurrences: EventOccurrence[]
  onOpenEvent: (id: string) => void
  onOpenDay: (iso: string) => void
  onNewEvent: (iso: string) => void
  /** Phone widths: too narrow for labelled chips, so days carry dots instead. */
  compact?: boolean
}) {
  const { weekStartsOn } = state.prefs
  const days = useMemo(
    () => monthGrid(state.calendarDate, weekStartsOn),
    [state.calendarDate, weekStartsOn],
  )
  const month = startOfMonth(state.calendarDate)
  const today = todayISO()
  const headers = useMemo(
    () => Array.from({ length: 7 }, (_, i) => WEEKDAY_NAMES[(i + weekStartsOn) % 7]),
    [weekStartsOn],
  )

  /*
   * Dragging a chip from one day to another. A month cell has no time in it,
   * so only the date moves: the event keeps the time it already had.
   */
  const dragRef = useRef<{ id: string; from: string } | null>(null)
  const [dragOver, setDragOver] = useState<string | null>(null)
  // Read from the pointerup handler, which would otherwise see a stale value.
  const dragOverRef = useRef<string | null>(null)
  dragOverRef.current = dragOver
  const movedRef = useRef(false)

  function startChipDrag(e: React.PointerEvent, occ: EventOccurrence) {
    if (e.button !== 0) return
    const startX = e.clientX
    const startY = e.clientY
    const touch = e.pointerType === 'touch'
    let engaged = false
    let holdTimer: number | undefined

    const engage = () => {
      engaged = true
      movedRef.current = true
      dragRef.current = { id: occ.event.id, from: occ.date }
    }

    // A finger holds first; the month grid scrolls under it otherwise.
    if (touch) holdTimer = window.setTimeout(engage, 350)

    const onMove = (ev: PointerEvent) => {
      if (!engaged) {
        const far = Math.abs(ev.clientX - startX) > 4 || Math.abs(ev.clientY - startY) > 4
        if (touch) {
          if (far) cleanup()
          return
        }
        if (!far) return
        engage()
      }
      const cell = document
        .elementsFromPoint(ev.clientX, ev.clientY)
        .find((el): el is HTMLElement => el instanceof HTMLElement && el.dataset.date !== undefined)
      setDragOver(cell?.dataset.date ?? null)
    }

    const onUp = () => {
      const current = dragRef.current
      const target = dragOverRef.current
      cleanup()
      window.setTimeout(() => void (movedRef.current = false), 0)
      if (!current || !target || target === current.from) return
      const dayDelta = diffDays(current.from, target)
      if (!dayDelta) return
      // A repeating event's day belongs to its rule, not to one occurrence.
      if (occ.event.recurrence) return
      updateEvent(occ.event.id, moveEvent(occ.event, { minuteDelta: 0, dayDelta }))
    }

    const cleanup = () => {
      window.clearTimeout(holdTimer)
      dragRef.current = null
      setDragOver(null)
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('pointercancel', cleanup)
    }

    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    window.addEventListener('pointercancel', cleanup)
  }

  return (
    <div className={`month${compact ? ' month--compact' : ''}`}>
      <div className="month__weekdays">
        {headers.map((h) => (
          <span key={h}>{h}</span>
        ))}
      </div>

      <div className="month__grid">
        {days.map((day) => {
          const dayEvents = occurrencesOnDay(occurrences, day)
          const dayReminders = state.prefs.showRemindersOnCalendar
            ? state.reminders.filter((r) => r.dueDate === day && !r.completed)
            : []
          const chips = [...dayEvents, ...dayReminders.map((r) => ({ reminder: r }))]
          const overflow = chips.length - MAX_CHIPS

          return (
            <div
              key={day}
              className={
                'month__cell' +
                (isSameMonth(day, month) ? '' : ' is-outside') +
                (day === today ? ' is-today' : '') +
                (day === state.calendarDate ? ' is-selected' : '') +
                (dragOver === day ? ' is-droptarget' : '') +
                (weekdayOf(day) === 0 || weekdayOf(day) === 6 ? ' is-weekend' : '')
              }
              onClick={() => onOpenDay(day)}
              onDoubleClick={() => onNewEvent(day)}
              data-date={day}
              role="gridcell"
              tabIndex={0}
              aria-label={day}
              onKeyDown={(e) => {
                if (e.key === 'Enter') onOpenDay(day)
              }}
            >
              <span className="month__date">
                {day.slice(8) === '01' ? shortMonth(day) + ' ' : ''}
                {Number(day.slice(8))}
              </span>

              {compact ? (
                <div className="month__dots">
                  {chips.slice(0, 4).map((chip, i) => {
                    const tint =
                      'reminder' in chip
                        ? state.lists.find((l) => l.id === chip.reminder.listId)?.tint
                        : state.calendars.find((c) => c.id === chip.event.calendarId)?.tint
                    return (
                      <span
                        key={i}
                        className={`month__dot tint-${tint ?? 'blue'}${'reminder' in chip ? ' is-reminder' : ''}`}
                      />
                    )
                  })}
                </div>
              ) : (
              <div className="month__chips">
                {chips.slice(0, MAX_CHIPS).map((chip, i) => {
                  if ('reminder' in chip) {
                    const list = state.lists.find((l) => l.id === chip.reminder.listId)
                    return (
                      <span key={`r-${chip.reminder.id}`} className={`chip chip--reminder tint-${list?.tint ?? 'blue'}`}>
                        <span className="chip__dot" />
                        <span className="chip__text">{chip.reminder.title || 'Reminder'}</span>
                      </span>
                    )
                  }
                  const occ = chip as EventOccurrence
                  const cal = state.calendars.find((c) => c.id === occ.event.calendarId)
                  const continues = occ.date !== day
                  return (
                    <button
                      key={`e-${occ.event.id}-${occ.date}-${i}`}
                      type="button"
                      className={`chip tint-${cal?.tint ?? 'blue'}${occ.event.allDay ? ' chip--allday' : ''}${
                        occ.event.recurrence ? '' : ' chip--draggable'
                      }`}
                      onPointerDown={(e) => {
                        if (occ.event.recurrence) return
                        e.stopPropagation()
                        startChipDrag(e, occ)
                      }}
                      onClick={(e) => {
                        e.stopPropagation()
                        if (movedRef.current) return
                        onOpenEvent(occ.event.id)
                      }}
                      title={occ.event.title}
                    >
                      {occ.event.allDay ? null : <span className="chip__dot" />}
                      <span className="chip__text">
                        {!occ.event.allDay && occ.event.startTime
                          ? `${formatTime(timeFromMinutes(occ.startMinutes), state.prefs.use24HourTime)} `
                          : ''}
                        {continues ? '↳ ' : ''}
                        {occ.event.title || 'New Event'}
                      </span>
                    </button>
                  )
                })}
                {overflow > 0 && <span className="month__more">{overflow} more</span>}
              </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

function shortMonth(iso: string): string {
  return new Intl.DateTimeFormat(undefined, { month: 'short' }).format(fromISODate(iso))
}
