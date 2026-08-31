import { useMemo } from 'react'
import type { AppState, EventOccurrence, Reminder } from '../../types'
import { occurrencesOnDay } from '../../state/selectors'
import { formatTime, friendlyDate, minutesFromTime } from '../../lib/date'
import { Icon } from '../ui/Icon'

type Entry =
  | { kind: 'event'; at: number; occ: EventOccurrence }
  | { kind: 'reminder'; at: number; reminder: Reminder }

/**
 * The chronological list under the compact month view — what the month grid's
 * dots stand for, once a day is selected.
 */
export function DayAgenda({
  state,
  date,
  occurrences,
  onOpenEvent,
}: {
  state: AppState
  date: string
  occurrences: EventOccurrence[]
  onOpenEvent: (id: string) => void
}) {
  const use24 = state.prefs.use24HourTime

  // Events and dated reminders interleave in one timeline; anything without a
  // time of its own sorts to the top, the way an all-day band reads.
  const entries = useMemo<Entry[]>(() => {
    const events: Entry[] = occurrencesOnDay(occurrences, date).map((occ) => ({
      kind: 'event',
      at: occ.event.allDay ? -1 : occ.startMinutes,
      occ,
    }))
    const reminders: Entry[] = state.prefs.showRemindersOnCalendar
      ? state.reminders
          .filter((r) => r.dueDate === date && !r.completed)
          .map((r) => ({ kind: 'reminder', at: r.dueTime ? minutesFromTime(r.dueTime) : -1, reminder: r }))
      : []
    return [...events, ...reminders].sort((a, b) => a.at - b.at)
  }, [occurrences, date, state.reminders, state.prefs.showRemindersOnCalendar])

  return (
    <div className="agenda">
      <h2 className="agenda__head">{friendlyDate(date)}</h2>
      <ul className="agenda__list scroll">
        {entries.length === 0 && <li className="agenda__empty">No events</li>}

        {entries.map((entry) => {
          if (entry.kind === 'reminder') {
            const r = entry.reminder
            const list = state.lists.find((l) => l.id === r.listId)
            return (
              <li key={r.id} className={`agenda__row tint-${list?.tint ?? 'blue'}`}>
                <span className="agenda__btn">
                  <span className="agenda__time">{r.dueTime ? formatTime(r.dueTime, use24) : '—'}</span>
                  <span className="agenda__bar agenda__bar--dashed" />
                  <span className="agenda__text">
                    <span className="agenda__title">
                      <Icon name="checklist" size={12} /> {r.title || 'Reminder'}
                    </span>
                    {list && <span className="agenda__sub">{list.name}</span>}
                  </span>
                </span>
              </li>
            )
          }

          const occ = entry.occ
          const cal = state.calendars.find((c) => c.id === occ.event.calendarId)
          return (
            <li key={`${occ.event.id}-${occ.date}`} className={`agenda__row tint-${cal?.tint ?? 'blue'}`}>
              <button type="button" className="agenda__btn" onClick={() => onOpenEvent(occ.event.id)}>
                <span className="agenda__time">
                  {occ.event.allDay ? 'all-day' : formatTime(occ.event.startTime, use24)}
                  {!occ.event.allDay && occ.event.endTime && (
                    <span className="agenda__end">{formatTime(occ.event.endTime, use24)}</span>
                  )}
                </span>
                <span className="agenda__bar" />
                <span className="agenda__text">
                  <span className="agenda__title">{occ.event.title || 'New Event'}</span>
                  {occ.event.location && <span className="agenda__sub">{occ.event.location}</span>}
                </span>
              </button>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
