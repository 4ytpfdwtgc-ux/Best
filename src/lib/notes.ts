import type { ID, Note } from '../types.ts'

/**
 * Pages nested inside pages.
 *
 * The tree is derived rather than stored: a page keeps only its parent's id,
 * so moving one is a single field and nothing can fall out of step with a
 * separate list of children.
 */

export interface NoteRow {
  note: Note
  depth: number
  hasChildren: boolean
}

/**
 * Arrange visible pages as a tree.
 *
 * Every page starts folded shut and only opens when its own control is
 * tapped. Nothing expands a branch on its own: a list that rearranges itself
 * while you are reading it is worse than one you have to open.
 *
 * A page whose parent is not itself visible — filtered out by a search, or
 * sitting in another folder — is shown at the top level rather than hidden
 * under a parent that is not there. Depth is capped so a deep chain cannot
 * indent a row off the side of a phone.
 */
export function noteTree(notes: Note[], expanded: ReadonlySet<ID>, maxDepth = 4): NoteRow[] {
  const present = new Set(notes.map((n) => n.id))
  const children = new Map<ID | 'root', Note[]>()
  for (const note of notes) {
    const key = note.parentId && present.has(note.parentId) ? note.parentId : 'root'
    const bucket = children.get(key)
    if (bucket) bucket.push(note)
    else children.set(key, [note])
  }

  /*
   * Which pages hang off a root at all, ignoring what is folded shut. A cycle
   * has no root — every page in the ring has a parent — so none of its pages
   * would be reached, and they would silently disappear from their own list.
   * That cannot be made through the UI, but a hand-edited backup could carry
   * one, and vanishing is far worse than being shown at the wrong depth.
   */
  const reachable = new Set<ID>()
  const mark = (key: ID | 'root') => {
    for (const note of children.get(key) ?? []) {
      if (reachable.has(note.id)) continue
      reachable.add(note.id)
      mark(note.id)
    }
  }
  mark('root')

  const rows: NoteRow[] = []
  const walk = (key: ID | 'root', depth: number) => {
    for (const note of children.get(key) ?? []) {
      const kids = children.get(note.id) ?? []
      rows.push({ note, depth: Math.min(depth, maxDepth), hasChildren: kids.length > 0 })
      // Folded shut unless this page has been opened by hand.
      if (kids.length && expanded.has(note.id)) walk(note.id, depth + 1)
    }
  }
  walk('root', 0)

  for (const note of notes) {
    if (reachable.has(note.id)) continue
    rows.push({ note, depth: 0, hasChildren: (children.get(note.id) ?? []).length > 0 })
  }
  return rows
}

/** A page and everything nested under it, so an action can take the lot. */
export function noteWithDescendants(notes: Note[], id: ID): ID[] {
  const ids = [id]
  for (let i = 0; i < ids.length; i++) {
    for (const note of notes) {
      if (note.parentId === ids[i] && !ids.includes(note.id)) ids.push(note.id)
    }
  }
  return ids
}

/** The pages above this one, outermost first. */
export function noteAncestors(notes: Note[], note: Note): Note[] {
  const chain: Note[] = []
  const seen = new Set<ID>([note.id])
  let current = note.parentId
  while (current && !seen.has(current)) {
    const parent = notes.find((n) => n.id === current)
    if (!parent) break
    chain.unshift(parent)
    seen.add(parent.id)
    current = parent.parentId
  }
  return chain
}

/**
 * Whether a page can be dropped onto another.
 *
 * A page cannot go inside itself or inside anything already nested under it:
 * that would cut the branch off the tree, and it would simply stop being
 * reachable. `into` of undefined means the top level, which is always allowed.
 */
export function canDropPage(notes: Note[], dragId: ID, into: ID | undefined): boolean {
  if (!dragId) return false
  if (into === dragId) return false
  const dragged = notes.find((n) => n.id === dragId)
  if (!dragged) return false
  // Dropping where it already is changes nothing, so it is not offered.
  if ((dragged.parentId ?? undefined) === into) return false
  if (!into) return true
  if (!notes.some((n) => n.id === into)) return false
  return !noteWithDescendants(notes, dragId).includes(into)
}
