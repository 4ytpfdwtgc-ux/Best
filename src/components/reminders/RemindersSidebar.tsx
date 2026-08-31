import { useApp } from '../../state/store'
import { countForList, countForSmartList, countForTag } from '../../state/selectors'
import { deleteList, deleteTag, setReminderSelection } from '../../state/actions'
import { Icon } from '../ui/Icon'
import type { ReminderList, SmartListId } from '../../types'

const SMART: { id: SmartListId; label: string; icon: string; tint: string }[] = [
  { id: 'today', label: 'Today', icon: 'today', tint: 'blue' },
  { id: 'scheduled', label: 'Scheduled', icon: 'calendar', tint: 'red' },
  { id: 'all', label: 'All', icon: 'inbox', tint: 'gray' },
  { id: 'flagged', label: 'Flagged', icon: 'flag', tint: 'orange' },
]

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
      <div className="smart-grid">
        {SMART.map((s) => (
          <button
            key={s.id}
            type="button"
            className={`smart-card tint-${s.tint}${sel.kind === 'smart' && sel.id === s.id ? ' is-on' : ''}`}
            onClick={() => setReminderSelection({ kind: 'smart', id: s.id })}
            aria-current={sel.kind === 'smart' && sel.id === s.id}
          >
            <span className="smart-card__top">
              <span className="smart-card__icon">
                <Icon name={s.icon} size={13} strokeWidth={2} />
              </span>
              <span className="smart-card__count">{countForSmartList(state, s.id)}</span>
            </span>
            <span className="smart-card__label">{s.label}</span>
          </button>
        ))}
      </div>

      <div className="sidebar__section">My Lists</div>
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
              <span className="side-item__glyph">{list.symbol}</span>
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
