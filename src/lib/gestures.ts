/**
 * How hard you have to mean it.
 *
 * Every gesture in the app used to carry its own thresholds, which meant
 * "the app is too twitchy" had no single answer. They live here instead, and
 * SENSITIVITY scales all of them at once: below 1 a gesture asks for more
 * movement and a longer hold before it engages.
 */

/**
 * 0.7 — thirty percent less sensitive than the first tuning, which fired on
 * the smallest stray movement while scrolling a list or a calendar.
 */
export const SENSITIVITY = 0.7

/** More movement is less sensitive, so distances scale inversely. */
function harder(base: number): number {
  return Math.round(base / SENSITIVITY)
}

/* ------------------------------------------------------------------ */
/* Distances, in pixels                                                */
/* ------------------------------------------------------------------ */

/** Movement before a sideways drag counts as a swipe rather than a tap. */
export const SWIPE_SLOP = harder(8)
/** Past this, letting go performs the swipe's action. */
export const SWIPE_COMMIT = harder(72)
/** Movement before a mouse drag starts moving something. */
export const DRAG_SLOP = harder(4)
/** The same for a finger, which is far less precise than a pointer. */
export const TOUCH_SLOP = harder(8)

/* ------------------------------------------------------------------ */
/* Time, in milliseconds                                               */
/* ------------------------------------------------------------------ */

/**
 * How long a finger holds still before a drag begins on something the page
 * also scrolls. Longer is less sensitive, so this scales the other way.
 */
export const TOUCH_HOLD_MS = Math.round(350 / SENSITIVITY)

/**
 * The same for a mouse, which has no scrolling to compete with and so needs
 * only enough of a pause to say "pick this up" rather than "swipe it".
 */
export const MOUSE_HOLD_MS = Math.round(180 / SENSITIVITY)

/* ------------------------------------------------------------------ */
/* Swipe animation                                                     */
/* ------------------------------------------------------------------ */

/** A row springing back to where it started. */
export const SWIPE_SETTLE_MS = 220
/** A row leaving sideways, before its space closes up. */
export const SWIPE_EXIT_MS = 260
/** The gap closing after it has gone. */
export const SWIPE_COLLAPSE_MS = 200
/** Deceleration curve; a row should arrive rather than stop dead. */
export const SWIPE_EASE = 'cubic-bezier(0.22, 0.61, 0.36, 1)'

/**
 * Fired on window when one gesture takes over from another.
 *
 * A note row is both a swipe row and something that can be picked up and
 * moved, and one pointer reaches both handlers. Rather than overload
 * `pointercancel` — which every one of them listens for, including the sender
 * — the winner says so explicitly and the others let go.
 */
export const RELEASE_GESTURES = 'cadence:release-gestures'

export function releaseOtherGestures(): void {
  window.dispatchEvent(new Event(RELEASE_GESTURES))
}

/* ------------------------------------------------------------------ */
/* Keeping a gesture clear of text selection                           */
/* ------------------------------------------------------------------ */

/** Set on the root while a gesture owns the pointer. */
export const DRAGGING_CLASS = 'is-gesturing'

let suppressions = 0

/**
 * Stop the browser selecting text while a gesture is running.
 *
 * A press-and-hold is how a page is picked up, and it is also how every
 * platform starts selecting text — on iOS it raises the magnifier and the
 * copy/paste callout as well. So the two fire together and the drag happens
 * underneath a growing blue highlight.
 *
 * Nested gestures are counted rather than assumed away, so one ending does not
 * lift the suppression another still needs. Returns the release.
 */
export function suppressSelection(): () => void {
  suppressions++
  if (suppressions === 1) {
    document.documentElement.classList.add(DRAGGING_CLASS)
    document.addEventListener('selectstart', preventSelect)
  }
  // Anything already selected when the gesture began goes too, or it stays
  // highlighted behind the drag.
  const selection = window.getSelection()
  if (selection && !selection.isCollapsed) selection.removeAllRanges()

  let released = false
  return () => {
    if (released) return
    released = true
    suppressions = Math.max(0, suppressions - 1)
    if (suppressions === 0) {
      document.documentElement.classList.remove(DRAGGING_CLASS)
      document.removeEventListener('selectstart', preventSelect)
    }
  }
}

function preventSelect(e: Event) {
  e.preventDefault()
}

/* ------------------------------------------------------------------ */
/* Keeping a gesture clear of the browser's own scrolling              */
/* ------------------------------------------------------------------ */

let holds = 0

/**
 * Stop the browser scrolling the page out from under a gesture.
 *
 * A row that can be dragged still has to let the list scroll through it, so it
 * allows the vertical pan (`touch-action: pan-y`). The moment a finger moves
 * the browser takes that pan for itself and sends `pointercancel` — which for a
 * drag that has already engaged means the highlight vanishes mid-gesture and
 * nothing is dropped.
 *
 * `touch-action` is read once when a finger lands, so changing it now would not
 * help. Preventing the moves does: a drag engages from a finger held still, so
 * the browser has not begun scrolling yet and the first move is still
 * cancelable. Refusing it means the scroll never starts.
 *
 * Counted like the selection suppression above, and returns the release.
 */
export function holdGesture(): () => void {
  holds++
  if (holds === 1) document.addEventListener('touchmove', preventScroll, { passive: false, capture: true })

  let released = false
  return () => {
    if (released) return
    released = true
    holds = Math.max(0, holds - 1)
    if (holds === 0) document.removeEventListener('touchmove', preventScroll, { capture: true })
  }
}

function preventScroll(e: Event) {
  if (e.cancelable) e.preventDefault()
}

/**
 * What a drag needs the moment it engages: no text selection underneath it,
 * and no scrolling out from under it. Returns the release for both.
 */
export function beginDrag(): () => void {
  const selection = suppressSelection()
  const scroll = holdGesture()
  return () => {
    selection()
    scroll()
  }
}
