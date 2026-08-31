import { useMemo } from 'react'
import type { AppState, EventOccurrence } from '../../types'
import { occurrencesOnDay } from '../../state/selectors'
import {
  formatTime, fromISODate, isSameMonth, monthGrid, startOfMonth, todayISO, weekdayOf,
} from '../../lib/date'

const WEEKDAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const MAX_CHIPS = 3

export function MonthView({
  state,
  occurrences,
  onOpenEvent,
  onOpenDay,
  onNewEvent,
}: {
  state: AppState
  occurrences: EventOccurrence[]
  onOpenEvent: (id: string) => void
  onOpenDay: (iso: string) => void
  onNewEvent: (iso: string) => void
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

  return (
    <div className="month">
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
                (weekdayOf(day) === 0 || weekdayOf(day) === 6 ? ' is-weekend' : '')
              }
              onClick={() => onOpenDay(day)}
              onDoubleClick={() => onNewEvent(day)}
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
                      className={`chip tint-${cal?.tint ?? 'blue'}${occ.event.allDay ? ' chip--allday' : ''}`}
                      onClick={(e) => {
                        e.stopPropagation()
                        onOpenEvent(occ.event.id)
                      }}
                      title={occ.event.title}
                    >
                      {occ.event.allDay ? null : <span className="chip__dot" />}
                      <span className="chip__text">
                        {!occ.event.allDay && occ.event.startTime
                          ? `${formatTime(occ.event.startTime, state.prefs.use24HourTime)} `
                          : ''}
                        {continues ? '↳ ' : ''}
                        {occ.event.title || 'New Event'}
                      </span>
                    </button>
                  )
                })}
                {overflow > 0 && <span className="month__more">{overflow} more</span>}
              </div>
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
