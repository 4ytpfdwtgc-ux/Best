import { useSyncExternalStore } from 'react'

/**
 * The last thing that can still be taken back.
 *
 * Every destructive action offers one of these as it runs, and the app shows
 * it as a toast with an Undo beside it. It is a property of the screen rather
 * than of the data -- deliberately not persisted, and gone on a reload, in the
 * same way the toast it belongs to is.
 *
 * There is only ever one: an undo stack invites the question of how far back
 * it goes and what happens when the thing three steps ago no longer exists.
 * One offer, held for a few seconds, is the promise the app can keep. Anything
 * older is what Recently Deleted is for.
 */
export interface UndoOffer {
  /** Rises with every offer, so a repeat of the same label still reads as new. */
  readonly seq: number
  /** What just happened, phrased for the toast: `Deleted “Packing list”`. */
  readonly label: string
  /** Put it back. */
  readonly revert: () => void
}

/** How long an offer stands. Long enough to notice, short enough to forget. */
export const UNDO_MS = 8000

let offer: UndoOffer | null = null
let timer: number | undefined
let seq = 0
const listeners = new Set<() => void>()

function emit() {
  for (const listener of listeners) listener()
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  return () => void listeners.delete(listener)
}

export function getUndo(): UndoOffer | null {
  return offer
}

/**
 * Offer to undo what just happened.
 *
 * A second offer replaces the first rather than queueing behind it: the toast
 * shows one thing, and the one it shows should be the one that just happened.
 */
export function offerUndo(label: string, revert: () => void, ms: number = UNDO_MS): void {
  if (timer !== undefined) clearTimeout(timer)
  offer = { seq: ++seq, label, revert }
  timer = setTimeout(clearUndo, ms) as unknown as number
  emit()
}

/** Take the offer. Returns whether there was one, so a shortcut can fall through. */
export function takeUndo(): boolean {
  const current = offer
  clearUndo()
  if (!current) return false
  current.revert()
  return true
}

export function clearUndo(): void {
  if (timer !== undefined) clearTimeout(timer)
  timer = undefined
  if (!offer) return
  offer = null
  emit()
}

export function useUndo(): UndoOffer | null {
  return useSyncExternalStore(subscribe, getUndo, getUndo)
}
