import type { AppState, Note, Reminder } from '../types.ts'
import { blocksToMarkdown } from './blocks.ts'
import { formatTime, friendlyDate } from './date.ts'

/**
 * Handing work to someone else.
 *
 * Real sharing — two people editing the same page, a list that stays in step —
 * needs a server: an account to own the document, somewhere to store it, and a
 * way to merge two edits. None of that is reachable from a static app with no
 * backend, and pretending otherwise would be worse than not having it.
 *
 * What is reachable is a one-way copy. These produce plain text that goes
 * anywhere: a message, an email, another app's editor.
 */

/** A page as markdown, ready to paste anywhere. */
export function noteToMarkdown(note: Note, title: string): string {
  const body = blocksToMarkdown(note.blocks).trim()
  return [`# ${title}`, '', body].join('\n').trimEnd() + '\n'
}

/** A list of tasks as a plain checklist. */
export function remindersToText(
  reminders: Reminder[],
  heading: string,
  use24HourTime = false,
): string {
  const lines = reminders.map((r) => {
    const when = r.dueDate
      ? ` — ${friendlyDate(r.dueDate)}${r.dueTime ? `, ${formatTime(r.dueTime, use24HourTime)}` : ''}`
      : ''
    const priority = r.priority > 0 ? ` ${'!'.repeat(r.priority)}` : ''
    return `- [${r.completed ? 'x' : ' '}] ${r.title || 'Untitled'}${priority}${when}`
  })
  return [`# ${heading}`, '', ...(lines.length ? lines : ['Nothing here.'])].join('\n') + '\n'
}

/** A filename that says what it is and sorts by date. */
export function shareFilename(title: string, extension: string, now = new Date()): string {
  const slug =
    title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 48) || 'cadence'
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${slug}-${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}.${extension}`
}

/** Everything a page refers to that will not travel with its text. */
export function unshareableCount(state: AppState, note: Note): number {
  return note.blocks.filter((b) => b.assetId).length + countChildren(state, note)
}

function countChildren(state: AppState, note: Note): number {
  return state.notes.filter((n) => n.parentId === note.id && !n.trashedAt).length
}
