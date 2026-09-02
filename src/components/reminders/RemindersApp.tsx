import { useEffect, useMemo, useState } from 'react'
import { useApp } from '../../state/store'
import { useLingering } from '../../state/linger'
import { groupRows, selectionTitle, viewRows } from '../../state/selectors'
import { addReminder, setActiveView, setSelectedReminder } from '../../state/actions'
import { todayISO } from '../../lib/date'
import { useIsPhone } from '../../lib/useMediaQuery'
import { Icon } from '../ui/Icon'
import { EmptyState, ToolButton } from '../ui/primitives'
import { RemindersSidebar } from './RemindersSidebar'
import { ReminderDetail } from './ReminderDetail'
import { ListSheet } from './ListSheet'
import { ListView } from './ListView'
import { BoardView } from './BoardView'
import { TableView } from './TableView'
import { ViewControls } from './ViewControls'
import type { ReminderList, ViewMode } from '../../types'

const MODE_ICON: Record<ViewMode, string> = {
  list: 'list',
  board: 'grid',
  table: 'checklist',
  calendar: 'calendar',
}

export function RemindersApp({
  sidebarOpen,
  onToggleSidebar,
}: {
  sidebarOpen: boolean
  onToggleSidebar: () => void
}) {
  const state = useApp()
  const isPhone = useIsPhone()
  const [query, setQuery] = useState('')
  const [sheet, setSheet] = useState<{ list?: ReminderList } | null>(null)

  // Reminders completed a moment ago are held in the list, struck through.
  const lingering = useLingering()
  const view = state.views.find((v) => v.id === state.activeViewId) ?? state.views[0]
  const rows = useMemo(() => viewRows(state, view, query, lingering), [state, view, query, lingering])
  const groups = useMemo(() => groupRows(state, view, rows), [state, view, rows])
  const selected = state.reminders.find((r) => r.id === state.selectedReminderId) ?? null

  const sel = state.reminderSelection
  const targetList = sel.kind === 'list' ? (sel.id as string) : (state.lists[0]?.id ?? 'list_inbox')

  function newReminder() {
    const created = addReminder({
      listId: targetList,
      title: '',
      dueDate: sel.kind === 'smart' && sel.id === 'today' ? todayISO() : undefined,
      flagged: sel.kind === 'smart' && sel.id === 'flagged',
      tags: sel.kind === 'tag' ? [sel.id as string] : [],
    })
    setSelectedReminder(created.id)
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

  // A phone cannot show a table or a board usefully; keep it on the list.
  const mode: ViewMode = isPhone && view.mode !== 'list' ? 'list' : view.mode

  return (
    <div className="module">
      {isPhone && sidebarOpen && (
        <div className="sidebar-scrim" onClick={onToggleSidebar} role="presentation" />
      )}
      <aside className="sidebar" hidden={!sidebarOpen} aria-label="Reminder lists">
        <div className="sidebar__head">
          <span className="sidebar__title">Tasks</span>
          {isPhone && (
            <button type="button" className="icon-btn icon-btn--lg" onClick={onToggleSidebar} aria-label="Close lists">
              <Icon name="close" size={17} />
            </button>
          )}
        </div>
        <div className="sidebar__body scroll" onClick={() => isPhone && onToggleSidebar()}>
          <RemindersSidebar onNewList={() => setSheet({})} onEditList={(list) => setSheet({ list })} />
        </div>
      </aside>

      <section className="content">
        <header className="toolbar">
          <ToolButton icon="sidebar" label="Toggle sidebar" onClick={onToggleSidebar} active={sidebarOpen} />
          <h1 className="toolbar__title">{selectionTitle(state)}</h1>
          <div className="toolbar__spacer" />
          <div className="search-field">
            <Icon name="search" size={14} />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search"
              aria-label="Search tasks"
            />
          </div>
          <button type="button" className="btn btn--primary" onClick={newReminder}>
            <Icon name="plus" size={14} strokeWidth={2.4} /> New
          </button>
        </header>

        <div className="viewtabs">
          <div className="viewtabs__tabs" role="tablist" aria-label="Views">
            {state.views.map((v) => (
              <button
                key={v.id}
                type="button"
                role="tab"
                aria-selected={v.id === view.id}
                className={`viewtab${v.id === view.id ? ' is-on' : ''}`}
                onClick={() => setActiveView(v.id)}
              >
                <Icon name={MODE_ICON[v.mode]} size={13} />
                {v.name}
              </button>
            ))}
          </div>
          <div className="toolbar__spacer" />
          <ViewControls state={state} view={view} />
        </div>

        {rows.length === 0 ? (
          <EmptyState
            icon="checklist"
            title="No tasks"
            hint={query ? 'Nothing matches your search.' : 'Press New, or ⌘N, to add one.'}
          />
        ) : mode === 'board' ? (
          <BoardView state={state} view={view} groups={groups} />
        ) : mode === 'table' ? (
          <TableView state={state} view={view} groups={groups} selectedId={state.selectedReminderId} />
        ) : (
          <div className="db-scroll scroll">
            <ListView
              state={state}
              view={view}
              groups={groups}
              selectedId={state.selectedReminderId}
              lingering={lingering}
            />
          </div>
        )}
      </section>

      {selected && (
        <ReminderDetail
          key={selected.id}
          reminder={selected}
          onClose={isPhone ? () => setSelectedReminder(null) : undefined}
        />
      )}
      {sheet && <ListSheet list={sheet.list} onClose={() => setSheet(null)} />}
    </div>
  )
}
