import { useApp } from '../../state/store'
import { countForList, countForSmartList, countForTag } from '../../state/selectors'
import { deleteList, deleteTag, setReminderSelection } from '../../state/actions'
import { Icon, isIconName } from '../ui/Icon'
import type { ReminderList, SmartListId } from '../../types'

const SMART: { id: SmartListId; label: string; icon: string; tint: string }[] = [
  { id: 'today', label: 'Today', icon: 'today', tint: 'blue' },
  { id: 'scheduled', label: 'Scheduled', icon: 'calendar', tint: 'red' },
  { id: 'all', label: 'All tasks', icon: 'inbox', tint: 'gray' },
  { id: 'flagged', label: 'Flagged', icon: 'flag', tint: 'orange' },
]

/** Kept apart from the working lists, below them, the way Notes keeps its own. */
const TRASH: { id: SmartListId; label: string; icon: string } = {
  id: 'trash', label: 'Recently Deleted', icon: 'trash',
}

export function RemindersSidebar({
  onNewList,
  onEditList,
}: {
  onNewList: () => void
  onEditList: (list: ReminderList) => void
}) {
  const state = useApp()
  const sel = state.reminderSelection

  return (
    <>
      <ul className="side-list">
        {SMART.map((item) => (
          <li key={item.id}>
            <button
              type="button"
              className={`side-item tint-${item.tint}${sel.kind === 'smart' && sel.id === item.id ? ' is-on' : ''}`}
              onClick={() => setReminderSelection({ kind: 'smart', id: item.id })}
              aria-current={sel.kind === 'smart' && sel.id === item.id}
            >
              <span className="side-item__glyph side-item__glyph--plain">
                <Icon name={item.icon} size={15} />
              </span>
              <span className="side-item__name">{item.label}</span>
              <span className="side-item__count">{countForSmartList(state, item.id)}</span>
            </button>
          </li>
        ))}
      </ul>

      <ul className="side-list">
        <li>
          <button
            type="button"
            className={`side-item${sel.kind === 'smart' && sel.id === TRASH.id ? ' is-on' : ''}`}
            onClick={() => setReminderSelection({ kind: 'smart', id: TRASH.id })}
            aria-current={sel.kind === 'smart' && sel.id === TRASH.id}
          >
            <span className="side-item__glyph side-item__glyph--plain">
              <Icon name={TRASH.icon} size={15} />
            </span>
            <span className="side-item__name">{TRASH.label}</span>
            <span className="side-item__count">{countForSmartList(state, TRASH.id)}</span>
          </button>
        </li>
      </ul>

      <div className="sidebar__section">Lists</div>
      <ul className="side-list">
        {state.lists.map((list) => (
          <li key={list.id}>
            <div
              className={`side-item tint-${list.tint}${sel.kind === 'list' && sel.id === list.id ? ' is-on' : ''}`}
              role="button"
              tabIndex={0}
              aria-current={sel.kind === 'list' && sel.id === list.id}
              onClick={() => setReminderSelection({ kind: 'list', id: list.id })}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault()
                  setReminderSelection({ kind: 'list', id: list.id })
                }
              }}
            >
              <span className="side-item__glyph">
                {isIconName(list.symbol) ? <Icon name={list.symbol} size={15} /> : list.symbol}
              </span>
              <span className="side-item__name">{list.name}</span>
              <span className="side-item__count">{countForList(state, list.id)}</span>
              <span
                className="side-item__more"
                role="button"
                tabIndex={-1}
                aria-label={`Edit ${list.name}`}
                onClick={(e) => {
                  e.stopPropagation()
                  onEditList(list)
                }}
              >
                <Icon name="ellipsis" size={14} strokeWidth={2.4} />
              </span>
              <span
                className="side-item__more"
                role="button"
                tabIndex={-1}
                aria-label={`Delete ${list.name}`}
                onClick={(e) => {
                  e.stopPropagation()
                  if (confirm(`Delete “${list.name}” and its reminders?`)) deleteList(list.id)
                }}
              >
                <Icon name="trash" size={14} />
              </span>
            </div>
          </li>
        ))}
      </ul>

      {state.tags.length > 0 && (
        <>
          <div className="sidebar__section">Tags</div>
          <div className="tag-cloud">
            {state.tags.map((tag) => (
              <button
                key={tag.id}
                type="button"
                className={`tag-chip tint-${tag.tint}${sel.kind === 'tag' && sel.id === tag.id ? ' is-on' : ''}`}
                onClick={() => setReminderSelection({ kind: 'tag', id: tag.id })}
                onDoubleClick={() => {
                  if (confirm(`Delete the tag “${tag.name}”?`)) deleteTag(tag.id)
                }}
                title={`${countForTag(state, tag.id)} reminders — double-click to delete`}
              >
                #{tag.name}
              </button>
            ))}
          </div>
        </>
      )}

      <button type="button" className="side-add" onClick={onNewList}>
        <Icon name="plus" size={15} strokeWidth={2.2} />
        Add List
      </button>
    </>
  )
}
