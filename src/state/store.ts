import { useSyncExternalStore } from 'react'
import type { AppState } from '../types'
import { createInitialState } from './seed'

const STORAGE_KEY = 'cadence.state.v1'
const SCHEMA_VERSION = 1

type Listener = () => void

/** True when this session started from sample data rather than saved state. */
let seeded = false

function load(): AppState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) {
      seeded = true
      return createInitialState()
    }
    const parsed = JSON.parse(raw) as Partial<AppState>
    if (parsed.version !== SCHEMA_VERSION) return createInitialState()
    // Merge over defaults so state written by an older build still boots.
    const base = createInitialState()
    return {
      ...base,
      ...parsed,
      prefs: { ...base.prefs, ...(parsed.prefs ?? {}) },
    } as AppState
  } catch {
    seeded = true
    return createInitialState()
  }
}

let state: AppState = load()
const listeners = new Set<Listener>()
let flushHandle: number | undefined

function persist() {
  if (flushHandle !== undefined) return
  flushHandle = window.setTimeout(() => {
    flushHandle = undefined
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
    } catch {
      // Quota exceeded or storage disabled — the app keeps working in memory.
    }
  }, 150)
}

// Write the sample data out straight away so ids stay stable across reloads.
if (seeded) persist()

export function getState(): AppState {
  return state
}

/** Apply a partial update, or a function of the current state. */
export function setState(patch: Partial<AppState> | ((s: AppState) => Partial<AppState>)): void {
  const next = typeof patch === 'function' ? patch(state) : patch
  state = { ...state, ...next }
  persist()
  listeners.forEach((l) => l())
}

export function subscribe(listener: Listener): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

/** Subscribe a component to the whole store. */
export function useApp(): AppState {
  return useSyncExternalStore(subscribe, getState, getState)
}

/** Wipe persisted state and reload with fresh sample data. */
export function resetStore(): void {
  localStorage.removeItem(STORAGE_KEY)
  state = createInitialState()
  persist()
  listeners.forEach((l) => l())
}

export { STORAGE_KEY, SCHEMA_VERSION }
