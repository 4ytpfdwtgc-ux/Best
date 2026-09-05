import type {
  Block, Calendar, CalendarEvent, DatabaseView, Filter, Folder, ID, ModuleName,
  Note, Preferences, Priority, PropertyDef, PropertyOption, PropertyValue,
  Reminder, ReminderList, ReminderSelection, Tag, TintName, CalendarViewMode,
} from '../types'
import { getState, setState } from './store'
import { noteWithDescendants, reorderedSiblings } from '../lib/notes'
import { lingerReminder, releaseReminder } from './linger'
import { uid } from '../lib/id'
import { nowISO, todayISO } from '../lib/date'
import { nextOccurrence } from '../lib/recurrence'
import { emptyBlock, markdownToBlocks } from '../lib/blocks'
import { PROP, STATUS } from './seed'

/* ------------------------------------------------------------------ */
/* Navigation & preferences                                            */
/* ------------------------------------------------------------------ */

export const setModule = (module: ModuleName) => setState({ module })

export const setPrefs = (patch: Partial<Preferences>) =>
  setState((s) => ({ prefs: { ...s.prefs, ...patch } }))

export const setCalendarView = (calendarView: CalendarViewMode) => setState({ calendarView })
export const setCalendarDate = (calendarDate: string) => setState({ calendarDate })
export const setSelectedEvent = (selectedEventId: ID | null) => setState({ selectedEventId })
export const setReminderSelection = (reminderSelection: ReminderSelection) =>
  setState({ reminderSelection, selectedReminderId: null })
export const setSelectedReminder = (selectedReminderId: ID | null) => setState({ selectedReminderId })
export const setSelectedFolder = (selectedFolderId: ID | 'all' | 'trash') =>
  setState({ selectedFolderId })
export const setSelectedNote = (selectedNoteId: ID | null) => setState({ selectedNoteId })

/* ------------------------------------------------------------------ */
/* Reminder lists & tags                                               */
/* ------------------------------------------------------------------ */

export function addList(name: string, tint: TintName, symbol: string): ReminderList {
  const list: ReminderList = {
    id: uid('list'),
    name: name.trim() || 'New List',
    tint,
    symbol,
    groupId: null,
    sortIndex: getState().lists.length,
  }
  setState((s) => ({ lists: [...s.lists, list], reminderSelection: { kind: 'list', id: list.id } }))
  return list
}

export function updateList(id: ID, patch: Partial<ReminderList>) {
  setState((s) => ({ lists: s.lists.map((l) => (l.id === id ? { ...l, ...patch } : l)) }))
}

export function deleteList(id: ID) {
  setState((s) => ({
    lists: s.lists.filter((l) => l.id !== id),
    reminders: s.reminders.filter((r) => r.listId !== id),
    reminderSelection:
      s.reminderSelection.kind === 'list' && s.reminderSelection.id === id
        ? { kind: 'smart', id: 'today' }
        : s.reminderSelection,
  }))
}

