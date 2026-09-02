import { Icon } from './ui/Icon'
import type { ModuleName } from '../types'

const MODULES: { id: ModuleName; icon: string; label: string; hint: string }[] = [
  { id: 'home', icon: 'today', label: 'Today', hint: '⌘0' },
  { id: 'reminders', icon: 'checklist', label: 'Reminders', hint: '⌘1' },
  { id: 'calendar', icon: 'calendar', label: 'Calendar', hint: '⌘2' },
  { id: 'notes', icon: 'note', label: 'Notes', hint: '⌘3' },
]

/** The slim vertical rail that switches between the three apps. */
export function AppRail({
  module,
  onSelect,
  onSettings,
  onSearch,
}: {
  module: ModuleName
  onSelect: (m: ModuleName) => void
  onSettings: () => void
  onSearch: () => void
}) {
  return (
    <nav className="rail" aria-label="Apps">
      <div className="rail__mark" aria-hidden="true">
        <Icon name="check" size={15} strokeWidth={2.6} />
      </div>

      <div className="rail__group">
        {MODULES.map((m) => (
          <button
            key={m.id}
            type="button"
            className={`rail__btn${module === m.id ? ' is-on' : ''}`}
            onClick={() => onSelect(m.id)}
            title={`${m.label} (${m.hint})`}
            aria-label={m.label}
            aria-current={module === m.id}
          >
            <Icon name={m.icon} size={20} />
            <span className="rail__label">{m.label}</span>
          </button>
        ))}
      </div>

      <div className="rail__group rail__group--end">
        <button type="button" className="rail__btn" onClick={onSearch} title="Quick Find (⌘K)" aria-label="Quick Find">
          <Icon name="search" size={19} />
          <span className="rail__label">Find</span>
        </button>
        <button type="button" className="rail__btn" onClick={onSettings} title="Settings (⌘,)" aria-label="Settings">
          <Icon name="gear" size={19} />
          <span className="rail__label">Settings</span>
        </button>
      </div>
    </nav>
  )
}
