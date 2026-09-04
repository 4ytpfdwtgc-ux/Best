import type {
  AppState, CalendarEvent, DatabaseView, EventOccurrence, FieldRef, ID, Note,
  PropertyDef, Reminder, ReminderSelection, TintName,
} from '../types'
import { addDays, diffDays, friendlyDate, minutesFromTime, todayISO } from '../lib/date'
import { occurrencesInRange } from '../lib/recurrence'
import { noteTitle } from './actions'
import { blocksToText } from '../lib/blocks'
export { noteAncestors, noteTree, noteWithDescendants, type NoteRow } from '../lib/notes'


/* ------------------------------------------------------------------ */
/* Reminders                                                           */
/* ------------------------------------------------------------------ */

export function selectionTitle(s: AppState): string {
  const sel = s.reminderSelection
  if (sel.kind === 'smart') {
    return {
      today: 'Today', scheduled: 'Scheduled', all: 'All',
      flagged: 'Flagged', completed: 'Completed', trash: 'Recently Deleted',
    }[sel.id as 'today']
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
    case 'trash':
      return true
    case 'all':
    default:
      return true
  }
}

/** Reminders for the current selection, ordered the way each view expects. */
/**
 * A trashed task belongs to no list but the trash, whatever else it matches.
 * Every list goes through here rather than remembering to check the stamp.
 */
function selects(r: Reminder, sel: ReminderSelection, today: string): boolean {
  const inTrash = sel.kind === 'smart' && sel.id === 'trash'
  if (!!r.trashedAt !== inTrash) return false
  return matchesSelection(r, sel, today)
}

export function visibleReminders(s: AppState, lingering: ReadonlySet<ID> = new Set()): Reminder[] {
  const today = todayISO()
  const sel = s.reminderSelection
  const showCompleted = sel.kind === 'smart' && sel.id === 'completed' ? true : s.prefs.showCompleted

  return s.reminders
    .filter((r) => selects(r, sel, today))
    .filter((r) => showCompleted || !r.completed || lingering.has(r.id))
    .sort((a, b) => compareReminders(a, b, lingering))
}

export function compareReminders(a: Reminder, b: Reminder, lingering: ReadonlySet<ID> = new Set()): number {
  // A reminder held on screen after being completed keeps its place until it
  // goes; sinking it to the bottom first would make the row jump away from the
  // finger that just ticked it.
  const aDone = a.completed && !lingering.has(a.id)
  const bDone = b.completed && !lingering.has(b.id)
  if (aDone !== bDone) return aDone ? 1 : -1
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
  if (id === 'trash') return s.reminders.filter((r) => r.trashedAt).length
  return s.reminders.filter((r) => {
    if (r.trashedAt) return false
    if (id !== 'completed' && r.completed) return false
    return matchesSelection(r, { kind: 'smart', id: id as 'today' }, today)
  }).length
}

export function countForList(s: AppState, listId: ID): number {
  return s.reminders.filter((r) => r.listId === listId && !r.completed && !r.trashedAt).length
}

export function countForTag(s: AppState, tagId: ID): number {
  return s.reminders.filter((r) => r.tags.includes(tagId) && !r.completed && !r.trashedAt).length
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
  const view = s.selectedFolderId
  const inTrash = view === 'trash'
  const inArchive = view === 'archive'
  return s.notes
    // Trash and Archive are exclusive views; every other view shows neither.
    .filter((n) => (inTrash ? !!n.trashedAt : inArchive ? !!n.archivedAt && !n.trashedAt : !n.trashedAt && !n.archivedAt))
    .filter((n) => inTrash || inArchive || view === 'all' || n.folderId === view)
    .filter((n) => !q || `${n.title} ${blocksToText(n.blocks)}`.toLowerCase().includes(q))
    .sort((a, b) => {
      if (a.pinned !== b.pinned) return a.pinned ? -1 : 1
      if (s.prefs.notesSort === 'title') return noteTitle(a).localeCompare(noteTitle(b))
      const key = s.prefs.notesSort === 'created' ? 'createdAt' : 'updatedAt'
      return a[key] < b[key] ? 1 : -1
    })
}

/** Every picture any page still refers to, trashed and archived ones included. */
export function referencedAssetIds(s: AppState): Set<ID> {
  const ids = new Set<ID>()
  for (const note of s.notes) {
    for (const block of note.blocks) if (block.assetId) ids.add(block.assetId)
  }
  return ids
}

