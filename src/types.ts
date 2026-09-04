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
  /** Values for the user-defined properties, keyed by `PropertyDef.id`. */
  props: Record<ID, PropertyValue>
  /** Set when deleted: out of every list, kept for thirty days. */
  trashedAt?: string
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
/* Database properties and views                                       */
/* ------------------------------------------------------------------ */

export type PropertyType = 'select' | 'multiSelect' | 'text' | 'number' | 'checkbox' | 'date' | 'url'

export interface PropertyOption {
  id: ID
  name: string
  tint: TintName
}

/** A user-defined column on the reminder database. */
export interface PropertyDef {
  id: ID
  name: string
  type: PropertyType
  /** `select` and `multiSelect` only. */
  options?: PropertyOption[]
}

export type PropertyValue = string | number | boolean | ID[] | null

export type ViewMode = 'list' | 'board' | 'table' | 'calendar'

/**
 * Fields a view can group, sort or filter by. Built-in fields use a reserved
 * name; anything else is a `PropertyDef` id.
 */
export type FieldRef = 'list' | 'priority' | 'status' | 'due' | 'title' | 'created' | ID

export type FilterOp =
  | 'is'
  | 'isNot'
  | 'contains'
  | 'isEmpty'
  | 'isNotEmpty'
  | 'before'
  | 'after'

export interface Filter {
  id: ID
  field: FieldRef
  op: FilterOp
  value?: string
}

export interface DatabaseView {
  id: ID
  name: string
  mode: ViewMode
  /** `null` shows one ungrouped run of rows. */
  groupBy: FieldRef | null
  sortBy: FieldRef
  sortDir: 'asc' | 'desc'
  filters: Filter[]
  /** Property columns shown in the table view, in order. */
  visibleProps: ID[]
  /** Hide completed reminders in this view. */
  hideCompleted: boolean
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

/** The block types the editor can create, in slash-menu order. */
export type BlockType =
  | 'text'
  | 'h1'
  | 'h2'
  | 'h3'
  | 'todo'
  | 'bullet'
  | 'numbered'
  | 'toggle'
  | 'quote'
  | 'callout'
  | 'divider'
  | 'code'
  | 'image'
  | 'link'
  | 'file'
  | 'table'

/**
 * A block of note content. Blocks are stored flat with an `indent` level
 * rather than nested: it keeps reordering, indenting and keyboard handling
 * simple, and a toggle simply hides the deeper blocks that follow it.
 */
export interface Block {
  id: ID
  type: BlockType
  text: string
  /** Nesting depth, 0 at the top level. */
  indent: number
  /** `todo` only. */
  checked?: boolean
  /** `toggle` only: hides the deeper blocks beneath it. */
  collapsed?: boolean
  /** `callout` background, and the emoji it leads with. */
  tint?: TintName
  icon?: string
  /** `code` only. */
  language?: string
  /**
   * `image` and `file`: the key in the asset store. The bytes live in
   * IndexedDB, never in the saved state. `text` is the caption, or the name.
   */
  assetId?: ID
  /** `image` only: intrinsic size, so the page holds its shape before it loads. */
  imageWidth?: number
  imageHeight?: number
  /** `link` only: the destination. `text` is the card's title. */
  url?: string
  /** `table` only: rows of cells, the first being the header. `text` is a caption. */
  rows?: string[][]
}

export interface Note {
  id: ID
  folderId: ID
  /** The page this one sits inside. Absent at the top level of its folder. */
  parentId?: ID
  /** The page title, shown large at the top and used in lists. */
  title: string
  /** Page icon: a name from the icon set, or an emoji saved by an older build. */
  icon?: string
  blocks: Block[]
  pinned: boolean
  locked: boolean
  tags: ID[]
  createdAt: string
  updatedAt: string
  /** Set when the page is archived: out of the way, but not deleted. */
  archivedAt?: string
  trashedAt?: string
}

/* ------------------------------------------------------------------ */
/* App state                                                           */
/* ------------------------------------------------------------------ */

export type ModuleName = 'home' | 'reminders' | 'calendar' | 'notes'
export type CalendarViewMode = 'day' | 'week' | 'month' | 'year'
export type ThemeSetting = 'system' | 'light' | 'dark'

/** Smart lists mirror Apple Reminders' built-in filters. */
export type SmartListId = 'today' | 'scheduled' | 'all' | 'flagged' | 'completed' | 'trash'

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
  properties: PropertyDef[]
  views: DatabaseView[]
  activeViewId: ID
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
  selectedFolderId: ID | 'all' | 'archive' | 'trash'
  selectedNoteId: ID | null
}
