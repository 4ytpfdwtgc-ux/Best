import { useEffect, useMemo, useState } from 'react'
import { useApp } from '../../state/store'
import { groupByDate, selectionTint, selectionTitle, visibleReminders } from '../../state/selectors'
import { addReminder, clearCompleted, setPrefs, setSelectedReminder } from '../../state/actions'
import { friendlyDate, todayISO } from '../../lib/date'
import { Icon } from '../ui/Icon'
import { EmptyState, ToolButton } from '../ui/primitives'
import { RemindersSidebar } from './RemindersSidebar'
import { ReminderRow } from './ReminderRow'
import { ReminderDetail } from './ReminderDetail'
import { ListSheet } from './ListSheet'
import type { ReminderList } from '../../types'

export function RemindersApp({
  sidebarOpen,
  onToggleSidebar,
}: {
  sidebarOpen: boolean
  onToggleSidebar: () => void
}) {
  const state = useApp()
  const [query, setQuery] = useState('')
  const [sheet, setSheet] = useState<{ list?: ReminderList } | null>(null)
  const [justAdded, setJustAdded] = useState<string | null>(null)

  const sel = state.reminderSelection
  const grouped = sel.kind === 'smart' && (sel.id === 'scheduled' || sel.id === 'today')

  const items = useMemo(() => {
    const all = visibleReminders(state)
    const q = query.trim().toLowerCase()
    return q ? all.filter((r) => `${r.title} ${r.notes ?? ''}`.toLowerCase().includes(q)) : all
  }, [state, query])

  const selected = state.reminders.find((r) => r.id === state.selectedReminderId) ?? null

  const targetList =
    sel.kind === 'list' ? (sel.id as string) : (state.lists[0]?.id ?? 'list_inbox')

  function newReminder() {
    const created = addReminder({
      listId: targetList,
      title: '',
      dueDate: sel.kind === 'smart' && sel.id === 'today' ? todayISO() : undefined,
      flagged: sel.kind === 'smart' && sel.id === 'flagged',
      tags: sel.kind === 'tag' ? [sel.id as string] : [],
    })
    setJustAdded(created.id)
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'n') {
        e.preventDefault()
        newReminder()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  const groups = grouped ? groupByDate(items) : [{ key: 'all', label: '', items }]

  return (
    <div className="module">
      <aside className="sidebar" hidden={!sidebarOpen} aria-label="Reminder lists">
        <div className="sidebar__head">
          <span className="sidebar__title">Reminders</span>
        </div>
        <div className="sidebar__body scroll">
          <RemindersSidebar onNewList={() => setSheet({})} onEditList={(list) => setSheet({ list })} />
        </div>
      </aside>

      <section className="content">
        <header className="toolbar">
          <ToolButton icon="sidebar" label="Toggle sidebar" onClick={onToggleSidebar} active={sidebarOpen} />
          <h1 className={`toolbar__title tint-${selectionTint(state)}`}>{selectionTitle(state)}</h1>
          <span className="toolbar__sub">{items.filter((r) => !r.completed).length}</span>
          <div className="toolbar__spacer" />
          <div className="search-field">
            <Icon name="search" size={14} />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search"
              aria-label="Search reminders"
            />
          </div>
          <ToolButton
            icon="check"
            label={state.prefs.showCompleted ? 'Hide completed' : 'Show completed'}
            active={state.prefs.showCompleted}
            onClick={() => setPrefs({ showCompleted: !state.prefs.showCompleted })}
          />
          <ToolButton
            icon="trash"
            label="Clear completed"
            onClick={() => clearCompleted(sel.kind === 'list' ? (sel.id as string) : undefined)}
          />
          <ToolButton icon="plus" label="New reminder (⌘N)" onClick={newReminder} />
        </header>

        <div
          className="rem-list scroll"
          onClick={(e) => {
            // Only clear the selection when the empty area itself is clicked.
            if (e.target === e.currentTarget) setSelectedReminder(null)
          }}
        >
          {items.length === 0 ? (
            <EmptyState
              icon="checklist"
              title="No Reminders"
              hint={query ? 'Nothing matches your search.' : 'Add one with the + button or ⌘N.'}
            />
          ) : (
            groups.map((group) => (
              <div key={group.key} className="rem-group">
                {group.label && (
                  <h2 className="rem-group__head">
                    {group.label === 'Overdue' || group.label === 'No Date'
                      ? group.label
                      : friendlyDate(group.label)}
                  </h2>
                )}
                <ul className="rem-group__items">
                  {group.items.map((r) => (
                    <ReminderRow
                      key={r.id}
                      reminder={r}
                      selected={r.id === state.selectedReminderId}
                      autoFocus={r.id === justAdded}
                      showList={sel.kind !== 'list'}
                      onSelect={() => setSelectedReminder(r.id)}
                    />
                  ))}
                </ul>
              </div>
            ))
          )}
        </div>
      </section>

      {selected && <ReminderDetail key={selected.id} reminder={selected} />}
      {sheet && <ListSheet list={sheet.list} onClose={() => setSheet(null)} />}
    </div>
  )
}
