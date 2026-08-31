import { useCallback, useEffect, useState } from 'react'
import { useApp } from './state/store'
import { setModule } from './state/actions'
import { AppRail } from './components/AppRail'
import { QuickFind } from './components/QuickFind'
import { SettingsSheet } from './components/SettingsSheet'
import { RemindersApp } from './components/reminders/RemindersApp'
import { CalendarApp } from './components/calendar/CalendarApp'
import { NotesApp } from './components/notes/NotesApp'
import type { ModuleName } from './types'

const MODULE_KEYS: Record<string, ModuleName> = {
  '1': 'reminders',
  '2': 'calendar',
  '3': 'notes',
}

export default function App() {
  const state = useApp()
  const [quickFind, setQuickFind] = useState(false)
  const [settings, setSettings] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(true)

  /* Apply theme + accent to the document root. */
  useEffect(() => {
    const root = document.documentElement
    const media = window.matchMedia('(prefers-color-scheme: dark)')
    const apply = () => {
      const dark = state.prefs.theme === 'dark' || (state.prefs.theme === 'system' && media.matches)
      root.dataset.theme = dark ? 'dark' : 'light'
    }
    apply()
    media.addEventListener('change', apply)
    return () => media.removeEventListener('change', apply)
  }, [state.prefs.theme])

  useEffect(() => {
    document.documentElement.style.setProperty('--accent', `var(--tint-${state.prefs.accent})`)
  }, [state.prefs.accent])

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

  return (
    <div className="app">
      <AppRail
        module={state.module}
        onSelect={setModule}
        onSettings={() => setSettings(true)}
        onSearch={() => setQuickFind(true)}
      />

      <main className="app__main">
        {state.module === 'reminders' && <RemindersApp sidebarOpen={sidebarOpen} onToggleSidebar={() => setSidebarOpen((v) => !v)} />}
        {state.module === 'calendar' && <CalendarApp sidebarOpen={sidebarOpen} onToggleSidebar={() => setSidebarOpen((v) => !v)} />}
        {state.module === 'notes' && <NotesApp sidebarOpen={sidebarOpen} onToggleSidebar={() => setSidebarOpen((v) => !v)} />}
      </main>

      {quickFind && <QuickFind onClose={() => setQuickFind(false)} />}
      {settings && <SettingsSheet onClose={() => setSettings(false)} />}
    </div>
  )
}
