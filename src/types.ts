/** Core data model shared by the Reminders, Calendar and Notes modules. */

export type ID = string

/** Named accent colors. Keep in sync with `--tint-*` custom properties in theme.css. */
export type TintName =
  | 'red' | 'orange' | 'yellow' | 'green' | 'mint'
  | 'teal' | 'cyan' | 'blue' | 'indigo' | 'purple' | 'pink' | 'brown' | 'gray'

export const TINTS: TintName[] = [
  'red', 'orange', 'yellow', 'green', 'mint',
  'teal', 'cyan', 'blue', 'indigo', 'purple', 'pink', 'brown', 'gray',
]

/* ------------------------------------------------------------------ */
/* Recurrence                                                          */
/* ------------------------------------------------------------------ */

export type Frequency = 'daily' | 'weekly' | 'monthly' | 'yearly'

export interface Recurrence {
  freq: Frequency
  /** Every N periods. 1 = every day/week/month/year. */
  interval: number
  /** For weekly rules: 0 (Sun) – 6 (Sat). Empty/undefined means "same day as start". */
  byWeekday?: number[]
  /** ISO date (yyyy-mm-dd) after which the rule stops producing occurrences. */
  until?: string
}

/* ------------------------------------------------------------------ */
/* Reminders                                                           */
/* ------------------------------------------------------------------ */

export type Priority = 0 | 1 | 2 | 3 // none, low, medium, high

export interface Subtask {
  id: ID
  title: string
  completed: boolean
}

export interface Reminder {
  id: ID
  listId: ID
  title: string
  notes?: string
  url?: string
  /** ISO date `yyyy-mm-dd`. Absent means the reminder is undated. */
  dueDate?: string
  /** `HH:mm` in local time. Only meaningful alongside `dueDate`. */
  dueTime?: string
  /** Minutes before the due moment to alert. */
  alertMinutesBefore?: number
  priority: Priority
  flagged: boolean
  completed: boolean
  completedAt?: string
  tags: ID[]
  subtasks: Subtask[]
  recurrence?: Recurrence
  createdAt: string
  updatedAt: string
  /** Manual ordering within a list. */
  sortIndex: number
}

export interface ReminderList {
  id: ID
  name: string
  tint: TintName
  symbol: string
  /** Groups behave like Apple's list groups; `null` for top-level lists. */
  groupId?: ID | null
  sortIndex: number
}

export interface Tag {
  id: ID
  name: string
  tint: TintName
}

/* ------------------------------------------------------------------ */
/* Calendar                                                            */
/* ------------------------------------------------------------------ */

export interface Calendar {
  id: ID
  name: string
  tint: TintName
  visible: boolean
  sortIndex: number
}

export interface CalendarEvent {
  id: ID
  calendarId: ID
  title: string
  location?: string
  notes?: string
  url?: string
  allDay: boolean
  /** ISO date `yyyy-mm-dd`. */
  startDate: string
  /** `HH:mm`; ignored when `allDay`. */
  startTime?: string
  /** ISO date `yyyy-mm-dd`; inclusive for all-day events. */
  endDate: string
  endTime?: string
  /** Minutes before start to alert; `null`/absent means no alert. */
  alertMinutesBefore?: number | null
  invitees?: string[]
  recurrence?: Recurrence
  createdAt: string
  updatedAt: string
}

/** A single materialized instance of an event (recurrence expanded). */
export interface EventOccurrence {
  event: CalendarEvent
  /** ISO date of this occurrence's start. */
  date: string
  /** Number of days this occurrence spans (>= 1). */
  span: number
  /** Minutes from midnight, for timed events. */
  startMinutes: number
  endMinutes: number
}

/* ------------------------------------------------------------------ */
/* Notes                                                               */
/* ------------------------------------------------------------------ */

export interface Folder {
  id: ID
  name: string
  tint: TintName
  sortIndex: number
}

export interface Note {
  id: ID
  folderId: ID
  /** Plain text with lightweight markup; first line is the title. */
  body: string
  pinned: boolean
  locked: boolean
  tags: ID[]
  createdAt: string
  updatedAt: string
  trashedAt?: string
}

/* ------------------------------------------------------------------ */
/* App state                                                           */
/* ------------------------------------------------------------------ */

export type ModuleName = 'home' | 'reminders' | 'calendar' | 'notes'
export type CalendarViewMode = 'day' | 'week' | 'month' | 'year'
export type ThemeSetting = 'system' | 'light' | 'dark'

/** Smart lists mirror Apple Reminders' built-in filters. */
export type SmartListId = 'today' | 'scheduled' | 'all' | 'flagged' | 'completed'

export interface ReminderSelection {
  kind: 'smart' | 'list' | 'tag'
  id: SmartListId | ID
}

export interface Preferences {
  theme: ThemeSetting
  accent: TintName
  /** 0 = Sunday, 1 = Monday. */
  weekStartsOn: 0 | 1
  showCompleted: boolean
  /** Overlay reminders with due dates onto the calendar. */
  showRemindersOnCalendar: boolean
  use24HourTime: boolean
  notesSort: 'edited' | 'created' | 'title'
}

export interface AppState {
  version: number
  module: ModuleName
  prefs: Preferences

  lists: ReminderList[]
  reminders: Reminder[]
  tags: Tag[]
  reminderSelection: ReminderSelection
  selectedReminderId: ID | null

  calendars: Calendar[]
  events: CalendarEvent[]
  calendarView: CalendarViewMode
  /** ISO date the calendar is focused on. */
  calendarDate: string
  selectedEventId: ID | null

  folders: Folder[]
  notes: Note[]
  selectedFolderId: ID | 'all' | 'trash'
  selectedNoteId: ID | null
}
