import { useMemo } from 'react'
import { addDays, startOfWeek, todayISO, weekdayOf } from '../../lib/date'

const LETTERS = ['S', 'M', 'T', 'W', 'T', 'F', 'S']

/** The seven-day selector above the Home calendar pane. */
export function WeekStrip({
  selected,
  weekStartsOn,
  busyDates,
  onSelect,
}: {
  selected: string
  weekStartsOn: 0 | 1
  busyDates: Set<string>
  onSelect: (iso: string) => void
}) {
  const today = todayISO()
  const days = useMemo(() => {
    const start = startOfWeek(selected, weekStartsOn)
    return Array.from({ length: 7 }, (_, i) => addDays(start, i))
  }, [selected, weekStartsOn])

  return (
    <div className="weekstrip" role="tablist" aria-label="Day">
      {days.map((day) => (
        <button
          key={day}
          type="button"
          role="tab"
          aria-selected={day === selected}
          aria-label={day}
          className={
            'weekstrip__day' +
            (day === selected ? ' is-selected' : '') +
            (day === today ? ' is-today' : '')
          }
          onClick={() => onSelect(day)}
        >
          <span className="weekstrip__letter">{LETTERS[weekdayOf(day)]}</span>
          <span className="weekstrip__num">{Number(day.slice(8))}</span>
          <span className={`weekstrip__dot${busyDates.has(day) ? ' is-on' : ''}`} />
        </button>
      ))}
    </div>
  )
}
