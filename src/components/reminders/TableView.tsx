import { useState } from 'react'
import type { AppState, DatabaseView, PropertyType } from '../../types'
import type { Group } from '../../state/selectors'
import { addProperty, deleteProperty, setSelectedReminder, toggleReminder, updateProperty } from '../../state/actions'
import { friendlyDate, todayISO } from '../../lib/date'
import { Icon } from '../ui/Icon'
import { PropertyCell } from './Property'

const TYPES: { value: PropertyType; label: string }[] = [
  { value: 'select', label: 'Select' },
  { value: 'multiSelect', label: 'Multi-select' },
  { value: 'text', label: 'Text' },
  { value: 'number', label: 'Number' },
  { value: 'checkbox', label: 'Checkbox' },
  { value: 'date', label: 'Date' },
  { value: 'url', label: 'URL' },
]

/** Spreadsheet view: one row per reminder, one column per visible property. */
export function TableView({
  state,
  view,
  groups,
  selectedId,
}: {
  state: AppState
  view: DatabaseView
  groups: Group[]
  selectedId: string | null
}) {
  const [adding, setAdding] = useState(false)
  const columns = view.visibleProps
    .map((id) => state.properties.find((p) => p.id === id))
    .filter((p): p is NonNullable<typeof p> => !!p)

  return (
    <div className="table-wrap scroll">
      <table className="db-table">
        <thead>
          <tr>
            <th className="db-table__name">Name</th>
            <th className="db-table__due">Due</th>
            {columns.map((property) => (
              <th key={property.id}>
                <input
                  className="db-table__rename"
                  value={property.name}
                  onChange={(e) => updateProperty(property.id, { name: e.target.value })}
                  aria-label={`Rename ${property.name}`}
                />
                <button
                  type="button"
                  className="icon-btn db-table__drop"
                  title={`Delete ${property.name}`}
                  aria-label={`Delete ${property.name}`}
                  onClick={() => {
                    if (confirm(`Delete the “${property.name}” property from every task?`)) {
                      deleteProperty(property.id)
                    }
                  }}
                >
                  <Icon name="close" size={12} />
                </button>
              </th>
            ))}
            <th className="db-table__add">
              {adding ? (
                <form
                  onSubmit={(e) => {
                    e.preventDefault()
                    const form = new FormData(e.currentTarget)
                    addProperty(String(form.get('name') ?? ''), form.get('type') as PropertyType)
                    setAdding(false)
                  }}
                >
                  <input name="name" className="input input--sm" placeholder="Property name" autoFocus aria-label="Property name" />
                  <select name="type" className="select input--sm" aria-label="Property type">
                    {TYPES.map((t) => (
                      <option key={t.value} value={t.value}>{t.label}</option>
                    ))}
                  </select>
                  <button type="submit" className="btn btn--primary">Add</button>
                </form>
              ) : (
                <button type="button" className="icon-btn" onClick={() => setAdding(true)} aria-label="Add a property">
                  <Icon name="plus" size={14} strokeWidth={2.2} />
                </button>
              )}
            </th>
          </tr>
        </thead>

        {groups.map((group) => (
          <tbody key={group.key ?? 'all'}>
            {view.groupBy && (
              <tr className="db-table__group">
                <td colSpan={columns.length + 3}>
                  <span className={`pill tint-${group.tint ?? 'gray'}`}>{group.name}</span>
                  <span className="board__count">{group.items.length}</span>
                </td>
              </tr>
            )}
            {group.items.map((reminder) => (
              <tr key={reminder.id} className={reminder.id === selectedId ? 'is-selected' : undefined}>
                <td className="db-table__name">
                  <span className="db-table__namecell">
                    <button
                      type="button"
                      className={`db-row__check${reminder.completed ? ' is-on' : ''}`}
                      onClick={() => toggleReminder(reminder.id)}
                      aria-pressed={reminder.completed}
                      aria-label={reminder.completed ? 'Mark as not done' : 'Mark as done'}
                    >
                      {reminder.completed ? <Icon name="check" size={11} strokeWidth={3} /> : null}
                    </button>
                    <button type="button" className="db-table__open" onClick={() => setSelectedReminder(reminder.id)}>
                      {reminder.title || 'Untitled'}
                    </button>
                  </span>
                </td>
                <td className="db-table__due">
                  {reminder.dueDate ? (
                    <span className={reminder.dueDate < todayISO() && !reminder.completed ? 'db-row__due is-overdue' : undefined}>
                      {friendlyDate(reminder.dueDate)}
                    </span>
                  ) : (
                    <span className="prop__empty">Empty</span>
                  )}
                </td>
                {columns.map((property) => (
                  <td key={property.id}>
                    <PropertyCell reminder={reminder} property={property} />
                  </td>
                ))}
                <td />
              </tr>
            ))}
          </tbody>
        ))}
      </table>
    </div>
  )
}
