import { useRef, useState } from 'react'
import type { AppState, DatabaseView, Reminder } from '../../types'
import type { Group } from '../../state/selectors'
import { addReminder, moveToGroup, setSelectedReminder, toggleReminder } from '../../state/actions'
import { friendlyDate, todayISO } from '../../lib/date'
import { Icon } from '../ui/Icon'
import { PropertyValueView } from './Property'
import { DRAG_SLOP, suppressSelection } from '../../lib/gestures'

/** Kanban board grouped by whatever the view's `groupBy` names. */
export function BoardView({
  state,
  view,
  groups,
}: {
  state: AppState
  view: DatabaseView
  groups: Group[]
}) {
  const [drag, setDrag] = useState<{ id: string; overKey: string | null } | null>(null)
  // The pointer handlers read the live value here; `drag` only drives rendering.
  const dragRef = useRef<{ id: string; overKey: string | null } | null>(null)

  function startDrag(e: React.PointerEvent, reminder: Reminder) {
    e.preventDefault()
    const origin = { x: e.clientX, y: e.clientY }
    let moved = false
    const release = suppressSelection()

    const onMove = (ev: PointerEvent) => {
      // Enough slop that a click is never read as a drag.
      if (Math.hypot(ev.clientX - origin.x, ev.clientY - origin.y) < DRAG_SLOP) return
      moved = true
      const column = document
        .elementFromPoint(ev.clientX, ev.clientY)
        ?.closest<HTMLElement>('[data-group-key]')
      dragRef.current = { id: reminder.id, overKey: column ? column.dataset.groupKey ?? null : null }
      setDrag(dragRef.current)
    }

    const onUp = () => {
      release()
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('pointercancel', onUp)
      const current = dragRef.current
      dragRef.current = null
      setDrag(null)
      if (!moved) setSelectedReminder(reminder.id)
      else if (current && view.groupBy) {
        const key = current.overKey === '__none__' ? null : current.overKey
        moveToGroup(reminder.id, view.groupBy, key)
      }
    }

    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    window.addEventListener('pointercancel', onUp)
  }

  return (
    <div className="board scroll">
      {groups.map((group) => {
        const key = group.key ?? '__none__'
        return (
          <section
            key={key}
            className={`board__col${drag?.overKey === key ? ' is-over' : ''}`}
            data-group-key={key}
          >
            <header className="board__head">
              <span className={`pill tint-${group.tint ?? 'gray'}`}>{group.name}</span>
              <span className="board__count">{group.items.length}</span>
            </header>

            <div className="board__cards">
              {group.items.map((reminder) => (
                <article
                  key={reminder.id}
                  className={`card${drag?.id === reminder.id ? ' is-dragging' : ''}`}
                  role="button"
                  tabIndex={0}
                  aria-label={reminder.title || 'Untitled'}
                  onPointerDown={(e) => {
                    // The checkbox handles its own pointer events.
                    if ((e.target as HTMLElement).closest('.db-row__check')) return
                    startDrag(e, reminder)
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault()
                      setSelectedReminder(reminder.id)
                    }
                  }}
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

                  <span className="card__body">
                    <span className="card__title">{reminder.title || 'Untitled'}</span>
                    <span className="card__props">
                      {reminder.dueDate && (
                        <span className={`pill tint-${reminder.dueDate < todayISO() && !reminder.completed ? 'red' : 'gray'}`}>
                          {friendlyDate(reminder.dueDate)}
                        </span>
                      )}
                      {view.visibleProps.map((id) => {
                        const property = state.properties.find((p) => p.id === id)
                        if (!property || property.id === view.groupBy) return null
                        const value = reminder.props[id]
                        const empty = value == null || value === '' || (Array.isArray(value) && !value.length)
                        if (empty) return null
                        return <PropertyValueView key={id} property={property} value={value} placeholder="" />
                      })}
                    </span>
                  </span>
                </article>
              ))}

              <button
                type="button"
                className="board__new"
                onClick={() => {
                  const created = addReminder({
                    listId: view.groupBy === 'list' && group.key ? group.key : state.lists[0]?.id ?? 'list_inbox',
                    title: 'New task',
                  })
                  if (view.groupBy && view.groupBy !== 'list') moveToGroup(created.id, view.groupBy, group.key)
                  setSelectedReminder(created.id)
                }}
              >
                <Icon name="plus" size={14} strokeWidth={2.2} /> New
              </button>
            </div>
          </section>
        )
      })}
    </div>
  )
}
