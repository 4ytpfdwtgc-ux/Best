import type {
  Calendar, CalendarEvent, Folder, ID, ModuleName, Note, Preferences,
  Priority, Reminder, ReminderList, ReminderSelection, Tag, TintName,
  CalendarViewMode,
} from '../types'
import { getState, setState } from './store'
import { uid } from '../lib/id'
import { nowISO, todayISO } from '../lib/date'
import { nextOccurrence } from '../lib/recurrence'

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

export function deleteReminder(id: ID) {
  setState((s) => ({
    reminders: s.reminders.filter((r) => r.id !== id),
    selectedReminderId: s.selectedReminderId === id ? null : s.selectedReminderId,
  }))
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

  updateReminder(id, {
    completed: !reminder.completed,
    completedAt: reminder.completed ? undefined : nowISO(),
  })
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
    reminders: s.reminders.filter((r) => !(r.completed && (!listId || r.listId === listId))),
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
    body: '',
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

export function trashNote(id: ID) {
  setState((s) => ({
    notes: s.notes.map((n) => (n.id === id ? { ...n, trashedAt: nowISO() } : n)),
    selectedNoteId: s.selectedNoteId === id ? null : s.selectedNoteId,
  }))
}

export function restoreNote(id: ID) {
  setState((s) => ({
    notes: s.notes.map((n) => (n.id === id ? { ...n, trashedAt: undefined } : n)),
  }))
}

export function deleteNoteForever(id: ID) {
  setState((s) => ({
    notes: s.notes.filter((n) => n.id !== id),
    selectedNoteId: s.selectedNoteId === id ? null : s.selectedNoteId,
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
  const title = noteTitleOf(n.body)
  return addReminder({
    listId: listId ?? getState().lists[0]?.id ?? 'list_inbox',
    title,
    notes: n.body.split('\n').slice(1).join('\n').trim() || undefined,
  })
}

function addHour(time: string): string {
  const [h, m] = time.split(':').map(Number)
  const total = Math.min(23 * 60 + 59, (h || 0) * 60 + (m || 0) + 60)
  return `${`${Math.floor(total / 60)}`.padStart(2, '0')}:${`${total % 60}`.padStart(2, '0')}`
}

export function noteTitleOf(body: string): string {
  const first = body.split('\n').find((l) => l.trim().length > 0)
  return (first ?? '').replace(/^#{1,3}\s*/, '').replace(/^[-*]\s+\[[ x]\]\s*/i, '').trim() || 'New Note'
}
