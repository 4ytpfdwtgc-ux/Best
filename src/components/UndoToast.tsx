import { takeUndo, useUndo } from '../state/undo'

/**
 * "Deleted “Packing list”  Undo".
 *
 * Recently Deleted is where something goes to be found later; this is for the
 * half-second after a swipe lands on the wrong row, which is when almost every
 * deletion is regretted. It stands in front of the tab bar, out of the way of
 * the row it is about, and takes ⌘Z as well as a tap.
 */
export function UndoToast() {
  const undo = useUndo()
  if (!undo) return null
  return (
    // Keyed by the offer, so a second deletion replays the entrance animation
    // rather than silently swapping the words.
    <div key={undo.seq} className="toast toast--undo" role="status" aria-live="polite">
      <span className="toast__label">{undo.label}</span>
      <button type="button" className="toast__undo" onClick={() => takeUndo()}>
        Undo
      </button>
    </div>
  )
}
