/**
 * Taking records out of a list and putting them back where they were.
 *
 * Undoing a deletion is mostly this: the action notes which records it is
 * about to remove and where they sat, and the undo splices them back in.
 * Appending would do for anything the app sorts before drawing, but lists,
 * folders and calendars are drawn in stored order, and a restored one arriving
 * at the bottom of the sidebar is not what "undo" means.
 */

export interface Taken<T> {
  /** Where it was, in the array it came out of. */
  at: number
  item: T
}

/** The records an action is about to remove, with their positions. */
export function pluck<T>(items: readonly T[], gone: (item: T) => boolean): Taken<T>[] {
  const taken: Taken<T>[] = []
  items.forEach((item, at) => {
    if (gone(item)) taken.push({ at, item })
  })
  return taken
}

/**
 * Put them back.
 *
 * Ascending order, so each insertion makes room for the next: two records
 * taken from positions 1 and 3 go back to 1 and 3, not 1 and 2. A position
 * past the end of what is there now -- because something else was deleted in
 * the meantime -- lands at the end rather than being dropped.
 */
export function spliceBack<T>(items: readonly T[], taken: readonly Taken<T>[]): T[] {
  const next = [...items]
  for (const { at, item } of taken) next.splice(Math.min(Math.max(at, 0), next.length), 0, item)
  return next
}
