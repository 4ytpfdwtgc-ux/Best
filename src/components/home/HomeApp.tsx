import { useMemo, useState } from 'react'
import { useApp } from '../../state/store'
import { compareReminders, occurrencesBetween } from '../../state/selectors'
import {
  addReminder, setCalendarDate, setCalendarView, setModule,
  setReminderSelection, setSelectedEvent, setSelectedReminder, toggleReminder,
} from '../../state/actions'
import {
  addDays, formatLongDate, formatTime, friendlyDate, startOfWeek, timeFromMinutes, todayISO,
} from '../../lib/date'
import { Icon } from '../ui/Icon'
import { TimeGrid } from '../calendar/TimeGrid'
import { EventSheet, type EventDraft } from '../calendar/EventSheet'
import { WeekStrip } from './WeekStrip'

/**
 * The app's front door: reminders in the top third, the day's calendar in the
 * bottom two thirds. Both panes share the selected day, so the week strip
 * re-aims the whole screen at once.
 */
export function HomeApp({
  onOpenSearch,
  onOpenSettings,
}: {
  onOpenSearch: () => void
  onOpenSettings: () => void
}) {
  const state = useApp()
  const [draft, setDraft] = useState<EventDraft | null>(null)
  const today = todayISO()
  const date = state.calendarDate
  const isToday = date === today

  // On today the pane also carries overdue work; on any other day, just that day.
  const reminders = useMemo(
    () =>
      state.reminders
        .filter((r) => !r.completed && r.dueDate && (isToday ? r.dueDate <= date : r.dueDate === date))
        .sort(compareReminders),
    [state.reminders, date, isToday],
  )

  const weekStart = startOfWeek(date, state.prefs.weekStartsOn)
  const occurrences = useMemo(
    () => occurrencesBetween(state, weekStart, addDays(weekStart, 6)),
    [state, weekStart],
  )

  const busyDates = useMemo(() => {
    const set = new Set<string>()
    for (const o of occurrences) for (let i = 0; i < o.span; i++) set.add(addDays(o.date, i))
    return set
  }, [occurrences])

  const dayOccurrences = useMemo(
    () => occurrences.filter((o) => o.date <= date && date <= addDays(o.date, o.span - 1)),
    [occurrences, date],
  )

  /*
   * With only a third of the screen the grid has to open somewhere useful:
   * the day's first event, or the current hour on an empty today.
   */
  const scrollToMinutes = useMemo(() => {
    const timed = dayOccurrences.filter((o) => !o.event.allDay)
    const first = timed.length ? Math.min(...timed.map((o) => o.startMinutes)) : undefined
    const now = new Date().getHours() * 60 + new Date().getMinutes()
    if (first === undefined) return isToday ? Math.max(0, now - 60) : undefined
    return Math.max(0, Math.min(first, isToday ? now : first) - 30)
  }, [dayOccurrences, isToday])

  function openReminder(id: string, listId: string) {
    setReminderSelection({ kind: 'list', id: listId })
    setSelectedReminder(id)
    setModule('reminders')
  }

  return (
    <div className="home">
      <div className="home__top">
        <header className="home__bar">
        <div className="home__heading">
          <h1 className="home__title">{friendlyDate(date)}</h1>
          <p className="home__date">{formatLongDate(date)}</p>
        </div>
        {!isToday && (
          <button type="button" className="btn btn--plain" onClick={() => setCalendarDate(today)}>
            Today
          </button>
        )}
        <button type="button" className="icon-btn icon-btn--lg" onClick={onOpenSearch} aria-label="Search">
          <Icon name="search" size={19} />
        </button>
        <button type="button" className="icon-btn icon-btn--lg" onClick={onOpenSettings} aria-label="Settings">
          <Icon name="gear" size={19} />
        </button>
        </header>

        <section className="home__pane home__pane--reminders" aria-label="Reminders">
        <div className="home__panehead">
          <button
            type="button"
            className="home__panetitle"
            onClick={() => {
              setReminderSelection({ kind: 'smart', id: isToday ? 'today' : 'scheduled' })
              setModule('reminders')
            }}
          >
            Tasks
            <span className="home__count">{reminders.length}</span>
            <Icon name="chevronRight" size={13} strokeWidth={2.4} />
          </button>
          <button
            type="button"
            className="icon-btn icon-btn--lg"
            aria-label="New reminder"
            onClick={() => {
              const created = addReminder({
                listId: state.lists[0]?.id ?? 'list_inbox',
                title: '',
                dueDate: date,
              })
              openReminder(created.id, created.listId)
            }}
          >
            <Icon name="plus" size={19} strokeWidth={2.2} />
          </button>
        </div>

        <ul className="home__reminders scroll">
          {reminders.length === 0 ? (
            <li className="home__empty">
              <Icon name="check" size={15} strokeWidth={2.4} />
              Nothing due {isToday ? 'today' : friendlyDate(date).toLowerCase()}
            </li>
          ) : (
            reminders.map((r) => {
              const list = state.lists.find((l) => l.id === r.listId)
              const overdue = !!r.dueDate && r.dueDate < today
              return (
                <li key={r.id} className={`home__rem tint-${list?.tint ?? 'blue'}`}>
                  <button
                    type="button"
                    className="rem__check"
                    onClick={() => toggleReminder(r.id)}
                    aria-label={`Complete ${r.title || 'reminder'}`}
                  />
                  <button type="button" className="home__rembody" onClick={() => openReminder(r.id, r.listId)}>
                    <span className="home__remtitle">
                      {r.priority > 0 && <span className="rem__priority">{'!'.repeat(r.priority)}</span>}
                      {r.title || 'New Reminder'}
                      {r.flagged && <Icon name="flag" size={12} filled />}
                    </span>
                    <span className="home__remmeta">
                      {overdue && <span className="home__overdue">{friendlyDate(r.dueDate!)}</span>}
                      {r.dueTime && <span>{formatTime(r.dueTime, state.prefs.use24HourTime)}</span>}
                      {list && <span className="home__remlist">{list.name}</span>}
                    </span>
                  </button>
                </li>
              )
            })
          )}
        </ul>
        </section>
      </div>

      <section className="home__pane home__pane--calendar" aria-label="Calendar">
        <div className="home__panehead">
          <button
            type="button"
            className="home__panetitle"
            onClick={() => {
              setCalendarView('day')
              setSelectedEvent(null)
              setModule('calendar')
            }}
          >
            Calendar
            <Icon name="chevronRight" size={13} strokeWidth={2.4} />
          </button>
          <button
            type="button"
            className="icon-btn icon-btn--lg"
            aria-label="New event"
            onClick={() => setDraft({ startDate: date, startTime: defaultStartTime(isToday) })}
          >
            <Icon name="plus" size={19} strokeWidth={2.2} />
          </button>
        </div>

        <WeekStrip
          selected={date}
          weekStartsOn={state.prefs.weekStartsOn}
          busyDates={busyDates}
          onSelect={setCalendarDate}
        />

        <div className="home__grid">
          <TimeGrid
            state={state}
            days={[date]}
            occurrences={dayOccurrences}
            onOpenEvent={(id) => {
              const event = state.events.find((e) => e.id === id)
              if (event) setDraft({ event, startDate: event.startDate })
            }}
            onNewEvent={(iso, time) => setDraft({ startDate: iso, startTime: time })}
            onSelectDay={setCalendarDate}
            showHeader={false}
            showReminders={false}
            scrollToMinutes={scrollToMinutes}
          />
        </div>
      </section>

      {draft && <EventSheet draft={draft} onClose={() => setDraft(null)} />}
    </div>
  )
}

/** New events on today start at the next half hour; other days at 9am. */
function defaultStartTime(isToday: boolean): string {
  if (!isToday) return '09:00'
  const now = new Date()
  const minutes = Math.min(23 * 60 + 30, Math.ceil((now.getHours() * 60 + now.getMinutes()) / 30) * 30)
  return timeFromMinutes(minutes)
}
