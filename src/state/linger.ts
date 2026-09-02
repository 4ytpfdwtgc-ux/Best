import { useSyncExternalStore } from 'react'
import type { ID } from '../types'

/**
 * How long a completed reminder stays on screen, struck through, before the
 * list drops it.
 */
export const LINGER_MS = 2000

/**
 * Reminders that have just been completed.
 *
 * Completing a task normally makes its row vanish on the spot, which gives no
 * sign that the tap landed on the row you meant. Holding it for a beat, struck
 * through, shows the result before taking it away — and leaves a window to tap
 * again and undo.
 *
 * This is deliberately outside AppState: it is a property of the screen, not of
 * the data, so it must not be persisted or survive a reload.
 */
let ids: ReadonlySet<ID> = new Set()
const timers = new Map<ID, number>()
const listeners = new Set<() => void>()

function emit() {
  for (const listener of listeners) listener()
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  return () => void listeners.delete(listener)
}

export function getLingering(): ReadonlySet<ID> {
  return ids
}

export function isLingering(id: ID): boolean {
  return ids.has(id)
}

/** Hold a reminder on screen for a beat now that it is complete. */
export function lingerReminder(id: ID, ms: number = LINGER_MS): void {
  const running = timers.get(id)
  if (running !== undefined) clearTimeout(running)
  timers.set(id, setTimeout(() => releaseReminder(id), ms) as unknown as number)

  if (ids.has(id)) return
  ids = new Set(ids).add(id)
  emit()
}

/** Drop the hold now, because the reminder was un-completed or deleted. */
export function releaseReminder(id: ID): void {
  const running = timers.get(id)
  if (running !== undefined) clearTimeout(running)
  timers.delete(id)

  if (!ids.has(id)) return
  const next = new Set(ids)
  next.delete(id)
  ids = next
  emit()
}

/** Test seam: drop every hold without waiting for its timer. */
export function releaseAll(): void {
  for (const id of [...ids]) releaseReminder(id)
}

export function useLingering(): ReadonlySet<ID> {
  return useSyncExternalStore(subscribe, getLingering, getLingering)
}
