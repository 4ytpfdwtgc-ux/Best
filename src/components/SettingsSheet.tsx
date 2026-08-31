import { useApp, resetStore } from '../state/store'
import { setPrefs } from '../state/actions'
import { Row, Sheet, Switch, TintPicker } from './ui/primitives'
import type { ThemeSetting } from '../types'

export function SettingsSheet({ onClose }: { onClose: () => void }) {
  const { prefs } = useApp()

  return (
    <Sheet
      title="Settings"
      onClose={onClose}
      width={440}
      footer={
        <>
          <button
            type="button"
            className="btn btn--danger"
            onClick={() => {
              if (confirm('Replace all data with the sample content? This cannot be undone.')) {
                resetStore()
                onClose()
              }
            }}
          >
            Reset sample data
          </button>
          <button type="button" className="btn btn--primary" onClick={onClose}>
            Done
          </button>
        </>
      }
    >
      <section className="settings__group">
        <h3 className="settings__heading">Appearance</h3>
        <Row label="Theme">
          <select
            className="select input--sm"
            value={prefs.theme}
            onChange={(e) => setPrefs({ theme: e.target.value as ThemeSetting })}
            aria-label="Theme"
          >
            <option value="system">System</option>
            <option value="light">Light</option>
            <option value="dark">Dark</option>
          </select>
        </Row>
        <Row label="Accent color">
          <TintPicker value={prefs.accent} onChange={(accent) => setPrefs({ accent })} />
        </Row>
      </section>

      <section className="settings__group">
        <h3 className="settings__heading">Calendar</h3>
        <Row label="Start week on">
          <select
            className="select input--sm"
            value={prefs.weekStartsOn}
            onChange={(e) => setPrefs({ weekStartsOn: Number(e.target.value) as 0 | 1 })}
            aria-label="Start week on"
          >
            <option value={0}>Sunday</option>
            <option value={1}>Monday</option>
          </select>
        </Row>
        <Row label="24-hour time">
          <Switch
            checked={prefs.use24HourTime}
            onChange={(use24HourTime) => setPrefs({ use24HourTime })}
            label="24-hour time"
          />
        </Row>
        <Row label="Show reminders on calendar">
          <Switch
            checked={prefs.showRemindersOnCalendar}
            onChange={(showRemindersOnCalendar) => setPrefs({ showRemindersOnCalendar })}
            label="Show reminders on calendar"
          />
        </Row>
      </section>

      <section className="settings__group">
        <h3 className="settings__heading">Reminders &amp; Notes</h3>
        <Row label="Show completed reminders">
          <Switch
            checked={prefs.showCompleted}
            onChange={(showCompleted) => setPrefs({ showCompleted })}
            label="Show completed reminders"
          />
        </Row>
        <Row label="Sort notes by">
          <select
            className="select input--sm"
            value={prefs.notesSort}
            onChange={(e) => setPrefs({ notesSort: e.target.value as 'edited' | 'created' | 'title' })}
            aria-label="Sort notes by"
          >
            <option value="edited">Date edited</option>
            <option value="created">Date created</option>
            <option value="title">Title</option>
          </select>
        </Row>
      </section>

      <section className="settings__group">
        <h3 className="settings__heading">Keyboard</h3>
        <ul className="shortcuts">
          <li><kbd className="kbd">⌘1</kbd> <kbd className="kbd">⌘2</kbd> <kbd className="kbd">⌘3</kbd><span>Switch apps</span></li>
          <li><kbd className="kbd">⌘K</kbd><span>Quick Find</span></li>
          <li><kbd className="kbd">⌘N</kbd><span>New item in the current app</span></li>
          <li><kbd className="kbd">⌘T</kbd><span>Jump to today (Calendar)</span></li>
          <li><kbd className="kbd">⇧⌘S</kbd><span>Toggle the sidebar</span></li>
        </ul>
      </section>
    </Sheet>
  )
}
