import { useEffect, useMemo, useState } from 'react'
import { useApp } from '../../state/store'
import { occurrencesBetween } from '../../state/selectors'
import {
  addCalendar, deleteCalendar, setCalendarDate, setCalendarView,
  setSelectedEvent, toggleCalendarVisible, updateCalendar,
} from '../../state/actions'
import {
  addDays, addMonths, addYears, formatLongDate, formatMonthYear,
  monthGrid, startOfWeek, todayISO,
} from '../../lib/date'
import { Icon } from '../ui/Icon'
import { EmptyState, Segmented, ToolButton } from '../ui/primitives'
import { MiniMonth } from './MiniMonth'
import { MonthView } from './MonthView'
import { TimeGrid } from './TimeGrid'
import { YearView } from './YearView'
import { EventSheet, type EventDraft } from './EventSheet'
import type { CalendarViewMode, TintName } from '../../types'

const VIEW_OPTIONS: { value: CalendarViewMode; label: string }[] = [
  { value: 'day', label: 'Day' },
  { value: 'week', label: 'Week' },
  { value: 'month', label: 'Month' },
  { value: 'year', label: 'Year' },
]

export function CalendarApp({
  sidebarOpen,
  onToggleSidebar,
}: {
  sidebarOpen: boolean
  onToggleSidebar: () => void
}) {
  const state = useApp()
  const [draft, setDraft] = useState<EventDraft | null>(null)
  const { calendarView: view, calendarDate: date } = state

  /* The date range the current view needs, padded so multi-day items resolve. */
  const [rangeStart, rangeEnd] = useMemo((): [string, string] => {
    if (view === 'day') return [date, date]
    if (view === 'week') {
      const start = startOfWeek(date, state.prefs.weekStartsOn)
      return [start, addDays(start, 6)]
    }
    if (view === 'month') {
      const grid = monthGrid(date, state.prefs.weekStartsOn)
      return [grid[0], grid[grid.length - 1]]
    }
    return [`${date.slice(0, 4)}-01-01`, `${date.slice(0, 4)}-12-31`]
  }, [view, date, state.prefs.weekStartsOn])

  const occurrences = useMemo(
    () => occurrencesBetween(state, rangeStart, rangeEnd),
    [state, rangeStart, rangeEnd],
  )

  const busyDates = useMemo(() => {
    const set = new Set<string>()
    for (const o of occurrences) {
      for (let i = 0; i < o.span; i++) set.add(addDays(o.date, i))
    }
    return set
  }, [occurrences])

  const days = useMemo(() => {
    if (view === 'day') return [date]
    if (view === 'week') {
      const start = startOfWeek(date, state.prefs.weekStartsOn)
      return Array.from({ length: 7 }, (_, i) => addDays(start, i))
    }
    return []
  }, [view, date, state.prefs.weekStartsOn])

  function step(direction: -1 | 1) {
    if (view === 'day') setCalendarDate(addDays(date, direction))
    else if (view === 'week') setCalendarDate(addDays(date, 7 * direction))
    else if (view === 'month') setCalendarDate(addMonths(date, direction))
    else setCalendarDate(addYears(date, direction))
  }

  const selectedEvent = state.events.find((e) => e.id === state.selectedEventId)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const typing = ['INPUT', 'TEXTAREA'].includes((document.activeElement as HTMLElement)?.tagName ?? '')
      const meta = e.metaKey || e.ctrlKey
      if (meta && e.key.toLowerCase() === 'n') {
        e.preventDefault()
        setDraft({ startDate: date })
      } else if (meta && e.key.toLowerCase() === 't') {
        e.preventDefault()
        setCalendarDate(todayISO())
      } else if (!typing && !meta) {
        if (e.key === 'ArrowLeft') step(-1)
        else if (e.key === 'ArrowRight') step(1)
        else if (e.key.toLowerCase() === 'd') setCalendarView('day')
        else if (e.key.toLowerCase() === 'w') setCalendarView('week')
        else if (e.key.toLowerCase() === 'm') setCalendarView('month')
        else if (e.key.toLowerCase() === 'y') setCalendarView('year')
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  const heading =
    view === 'year'
      ? date.slice(0, 4)
      : view === 'day'
        ? formatLongDate(date)
        : view === 'week'
          ? weekHeading(startOfWeek(date, state.prefs.weekStartsOn))
          : formatMonthYear(date)

  return (
    <div className="module">
      <aside className="sidebar" hidden={!sidebarOpen} aria-label="Calendars">
        <div className="sidebar__head">
          <span className="sidebar__title">Calendar</span>
        </div>
        <div className="sidebar__body scroll">
          <MiniMonth
            selected={date}
            weekStartsOn={state.prefs.weekStartsOn}
            markedDates={busyDates}
            onSelect={(iso) => {
              setCalendarDate(iso)
              if (view === 'year') setCalendarView('day')
            }}
          />

          <div className="sidebar__section">Calendars</div>
          <ul className="side-list">
            {state.calendars.map((cal) => (
              <li key={cal.id}>
                <div className={`side-item tint-${cal.tint}`}>
                  <button
                    type="button"
                    className={`cal-check${cal.visible ? ' is-on' : ''}`}
                    onClick={() => toggleCalendarVisible(cal.id)}
                    aria-pressed={cal.visible}
                    aria-label={`${cal.visible ? 'Hide' : 'Show'} ${cal.name}`}
                  >
                    {cal.visible ? <Icon name="check" size={10} strokeWidth={3.2} /> : null}
                  </button>
                  <input
                    className="side-item__name side-item__rename"
                    value={cal.name}
                    onChange={(e) => updateCalendar(cal.id, { name: e.target.value })}
                    aria-label="Calendar name"
                  />
                  <span
                    className="side-item__more"
                    role="button"
                    tabIndex={-1}
                    aria-label={`Delete ${cal.name}`}
                    onClick={() => {
                      if (confirm(`Delete “${cal.name}” and its events?`)) deleteCalendar(cal.id)
                    }}
                  >
                    <Icon name="trash" size={14} />
                  </span>
                </div>
              </li>
            ))}
          </ul>

          <button
            type="button"
            className="side-add"
            onClick={() => {
              const tints: TintName[] = ['purple', 'teal', 'pink', 'indigo', 'brown', 'mint']
              addCalendar('New Calendar', tints[state.calendars.length % tints.length])
            }}
          >
            <Icon name="plus" size={15} strokeWidth={2.2} />
            Add Calendar
          </button>
        </div>
      </aside>

      <section className="content">
        <header className="toolbar">
          <ToolButton icon="sidebar" label="Toggle sidebar" onClick={onToggleSidebar} active={sidebarOpen} />
          <ToolButton icon="chevronLeft" label="Previous" onClick={() => step(-1)} />
          <ToolButton icon="chevronRight" label="Next" onClick={() => step(1)} />
          <h1 className="toolbar__title">{heading}</h1>
          <div className="toolbar__spacer" />
          <button type="button" className="btn" onClick={() => setCalendarDate(todayISO())}>Today</button>
          <Segmented value={view} options={VIEW_OPTIONS} onChange={setCalendarView} ariaLabel="Calendar view" />
          <ToolButton icon="plus" label="New event (⌘N)" onClick={() => setDraft({ startDate: date })} />
        </header>

        {state.calendars.every((c) => !c.visible) ? (
          <EmptyState icon="calendar" title="All calendars hidden" hint="Turn one back on in the sidebar to see events." />
        ) : view === 'month' ? (
          <MonthView
            state={state}
            occurrences={occurrences}
            onOpenEvent={setSelectedEvent}
            onOpenDay={setCalendarDate}
            onNewEvent={(iso) => setDraft({ startDate: iso })}
          />
        ) : view === 'year' ? (
          <YearView
            state={state}
            busyDates={busyDates}
            onSelect={(iso) => {
              setCalendarDate(iso)
              setCalendarView('day')
            }}
          />
        ) : (
          <TimeGrid
            state={state}
            days={days}
            occurrences={occurrences}
            onOpenEvent={setSelectedEvent}
            onNewEvent={(iso, time) => setDraft({ startDate: iso, startTime: time })}
            onSelectDay={setCalendarDate}
          />
        )}
      </section>

      {(draft || selectedEvent) && (
        <EventSheet
          draft={draft ?? { event: selectedEvent, startDate: selectedEvent!.startDate }}
          onClose={() => {
            setDraft(null)
            setSelectedEvent(null)
          }}
        />
      )}
    </div>
  )
}

function weekHeading(start: string): string {
  const end = addDays(start, 6)
  const sameMonth = start.slice(0, 7) === end.slice(0, 7)
  return sameMonth
    ? formatMonthYear(start)
    : `${formatMonthYear(start).split(' ')[0]} – ${formatMonthYear(end)}`
}
