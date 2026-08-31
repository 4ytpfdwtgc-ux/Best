import { useState } from 'react'
import type { Priority, Reminder } from '../../types'
import { useApp } from '../../state/store'
import {
  addSubtask, addTag, deleteReminder, deleteSubtask, scheduleReminderAsEvent,
  setModule, updateReminder, updateSubtask,
} from '../../state/actions'
import { addDays, todayISO } from '../../lib/date'
import { Icon } from '../ui/Icon'
import { RecurrenceEditor } from '../ui/RecurrenceEditor'
import { Row, Switch } from '../ui/primitives'

const ALERT_OPTIONS = [
  { value: '', label: 'None' },
  { value: '0', label: 'At time of event' },
  { value: '5', label: '5 minutes before' },
  { value: '15', label: '15 minutes before' },
  { value: '60', label: '1 hour before' },
  { value: '1440', label: '1 day before' },
]

/** The inspector shown to the right of the reminder list. */
export function ReminderDetail({ reminder }: { reminder: Reminder }) {
  const state = useApp()
  const [newSubtask, setNewSubtask] = useState('')
  const [newTag, setNewTag] = useState('')

  const set = (patch: Partial<Reminder>) => updateReminder(reminder.id, patch)

  return (
    <aside className="detail scroll" aria-label="Reminder details">
      <input
        className="detail__title"
        value={reminder.title}
        placeholder="New Reminder"
        onChange={(e) => set({ title: e.target.value })}
        aria-label="Title"
      />

      <textarea
        className="textarea"
        placeholder="Notes"
        value={reminder.notes ?? ''}
        onChange={(e) => set({ notes: e.target.value || undefined })}
        aria-label="Notes"
      />

      <section className="detail__group">
        <Row label="List">
          <select
            className="select input--sm"
            value={reminder.listId}
            onChange={(e) => set({ listId: e.target.value })}
            aria-label="List"
          >
            {state.lists.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name}
              </option>
            ))}
          </select>
        </Row>

        <Row label="Date">
          <input
            type="date"
            className="input input--sm"
            value={reminder.dueDate ?? ''}
            onChange={(e) => set({ dueDate: e.target.value || undefined, dueTime: e.target.value ? reminder.dueTime : undefined })}
            aria-label="Due date"
          />
        </Row>

        <div className="detail__quickdates">
          <button type="button" className="btn btn--plain" onClick={() => set({ dueDate: todayISO() })}>Today</button>
          <button type="button" className="btn btn--plain" onClick={() => set({ dueDate: addDays(todayISO(), 1) })}>Tomorrow</button>
          <button type="button" className="btn btn--plain" onClick={() => set({ dueDate: addDays(todayISO(), 7) })}>Next week</button>
          {reminder.dueDate && (
            <button type="button" className="btn btn--plain" onClick={() => set({ dueDate: undefined, dueTime: undefined })}>Clear</button>
          )}
        </div>

        {reminder.dueDate && (
          <Row label="Time">
            <input
              type="time"
              className="input input--sm"
              value={reminder.dueTime ?? ''}
              onChange={(e) => set({ dueTime: e.target.value || undefined })}
              aria-label="Due time"
            />
          </Row>
        )}

        {reminder.dueDate && (
          <Row label="Alert">
            <select
              className="select input--sm"
              value={reminder.alertMinutesBefore === undefined ? '' : String(reminder.alertMinutesBefore)}
              onChange={(e) => set({ alertMinutesBefore: e.target.value === '' ? undefined : Number(e.target.value) })}
              aria-label="Alert"
            >
              {ALERT_OPTIONS.map((o) => (
                <option key={o.label} value={o.value}>{o.label}</option>
              ))}
            </select>
          </Row>
        )}

        <h3 className="detail__heading detail__heading--inline">Repeat</h3>
        <RecurrenceEditor value={reminder.recurrence} onChange={(recurrence) => set({ recurrence })} />
      </section>

      <section className="detail__group">
        <Row label="Priority">
          <select
            className="select input--sm"
            value={reminder.priority}
            onChange={(e) => set({ priority: Number(e.target.value) as Priority })}
            aria-label="Priority"
          >
            <option value={0}>None</option>
            <option value={1}>Low</option>
            <option value={2}>Medium</option>
            <option value={3}>High</option>
          </select>
        </Row>
        <Row label="Flagged">
          <Switch checked={reminder.flagged} onChange={(flagged) => set({ flagged })} label="Flagged" />
        </Row>
        <Row label="URL">
          <input
            className="input input--sm"
            placeholder="https://"
            value={reminder.url ?? ''}
            onChange={(e) => set({ url: e.target.value || undefined })}
            aria-label="URL"
          />
        </Row>
      </section>

      <section className="detail__group">
        <h3 className="detail__heading">Tags</h3>
        <div className="tag-cloud">
          {state.tags.map((tag) => {
            const on = reminder.tags.includes(tag.id)
            return (
              <button
                key={tag.id}
                type="button"
                className={`tag-chip tint-${tag.tint}${on ? ' is-on' : ''}`}
                aria-pressed={on}
                onClick={() =>
                  set({ tags: on ? reminder.tags.filter((t) => t !== tag.id) : [...reminder.tags, tag.id] })
                }
              >
                #{tag.name}
              </button>
            )
          })}
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault()
            if (!newTag.trim()) return
            const tag = addTag(newTag)
            if (!reminder.tags.includes(tag.id)) set({ tags: [...reminder.tags, tag.id] })
            setNewTag('')
          }}
        >
          <input
            className="input"
            placeholder="Add tag…"
            value={newTag}
            onChange={(e) => setNewTag(e.target.value)}
            aria-label="Add tag"
          />
        </form>
      </section>

      <section className="detail__group">
        <h3 className="detail__heading">Subtasks</h3>
        <ul className="subtasks">
          {reminder.subtasks.map((s) => (
            <li key={s.id}>
              <button
                type="button"
                className={`rem__check rem__check--sm${s.completed ? ' is-on' : ''}`}
                onClick={() => updateSubtask(reminder.id, s.id, { completed: !s.completed })}
                aria-label={s.title}
                aria-pressed={s.completed}
              >
                {s.completed ? <Icon name="check" size={9} strokeWidth={3} /> : null}
              </button>
              <input
                className={`subtasks__input${s.completed ? ' is-struck' : ''}`}
                value={s.title}
                onChange={(e) => updateSubtask(reminder.id, s.id, { title: e.target.value })}
                aria-label="Subtask title"
              />
              <button
                type="button"
                className="icon-btn"
                onClick={() => deleteSubtask(reminder.id, s.id)}
                aria-label="Delete subtask"
              >
                <Icon name="close" size={12} />
              </button>
            </li>
          ))}
        </ul>
        <form
          onSubmit={(e) => {
            e.preventDefault()
            if (!newSubtask.trim()) return
            addSubtask(reminder.id, newSubtask)
            setNewSubtask('')
          }}
        >
          <input
            className="input"
            placeholder="Add subtask…"
            value={newSubtask}
            onChange={(e) => setNewSubtask(e.target.value)}
            aria-label="Add subtask"
          />
        </form>
      </section>

      <div className="detail__actions">
        <button
          type="button"
          className="btn"
          onClick={() => {
            scheduleReminderAsEvent(reminder.id)
            setModule('calendar')
          }}
        >
          <Icon name="calendar" size={14} /> Schedule
        </button>
        <button type="button" className="btn btn--danger" onClick={() => deleteReminder(reminder.id)}>
          <Icon name="trash" size={14} /> Delete
        </button>
      </div>
    </aside>
  )
}
