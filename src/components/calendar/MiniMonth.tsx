import { useMemo, useState } from 'react'
import {
  addMonths, formatMonthYear, isSameMonth, monthGrid, startOfMonth, todayISO,
} from '../../lib/date'
import { Icon } from '../ui/Icon'

const WEEKDAY_LETTERS = ['S', 'M', 'T', 'W', 'T', 'F', 'S']

/** The compact month picker in the calendar sidebar. */
export function MiniMonth({
  selected,
  weekStartsOn,
  markedDates,
  onSelect,
}: {
  selected: string
  weekStartsOn: 0 | 1
  markedDates: Set<string>
  onSelect: (iso: string) => void
}) {
  const [anchor, setAnchor] = useState(() => startOfMonth(selected))
  const shown = useMemo(
    () => (isSameMonth(anchor, selected) ? anchor : startOfMonth(selected)),
    [anchor, selected],
  )
  const days = useMemo(() => monthGrid(shown, weekStartsOn), [shown, weekStartsOn])
  const today = todayISO()
  const letters = WEEKDAY_LETTERS.slice(weekStartsOn).concat(WEEKDAY_LETTERS.slice(0, weekStartsOn))

  return (
    <div className="mini">
      <div className="mini__head">
        <button type="button" className="icon-btn" onClick={() => setAnchor(addMonths(shown, -1))} aria-label="Previous month">
          <Icon name="chevronLeft" size={13} strokeWidth={2.2} />
        </button>
        <span className="mini__title">{formatMonthYear(shown)}</span>
        <button type="button" className="icon-btn" onClick={() => setAnchor(addMonths(shown, 1))} aria-label="Next month">
          <Icon name="chevronRight" size={13} strokeWidth={2.2} />
        </button>
      </div>

      <div className="mini__grid" role="grid" aria-label={formatMonthYear(shown)}>
        {letters.map((l, i) => (
          <span key={i} className="mini__weekday" role="columnheader">{l}</span>
        ))}
        {days.map((d) => (
          <button
            key={d}
            type="button"
            role="gridcell"
            className={
              'mini__day' +
              (isSameMonth(d, shown) ? '' : ' is-muted') +
              (d === today ? ' is-today' : '') +
              (d === selected ? ' is-selected' : '')
            }
            onClick={() => onSelect(d)}
            aria-current={d === today ? 'date' : undefined}
            aria-label={d}
          >
            {Number(d.slice(8))}
            {markedDates.has(d) ? <span className="mini__dot" /> : null}
          </button>
        ))}
      </div>
    </div>
  )
}