export function addTag(name: string, tint: TintName = 'gray'): Tag {
  const clean = name.trim().replace(/^#/, '').toLowerCase()
  const existing = getState().tags.find((t) => t.name === clean)
  if (existing) return existing
  const tag: Tag = { id: uid('tag'), name: clean || 'tag', tint }
  setState((s) => ({ tags: [...s.tags, tag] }))
  return tag
}

export function deleteTag(id: ID) {
  setState((s) => ({
    tags: s.tags.filter((t) => t.id !== id),
    reminders: s.reminders.map((r) =>
      r.tags.includes(id) ? { ...r, tags: r.tags.filter((t) => t !== id) } : r,
    ),
    notes: s.notes.map((n) => (n.tags.includes(id) ? { ...n, tags: n.tags.filter((t) => t !== id) } : n)),
    reminderSelection:
      s.reminderSelection.kind === 'tag' && s.reminderSelection.id === id
        ? { kind: 'smart', id: 'today' }
        : s.reminderSelection,
  }))
}

/* ------------------------------------------------------------------ */
/* Reminders                                                           */
/* ------------------------------------------------------------------ */

export function addReminder(partial: Partial<Reminder> & { listId: ID }): Reminder {
  const now = nowISO()
  const siblings = getState().reminders.filter((r) => r.listId === partial.listId)
  const reminder: Reminder = {
    id: uid('rem'),
    title: '',
    priority: 0 as Priority,
    flagged: false,
    completed: false,
    tags: [],
    subtasks: [],
    props: { [PROP.status]: STATUS.todo },
    createdAt: now,
    updatedAt: now,
    sortIndex: siblings.length,
    ...partial,
  }
  setState((s) => ({ reminders: [...s.reminders, reminder], selectedReminderId: reminder.id }))
  return reminder
}

export function updateReminder(id: ID, patch: Partial<Reminder>) {
  setState((s) => ({
    reminders: s.reminders.map((r) => (r.id === id ? { ...r, ...patch, updatedAt: nowISO() } : r)),
  }))
}

/**
 * Move a task to the trash.
 *
 * A swipe is far easier to trigger by accident than a button in a detail
 * panel, and this is the only destructive gesture in the app, so it has to be
 * recoverable. Pages have worked this way since the swipe went in; tasks did
 * not, and vanished outright.
 */
export function deleteReminder(id: ID) {
  releaseReminder(id)
  setState((s) => ({
    reminders: s.reminders.map((r) => (r.id === id ? { ...r, trashedAt: nowISO() } : r)),
    selectedReminderId: s.selectedReminderId === id ? null : s.selectedReminderId,
  }))
}

export function restoreReminder(id: ID) {
  setState((s) => ({
    reminders: s.reminders.map((r) => {
      if (r.id !== id) return r
      const { trashedAt: _dropped, ...rest } = r
      return rest
    }),
  }))
}

/** Gone for good. The one irreversible action, so it is never a gesture. */
export function destroyReminder(id: ID) {
  releaseReminder(id)
  setState((s) => ({
    reminders: s.reminders.filter((r) => r.id !== id),
    selectedReminderId: s.selectedReminderId === id ? null : s.selectedReminderId,
  }))
}

export function emptyReminderTrash() {
  setState((s) => ({
    reminders: s.reminders.filter((r) => !r.trashedAt),
    selectedReminderId: null,
  }))
}

/** Drop what has sat in the trash past its thirty days. Run once, at launch. */
export function purgeExpiredReminders(days = 30) {
  const cutoff = new Date(Date.now() - days * 86_400_000).toISOString()
  const stale = getState().reminders.some((r) => r.trashedAt && r.trashedAt < cutoff)
  if (!stale) return
  setState((s) => ({ reminders: s.reminders.filter((r) => !r.trashedAt || r.trashedAt >= cutoff) }))
}

/**
 * Toggle completion. Completing a repeating reminder rolls its due date to the
 * next occurrence instead of striking it out, matching Apple Reminders.
 */
export function toggleReminder(id: ID) {
  const reminder = getState().reminders.find((r) => r.id === id)
  if (!reminder) return

  if (!reminder.completed && reminder.recurrence && reminder.dueDate) {
    const next = nextOccurrence(reminder.dueDate, reminder.recurrence, reminder.dueDate)
    if (next) {
      updateReminder(id, {
        dueDate: next,
        completed: false,
        subtasks: reminder.subtasks.map((s) => ({ ...s, completed: false })),
      })
      return
    }
  }

  const completed = !reminder.completed
  updateReminder(id, {
    completed,
    completedAt: completed ? nowISO() : undefined,
    props: { ...reminder.props, [PROP.status]: completed ? STATUS.done : STATUS.todo },
  })
  // Show the result before the row goes; tapping again inside the window undoes it.
  if (completed) lingerReminder(id)
  else releaseReminder(id)
}

/**
 * Set one property value. Status is special: it mirrors the completion
 * checkbox, so dragging a card to Done ticks it and dragging it out unticks it.
 */
export function setProperty(reminderId: ID, propertyId: ID, value: PropertyValue) {
  const reminder = getState().reminders.find((r) => r.id === reminderId)
  if (!reminder) return
  const patch: Partial<Reminder> = { props: { ...reminder.props, [propertyId]: value } }
  if (propertyId === PROP.status) {
    const done = value === STATUS.done
    patch.completed = done
    patch.completedAt = done ? nowISO() : undefined
  }
  updateReminder(reminderId, patch)

  // Status mirrors the checkbox, so it earns the same hold before the row goes.
  if (patch.completed !== undefined && patch.completed !== reminder.completed) {
    if (patch.completed) lingerReminder(reminderId)
    else releaseReminder(reminderId)
  }
}

/* ------------------------------------------------------------------ */
/* Database properties and views                                       */
/* ------------------------------------------------------------------ */

export function addProperty(name: string, type: PropertyDef['type']): PropertyDef {
  const property: PropertyDef = {
    id: uid('prop'),
    name: name.trim() || 'Property',
    type,
    options: type === 'select' || type === 'multiSelect' ? [] : undefined,
  }
  setState((s) => ({
    properties: [...s.properties, property],
    // A new column should be visible where columns are shown.
    views: s.views.map((v) =>
      v.mode === 'table' ? { ...v, visibleProps: [...v.visibleProps, property.id] } : v,
    ),
  }))
  return property
}

export function updateProperty(id: ID, patch: Partial<PropertyDef>) {
  setState((s) => ({ properties: s.properties.map((p) => (p.id === id ? { ...p, ...patch } : p)) }))
}

export function deleteProperty(id: ID) {
  setState((s) => ({
    properties: s.properties.filter((p) => p.id !== id),
    reminders: s.reminders.map((r) => {
      if (!(id in r.props)) return r
      const { [id]: _removed, ...rest } = r.props
      return { ...r, props: rest }
    }),
    views: s.views.map((v) => ({
      ...v,
      visibleProps: v.visibleProps.filter((p) => p !== id),
      groupBy: v.groupBy === id ? null : v.groupBy,
      sortBy: v.sortBy === id ? 'due' : v.sortBy,
      filters: v.filters.filter((f) => f.field !== id),
    })),
  }))
}

/** Add an option to a select property, reusing one that already matches. */
export function addPropertyOption(propertyId: ID, name: string, tint: TintName = 'gray'): PropertyOption | null {
  const property = getState().properties.find((p) => p.id === propertyId)
  if (!property) return null
  const clean = name.trim()
  const existing = property.options?.find((o) => o.name.toLowerCase() === clean.toLowerCase())
  if (existing) return existing
  const option: PropertyOption = { id: uid('opt'), name: clean || 'Option', tint }
  updateProperty(propertyId, { options: [...(property.options ?? []), option] })
  return option
}

export const setActiveView = (activeViewId: ID) => setState({ activeViewId })

export function updateView(id: ID, patch: Partial<DatabaseView>) {
  setState((s) => ({ views: s.views.map((v) => (v.id === id ? { ...v, ...patch } : v)) }))
}

export function addFilter(viewId: ID, filter: Omit<Filter, 'id'>) {
  const view = getState().views.find((v) => v.id === viewId)
  if (!view) return
  updateView(viewId, { filters: [...view.filters, { ...filter, id: uid('flt') }] })
}

export function updateFilter(viewId: ID, filterId: ID, patch: Partial<Filter>) {
  const view = getState().views.find((v) => v.id === viewId)
  if (!view) return
  updateView(viewId, {
    filters: view.filters.map((f) => (f.id === filterId ? { ...f, ...patch } : f)),
  })
}

export function removeFilter(viewId: ID, filterId: ID) {
  const view = getState().views.find((v) => v.id === viewId)
  if (!view) return
  updateView(viewId, { filters: view.filters.filter((f) => f.id !== filterId) })
}

/** Move a reminder onto another value of the field a board is grouped by. */
export function moveToGroup(reminderId: ID, field: string, groupKey: string | null) {
  const reminder = getState().reminders.find((r) => r.id === reminderId)
  if (!reminder) return
  if (field === 'list') {
    if (groupKey) updateReminder(reminderId, { listId: groupKey })
  } else if (field === 'priority') {
    updateReminder(reminderId, { priority: (Number(groupKey) || 0) as Priority })
  } else if (field === 'status') {
    updateReminder(reminderId, { completed: groupKey === 'done' })
  } else {
    const property = getState().properties.find((p) => p.id === field)
    if (!property) return
    setProperty(reminderId, field, property.type === 'multiSelect' ? (groupKey ? [groupKey] : []) : groupKey)
  }
}

export function toggleFlag(id: ID) {
  const r = getState().reminders.find((x) => x.id === id)
  if (r) updateReminder(id, { flagged: !r.flagged })
}

export function addSubtask(reminderId: ID, title: string) {
  const r = getState().reminders.find((x) => x.id === reminderId)
  if (!r) return
  updateReminder(reminderId, {
    subtasks: [...r.subtasks, { id: uid('sub'), title: title.trim() || 'Subtask', completed: false }],
  })
}

export function updateSubtask(reminderId: ID, subtaskId: ID, patch: { title?: string; completed?: boolean }) {
  const r = getState().reminders.find((x) => x.id === reminderId)
  if (!r) return
  updateReminder(reminderId, {
    subtasks: r.subtasks.map((s) => (s.id === subtaskId ? { ...s, ...patch } : s)),
  })
}

export function deleteSubtask(reminderId: ID, subtaskId: ID) {
  const r = getState().reminders.find((x) => x.id === reminderId)
  if (!r) return
  updateReminder(reminderId, { subtasks: r.subtasks.filter((s) => s.id !== subtaskId) })
}

export function clearCompleted(listId?: ID) {
  setState((s) => ({
    reminders: s.reminders.filter(
      (r) => r.trashedAt || !(r.completed && (!listId || r.listId === listId)),
    ),
  }))
}

/* ------------------------------------------------------------------ */
/* Calendars & events                                                  */
/* ------------------------------------------------------------------ */

export function addCalendar(name: string, tint: TintName): Calendar {
  const cal: Calendar = {
    id: uid('cal'),
    name: name.trim() || 'New Calendar',
    tint,
    visible: true,
    sortIndex: getState().calendars.length,
  }
  setState((s) => ({ calendars: [...s.calendars, cal] }))
  return cal
}

export function updateCalendar(id: ID, patch: Partial<Calendar>) {
  setState((s) => ({ calendars: s.calendars.map((c) => (c.id === id ? { ...c, ...patch } : c)) }))
}

export function deleteCalendar(id: ID) {
  setState((s) => ({
    calendars: s.calendars.filter((c) => c.id !== id),
    events: s.events.filter((e) => e.calendarId !== id),
  }))
}

export function toggleCalendarVisible(id: ID) {
  const c = getState().calendars.find((x) => x.id === id)
  if (c) updateCalendar(id, { visible: !c.visible })
}

export function addEvent(partial: Partial<CalendarEvent> & { startDate: string }): CalendarEvent {
  const now = nowISO()
  const calendarId = partial.calendarId ?? getState().calendars[0]?.id ?? 'cal_personal'
  const event: CalendarEvent = {
    id: uid('evt'),
    calendarId,
    title: '',
    allDay: false,
    endDate: partial.startDate,
    createdAt: now,
    updatedAt: now,
    ...partial,
  }
  setState((s) => ({ events: [...s.events, event], selectedEventId: event.id }))
  return event
}

export function updateEvent(id: ID, patch: Partial<CalendarEvent>) {
  setState((s) => ({
    events: s.events.map((e) => (e.id === id ? { ...e, ...patch, updatedAt: nowISO() } : e)),
  }))
}

export function deleteEvent(id: ID) {
  setState((s) => ({
    events: s.events.filter((e) => e.id !== id),
    selectedEventId: s.selectedEventId === id ? null : s.selectedEventId,
  }))
}

/* ------------------------------------------------------------------ */
/* Notes                                                               */
/* ------------------------------------------------------------------ */

export function addFolder(name: string, tint: TintName = 'yellow'): Folder {
  const folder: Folder = {
    id: uid('fold'),
    name: name.trim() || 'New Folder',
    tint,
    sortIndex: getState().folders.length,
  }
  setState((s) => ({ folders: [...s.folders, folder], selectedFolderId: folder.id }))
  return folder
}

export function updateFolder(id: ID, patch: Partial<Folder>) {
  setState((s) => ({ folders: s.folders.map((f) => (f.id === id ? { ...f, ...patch } : f)) }))
}

export function deleteFolder(id: ID) {
  const stamp = nowISO()
  setState((s) => ({
    folders: s.folders.filter((f) => f.id !== id),
    notes: s.notes.map((n) => (n.folderId === id ? { ...n, trashedAt: n.trashedAt ?? stamp } : n)),
    selectedFolderId: s.selectedFolderId === id ? 'all' : s.selectedFolderId,
  }))
}

export function addNote(folderId?: ID): Note {
  const s = getState()
  const target =
    folderId && s.folders.some((f) => f.id === folderId)
      ? folderId
      : typeof s.selectedFolderId === 'string' && s.folders.some((f) => f.id === s.selectedFolderId)
        ? (s.selectedFolderId as ID)
        : (s.folders[0]?.id ?? 'fold_notes')
  const now = nowISO()
  const note: Note = {
    id: uid('note'),
    folderId: target,
    title: '',
    blocks: [emptyBlock('text')],
    pinned: false,
    locked: false,
    tags: [],
    createdAt: now,
    updatedAt: now,
  }
  setState((st) => ({ notes: [note, ...st.notes], selectedNoteId: note.id }))
  return note
}

export function updateNote(id: ID, patch: Partial<Note>) {
  setState((s) => ({
    notes: s.notes.map((n) => (n.id === id ? { ...n, ...patch, updatedAt: nowISO() } : n)),
  }))
}

/*
 * A page carries whatever is nested under it. Leaving the children behind
 * would orphan them into the top level, which is not what "delete this page"
 * means to anyone.
 */
export function trashNote(id: ID) {
  const family = new Set(noteWithDescendants(getState().notes, id))
  const at = nowISO()
  setState((s) => ({
    notes: s.notes.map((n) =>
      family.has(n.id) ? { ...n, trashedAt: at, archivedAt: undefined } : n,
    ),
    selectedNoteId: family.has(s.selectedNoteId ?? '') ? null : s.selectedNoteId,
  }))
}

/** Move a page out of the way without deleting it. */
export function archiveNote(id: ID) {
  const family = new Set(noteWithDescendants(getState().notes, id))
  const at = nowISO()
  setState((s) => ({
    notes: s.notes.map((n) => (family.has(n.id) ? { ...n, archivedAt: at } : n)),
    selectedNoteId: family.has(s.selectedNoteId ?? '') ? null : s.selectedNoteId,
  }))
}

export function unarchiveNote(id: ID) {
  const family = new Set(noteWithDescendants(getState().notes, id))
  setState((s) => ({
    notes: s.notes.map((n) => (family.has(n.id) ? { ...n, archivedAt: undefined } : n)),
  }))
}

export function restoreNote(id: ID) {
  const family = new Set(noteWithDescendants(getState().notes, id))
  setState((s) => ({
    notes: s.notes.map((n) => (family.has(n.id) ? { ...n, trashedAt: undefined } : n)),
  }))
}

export function deleteNoteForever(id: ID) {
  const family = new Set(noteWithDescendants(getState().notes, id))
  setState((s) => ({
    notes: s.notes.filter((n) => !family.has(n.id)),
    selectedNoteId: family.has(s.selectedNoteId ?? '') ? null : s.selectedNoteId,
  }))
}

/**
 * Bring imported notes in as pages.
 *
 * Additive, unlike restoring a backup: nothing already here is touched. Notes
 * that name a folder land in one of that name, created if it does not exist,
 * so an Apple Notes folder structure survives the trip.
 */
export function importNotes(
  imported: { title: string; body: string; folder?: string }[],
  fallbackFolder = 'Imported',
): { pages: number; folders: number } {
  if (!imported.length) return { pages: 0, folders: 0 }

  let foldersMade = 0
  const byName = new Map<string, ID>()
  for (const folder of getState().folders) byName.set(folder.name.trim().toLowerCase(), folder.id)

  const folderFor = (name: string): ID => {
    const key = name.trim().toLowerCase()
    const existing = byName.get(key)
    if (existing) return existing
    const created = addFolder(name)
    byName.set(key, created.id)
    foldersMade++
    return created.id
  }

  const now = nowISO()
  const pages: Note[] = imported.map((note) => ({
    id: uid('note'),
    folderId: folderFor(note.folder?.trim() || fallbackFolder),
    title: note.title.slice(0, 200),
    blocks: markdownToBlocks(note.body),
    pinned: false,
    locked: false,
    tags: [],
    createdAt: now,
    updatedAt: now,
  }))

  setState((s) => ({
    notes: [...s.notes, ...pages],
    selectedNoteId: pages[0]?.id ?? s.selectedNoteId,
    selectedFolderId: pages[0]?.folderId ?? s.selectedFolderId,
  }))
  return { pages: pages.length, folders: foldersMade }
}

/** A new page inside another, in the same folder as its parent. */
export function addSubpage(parentId: ID): Note | undefined {
  const parent = getState().notes.find((n) => n.id === parentId)
  if (!parent) return undefined
  const created = addNote(parent.folderId)
  updateNote(created.id, { parentId })
  return { ...created, parentId }
}

/**
 * Move a page under another, or to the top level.
 *
 * A page cannot be put inside its own descendant: that would cut the branch
 * off the tree entirely, and it would simply stop being reachable.
 */
export function reparentNote(id: ID, parentId: ID | undefined) {
  if (id === parentId) return
  const state = getState()
  if (parentId && noteWithDescendants(state.notes, id).includes(parentId)) return
  const parent = parentId ? state.notes.find((n) => n.id === parentId) : undefined
  if (parentId && !parent) return

  // Whatever is nested under the page follows it into the parent's folder.
  const family = new Set(noteWithDescendants(state.notes, id))
  const folderId = parent?.folderId
  const at = nowISO()
  setState((s) => ({
    notes: s.notes.map((n) => {
      if (!family.has(n.id)) return n
      const moved = folderId ? { ...n, folderId } : n
      return n.id === id ? { ...moved, parentId, updatedAt: at } : moved
    }),
  }))
}

/**
 * Put a page at a particular place among its siblings, under the Manual sort.
 *
 * `beforeId` is the page it should land above, or undefined for the end. The
 * whole level is renumbered rather than a gap being found between two
 * neighbours: a list of pages is short, and numbering it outright means the
 * order can never drift or run out of room between two adjacent values.
 */
export function reorderNote(
  id: ID,
  parentId: ID | undefined,
  beforeId: ID | undefined,
  /*
   * The rows at that level as they are drawn, in order. Taken from the list
   * rather than worked out from the store, because All Notes shows pages from
   * every folder together: an order derived per folder would describe
   * something other than what is on the screen, and a drop would appear to do
   * nothing.
   */
  siblingIds: ID[],
) {
  const state = getState()
  const dragged = state.notes.find((n) => n.id === id)
  if (!dragged) return
  // The same rule as nesting: a page cannot be placed inside its own branch.
  if (parentId && noteWithDescendants(state.notes, id).includes(parentId)) return

  const parent = parentId ? state.notes.find((n) => n.id === parentId) : undefined
  if (parentId && !parent) return
  const folderId = parent?.folderId ?? dragged.folderId

  const known = new Map(state.notes.map((n) => [n.id, n]))
  const siblings = siblingIds.map((sid) => known.get(sid)).filter((n): n is Note => !!n)
  const order = reorderedSiblings(siblings, id, beforeId)
  const position = new Map(order.map((noteId, i) => [noteId, i]))

  // Arriving from elsewhere, the page brings its branch into this folder.
  const family = new Set(noteWithDescendants(state.notes, id))
  const at = nowISO()
  setState((s) => ({
    notes: s.notes.map((n) => {
      const index = position.get(n.id)
      const inFamily = family.has(n.id)
      if (index === undefined && !inFamily) return n
      let next = n
      if (inFamily && n.folderId !== folderId) next = { ...next, folderId }
      if (n.id === id) next = { ...next, parentId, updatedAt: at }
      if (index !== undefined) next = { ...next, sortIndex: index }
      return next
    }),
  }))
}

/**
 * Move a page, and everything under it, into a folder.
 *
 * It lands at that folder's top level: a page dragged out of one folder into
 * another is being taken out of wherever it sat, not put inside something it
 * cannot see.
 */
export function moveNoteToFolder(id: ID, folderId: ID) {
  const state = getState()
  if (!state.folders.some((f) => f.id === folderId)) return
  const family = new Set(noteWithDescendants(state.notes, id))
  const at = nowISO()
  setState((s) => ({
    notes: s.notes.map((n) => {
      if (!family.has(n.id)) return n
      const moved = { ...n, folderId }
      return n.id === id ? { ...moved, parentId: undefined, updatedAt: at } : moved
    }),
  }))
}

export function emptyTrash() {
  setState((s) => ({ notes: s.notes.filter((n) => !n.trashedAt) }))
}

export function toggleNotePin(id: ID) {
  const n = getState().notes.find((x) => x.id === id)
  if (n) updateNote(id, { pinned: !n.pinned })
}

/* ------------------------------------------------------------------ */
/* Cross-module                                                        */
/* ------------------------------------------------------------------ */

/** Turn a reminder into a calendar event on its due date. */
export function scheduleReminderAsEvent(reminderId: ID, calendarId?: ID): CalendarEvent | null {
  const r = getState().reminders.find((x) => x.id === reminderId)
  if (!r) return null
  const date = r.dueDate ?? todayISO()
  return addEvent({
    calendarId: calendarId ?? getState().calendars[0]?.id,
    title: r.title,
    notes: r.notes,
    startDate: date,
    endDate: date,
    allDay: !r.dueTime,
    startTime: r.dueTime,
    endTime: r.dueTime ? addHour(r.dueTime) : undefined,
    recurrence: r.recurrence,
  })
}

/** Create a reminder from a note's title, so a thought becomes a task. */
export function reminderFromNote(noteId: ID, listId?: ID): Reminder | null {
  const n = getState().notes.find((x) => x.id === noteId)
  if (!n) return null
  return addReminder({
    listId: listId ?? getState().lists[0]?.id ?? 'list_inbox',
    title: noteTitle(n),
    notes: n.blocks.map((b) => b.text).filter(Boolean).join('\n').slice(0, 400) || undefined,
  })
}

/* ------------------------------------------------------------------ */
/* Blocks                                                              */
/* ------------------------------------------------------------------ */

/** Replace a note's blocks wholesale; the editor computes the next array. */
export function setBlocks(noteId: ID, blocks: Block[]) {
  updateNote(noteId, { blocks: blocks.length ? blocks : [emptyBlock('text')] })
}

export function updateBlock(noteId: ID, blockId: ID, patch: Partial<Block>) {
  const note = getState().notes.find((n) => n.id === noteId)
  if (!note) return
  setBlocks(noteId, note.blocks.map((b) => (b.id === blockId ? { ...b, ...patch } : b)))
}

/** Insert after `afterId`, or at the end when it is not found. */
export function insertBlock(noteId: ID, afterId: ID | null, block: Block): ID {
  const note = getState().notes.find((n) => n.id === noteId)
  if (!note) return block.id
  const index = afterId ? note.blocks.findIndex((b) => b.id === afterId) : note.blocks.length - 1
  const next = [...note.blocks]
  next.splice(index + 1, 0, block)
  setBlocks(noteId, next)
  return block.id
}

export function removeBlock(noteId: ID, blockId: ID) {
  const note = getState().notes.find((n) => n.id === noteId)
  if (!note) return
  setBlocks(noteId, note.blocks.filter((b) => b.id !== blockId))
}

/** Move a block, and anything nested under it, to a new position. */
export function moveBlock(noteId: ID, blockId: ID, toIndex: number) {
  const note = getState().notes.find((n) => n.id === noteId)
  if (!note) return
  const from = note.blocks.findIndex((b) => b.id === blockId)
  if (from === -1) return

  let end = from + 1
  while (end < note.blocks.length && note.blocks[end].indent > note.blocks[from].indent) end++
  const moving = note.blocks.slice(from, end)
  const rest = [...note.blocks.slice(0, from), ...note.blocks.slice(end)]
  const target = toIndex > from ? toIndex - moving.length : toIndex
  rest.splice(Math.max(0, Math.min(rest.length, target)), 0, ...moving)
  setBlocks(noteId, rest)
}

/** Title of a note, falling back to its first non-empty block. */
export function noteTitle(note: { title: string; blocks: Block[] }): string {
  if (note.title.trim()) return note.title.trim()
  const first = note.blocks.find((b) => b.text.trim() && b.type !== 'divider')
  return first?.text.trim() || 'Untitled'
}

function addHour(time: string): string {
  const [h, m] = time.split(':').map(Number)
  const total = Math.min(23 * 60 + 59, (h || 0) * 60 + (m || 0) + 60)
  return `${`${Math.floor(total / 60)}`.padStart(2, '0')}:${`${total % 60}`.padStart(2, '0')}`
}


