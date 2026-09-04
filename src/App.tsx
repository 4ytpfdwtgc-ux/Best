import { useCallback, useEffect, useState } from 'react'
import { getState, useApp } from './state/store'
import { referencedAssetIds } from './state/selectors'
import { sweepOrphans } from './lib/assets'
import { purgeExpiredReminders, setModule } from './state/actions'
import { useIsPhone } from './lib/useMediaQuery'
import { applyCapture } from './state/capture'
import { AppRail } from './components/AppRail'
import { TabBar } from './components/TabBar'
import { QuickFind } from './components/QuickFind'
import { SettingsSheet } from './components/SettingsSheet'
import { HomeApp } from './components/home/HomeApp'
import { RemindersApp } from './components/reminders/RemindersApp'
import { CalendarApp } from './components/calendar/CalendarApp'
import { NotesApp } from './components/notes/NotesApp'
import type { ModuleName } from './types'

const MODULE_KEYS: Record<string, ModuleName> = {
  '0': 'home',
  '1': 'reminders',
  '2': 'calendar',
  '3': 'notes',
}

export default function App() {
  const state = useApp()
  const isPhone = useIsPhone()
  const [quickFind, setQuickFind] = useState(false)
  const [settings, setSettings] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [toast, setToast] = useState<string | null>(null)

  /*
   * A shortcut hands work over in the query string. Consume it once, then
   * clear it so a refresh cannot add the same thing twice.
   */
  useEffect(() => {
    if (!window.location.search) return
    const message = applyCapture(window.location.search)
    window.history.replaceState({}, '', window.location.pathname + window.location.hash)
    if (message) setToast(message)
  }, [])

  /*
   * Deleting a block or a page leaves its pictures behind, and nothing smaller
   * than the whole page list can tell an orphan from one a duplicated block
   * still shares. Reclaim them once, at launch, rather than eagerly.
   */
  useEffect(() => {
    void sweepOrphans(referencedAssetIds(getState()))
    // A trashed task is kept for thirty days, then it really is gone.
    purgeExpiredReminders()
  }, [])

  useEffect(() => {
    if (!toast) return
    const handle = window.setTimeout(() => setToast(null), 4000)
    return () => window.clearTimeout(handle)
  }, [toast])

  /* Apply theme + accent to the document root. */
  useEffect(() => {
    const root = document.documentElement
    const media = window.matchMedia('(prefers-color-scheme: dark)')
    const apply = () => {
      const dark = state.prefs.theme === 'dark' || (state.prefs.theme === 'system' && media.matches)
      root.dataset.theme = dark ? 'dark' : 'light'
      // Keep the iOS status bar and address bar in step with the app chrome.
      document
        .querySelector('meta[name="theme-color"]')
        ?.setAttribute('content', dark ? '#1a1a1c' : '#f5f5f7')
    }
    apply()
    media.addEventListener('change', apply)
    return () => media.removeEventListener('change', apply)
  }, [state.prefs.theme])

  useEffect(() => {
    // Blue is the stylesheet default (Notion's interactive blue), so only a
    // deliberately different choice overrides it.
    const root = document.documentElement
    if (state.prefs.accent === 'blue') root.style.removeProperty('--accent')
    else root.style.setProperty('--accent', `var(--tint-${state.prefs.accent})`)
  }, [state.prefs.accent])

  /* On a phone the sidebar is an overlay, so it starts closed. */
  useEffect(() => setSidebarOpen(!isPhone), [isPhone])

  const isTyping = useCallback(() => {
    const el = document.activeElement as HTMLElement | null
    return !!el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable)
  }, [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const meta = e.metaKey || e.ctrlKey
      if (meta && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setQuickFind(true)
        return
      }
      if (meta && e.key === ',') {
        e.preventDefault()
        setSettings(true)
        return
      }
      if (meta && MODULE_KEYS[e.key]) {
        e.preventDefault()
        setModule(MODULE_KEYS[e.key])
        return
      }
      if (meta && e.key.toLowerCase() === 's' && e.shiftKey) {
        e.preventDefault()
        setSidebarOpen((v) => !v)
        return
      }
      if (e.key === '/' && !isTyping()) {
        e.preventDefault()
        setQuickFind(true)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [isTyping])

  const paneProps = {
    sidebarOpen,
    onToggleSidebar: () => setSidebarOpen((v) => !v),
  }

  return (
    <div className={`app${isPhone ? ' app--phone' : ''}`}>
      {!isPhone && (
        <AppRail
          module={state.module}
          onSelect={setModule}
          onSettings={() => setSettings(true)}
          onSearch={() => setQuickFind(true)}
        />
      )}

      <main className="app__main">
        {state.module === 'home' && (
          <HomeApp onOpenSearch={() => setQuickFind(true)} onOpenSettings={() => setSettings(true)} />
        )}
        {state.module === 'reminders' && <RemindersApp {...paneProps} />}
        {state.module === 'calendar' && <CalendarApp {...paneProps} />}
        {state.module === 'notes' && <NotesApp {...paneProps} />}
      </main>

      {isPhone && <TabBar module={state.module} onSelect={setModule} />}

      {toast && (
        <div className="toast" role="status" aria-live="polite" onClick={() => setToast(null)}>
          {toast}
        </div>
      )}

      {quickFind && <QuickFind onClose={() => setQuickFind(false)} />}
      {settings && <SettingsSheet onClose={() => setSettings(false)} />}
    </div>
  )
}
