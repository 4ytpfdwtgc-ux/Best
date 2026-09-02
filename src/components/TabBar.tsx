import { Icon } from './ui/Icon'
import type { ModuleName } from '../types'

const TABS: { id: ModuleName; icon: string; label: string }[] = [
  { id: 'home', icon: 'today', label: 'Today' },
  { id: 'reminders', icon: 'checklist', label: 'Reminders' },
  { id: 'calendar', icon: 'calendar', label: 'Calendar' },
  { id: 'notes', icon: 'note', label: 'Notes' },
]

/** iOS-style bottom tab bar, used instead of the rail at phone widths. */
export function TabBar({
  module,
  onSelect,
}: {
  module: ModuleName
  onSelect: (m: ModuleName) => void
}) {
  return (
    <nav className="tabbar" aria-label="Apps">
      {TABS.map((t) => (
        <button
          key={t.id}
          type="button"
          className={`tabbar__btn${module === t.id ? ' is-on' : ''}`}
          onClick={() => onSelect(t.id)}
          aria-current={module === t.id}
        >
          <Icon name={t.icon} size={23} />
          <span className="tabbar__label">{t.label}</span>
        </button>
      ))}
    </nav>
  )
}
