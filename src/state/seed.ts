import type {
  AppState, Block, Calendar, CalendarEvent, DatabaseView, Folder, Note,
  PropertyDef, Reminder, ReminderList, Tag,
} from '../types'
import { addDays, nowISO, todayISO } from '../lib/date'
import { emptyBlock } from '../lib/blocks'
import { uid } from '../lib/id'

export const SCHEMA_VERSION = 4

/** Ids of the built-in properties, referenced by the seeded views. */
export const PROP = {
  status: 'prop_status',
  effort: 'prop_effort',
  area: 'prop_area',
  estimate: 'prop_estimate',
} as const

/** The Status option ids, which the completion checkbox keeps in step. */
export const STATUS = {
  todo: 'opt_status_todo',
  doing: 'opt_status_doing',
  done: 'opt_status_done',
} as const

export function defaultProperties(): PropertyDef[] {
  return [
    {
      id: PROP.status,
      name: 'Status',
      type: 'select',
      options: [
        { id: STATUS.todo, name: 'Not started', tint: 'gray' },
        { id: STATUS.doing, name: 'In progress', tint: 'blue' },
        { id: STATUS.done, name: 'Done', tint: 'green' },
      ],
    },
    {
      id: PROP.effort,
      name: 'Effort',
      type: 'select',
      options: [
        { id: 'opt_effort_quick', name: 'Quick', tint: 'green' },
        { id: 'opt_effort_medium', name: 'Medium', tint: 'yellow' },
        { id: 'opt_effort_deep', name: 'Deep', tint: 'red' },
      ],
    },
    {
      id: PROP.area,
      name: 'Area',
      type: 'multiSelect',
      options: [
        { id: 'opt_area_work', name: 'Work', tint: 'orange' },
        { id: 'opt_area_home', name: 'Home', tint: 'green' },
        { id: 'opt_area_errands', name: 'Errands', tint: 'teal' },
        { id: 'opt_area_health', name: 'Health', tint: 'purple' },
      ],
    },
    { id: PROP.estimate, name: 'Estimate', type: 'number' },
  ]
}

export function defaultViews(): DatabaseView[] {
  return [
    {
      id: 'view_list',
      name: 'List',
      mode: 'list',
      groupBy: 'due',
      sortBy: 'due',
      sortDir: 'asc',
      filters: [],
      visibleProps: [PROP.status, PROP.area],
      hideCompleted: true,
    },
    {
      id: 'view_board',
      name: 'Board',
      mode: 'board',
      groupBy: PROP.status,
      sortBy: 'due',
      sortDir: 'asc',
      filters: [],
      visibleProps: [PROP.effort, PROP.area],
      hideCompleted: false,
    },
    {
      id: 'view_table',
      name: 'Table',
      mode: 'table',
      groupBy: null,
      sortBy: 'due',
      sortDir: 'asc',
      filters: [],
      visibleProps: [PROP.status, PROP.effort, PROP.area, PROP.estimate],
      hideCompleted: false,
    },
  ]
}

const b = (
  type: Block['type'],
  text: string,
  extra: Partial<Block> = {},
): Block => ({ ...emptyBlock(type), text, ...extra })

