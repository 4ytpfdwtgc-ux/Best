import { useEffect, useRef, useState } from 'react'
import type { Reminder } from '../../types'
import { useApp } from '../../state/store'
import { deleteReminder, toggleFlag, toggleReminder, updateReminder, updateSubtask } from '../../state/actions'
import { formatTime, friendlyDate, todayISO } from '../../lib/date'
import { describeRecurrence } from '../../lib/recurrence'
import { Icon } from '../ui/Icon'

const PRIORITY_MARK = ['', '!', '!!', '!!!']

export function ReminderRow({
  reminder,
  selected,
  onSelect,
  showList,
  autoFocus,
}: {
  reminder: Reminder
  selected: boolean
  onSelect: () => void
  showList?: boolean
  autoFocus?: boolean
}) {
  const state = useApp()
  const [title, setTitle] = useState(reminder.title)
  const [expanded, setExpanded] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => setTitle(reminder.title), [reminder.title])
  useEffect(() => {
    if (autoFocus) inputRef.current?.focus()
  }, [autoFocus])

  const list = state.lists.find((l) => l.id === reminder.listId)
  const overdue = !!reminder.dueDate && reminder.dueDate < todayISO() && !reminder.completed
  const tags = reminder.tags.map((id) => state.tags.find((t) => t.id === id)).filter(Boolean)
  const doneSubtasks = reminder.subtasks.filter((s) => s.completed).length

  function commit() {
    const next = title.trim()
    if (next === reminder.title) return
    if (!next && !reminder.notes) deleteReminder(reminder.id)
    else updateReminder(reminder.id, { title: next })
  }

  return (
    <li className={`rem tint-${list?.tint ?? 'blue'}${selected ? ' is-selected' : ''}${reminder.completed ? ' is-done' : ''}`}>
      <div className="rem__main" onClick={onSelect}>
        <button
          type="button"
          className={`rem__check${reminder.completed ? ' is-on' : ''}`}
          onClick={(e) => {
            e.stopPropagation()
            toggleReminder(reminder.id)
          }}
          aria-label={reminder.completed ? 'Mark as not completed' : 'Mark as completed'}
          aria-pressed={reminder.completed}
        >
          {reminder.completed ? <Icon name="check" size={11} strokeWidth={3} /> : null}
        </button>

        <div className="rem__body">
          <div className="rem__titleline">
            {reminder.priority > 0 && (
              <span className="rem__priority" title={`Priority ${reminder.priority}`}>
                {PRIORITY_MARK[reminder.priority]}
              </span>
            )}
            <input
              ref={inputRef}
              className="rem__title"
              value={title}
              placeholder="New Reminder"
              onChange={(e) => setTitle(e.target.value)}
              onBlur={commit}
              onFocus={onSelect}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  commit()
                  ;(e.target as HTMLInputElement).blur()
                }
                if (e.key === 'Escape') setTitle(reminder.title)
              }}
              aria-label="Reminder title"
            />
            {reminder.flagged && (
              <span className="rem__flag" title="Flagged">
                <Icon name="flag" size={13} filled />
              </span>
            )}
          </div>

          {reminder.notes && <p className="rem__notes">{reminder.notes}</p>}

          <div className="rem__meta">
            {reminder.dueDate && (
              <span className={`rem__due${overdue ? ' is-overdue' : ''}`}>
                {friendlyDate(reminder.dueDate)}
                {reminder.dueTime ? `, ${formatTime(reminder.dueTime, state.prefs.use24HourTime)}` : ''}
              </span>
            )}
            {reminder.recurrence && (
              <span className="rem__chip">
                <Icon name="repeat" size={11} /> {describeRecurrence(reminder.recurrence)}
              </span>
            )}
            {reminder.subtasks.length > 0 && (
              <button
                type="button"
                className="rem__chip rem__chip--button"
                onClick={(e) => {
                  e.stopPropagation()
                  setExpanded((v) => !v)
                }}
                aria-expanded={expanded}
              >
                <Icon name="checklist" size={11} /> {doneSubtasks}/{reminder.subtasks.length}
              </button>
            )}
            {tags.map((t) => (
              <span key={t!.id} className={`pill tint-${t!.tint}`}>#{t!.name}</span>
            ))}
            {showList && list && <span className="rem__list">{list.name}</span>}
          </div>

          {expanded && reminder.subtasks.length > 0 && (
            <ul className="rem__subtasks">
              {reminder.subtasks.map((s) => (
                <li key={s.id}>
                  <button
                    type="button"
                    className={`rem__check rem__check--sm${s.completed ? ' is-on' : ''}`}
                    onClick={(e) => {
                      e.stopPropagation()
                      updateSubtask(reminder.id, s.id, { completed: !s.completed })
                    }}
                    aria-label={s.title}
                    aria-pressed={s.completed}
                  >
                    {s.completed ? <Icon name="check" size={9} strokeWidth={3} /> : null}
                  </button>
                  <span className={s.completed ? 'is-struck' : ''}>{s.title}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <button
          type="button"
          className="rem__action"
          onClick={(e) => {
            e.stopPropagation()
            toggleFlag(reminder.id)
          }}
          title={reminder.flagged ? 'Unflag' : 'Flag'}
          aria-label={reminder.flagged ? 'Unflag' : 'Flag'}
        >
          <Icon name="flag" size={14} filled={reminder.flagged} />
        </button>
        <button
          type="button"
          className="rem__action"
          onClick={(e) => {
            e.stopPropagation()
            deleteReminder(reminder.id)
          }}
          title="Delete"
          aria-label="Delete reminder"
        >
          <Icon name="trash" size={14} />
        </button>
      </div>
    </li>
  )
}
