import { useEffect, useRef, useState } from 'react'
import type { AppState, EventOccurrence } from '../../types'
import { layoutColumns, occurrencesOnDay } from '../../state/selectors'
import {
  diffDays, formatHourLabel, formatTime, formatWeekdayShort, timeFromMinutes, todayISO,
} from '../../lib/date'
import { limitToTime, moveEvent, resizeEvent } from '../../lib/reschedule'
import { updateEvent } from '../../state/actions'

const HOUR_PX = 46
const DAY_MINUTES = 24 * 60
interface DragState {
  id: string
  mode: 'move' | 'resize'
  minuteDelta: number
  dayDelta: number
}

/** Shared hour-by-hour grid backing both the day and week views. */
export function TimeGrid({
  state,
  days,
  occurrences,
  onOpenEvent,
  onNewEvent,
  onSelectDay,
  showHeader = true,
  showReminders = true,
  scrollToMinutes,
}: {
  state: AppState
  days: string[]
  occurrences: EventOccurrence[]
  onOpenEvent: (id: string) => void
  onNewEvent: (iso: string, time?: string) => void
  onSelectDay: (iso: string) => void
  /** Hidden when an outer view already labels the days (the Home split). */
  showHeader?: boolean
  /** Off in the Home split, where the pane above already lists reminders. */
  showReminders?: boolean
  /** Minutes from midnight to open on. Defaults to 7:30am. */
  scrollToMinutes?: number
}) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const bodyRef = useRef<HTMLDivElement>(null)
  const today = todayISO()

  /*
   * A drag in progress. Held in a ref for the pointer handlers to read and
   * mirrored into state only for drawing, so a move never re-enters the
   * handlers through a stale closure.
   */
  const dragRef = useRef<DragState | null>(null)
  const [drag, setDrag] = useState<DragState | null>(null)
  // A drag ends before the click it generates arrives, so the fact that one
  // happened has to outlive it by a beat.
  const movedRef = useRef(false)

  function startDrag(e: React.PointerEvent, occ: EventOccurrence, mode: 'move' | 'resize') {
    if (e.button !== 0 || occ.event.allDay) return
    const startX = e.clientX
    const startY = e.clientY
    const touch = e.pointerType === 'touch'
    let engaged = false
    let holdTimer: number | undefined

    const engage = () => {
      engaged = true
      movedRef.current = true
      dragRef.current = { id: occ.event.id, mode, minuteDelta: 0, dayDelta: 0 }
      setDrag(dragRef.current)
    }

    /*
     * A finger has to hold before it drags: the grid scrolls under it, and an
     * event that moved on the first flick would make the calendar unusable.
     * A mouse has no such conflict, so it engages as soon as it has moved.
     */
    movedRef.current = false
    if (touch) holdTimer = window.setTimeout(engage, 350)

    const onMove = (ev: PointerEvent) => {
      const dx = ev.clientX - startX
      const dy = ev.clientY - startY
      if (!engaged) {
        if (touch) {
          // Moving before the hold completes is a scroll, not a drag.
          if (Math.abs(dx) > 8 || Math.abs(dy) > 8) cleanup()
          return
        }
        if (Math.abs(dx) < 4 && Math.abs(dy) < 4) return
        engage()
      }

      const minuteDelta = (dy / HOUR_PX) * 60
      /*
       * Which day the pointer is over, asked of the DOM rather than worked out
       * from a hard-coded gutter: it is 56px on a desktop and 46 on a phone,
       * and one number in two places is one too many.
       */
      let dayDelta = 0
      if (mode === 'move' && days.length > 1) {
        const column = document
          .elementsFromPoint(ev.clientX, ev.clientY)
          .find((el): el is HTMLElement => el instanceof HTMLElement && el.dataset.day !== undefined)
        const over = column ? days.indexOf(column.dataset.day ?? '') : -1
        const from = days.indexOf(occ.date)
        if (from >= 0 && over >= 0) dayDelta = over - from
      }
      dragRef.current = { id: occ.event.id, mode, minuteDelta, dayDelta }
      setDrag(dragRef.current)
    }

    const onUp = () => {
      const current = dragRef.current
      cleanup()
      // Let the click that follows this release see that a drag happened.
      window.setTimeout(() => void (movedRef.current = false), 0)
      if (!current) return
      const next =
        current.mode === 'resize'
          ? resizeEvent(occ.event, current.minuteDelta)
          : limitToTime(occ.event, moveEvent(occ.event, current))
      updateEvent(occ.event.id, next)
    }

    const cleanup = () => {
      window.clearTimeout(holdTimer)
      dragRef.current = null
      setDrag(null)
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('pointercancel', cleanup)
    }

    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    window.addEventListener('pointercancel', cleanup)
  }

  const nowMinutes = new Date().getHours() * 60 + new Date().getMinutes()
  const use24 = state.prefs.use24HourTime

  // Open on the working day rather than at midnight.
  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    const anchor = (scrollToMinutes ?? 7.5 * 60) / 60
    el.scrollTop = Math.max(0, anchor * HOUR_PX - 20)
  }, [scrollToMinutes, days[0]])

  const allDayRows = days.map((day) =>
    occurrencesOnDay(occurrences, day).filter((o) => o.event.allDay),
  )
  const overlayReminders = showReminders && state.prefs.showRemindersOnCalendar
  const hasAllDay = allDayRows.some((r) => r.length > 0) || overlayReminders

  return (
    <div className="tg">
      {showHeader && (
      <div className="tg__header" style={{ gridTemplateColumns: `var(--tg-gutter) repeat(${days.length}, 1fr)` }}>
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
      )}

      {hasAllDay && (
        <div className="tg__allday" style={{ gridTemplateColumns: `var(--tg-gutter) repeat(${days.length}, 1fr)` }}>
          <span className="tg__allday-label">all-day</span>
          {days.map((day, i) => {
            const reminders = overlayReminders
              ? state.reminders.filter((r) => r.dueDate === day && !r.completed && !r.trashedAt)
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
        <div
          className="tg__body"
          ref={bodyRef}
          style={{ gridTemplateColumns: `var(--tg-gutter) repeat(${days.length}, 1fr)`, height: 24 * HOUR_PX }}
        >
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
                data-day={day}
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
                  const dragging = drag?.id === occ.event.id
                  // While dragging, draw where it would land rather than where
                  // it is: the change is only written on release.
                  const preview =
                    dragging && isStart
                      ? drag.mode === 'resize'
                        ? resizeEvent(occ.event, drag.minuteDelta)
                        : limitToTime(occ.event, moveEvent(occ.event, drag))
                      : null
                  const shifted = preview
                    ? minutesOfTime(preview.startTime)
                    : isStart
                      ? occ.startMinutes
                      : 0
                  const start = shifted
                  const end = preview
                    ? start + Math.max(15, spanMinutes(preview))
                    : Math.max(start + 20, isStart ? occ.endMinutes : DAY_MINUTES)
                  const height = Math.max(15, ((end - start) / 60) * HOUR_PX - 2)
                  // Short events read better as a single line than as a stacked block.
                  const compact = height < 28
                  // A dragged event leaves its column and floats over the day.
                  const laneCol = dragging ? 0 : col
                  const laneCount = dragging ? 1 : cols
                  return (
                    <div
                      key={`${occ.event.id}-${occ.date}`}
                      role="button"
                      tabIndex={0}
                      className={`ev tint-${cal?.tint ?? 'blue'}${compact ? ' ev--compact' : ''}${
                        dragging ? ' is-dragging' : ''
                      }`}
                      style={{
                        top: (start / 60) * HOUR_PX,
                        height,
                        left: `calc(${(laneCol / laneCount) * 100}% + 2px)`,
                        width: `calc(${100 / laneCount}% - 5px)`,
                      }}
                      onPointerDown={(e) => isStart && startDrag(e, occ, 'move')}
                      onClick={(e) => {
                        e.stopPropagation()
                        // A drag must not also open the editor.
                        if (dragRef.current || movedRef.current) return
                        onOpenEvent(occ.event.id)
                      }}
                      onKeyDown={(e) => {
                        if (e.key !== 'Enter' && e.key !== ' ') return
                        e.preventDefault()
                        onOpenEvent(occ.event.id)
                      }}
                    >
                      <span className="ev__title">{occ.event.title || 'New Event'}</span>
                      <span className="ev__time">
                        {preview
                          ? `${formatTime(preview.startTime, use24)}–${formatTime(preview.endTime, use24)}`
                          : formatTime(timeFromMinutes(occ.startMinutes), use24)}
                        {!compact && !preview && occ.event.location ? ` · ${occ.event.location}` : ''}
                      </span>
                      {/*
                        * No grip on a short event: at fifteen minutes the block
                        * is barely taller than the grip, which would swallow
                        * the whole thing and leave no way to move it at all.
                        */}
                      {isStart && !occ.event.allDay && !compact && (
                        <span
                          className="ev__grip"
                          aria-hidden="true"
                          onPointerDown={(e) => {
                            e.stopPropagation()
                            startDrag(e, occ, 'resize')
                          }}
                        />
                      )}
                    </div>
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

function minutesOfTime(time: string): number {
  const [h, m] = time.split(':').map(Number)
  return (h || 0) * 60 + (m || 0)
}

/** How long a rescheduled event runs, across midnight if it has to. */
function spanMinutes({ startTime, endTime, startDate, endDate }: {
  startTime: string
  endTime: string
  startDate: string
  endDate: string
}): number {
  const days = Math.max(0, diffDays(startDate, endDate))
  return minutesOfTime(endTime) + days * DAY_MINUTES - minutesOfTime(startTime)
}

export { HOUR_PX }