/** First-run content. An empty app is hard to judge, so the baseline ships full. */
export function createInitialState(): AppState {
  const today = todayISO()
  const now = nowISO()

  const lists: ReminderList[] = [
    { id: 'list_inbox', name: 'Inbox', tint: 'gray', symbol: 'inbox', sortIndex: 0, groupId: null },
    { id: 'list_work', name: 'Work', tint: 'orange', symbol: 'briefcase', sortIndex: 1, groupId: null },
    { id: 'list_home', name: 'Home', tint: 'green', symbol: 'home', sortIndex: 2, groupId: null },
    { id: 'list_shop', name: 'Groceries', tint: 'pink', symbol: 'cart', sortIndex: 3, groupId: null },
  ]

  const tags: Tag[] = [
    { id: 'tag_urgent', name: 'urgent', tint: 'red' },
    { id: 'tag_errand', name: 'errand', tint: 'teal' },
    { id: 'tag_focus', name: 'focus', tint: 'indigo' },
  ]

  const r = (
    partial: Partial<Reminder> & { title: string; listId: string; sortIndex: number },
  ): Reminder => ({
    id: uid('rem'),
    priority: 0,
    flagged: false,
    completed: false,
    tags: [],
    subtasks: [],
    props: { [PROP.status]: STATUS.todo },
    createdAt: now,
    updatedAt: now,
    ...partial,
  })

  const reminders: Reminder[] = [
    r({
      title: 'Ship the Notion pass',
      listId: 'list_work',
      sortIndex: 0,
      dueDate: today,
      dueTime: '17:00',
      priority: 3,
      flagged: true,
      tags: ['tag_focus'],
      notes: 'Blocks, slash menu, database views.',
      props: { [PROP.status]: STATUS.doing, [PROP.effort]: 'opt_effort_deep', [PROP.area]: ['opt_area_work'], [PROP.estimate]: 240 },
      subtasks: [
        { id: uid('sub'), title: 'Block editor', completed: true },
        { id: uid('sub'), title: 'Board view', completed: true },
        { id: uid('sub'), title: 'Filters', completed: false },
      ],
    }),
    r({
      title: 'Stand-up notes',
      listId: 'list_work',
      sortIndex: 1,
      dueDate: today,
      dueTime: '09:30',
      recurrence: { freq: 'weekly', interval: 1, byWeekday: [1, 2, 3, 4, 5] },
      props: { [PROP.status]: STATUS.todo, [PROP.effort]: 'opt_effort_quick', [PROP.area]: ['opt_area_work'], [PROP.estimate]: 15 },
    }),
    r({
      title: 'Review design feedback',
      listId: 'list_work',
      sortIndex: 2,
      dueDate: addDays(today, 2),
      priority: 2,
      props: { [PROP.status]: STATUS.todo, [PROP.effort]: 'opt_effort_medium', [PROP.area]: ['opt_area_work'] },
    }),
    r({
      title: 'Water the plants',
      listId: 'list_home',
      sortIndex: 0,
      dueDate: today,
      recurrence: { freq: 'daily', interval: 3 },
      tags: ['tag_errand'],
      props: { [PROP.status]: STATUS.todo, [PROP.effort]: 'opt_effort_quick', [PROP.area]: ['opt_area_home'] },
    }),
    r({
      title: 'Change the air filter',
      listId: 'list_home',
      sortIndex: 1,
      dueDate: addDays(today, 12),
      recurrence: { freq: 'monthly', interval: 3 },
      props: { [PROP.status]: STATUS.todo, [PROP.area]: ['opt_area_home'] },
    }),
    r({
      title: 'Call the plumber',
      listId: 'list_home',
      sortIndex: 2,
      flagged: true,
      tags: ['tag_urgent'],
      props: { [PROP.status]: STATUS.doing, [PROP.effort]: 'opt_effort_quick', [PROP.area]: ['opt_area_home', 'opt_area_errands'] },
    }),
    r({ title: 'Oat milk', listId: 'list_shop', sortIndex: 0, tags: ['tag_errand'], props: { [PROP.status]: STATUS.todo, [PROP.area]: ['opt_area_errands'] } }),
    r({ title: 'Coffee beans', listId: 'list_shop', sortIndex: 1, tags: ['tag_errand'], props: { [PROP.status]: STATUS.todo, [PROP.area]: ['opt_area_errands'] } }),
    r({ title: 'Sourdough', listId: 'list_shop', sortIndex: 2, completed: true, completedAt: now, props: { [PROP.status]: STATUS.done, [PROP.area]: ['opt_area_errands'] } }),
    r({
      title: 'Book the dentist',
      listId: 'list_inbox',
      sortIndex: 0,
      dueDate: addDays(today, 1),
      dueTime: '11:00',
      props: { [PROP.status]: STATUS.todo, [PROP.effort]: 'opt_effort_quick', [PROP.area]: ['opt_area_health'] },
    }),
  ]

  const calendars: Calendar[] = [
    { id: 'cal_personal', name: 'Personal', tint: 'blue', visible: true, sortIndex: 0 },
    { id: 'cal_work', name: 'Work', tint: 'orange', visible: true, sortIndex: 1 },
    { id: 'cal_family', name: 'Family', tint: 'green', visible: true, sortIndex: 2 },
  ]

  const e = (
    partial: Partial<CalendarEvent> & { title: string; calendarId: string; startDate: string },
  ): CalendarEvent => ({
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
    { id: 'fold_notes', name: 'Notes', tint: 'gray', sortIndex: 0 },
    { id: 'fold_work', name: 'Work', tint: 'orange', sortIndex: 1 },
    { id: 'fold_ideas', name: 'Ideas', tint: 'purple', sortIndex: 2 },
  ]

  const notes: Note[] = [
    {
      id: uid('note'),
      folderId: 'fold_work',
      title: 'Cadence',
      icon: 'target',
      pinned: true,
      locked: false,
      tags: ['tag_focus'],
      createdAt: now,
      updatedAt: now,
      blocks: [
        b('text', 'One window for the three things that actually run a week.'),
        b('callout', 'Press / on an empty line to insert any block. Drag the handle to reorder.', { tint: 'blue', icon: '💡' }),
        b('h2', 'Shipped'),
        b('todo', 'Shared data model with lightweight recurrence', { checked: true }),
        b('todo', 'Block editor with slash commands', { checked: true }),
        b('todo', 'Board, table and list views', { checked: true }),
        b('todo', 'Sync', { checked: false }),
        b('h2', 'Notes'),
        b('toggle', 'Why blocks are stored flat'),
        b('text', 'An indent level keeps reordering and keyboard handling simple, and a toggle just hides the deeper blocks after it.', { indent: 1 }),
        b('divider', ''),
        b('quote', 'Keyboard: ⌘1–⌘3 switch apps, ⌘K opens search.'),
      ],
    },
    {
      id: uid('note'),
      folderId: 'fold_notes',
      title: 'Packing list',
      icon: 'plane',
      pinned: false,
      locked: false,
      tags: [],
      createdAt: now,
      updatedAt: now,
      blocks: [
        b('todo', 'Passport'),
        b('todo', 'Charger + adapter'),
        b('todo', 'Sunscreen'),
        b('todo', 'Headphones', { checked: true }),
      ],
    },
    {
      id: uid('note'),
      folderId: 'fold_ideas',
      title: 'Weekend projects',
      icon: 'bulb',
      pinned: false,
      locked: false,
      tags: [],
      createdAt: now,
      updatedAt: now,
      blocks: [
        b('numbered', 'A tiny synth in the browser'),
        b('numbered', 'Rebuild the bookshelf'),
        b('numbered', 'Learn to make focaccia'),
        b('code', 'const oven = 250 // °C, as hot as it goes', { language: 'js' }),
      ],
    },
  ]

  return {
    version: SCHEMA_VERSION,
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
    properties: defaultProperties(),
    views: defaultViews(),
    activeViewId: 'view_list',
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