/** Every `[[Page]]` written in a page's blocks, in the order they appear. */
export function wikiLinksIn(note: Note): string[] {
  const found: string[] = []
  for (const block of note.blocks) {
    for (const match of block.text.matchAll(/\[\[([^\]\n]+)\]\]/g)) {
      const name = match[1].trim()
      if (name && !found.includes(name)) found.push(name)
    }
  }
  return found
}

/** A page by its title, matched the way someone typing a link would expect. */
export function findNoteByTitle(s: AppState, title: string): Note | undefined {
  const wanted = title.trim().toLowerCase()
  if (!wanted) return undefined
  return s.notes.find((n) => !n.trashedAt && noteTitle(n).trim().toLowerCase() === wanted)
}

/**
 * Pages that link here.
 *
 * Matched on the title rather than an id, so a link written before its page
 * existed starts working the moment the page is created — which is how the
 * link is usually written in the first place.
 */
export function backlinksTo(s: AppState, note: Note): Note[] {
  const title = noteTitle(note).trim().toLowerCase()
  if (!title) return []
  return s.notes.filter(
    (other) =>
      other.id !== note.id &&
      !other.trashedAt &&
      wikiLinksIn(other).some((name) => name.toLowerCase() === title),
  )
}

export function noteSnippet(note: Note): string {
  const text = blocksToText(note.blocks).trim()
  // When the title came from the first block, do not repeat it in the preview.
  const withoutTitle = note.title.trim() ? text : text.slice(note.title.length)
  return (withoutTitle || text).slice(0, 120) || 'No additional text'
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
    if (r.trashedAt) continue
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
    if (n.trashedAt || n.archivedAt) continue
    if (!`${n.title} ${blocksToText(n.blocks)}`.toLowerCase().includes(q)) continue
    const folder = s.folders.find((f) => f.id === n.folderId)
    hits.push({
      kind: 'note',
      id: n.id,
      title: noteTitle(n),
      subtitle: [folder?.name, noteSnippet(n).slice(0, 48)].filter(Boolean).join(' · '),
      tint: folder?.tint ?? 'gray',
    })
  }

  return hits.slice(0, limit)
}

/* ------------------------------------------------------------------ */
/* Database engine: filter, sort, group                                */
/* ------------------------------------------------------------------ */

export const BUILTIN_FIELDS: { id: FieldRef; name: string }[] = [
  { id: 'title', name: 'Name' },
  { id: 'list', name: 'List' },
  { id: 'due', name: 'Due' },
  { id: 'priority', name: 'Priority' },
  { id: 'status', name: 'Done' },
  { id: 'created', name: 'Created' },
]

export function fieldName(s: AppState, field: FieldRef): string {
  return (
    BUILTIN_FIELDS.find((f) => f.id === field)?.name ??
    s.properties.find((p) => p.id === field)?.name ??
    'Field'
  )
}

export function propertyOf(s: AppState, field: FieldRef): PropertyDef | undefined {
  return s.properties.find((p) => p.id === field)
}

/** A comparable, displayable reading of one field on one reminder. */
export function fieldValue(s: AppState, reminder: Reminder, field: FieldRef): string {
  switch (field) {
    case 'title': return reminder.title
    case 'list': return s.lists.find((l) => l.id === reminder.listId)?.name ?? ''
    case 'due': return reminder.dueDate ?? ''
    case 'priority': return String(reminder.priority)
    case 'status': return reminder.completed ? 'Done' : 'Not done'
    case 'created': return reminder.createdAt
    default: {
      const property = propertyOf(s, field)
      const raw = reminder.props[field]
      if (raw == null || raw === '') return ''
      if (property?.type === 'multiSelect') {
        const ids = Array.isArray(raw) ? raw : []
        return ids
          .map((id) => property.options?.find((o) => o.id === id)?.name ?? '')
          .filter(Boolean)
          .join(', ')
      }
      if (property?.type === 'select') {
        return property.options?.find((o) => o.id === raw)?.name ?? ''
      }
      return String(raw)
    }
  }
}

function matchesFilter(s: AppState, reminder: Reminder, filter: DatabaseView['filters'][number]): boolean {
  const value = fieldValue(s, reminder, filter.field).toLowerCase()
  const target = (filter.value ?? '').toLowerCase()
  switch (filter.op) {
    case 'is': return value === target
    case 'isNot': return value !== target
    case 'contains': return value.includes(target)
    case 'isEmpty': return value === ''
    case 'isNotEmpty': return value !== ''
    case 'before': return !!value && value < target
    case 'after': return !!value && value > target
    default: return true
  }
}

