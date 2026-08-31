import { useEffect, useRef } from 'react'
import type { AppState, EventOccurrence } from '../../types'
import { layoutColumns, occurrencesOnDay } from '../../state/selectors'
import { formatHourLabel, formatTime, formatWeekdayShort, timeFromMinutes, todayISO } from '../../lib/date'

const HOUR_PX = 46
const DAY_MINUTES = 24 * 60

/** Shared hour-by-hour grid backing both the day and week views. */
export function TimeGrid({
  state,
  days,
  occurrences,
  onOpenEvent,
  onNewEvent,
  onSelectDay,
}: {
  state: AppState
  days: string[]
  occurrences: EventOccurrence[]
  onOpenEvent: (id: string) => void
  onNewEvent: (iso: string, time?: string) => void
  onSelectDay: (iso: string) => void
}) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const today = todayISO()
  const nowMinutes = new Date().getHours() * 60 + new Date().getMinutes()
  const use24 = state.prefs.use24HourTime

  // Open on the working day rather than at midnight.
  useEffect(() => {
    const el = scrollRef.current
    if (el) el.scrollTop = Math.max(0, (7.5 * HOUR_PX) - 20)
  }, [])

  const allDayRows = days.map((day) =>
    occurrencesOnDay(occurrences, day).filter((o) => o.event.allDay),
  )
  const hasAllDay = allDayRows.some((r) => r.length > 0) || state.prefs.showRemindersOnCalendar

  return (
    <div className="tg">
      <div className="tg__header" style={{ gridTemplateColumns: `56px repeat(${days.length}, 1fr)` }}>
        <span />
        {days.map((day) => (
          <button
            key={day}
            type="button"
            className={`tg__dayhead${day === today ? ' is-today' : ''}${day === state.calendarDate ? ' is-selected' : ''}`}
            onClick={() => onSelectDay(day)}
          >
            <span className="tg__dayname">{formatWeekdayShort(day)}</span>
            <span className="tg__daynum">{Number(day.slice(8))}</span>
          </button>
        ))}
      </div>

      {hasAllDay && (
        <div className="tg__allday" style={{ gridTemplateColumns: `56px repeat(${days.length}, 1fr)` }}>
          <span className="tg__allday-label">all-day</span>
          {days.map((day, i) => {
            const reminders = state.prefs.showRemindersOnCalendar
              ? state.reminders.filter((r) => r.dueDate === day && !r.completed)
              : []
            return (
              <div key={day} className="tg__allday-cell">
                {allDayRows[i].map((occ) => {
                  const cal = state.calendars.find((c) => c.id === occ.event.calendarId)
                  return (
                    <button
                      key={`${occ.event.id}-${occ.date}`}
                      type="button"
                      className={`chip chip--allday tint-${cal?.tint ?? 'blue'}`}
                      onClick={() => onOpenEvent(occ.event.id)}
                    >
                      <span className="chip__text">{occ.event.title || 'New Event'}</span>
                    </button>
                  )
                })}
                {reminders.map((r) => {
                  const list = state.lists.find((l) => l.id === r.listId)
                  return (
                    <span key={r.id} className={`chip chip--reminder tint-${list?.tint ?? 'blue'}`}>
                      <span className="chip__dot" />
                      <span className="chip__text">
                        {r.dueTime ? `${formatTime(r.dueTime, use24)} ` : ''}
                        {r.title || 'Reminder'}
                      </span>
                    </span>
                  )
                })}
              </div>
            )
          })}
        </div>
      )}

      <div className="tg__scroll scroll" ref={scrollRef}>
        <div className="tg__body" style={{ gridTemplateColumns: `56px repeat(${days.length}, 1fr)`, height: 24 * HOUR_PX }}>
          <div className="tg__hours">
            {Array.from({ length: 24 }, (_, h) => (
              <span key={h} className="tg__hour" style={{ top: h * HOUR_PX }}>
                {h === 0 ? '' : formatHourLabel(h, use24)}
              </span>
            ))}
          </div>

          {days.map((day) => {
            const timed = occurrencesOnDay(occurrences, day).filter((o) => !o.event.allDay)
            const laid = layoutColumns(timed)
            return (
              <div
                key={day}
                className={`tg__col${day === today ? ' is-today' : ''}`}
                onDoubleClick={(e) => {
                  const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
                  const minutes = Math.floor(((e.clientY - rect.top) / HOUR_PX) * 60 / 30) * 30
                  onNewEvent(day, timeFromMinutes(Math.min(DAY_MINUTES - 30, Math.max(0, minutes))))
                }}
              >
                {Array.from({ length: 24 }, (_, h) => (
                  <span key={h} className="tg__line" style={{ top: h * HOUR_PX }} />
                ))}

                {laid.map(({ occ, col, cols }) => {
                  const cal = state.calendars.find((c) => c.id === occ.event.calendarId)
                  // A multi-day timed event fills the whole day on its middle days.
                  const isStart = occ.date === day
                  const start = isStart ? occ.startMinutes : 0
                  const end = Math.max(start + 20, isStart ? occ.endMinutes : DAY_MINUTES)
                  const height = Math.max(15, ((end - start) / 60) * HOUR_PX - 2)
                  // Short events read better as a single line than as a stacked block.
                  const compact = height < 28
                  return (
                    <button
                      key={`${occ.event.id}-${occ.date}`}
                      type="button"
                      className={`ev tint-${cal?.tint ?? 'blue'}${compact ? ' ev--compact' : ''}`}
                      style={{
                        top: (start / 60) * HOUR_PX,
                        height,
                        left: `calc(${(col / cols) * 100}% + 2px)`,
                        width: `calc(${100 / cols}% - 5px)`,
                      }}
                      onClick={(e) => {
                        e.stopPropagation()
                        onOpenEvent(occ.event.id)
                      }}
                    >
                      <span className="ev__title">{occ.event.title || 'New Event'}</span>
                      <span className="ev__time">
                        {formatTime(occ.event.startTime, use24)}
                        {!compact && occ.event.location ? ` · ${occ.event.location}` : ''}
                      </span>
                    </button>
                  )
                })}

                {day === today && (
                  <span className="tg__now" style={{ top: (nowMinutes / 60) * HOUR_PX }} aria-hidden="true" />
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

export { HOUR_PX }
