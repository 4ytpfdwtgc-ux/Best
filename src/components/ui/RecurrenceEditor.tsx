import type { Frequency, Recurrence } from '../../types'

const WEEKDAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S']

/** Compact editor for the recurrence subset the app supports. */
export function RecurrenceEditor({
  value,
  onChange,
}: {
  value: Recurrence | undefined
  onChange: (r: Recurrence | undefined) => void
}) {
  const freq = value?.freq ?? 'none'

  return (
    <div className="recur">
      <div className="recur__top">
        <select
          className="select input--sm"
          value={freq}
          aria-label="Repeat"
          onChange={(e) => {
            const v = e.target.value
            if (v === 'none') onChange(undefined)
            else onChange({ freq: v as Frequency, interval: value?.interval ?? 1, byWeekday: value?.byWeekday, until: value?.until })
          }}
        >
          <option value="none">Never</option>
          <option value="daily">Daily</option>
          <option value="weekly">Weekly</option>
          <option value="monthly">Monthly</option>
          <option value="yearly">Yearly</option>
        </select>

        {value && (
          <label className="recur__every">
            every
            <input
              type="number"
              min={1}
              max={99}
              className="input input--sm recur__interval"
              value={value.interval}
              onChange={(e) => onChange({ ...value, interval: Math.max(1, Number(e.target.value) || 1) })}
              aria-label="Repeat interval"
            />
            {{ daily: 'days', weekly: 'weeks', monthly: 'months', yearly: 'years' }[value.freq]}
          </label>
        )}
      </div>

      {value?.freq === 'weekly' && (
        <div className="recur__days" role="group" aria-label="Repeat on">
          {WEEKDAYS.map((label, day) => {
            const on = value.byWeekday?.includes(day) ?? false
            return (
              <button
                key={day}
                type="button"
                className={`recur__day${on ? ' is-on' : ''}`}
                aria-pressed={on}
                aria-label={['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][day]}
                onClick={() => {
                  const current = value.byWeekday ?? []
                  const next = on ? current.filter((d) => d !== day) : [...current, day].sort()
                  onChange({ ...value, byWeekday: next.length ? next : undefined })
                }}
              >
                {label}
              </button>
            )
          })}
        </div>
      )}

      {value && (
        <label className="recur__until">
          <span>Ends</span>
          <input
            type="date"
            className="input input--sm"
            value={value.until ?? ''}
            onChange={(e) => onChange({ ...value, until: e.target.value || undefined })}
            aria-label="Repeat end date"
          />
        </label>
      )}
    </div>
  )
}
