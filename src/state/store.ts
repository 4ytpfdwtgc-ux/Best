import { useSyncExternalStore } from 'react'
import type { AppState } from '../types'
import { createInitialState, SCHEMA_VERSION } from './seed'
import { migrate } from './migrate'

const STORAGE_KEY = 'cadence.state.v1'

type Listener = () => void

/**
 * True when the loaded state still has to be written back: either it came from
 * sample data, or it was migrated from an older schema and the save on disk is
 * still the old shape.
 */
let needsWrite = false

function load(): AppState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) {
      needsWrite = true
      return createInitialState()
    }
    // Bring older saves forward rather than discarding them on a schema bump.
    const parsed = JSON.parse(raw) as Partial<AppState>
    needsWrite = parsed.version !== SCHEMA_VERSION
    return migrate(parsed)
  } catch {
    needsWrite = true
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

// Write straight away so sample ids stay stable and a migration is not redone
// on every launch.
if (needsWrite) persist()

export function getState(): AppState {
  return state
}

/** Apply a partial update, or a function of the current state. */
export function setState(patch: Partial<AppState> | ((s: AppState) => Partial<AppState>)): void {
  const next = typeof patch === 'function' ? patch(state) : patch
  // A no-op write would still hand out a new state object, which invalidates
  // every downstream useMemo and can spin a component into an update loop.
  const changed = (Object.keys(next) as (keyof AppState)[]).some((k) => next[k] !== state[k])
  if (!changed) return
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

/**
 * Replace the whole library, as a restored backup does.
 *
 * The saved state goes through the same migration as any older save, so a
 * backup written by an earlier build is brought forward rather than refused.
 */
export function replaceState(saved: Partial<AppState>): void {
  state = migrate(saved)
  persist()
  listeners.forEach((l) => l())
}

/** Wipe persisted state and reload with fresh sample data. */
export function resetStore(): void {
  localStorage.removeItem(STORAGE_KEY)
  state = createInitialState()
  persist()
  listeners.forEach((l) => l())
}

export { STORAGE_KEY, SCHEMA_VERSION }
