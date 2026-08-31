import type {
  AppState, CalendarEvent, EventOccurrence, ID, Note, Reminder, ReminderSelection,
} from '../types'
import { addDays, diffDays, friendlyDate, minutesFromTime, todayISO } from '../lib/date'
import { occurrencesInRange } from '../lib/recurrence'
import { noteTitleOf } from './actions'

/* ------------------------------------------------------------------ */
/* Reminders                                                           */
/* ------------------------------------------------------------------ */

export function selectionTitle(s: AppState): string {
  const sel = s.reminderSelection
  if (sel.kind === 'smart') {
    return { today: 'Today', scheduled: 'Scheduled', all: 'All', flagged: 'Flagged', completed: 'Completed' }[
      sel.id as 'today'
    ]
  }
  if (sel.kind === 'list') return s.lists.find((l) => l.id === sel.id)?.name ?? 'List'
  return `#${s.tags.find((t) => t.id === sel.id)?.name ?? 'tag'}`
}

export function selectionTint(s: AppState): string {
  const sel = s.reminderSelection
  if (sel.kind === 'list') return s.lists.find((l) => l.id === sel.id)?.tint ?? 'blue'
  if (sel.kind === 'tag') return s.tags.find((t) => t.id === sel.id)?.tint ?? 'gray'
  return { today: 'blue', scheduled: 'red', all: 'gray', flagged: 'orange', completed: 'gray' }[
    sel.id as 'today'
  ]
}

function matchesSelection(r: Reminder, sel: ReminderSelection, today: string): boolean {
  if (sel.kind === 'list') return r.listId === sel.id
  if (sel.kind === 'tag') return r.tags.includes(sel.id)
  switch (sel.id) {
    case 'today':
      return !!r.dueDate && r.dueDate <= today
    case 'scheduled':
      return !!r.dueDate
    case 'flagged':
      return r.flagged
    case 'completed':
      return r.completed
    case 'all':
    default:
      return true
  }
}

/** Reminders for the current selection, ordered the way each view expects. */
export function visibleReminders(s: AppState): Reminder[] {
  const today = todayISO()
  const sel = s.reminderSelection
  const showCompleted = sel.kind === 'smart' && sel.id === 'completed' ? true : s.prefs.showCompleted

  return s.reminders
    .filter((r) => matchesSelection(r, sel, today))
    .filter((r) => showCompleted || !r.completed)
    .sort(compareReminders)
}

export function compareReminders(a: Reminder, b: Reminder): number {
  if (a.completed !== b.completed) return a.completed ? 1 : -1
  if (a.dueDate && b.dueDate) {
    if (a.dueDate !== b.dueDate) return a.dueDate < b.dueDate ? -1 : 1
    const at = minutesFromTime(a.dueTime, 24 * 60)
    const bt = minutesFromTime(b.dueTime, 24 * 60)
    if (at !== bt) return at - bt
  } else if (a.dueDate !== b.dueDate) {
    return a.dueDate ? -1 : 1
  }
  if (a.priority !== b.priority) return b.priority - a.priority
  return a.sortIndex - b.sortIndex
}

export function countForSmartList(s: AppState, id: string): number {
  const today = todayISO()
  return s.reminders.filter((r) => {
    if (id !== 'completed' && r.completed) return false
    return matchesSelection(r, { kind: 'smart', id: id as 'today' }, today)
  }).length
}

export function countForList(s: AppState, listId: ID): number {
  return s.reminders.filter((r) => r.listId === listId && !r.completed).length
}

export function countForTag(s: AppState, tagId: ID): number {
  return s.reminders.filter((r) => r.tags.includes(tagId) && !r.completed).length
}

/** Group scheduled reminders under date headings. */
export function groupByDate(reminders: Reminder[]): { key: string; label: string; items: Reminder[] }[] {
  const today = todayISO()
  const buckets = new Map<string, Reminder[]>()
  for (const r of reminders) {
    const key = !r.dueDate ? 'none' : r.dueDate < today ? 'overdue' : r.dueDate
    const bucket = buckets.get(key)
    if (bucket) bucket.push(r)
    else buckets.set(key, [r])
  }
  const keys = [...buckets.keys()].sort((a, b) => {
    const rank = (k: string) => (k === 'overdue' ? 0 : k === 'none' ? 2 : 1)
    return rank(a) - rank(b) || (a < b ? -1 : a > b ? 1 : 0)
  })
  return keys.map((key) => ({
    key,
    label: key === 'overdue' ? 'Overdue' : key === 'none' ? 'No Date' : key,
    items: buckets.get(key)!,
  }))
}

/* ------------------------------------------------------------------ */
/* Calendar                                                            */
/* ------------------------------------------------------------------ */

/** Expand events (including recurrences) into occurrences overlapping a range. */
export function occurrencesBetween(
  s: AppState,
  rangeStart: string,
  rangeEnd: string,
): EventOccurrence[] {
  const visible = new Set(s.calendars.filter((c) => c.visible).map((c) => c.id))
  const out: EventOccurrence[] = []

  for (const event of s.events) {
    if (!visible.has(event.calendarId)) continue
    const span = Math.max(1, diffDays(event.startDate, event.endDate) + 1)
    // Widen the search window so multi-day events starting before the range appear.
    const searchStart = addDays(rangeStart, -(span - 1))
    for (const date of occurrencesInRange(event.startDate, event.recurrence, searchStart, rangeEnd)) {
      out.push({
        event,
        date,
        span,
        startMinutes: event.allDay ? 0 : minutesFromTime(event.startTime, 0),
        endMinutes: event.allDay ? 24 * 60 : minutesFromTime(event.endTime, minutesFromTime(event.startTime, 0) + 60),
      })
    }
  }

  return out.sort(
    (a, b) =>
      (a.date < b.date ? -1 : a.date > b.date ? 1 : 0) ||
      Number(b.event.allDay) - Number(a.event.allDay) ||
      a.startMinutes - b.startMinutes,
  )
}