/**
 * Rows for a view: selection, then its filters, then its sort.
 *
 * `lingering` names reminders that were just completed. They survive the
 * hide-completed filter for a beat so the row can be seen crossed out before
 * the list drops it.
 */
export function viewRows(
  s: AppState,
  view: DatabaseView,
  query = '',
  lingering: ReadonlySet<ID> = new Set(),
): Reminder[] {
  const today = todayISO()
  const q = query.trim().toLowerCase()

  return s.reminders
    .filter((r) => selects(r, s.reminderSelection, today))
    .filter((r) => !view.hideCompleted || !r.completed || lingering.has(r.id))
    .filter((r) => view.filters.every((f) => matchesFilter(s, r, f)))
    .filter((r) => !q || `${r.title} ${r.notes ?? ''}`.toLowerCase().includes(q))
    .sort((a, b) => {
      const dir = view.sortDir === 'desc' ? -1 : 1
      if (view.sortBy === 'due') return dir * compareReminders(a, b, lingering)
      if (view.sortBy === 'priority') return dir * (b.priority - a.priority)
      const av = fieldValue(s, a, view.sortBy)
      const bv = fieldValue(s, b, view.sortBy)
      // Empty values sort last regardless of direction, as they do in Notion.
      if (!av !== !bv) return av ? -1 : 1
      return dir * av.localeCompare(bv, undefined, { numeric: true })
    })
}

export interface Group {
  key: string | null
  name: string
  tint?: TintName
  items: Reminder[]
}

/** Split rows into the columns or sections a view's `groupBy` calls for. */
export function groupRows(s: AppState, view: DatabaseView, rows: Reminder[]): Group[] {
  const field = view.groupBy
  if (!field) return [{ key: null, name: 'All', items: rows }]

  if (field === 'due') {
    return groupByDate(rows).map((g) => ({
      key: g.key,
      name: g.label === 'Overdue' || g.label === 'No Date' ? g.label : friendlyDate(g.label),
      tint: g.key === 'overdue' ? ('red' as TintName) : undefined,
      items: g.items,
    }))
  }

  if (field === 'list') {
    const groups: Group[] = s.lists.map((l) => ({
      key: l.id,
      name: l.name,
      tint: l.tint,
      items: rows.filter((r) => r.listId === l.id),
    }))
    return groups.filter((g) => g.items.length || view.mode === 'board')
  }

  if (field === 'priority') {
    const names = ['None', 'Low', 'Medium', 'High']
    const tints: TintName[] = ['gray', 'blue', 'yellow', 'red']
    return [3, 2, 1, 0].map((p) => ({
      key: String(p),
      name: names[p],
      tint: tints[p],
      items: rows.filter((r) => r.priority === p),
    }))
  }

  if (field === 'status') {
    return [
      { key: 'todo', name: 'Not done', tint: 'gray' as TintName, items: rows.filter((r) => !r.completed) },
      { key: 'done', name: 'Done', tint: 'green' as TintName, items: rows.filter((r) => r.completed) },
    ]
  }

  const property = propertyOf(s, field)
  if (!property) return [{ key: null, name: 'All', items: rows }]

  const groups: Group[] = (property.options ?? []).map((option) => ({
    key: option.id,
    name: option.name,
    tint: option.tint,
    items: rows.filter((r) => {
      const raw = r.props[property.id]
      return Array.isArray(raw) ? raw.includes(option.id) : raw === option.id
    }),
  }))

  const ungrouped = rows.filter((r) => {
    const raw = r.props[property.id]
    return Array.isArray(raw) ? raw.length === 0 : raw == null || raw === ''
  })
  if (ungrouped.length || view.mode === 'board') {
    groups.push({ key: null, name: 'No ' + property.name, tint: 'gray', items: ungrouped })
  }
  return groups
}

/** The option a select-ish value refers to, for rendering a tag. */
export function optionsFor(property: PropertyDef, value: PropertyValueLike): PropertyOptionLike[] {
  if (!property.options) return []
  const ids = Array.isArray(value) ? value : value == null || value === '' ? [] : [value]
  return ids
    .map((id) => property.options?.find((o) => o.id === id))
    .filter((o): o is PropertyOptionLike => !!o)
}

type PropertyValueLike = string | number | boolean | ID[] | null | undefined
type PropertyOptionLike = { id: ID; name: string; tint: TintName }
