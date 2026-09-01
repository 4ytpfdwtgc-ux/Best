import { parseCapture } from '../lib/capture'
import { friendlyDate } from '../lib/date'
import { emptyBlock } from '../lib/blocks'
import { getState } from './store'
import {
  addNote, addReminder, addTag, setModule, setReminderSelection,
  setSelectedFolder, setSelectedNote, setSelectedReminder, updateNote,
} from './actions'

/**
 * Handle a capture handed over in the URL — the bridge an iOS Shortcut uses,
 * so "Hey Siri, add to Cadence" ends up as a task or a page.
 *
 *   ?add=buy%20oat%20milk%20tomorrow%20at%205pm
 *   ?note=thoughts%20on%20the%20redesign
 *
 * Returns a line to confirm with, or `null` when there was nothing to do.
 */
export function applyCapture(search: string): string | null {
  const params = new URLSearchParams(search)
  const task = params.get('add')?.trim()
  const note = params.get('note')?.trim()

  if (task) {
    const parsed = parseCapture(task)
    const tags = parsed.tags.map((name) => addTag(name).id)
    const listParam = params.get('list')?.toLowerCase()
    const list =
      getState().lists.find((l) => l.name.toLowerCase() === listParam) ?? getState().lists[0]

    const created = addReminder({
      listId: list?.id ?? 'list_inbox',
      title: parsed.title,
      dueDate: parsed.dueDate,
      dueTime: parsed.dueTime,
      priority: parsed.priority,
      tags,
    })

    setReminderSelection({ kind: 'list', id: created.listId })
    setSelectedReminder(created.id)
    setModule('reminders')
    const when = [parsed.dueDate && friendlyDate(parsed.dueDate), parsed.dueTime].filter(Boolean).join(' at ')
    return `Added “${parsed.title}”${when ? ` · ${when}` : ''}`
  }

  if (note) {
    // The first line titles the page; anything after it becomes the body.
    // Dictation rarely produces newlines, so fall back to sentences — keeping
    // their punctuation, which a split on the terminator would eat.
    const [first, ...rest] = note.includes('\n')
      ? note.split('\n')
      : (note.match(/[^.!?\n]+[.!?]*/g) ?? [note])
    const created = addNote()
    updateNote(created.id, {
      title: first.trim().replace(/\.$/, '').slice(0, 120),
      blocks: rest.length
        ? rest.filter((line) => line.trim()).map((line) => ({ ...emptyBlock('text'), text: line.trim() }))
        : [emptyBlock('text')],
    })
    setSelectedFolder(created.folderId)
    setSelectedNote(created.id)
    setModule('notes')
    return `Added the page “${first.trim().slice(0, 60)}”`
  }

  return null
}

/** The capture URL for this deployment, shown in Settings for the shortcut. */
export function captureUrlTemplate(kind: 'add' | 'note' = 'add'): string {
  const { origin, pathname } = window.location
  const base = pathname.replace(/index\.html$/, '')
  return `${origin}${base}?${kind}=`
}
