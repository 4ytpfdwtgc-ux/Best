import { useMemo } from 'react'
import type { AppState } from '../../types'
import { isSameMonth, monthGrid, todayISO } from '../../lib/date'

const WEEKDAY_LETTERS = ['S', 'M', 'T', 'W', 'T', 'F', 'S']

/** Twelve mini months, with days that have events tinted. */
export function YearView({
  state,
  busyDates,
  onSelect,
}: {
  state: AppState
  busyDates: Set<string>
  onSelect: (iso: string) => void
}) {
  const year = state.calendarDate.slice(0, 4)
  const today = todayISO()
  const months = useMemo(
    () => Array.from({ length: 12 }, (_, m) => `${year}-${`${m + 1}`.padStart(2, '0')}-01`),
    [year],
  )
  const letters = WEEKDAY_LETTERS.slice(state.prefs.weekStartsOn).concat(
    WEEKDAY_LETTERS.slice(0, state.prefs.weekStartsOn),
  )

  return (
    <div className="year scroll">
      {months.map((month) => (
        <section key={month} className="year__month">
          <h3 className="year__title">
            {new Intl.DateTimeFormat(undefined, { month: 'long' }).format(new Date(Number(year), Number(month.slice(5, 7)) - 1, 1))}
          </h3>
          <div className="year__grid">
            {letters.map((l, i) => (
              <span key={i} className="year__weekday">{l}</span>
            ))}
            {monthGrid(month, state.prefs.weekStartsOn).map((day) => (
              <button
                key={day}
                type="button"
                className={
                  'year__day' +
                  (isSameMonth(day, month) ? '' : ' is-muted') +
                  (day === today ? ' is-today' : '') +
                  (isSameMonth(day, month) && busyDates.has(day) ? ' is-busy' : '')
                }
                onClick={() => onSelect(day)}
                aria-label={day}
              >
                {Number(day.slice(8))}
              </button>
            ))}
          </div>
        </section>
      ))}
    </div>
  )
}
