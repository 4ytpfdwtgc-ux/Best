import { useEffect, useMemo, useRef, useState } from 'react'
import { useApp } from '../state/store'
import { search, type SearchHit } from '../state/selectors'
import {
  setCalendarDate, setModule, setSelectedEvent, setSelectedFolder,
  setSelectedNote, setSelectedReminder, setReminderSelection,
} from '../state/actions'
import { Icon } from './ui/Icon'

const KIND_ICON = { reminder: 'checklist', event: 'calendar', note: 'note' } as const
const KIND_LABEL = { reminder: 'Reminder', event: 'Event', note: 'Note' } as const

/** Spotlight-style search across all three modules. */
export function QuickFind({ onClose }: { onClose: () => void }) {
  const state = useApp()
  const [query, setQuery] = useState('')
  const [cursor, setCursor] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)

  const hits = useMemo(() => search(state, query), [state, query])

  useEffect(() => inputRef.current?.focus(), [])
  useEffect(() => setCursor(0), [query])

  function open(hit: SearchHit) {
    if (hit.kind === 'reminder') {
      const reminder = state.reminders.find((r) => r.id === hit.id)
      if (reminder) setReminderSelection({ kind: 'list', id: reminder.listId })
      setSelectedReminder(hit.id)
      setModule('reminders')
    } else if (hit.kind === 'event') {
      const event = state.events.find((e) => e.id === hit.id)
      if (event) setCalendarDate(event.startDate)
      setSelectedEvent(hit.id)
      setModule('calendar')
    } else {
      const note = state.notes.find((n) => n.id === hit.id)
      if (note) setSelectedFolder(note.folderId)
      setSelectedNote(hit.id)
      setModule('notes')
    }
    onClose()
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Escape') return onClose()
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setCursor((c) => Math.min(c + 1, Math.max(0, hits.length - 1)))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setCursor((c) => Math.max(0, c - 1))
    } else if (e.key === 'Enter' && hits[cursor]) {
      e.preventDefault()
      open(hits[cursor])
    }
  }

  return (
    <div className="scrim scrim--find" onMouseDown={onClose} role="presentation">
      <div
        className="finder"
        role="dialog"
        aria-modal="true"
        aria-label="Quick Find"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="finder__field">
          <Icon name="search" size={18} />
          <input
            ref={inputRef}
            className="finder__input"
            placeholder="Search reminders, events and notes"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onKeyDown}
            aria-label="Search"
          />
          <kbd className="kbd">esc</kbd>
        </div>

        {query.trim() ? (
          hits.length ? (
            <ul className="finder__results scroll" role="listbox" aria-label="Results">
              {hits.map((hit, i) => (
                <li key={`${hit.kind}-${hit.id}`}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={i === cursor}
                    className={`finder__row tint-${hit.tint}${i === cursor ? ' is-on' : ''}`}
                    onMouseEnter={() => setCursor(i)}
                    onClick={() => open(hit)}
                  >
                    <span className="finder__icon">
                      <Icon name={KIND_ICON[hit.kind]} size={15} />
                    </span>
                    <span className="finder__text">
                      <span className="finder__title">{hit.title}</span>
                      <span className="finder__sub">{hit.subtitle}</span>
                    </span>
                    <span className="finder__kind">{KIND_LABEL[hit.kind]}</span>
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="finder__empty">No results for “{query}”</p>
          )
        ) : (
          <p className="finder__empty">
            Type to search everything. <kbd className="kbd">↑</kbd> <kbd className="kbd">↓</kbd> to move,{' '}
            <kbd className="kbd">↵</kbd> to open.
          </p>
        )}
      </div>
    </div>
  )
}
