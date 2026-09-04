import { useMemo, useRef, useState } from 'react'
import type { AppState, ID } from '../../types'
import { parseCapture } from '../../lib/capture'
import { formatTime, friendlyDate } from '../../lib/date'
import { addReminder, addTag, setSelectedReminder } from '../../state/actions'
import { Icon } from '../ui/Icon'

/**
 * One line that becomes a task.
 *
 * The app has understood dictated phrases since the Shortcuts bridge, but only
 * through a URL — typing the same thing in the app got a literal title. This
 * puts the parser where it is actually used, and shows what it made of the
 * phrase before Enter commits it, so it can be trusted rather than guessed at.
 */
export function QuickAdd({
  state,
  listId,
  defaultDate,
}: {
  state: AppState
  /** The list a new task lands in. */
  listId: ID
  /** Used when the phrase names no date, e.g. the Today list. */
  defaultDate?: string
}) {
  const [text, setText] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  const parsed = useMemo(() => (text.trim() ? parseCapture(text) : null), [text])
  // Only worth showing when the parser found something the plain text does not say.
  const understood = parsed && (parsed.dueDate || parsed.dueTime || parsed.priority || parsed.tags.length)

  function commit() {
    const phrase = text.trim()
    if (!phrase) return
    const capture = parseCapture(phrase)
    const created = addReminder({
      listId,
      title: capture.title,
      dueDate: capture.dueDate ?? defaultDate,
      dueTime: capture.dueTime,
      priority: capture.priority,
      tags: capture.tags.map((name) => addTag(name).id),
    })
    setText('')
    // Keep the field focused: adding tasks is something people do in runs.
    inputRef.current?.focus()
    return created
  }

  return (
    <div className="quickadd">
      <form
        className="quickadd__row"
        onSubmit={(e) => {
          e.preventDefault()
          commit()
        }}
      >
        <Icon name="plus" size={15} strokeWidth={2.2} />
        <input
          ref={inputRef}
          className="quickadd__input"
          value={text}
          placeholder="Add a task — “call the plumber tomorrow at 5pm #home !!”"
          aria-label="Add a task"
          enterKeyHint="done"
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key !== 'Escape') return
            setText('')
            e.currentTarget.blur()
          }}
        />
        {text.trim() && (
          <button
            type="button"
            className="quickadd__open"
            onClick={() => {
              const created = commit()
              if (created) setSelectedReminder(created.id)
            }}
          >
            Details
          </button>
        )}
      </form>

      {understood && parsed && (
        <p className="quickadd__read">
          <span className="quickadd__title">{parsed.title || 'Untitled'}</span>
          {parsed.dueDate && (
            <span className="quickadd__chip">
              <Icon name="calendar" size={11} />
              {friendlyDate(parsed.dueDate)}
              {parsed.dueTime ? `, ${formatTime(parsed.dueTime, state.prefs.use24HourTime)}` : ''}
            </span>
          )}
          {!parsed.dueDate && parsed.dueTime && (
            <span className="quickadd__chip">
              <Icon name="clock" size={11} />
              {formatTime(parsed.dueTime, state.prefs.use24HourTime)}
            </span>
          )}
          {parsed.priority > 0 && (
            <span className="quickadd__chip is-priority">{'!'.repeat(parsed.priority)}</span>
          )}
          {parsed.tags.map((tag) => (
            <span key={tag} className="quickadd__chip">#{tag}</span>
          ))}
        </p>
      )}
    </div>
  )
}
