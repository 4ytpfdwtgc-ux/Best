import type { AppState, Calendar, CalendarEvent, Folder, Note, Reminder, ReminderList, Tag } from '../types'
import { addDays, nowISO, todayISO } from '../lib/date'
import { uid } from '../lib/id'

/**
 * First-run content. Empty apps are hard to evaluate, so the baseline ships
 * with a small, realistic set of lists, events and notes.
 */
export function createInitialState(): AppState {
  const today = todayISO()
  const now = nowISO()

  const lists: ReminderList[] = [
    { id: 'list_inbox', name: 'Inbox', tint: 'blue', symbol: '📥', sortIndex: 0, groupId: null },
    { id: 'list_work', name: 'Work', tint: 'orange', symbol: '💼', sortIndex: 1, groupId: null },
    { id: 'list_home', name: 'Home', tint: 'green', symbol: '🏡', sortIndex: 2, groupId: null },
    { id: 'list_shop', name: 'Groceries', tint: 'pink', symbol: '🛒', sortIndex: 3, groupId: null },
  ]

  const tags: Tag[] = [
    { id: 'tag_urgent', name: 'urgent', tint: 'red' },
    { id: 'tag_errand', name: 'errand', tint: 'teal' },
    { id: 'tag_focus', name: 'focus', tint: 'indigo' },
  ]

  const r = (partial: Partial<Reminder> & { title: string; listId: string; sortIndex: number }): Reminder => ({
    id: uid('rem'),
    notes: undefined,
    priority: 0,
    flagged: false,
    completed: false,
    tags: [],
    subtasks: [],
    createdAt: now,
    updatedAt: now,
    ...partial,
  })

  const reminders: Reminder[] = [
    r({
      title: 'Ship the baseline build',
      listId: 'list_work',
      sortIndex: 0,
      dueDate: today,
      dueTime: '17:00',
      priority: 3,
      flagged: true,
      tags: ['tag_focus'],
      notes: 'Reminders, Calendar and Notes in one window.',
      subtasks: [
        { id: uid('sub'), title: 'Data model', completed: true },
        { id: uid('sub'), title: 'Month + week views', completed: true },
        { id: uid('sub'), title: 'Quick Find', completed: false },
      ],
    }),
    r({ title: 'Stand-up notes', listId: 'list_work', sortIndex: 1, dueDate: today, dueTime: '09:30', recurrence: { freq: 'weekly', interval: 1, byWeekday: [1, 2, 3, 4, 5] } }),
    r({ title: 'Review design feedback', listId: 'list_work', sortIndex: 2, dueDate: addDays(today, 2), priority: 2 }),
    r({ title: 'Water the plants', listId: 'list_home', sortIndex: 0, dueDate: today, recurrence: { freq: 'daily', interval: 3 }, tags: ['tag_errand'] }),
    r({ title: 'Change the air filter', listId: 'list_home', sortIndex: 1, dueDate: addDays(today, 12), recurrence: { freq: 'monthly', interval: 3 } }),
    r({ title: 'Call the plumber', listId: 'list_home', sortIndex: 2, flagged: true, tags: ['tag_urgent'] }),
    r({ title: 'Oat milk', listId: 'list_shop', sortIndex: 0, tags: ['tag_errand'] }),
    r({ title: 'Coffee beans', listId: 'list_shop', sortIndex: 1, tags: ['tag_errand'] }),
    r({ title: 'Sourdough', listId: 'list_shop', sortIndex: 2, completed: true, completedAt: now }),
    r({ title: 'Book the dentist', listId: 'list_inbox', sortIndex: 0, dueDate: addDays(today, 1), dueTime: '11:00' }),
  ]

  const calendars: Calendar[] = [
    { id: 'cal_personal', name: 'Personal', tint: 'blue', visible: true, sortIndex: 0 },
    { id: 'cal_work', name: 'Work', tint: 'orange', visible: true, sortIndex: 1 },
    { id: 'cal_family', name: 'Family', tint: 'green', visible: true, sortIndex: 2 },
  ]

  const e = (partial: Partial<CalendarEvent> & { title: string; calendarId: string; startDate: string }): CalendarEvent => ({
    id: uid('evt'),
    allDay: false,
    endDate: partial.startDate,
    createdAt: now,
    updatedAt: now,
    ...partial,
  })

  const events: CalendarEvent[] = [
    e({ title: 'Team stand-up', calendarId: 'cal_work', startDate: today, startTime: '09:30', endTime: '09:45', recurrence: { freq: 'weekly', interval: 1, byWeekday: [1, 2, 3, 4, 5] }, alertMinutesBefore: 5 }),
    e({ title: 'Design review', calendarId: 'cal_work', startDate: today, startTime: '13:00', endTime: '14:00', location: 'Studio B' }),
    e({ title: 'Lunch with Sam', calendarId: 'cal_personal', startDate: addDays(today, 1), startTime: '12:30', endTime: '13:30', location: 'Cafe Loro' }),
    e({ title: 'Gym', calendarId: 'cal_personal', startDate: addDays(today, -1), startTime: '07:00', endTime: '08:00', recurrence: { freq: 'weekly', interval: 1, byWeekday: [1, 3, 5] } }),
    e({ title: 'Flight to Lisbon', calendarId: 'cal_personal', startDate: addDays(today, 9), startTime: '06:45', endTime: '10:20', location: 'SFO → LIS' }),
    e({ title: 'Offsite', calendarId: 'cal_work', startDate: addDays(today, 4), endDate: addDays(today, 5), allDay: true }),
    e({ title: "Mom's birthday", calendarId: 'cal_family', startDate: addDays(today, 16), allDay: true, recurrence: { freq: 'yearly', interval: 1 } }),
    e({ title: 'Movie night', calendarId: 'cal_family', startDate: addDays(today, 2), startTime: '19:30', endTime: '21:45' }),
  ]

  const folders: Folder[] = [
    { id: 'fold_notes', name: 'Notes', tint: 'yellow', sortIndex: 0 },
    { id: 'fold_work', name: 'Work', tint: 'orange', sortIndex: 1 },
    { id: 'fold_ideas', name: 'Ideas', tint: 'purple', sortIndex: 2 },
  ]

  const notes: Note[] = [
    {
      id: uid('note'),
      folderId: 'fold_work',
      pinned: true,
      locked: false,
      tags: ['tag_focus'],
      createdAt: now,
      updatedAt: now,
      body: [
        '# Cadence — baseline',
        '',
        'One window for the three things that actually run a week.',
        '',
        '## Shipped',
        '- [x] Shared data model with lightweight recurrence',
        '- [x] Reminders with smart lists, tags and subtasks',
        '- [x] Day / week / month / year calendar views',
        '- [ ] Sync',
        '',
        '> Keyboard: ⌘1/⌘2/⌘3 switch apps, ⌘K opens Quick Find.',
      ].join('\n'),
    },
    {
      id: uid('note'),
      folderId: 'fold_notes',
      pinned: false,
      locked: false,
      tags: [],
      createdAt: now,
      updatedAt: now,
      body: ['Packing list', '', '- [ ] Passport', '- [ ] Charger + adapter', '- [ ] Sunscreen', '- [x] Headphones'].join('\n'),
    },
    {
      id: uid('note'),
      folderId: 'fold_ideas',
      pinned: false,
      locked: false,
      tags: [],
      createdAt: now,
      updatedAt: now,
      body: ['Weekend project ideas', '', '1. A tiny synth in the browser', '2. Rebuild the bookshelf', '3. **Learn to make focaccia**'].join('\n'),
    },
  ]

  return {
    version: 1,
    module: 'home',
    prefs: {
      theme: 'system',
      accent: 'blue',
      weekStartsOn: 0,
      showCompleted: false,
      showRemindersOnCalendar: true,
      use24HourTime: false,
      notesSort: 'edited',
    },
    lists,
    reminders,
    tags,
    reminderSelection: { kind: 'smart', id: 'today' },
    selectedReminderId: null,
    calendars,
    events,
    calendarView: 'month',
    calendarDate: today,
    selectedEventId: null,
    folders,
    notes,
    selectedFolderId: 'all',
    selectedNoteId: notes[0]?.id ?? null,
  }
}