/** Occurrences touching a specific day (multi-day events included). */
export function occurrencesOnDay(all: EventOccurrence[], date: string): EventOccurrence[] {
  return all.filter((o) => {
    const end = addDays(o.date, o.span - 1)
    return o.date <= date && date <= end
  })
}

/** Lay timed occurrences out into non-overlapping columns for day/week views. */
export function layoutColumns(items: EventOccurrence[]): { occ: EventOccurrence; col: number; cols: number }[] {
  const timed = items.filter((o) => !o.event.allDay).sort((a, b) => a.startMinutes - b.startMinutes)
  const result: { occ: EventOccurrence; col: number; cols: number }[] = []
  let cluster: typeof result = []
  let clusterEnd = -1

  const flush = () => {
    const cols = cluster.reduce((max, c) => Math.max(max, c.col + 1), 0)
    cluster.forEach((c) => (c.cols = cols))
    result.push(...cluster)
    cluster = []
    clusterEnd = -1
  }

  for (const occ of timed) {
    if (occ.startMinutes >= clusterEnd && cluster.length) flush()
    const used = new Set(cluster.filter((c) => c.occ.endMinutes > occ.startMinutes).map((c) => c.col))
    let col = 0
    while (used.has(col)) col++
    cluster.push({ occ, col, cols: 1 })
    clusterEnd = Math.max(clusterEnd, occ.endMinutes)
  }
  if (cluster.length) flush()
  return result
}

/* ------------------------------------------------------------------ */
/* Notes                                                               */
/* ------------------------------------------------------------------ */

export function visibleNotes(s: AppState, query = ''): Note[] {
  const q = query.trim().toLowerCase()
  const inTrash = s.selectedFolderId === 'trash'
  return s.notes
    .filter((n) => (inTrash ? !!n.trashedAt : !n.trashedAt))
    .filter((n) => inTrash || s.selectedFolderId === 'all' || n.folderId === s.selectedFolderId)
    .filter((n) => !q || n.body.toLowerCase().includes(q))
    .sort((a, b) => {
      if (a.pinned !== b.pinned) return a.pinned ? -1 : 1
      if (s.prefs.notesSort === 'title') return noteTitleOf(a.body).localeCompare(noteTitleOf(b.body))
      const key = s.prefs.notesSort === 'created' ? 'createdAt' : 'updatedAt'
      return a[key] < b[key] ? 1 : -1
    })
}

export function noteSnippet(body: string): string {
  const lines = body.split('\n')
  const firstIdx = lines.findIndex((l) => l.trim().length > 0)
  const rest = lines
    .slice(firstIdx + 1)
    .map((l) => l.replace(/^#{1,3}\s*/, '').replace(/^[-*]\s+\[[ x]\]\s*/i, '').replace(/^[-*>]\s*/, ''))
    .filter((l) => l.trim().length > 0)
    .join(' ')
  return rest.slice(0, 120) || 'No additional text'
}

/* ------------------------------------------------------------------ */
/* Unified search (Quick Find)                                         */
/* ------------------------------------------------------------------ */

export interface SearchHit {
  kind: 'reminder' | 'event' | 'note'
  id: ID
  title: string
  subtitle: string
  tint: string
}

export function search(s: AppState, query: string, limit = 20): SearchHit[] {
  const q = query.trim().toLowerCase()
  if (!q) return []
  const hits: SearchHit[] = []

  for (const r of s.reminders) {
    if (!`${r.title} ${r.notes ?? ''}`.toLowerCase().includes(q)) continue
    const list = s.lists.find((l) => l.id === r.listId)
    hits.push({
      kind: 'reminder',
      id: r.id,
      title: r.title || 'Untitled reminder',
      subtitle: [list?.name, r.dueDate && friendlyDate(r.dueDate)].filter(Boolean).join(' · '),
      tint: list?.tint ?? 'blue',
    })
  }

  for (const e of s.events as CalendarEvent[]) {
    if (!`${e.title} ${e.location ?? ''} ${e.notes ?? ''}`.toLowerCase().includes(q)) continue
    const cal = s.calendars.find((c) => c.id === e.calendarId)
    hits.push({
      kind: 'event',
      id: e.id,
      title: e.title || 'Untitled event',
      subtitle: [cal?.name, friendlyDate(e.startDate)].filter(Boolean).join(' · '),
      tint: cal?.tint ?? 'blue',
    })
  }

  for (const n of s.notes) {
    if (n.trashedAt || !n.body.toLowerCase().includes(q)) continue
    const folder = s.folders.find((f) => f.id === n.folderId)
    hits.push({
      kind: 'note',
      id: n.id,
      title: noteTitleOf(n.body),
      subtitle: [folder?.name, noteSnippet(n.body).slice(0, 48)].filter(Boolean).join(' · '),
      tint: folder?.tint ?? 'yellow',
    })
  }

  return hits.slice(0, limit)
}
