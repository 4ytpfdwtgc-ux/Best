import { useEffect, useRef, useState } from 'react'
import { useApp, replaceState, resetStore } from '../state/store'
import { setPrefs } from '../state/actions'
import { captureUrlTemplate } from '../state/capture'
import { buildICS } from '../lib/ics'
import { shareOrDownload } from '../lib/deliver'
import { Row, Sheet, Switch, TintPicker } from './ui/primitives'
import { Icon } from './ui/Icon'
import { formatBytes, usage } from '../lib/assets'
import { BackupError, backupFilename, buildBackup, readBackup, restoreAssets } from '../lib/backup'
import type { ThemeSetting } from '../types'

export function SettingsSheet({ onClose }: { onClose: () => void }) {
  const state = useApp()
  const { prefs } = state
  const [copied, setCopied] = useState<string | null>(null)

  async function copy(text: string, key: string) {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(key)
      window.setTimeout(() => setCopied(null), 1500)
    } catch {
      // Clipboard access can be refused; the field is selectable either way.
    }
  }

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
        <Row label="Pictures on this device">
          <PictureUsage />
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
        <h3 className="settings__heading">Backup</h3>
        <BackupRows onRestored={onClose} />
      </section>

      <section className="settings__group">
        <h3 className="settings__heading">iOS</h3>

        <Row label="Send events to the system calendar">
          <button
            type="button"
            className="btn"
            onClick={() => void shareOrDownload('cadence.ics', buildICS(state.events))}
          >
            <Icon name="calendar" size={14} /> Export all ({state.events.length})
          </button>
        </Row>
        <p className="settings__note">
          Opens the share sheet on iPhone, so the file can go straight to Calendar. A single event
          can also be sent from its own editor.
        </p>

        <h4 className="settings__sub">“Hey Siri” capture</h4>
        <p className="settings__note">
          In Shortcuts, make a shortcut named <strong>Add to Cadence</strong>:{' '}
          <em>Dictate Text</em> → <em>URL</em> (the address below with the dictated text appended) →{' '}
          <em>Open URLs</em>. Then say “Hey Siri, Add to Cadence”. Spoken dates and times are
          understood — “buy oat milk tomorrow at 5pm”.
        </p>

        {(['add', 'note'] as const).map((kind) => (
          <div key={kind} className="settings__copy">
            <span className="settings__copylabel">{kind === 'add' ? 'Task' : 'Page'}</span>
            <input
              className="input"
              readOnly
              value={captureUrlTemplate(kind)}
              onFocus={(e) => e.currentTarget.select()}
              aria-label={`${kind === 'add' ? 'Task' : 'Page'} capture address`}
            />
            <button type="button" className="btn" onClick={() => void copy(captureUrlTemplate(kind), kind)}>
              {copied === kind ? 'Copied' : 'Copy'}
            </button>
          </div>
        ))}
      </section>

      <section className="settings__group">
        <h3 className="settings__heading">Keyboard</h3>
        <ul className="shortcuts">
          <li><kbd className="kbd">⌘0</kbd> <kbd className="kbd">⌘1</kbd> <kbd className="kbd">⌘2</kbd> <kbd className="kbd">⌘3</kbd><span>Switch apps</span></li>
          <li><kbd className="kbd">⌘K</kbd><span>Quick Find</span></li>
          <li><kbd className="kbd">⌘N</kbd><span>New item in the current app</span></li>
          <li><kbd className="kbd">⌘T</kbd><span>Jump to today (Calendar)</span></li>
          <li><kbd className="kbd">⇧⌘S</kbd><span>Toggle the sidebar</span></li>
        </ul>
      </section>
    </Sheet>
  )
}

/**
 * How much room the pictures take. Worth showing: they are the only thing here
 * big enough to run into a storage limit, and they live on this device alone.
 */
function PictureUsage() {
  const [stats, setStats] = useState<{ count: number; bytes: number } | null>(null)

  useEffect(() => {
    let live = true
    usage().then((found) => live && setStats(found))
    return () => void (live = false)
  }, [])

  if (!stats) return <span className="row__note">Counting…</span>
  if (!stats.count) return <span className="row__note">None yet</span>
  return (
    <span className="row__note">
      {stats.count} {stats.count === 1 ? 'picture' : 'pictures'} · {formatBytes(stats.bytes)}
    </span>
  )
}

/**
 * Export and restore the whole library.
 *
 * Everything lives in this one browser, so a cleared cache or a new phone
 * takes all of it. This is the only recovery a static app can offer, which is
 * why it is a section of its own rather than a line in a menu.
 */
function BackupRows({ onRestored }: { onRestored: () => void }) {
  const state = useApp()
  const [busy, setBusy] = useState<'export' | 'import' | null>(null)
  const [message, setMessage] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  async function exportAll() {
    setBusy('export')
    setMessage(null)
    try {
      const json = await buildBackup(state)
      const how = await shareOrDownload(backupFilename(), json, 'application/json')
      setMessage({
        kind: 'ok',
        text: how === 'shared' ? 'Backup shared.' : 'Backup saved to your downloads.',
      })
    } catch {
      setMessage({ kind: 'error', text: 'The backup could not be written.' })
    } finally {
      setBusy(null)
    }
  }

  async function importAll(file: File) {
    setBusy('import')
    setMessage(null)
    try {
      const { backup, summary } = readBackup(await file.text())
      const when = summary.exportedAt.slice(0, 10)
      const ok = confirm(
        `Restore the backup from ${when}?\n\n` +
          `${summary.notes} pages, ${summary.reminders} tasks, ${summary.events} events, ` +
          `${summary.assets} pictures.\n\n` +
          'Everything currently in this app will be replaced.',
      )
      if (!ok) return

      // Assets first: state restored before them would sweep them as orphans.
      await restoreAssets(backup.assets)
      replaceState(backup.state)
      onRestored()
    } catch (error) {
      setMessage({
        kind: 'error',
        text: error instanceof BackupError ? error.message : 'That backup could not be read.',
      })
    } finally {
      setBusy(null)
    }
  }

  return (
    <>
      <Row label="Everything, as one file">
        <button type="button" className="btn" onClick={() => void exportAll()} disabled={busy !== null}>
          <Icon name="download" size={14} /> {busy === 'export' ? 'Working…' : 'Export'}
        </button>
      </Row>
      <Row label="Restore from a backup">
        <button
          type="button"
          className="btn"
          onClick={() => inputRef.current?.click()}
          disabled={busy !== null}
        >
          <Icon name="upload" size={14} /> {busy === 'import' ? 'Working…' : 'Choose a file'}
        </button>
      </Row>
      <input
        ref={inputRef}
        type="file"
        accept="application/json,.json"
        className="sr-only"
        tabIndex={-1}
        aria-hidden="true"
        onChange={(e) => {
          const file = e.target.files?.[0]
          e.target.value = ''
          if (file) void importAll(file)
        }}
      />
      <p className="settings__note">
        Tasks, events, pages and pictures are held in this browser alone — no account, no server.
        Clearing website data or moving to another phone takes them with it, and iOS can evict the
        storage of a site that has not been opened for a week. An exported file is the only way
        back, so keep one somewhere safe.
      </p>
      {message && (
        <p className={`settings__note${message.kind === 'error' ? ' is-error' : ''}`}>{message.text}</p>
      )}
    </>
  )
}
