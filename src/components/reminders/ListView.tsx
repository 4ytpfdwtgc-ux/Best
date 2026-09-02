import type { AppState, DatabaseView, Reminder } from '../../types'
import type { Group } from '../../state/selectors'
import { deleteReminder, setSelectedReminder, toggleFlag, toggleReminder } from '../../state/actions'
import { formatTime, friendlyDate, todayISO } from '../../lib/date'
import { describeRecurrence } from '../../lib/recurrence'
import { Icon } from '../ui/Icon'
import { SwipeRow } from '../ui/SwipeRow'
import { PropertyValueView } from './Property'

const PRIORITY_MARK = ['', '!', '!!', '!!!']

/** The default view: grouped rows, closest to a to-do list. */
export function ListView({
  state,
  view,
  groups,
  selectedId,
  lingering,
}: {
  state: AppState
  view: DatabaseView
  groups: Group[]
  selectedId: string | null
  /** Reminders held on screen for a beat after being completed. */
  lingering: ReadonlySet<string>
}) {
  return (
    <div className="db-list">
      {groups.map((group) => (
        <section key={group.key ?? 'all'} className="db-group">
          {view.groupBy && (
            <h2 className={`db-group__head${group.tint ? ` tint-${group.tint}` : ''}`}>
              <span className="db-group__name">{group.name}</span>
              <span className="db-group__count">{group.items.length}</span>
            </h2>
          )}
          <ul className="db-group__rows">
            {group.items.map((reminder) => (
              <ListRow
                key={reminder.id}
                state={state}
                view={view}
                reminder={reminder}
                selected={reminder.id === selectedId}
                leaving={lingering.has(reminder.id)}
              />
            ))}
            {group.items.length === 0 && <li className="db-group__empty">Empty</li>}
          </ul>
        </section>
      ))}
    </div>
  )
}

function ListRow({
  state,
  view,
  reminder,
  selected,
  leaving,
}: {
  state: AppState
  view: DatabaseView
  reminder: Reminder
  selected: boolean
  /** Completed a moment ago: struck through, and about to be dropped. */
  leaving: boolean
}) {
  const list = state.lists.find((l) => l.id === reminder.listId)
  const overdue = !!reminder.dueDate && reminder.dueDate < todayISO() && !reminder.completed
  const done = reminder.subtasks.filter((s) => s.completed).length

  return (
    <li className="db-rowwrap">
      <SwipeRow
        // A completed row has nothing left to complete, so it only offers Delete.
        left={
          reminder.completed
            ? undefined
            : {
                label: 'Complete',
                icon: 'check',
                tint: 'green',
                keepsRow: true,
                run: () => toggleReminder(reminder.id),
              }
        }
        right={{ label: 'Delete', icon: 'trash', tint: 'red', run: () => deleteReminder(reminder.id) }}
      >
        <div
          className={`db-row${selected ? ' is-selected' : ''}${reminder.completed ? ' is-done' : ''}${
            leaving ? ' is-leaving' : ''
          }`}
        >
          <button
            type="button"
            className={`db-row__check${reminder.completed ? ' is-on' : ''}`}
            onClick={() => toggleReminder(reminder.id)}
            aria-pressed={reminder.completed}
            aria-label={reminder.completed ? 'Mark as not done' : 'Mark as done'}
          >
            {reminder.completed ? <Icon name="check" size={11} strokeWidth={3} /> : null}
          </button>

          <button type="button" className="db-row__open" onClick={() => setSelectedReminder(reminder.id)}>
            <span className="db-row__title">
              {reminder.priority > 0 && <span className="db-row__priority">{PRIORITY_MARK[reminder.priority]}</span>}
              {reminder.title || 'Untitled'}
            </span>

            <span className="db-row__meta">
              {reminder.dueDate && (
                <span className={`db-row__due${overdue ? ' is-overdue' : ''}`}>
                  {friendlyDate(reminder.dueDate)}
                  {reminder.dueTime ? `, ${formatTime(reminder.dueTime, state.prefs.use24HourTime)}` : ''}
                </span>
              )}
              {reminder.recurrence && (
                <span className="db-row__chip" title={describeRecurrence(reminder.recurrence)}>
                  <Icon name="repeat" size={11} />
                </span>
              )}
              {reminder.subtasks.length > 0 && (
                <span className="db-row__chip">
                  <Icon name="checklist" size={11} /> {done}/{reminder.subtasks.length}
                </span>
              )}
              {view.visibleProps.map((id) => {
                const property = state.properties.find((p) => p.id === id)
                if (!property) return null
                const value = reminder.props[id]
                const empty = value == null || value === '' || (Array.isArray(value) && !value.length)
                if (empty) return null
                return <PropertyValueView key={id} property={property} value={value} placeholder="" />
              })}
              {reminder.tags.map((id) => {
                const tag = state.tags.find((t) => t.id === id)
                return tag ? <span key={id} className={`pill tint-${tag.tint}`}>{tag.name}</span> : null
              })}
              {list && <span className="db-row__list">{list.name}</span>}
            </span>
          </button>

          <button
            type="button"
            className={`db-row__flag${reminder.flagged ? ' is-on' : ''}`}
            onClick={() => toggleFlag(reminder.id)}
            title={reminder.flagged ? 'Unflag' : 'Flag'}
            aria-label={reminder.flagged ? 'Unflag' : 'Flag'}
          >
            <Icon name="flag" size={14} filled={reminder.flagged} />
          </button>
        </div>
      </SwipeRow>
    </li>
  )
}
