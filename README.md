# Cadence

An all-in-one **Reminders**, **Calendar** and **Notes** app in a single window,
borrowing the interaction model of Apple's three apps. This is the baseline to
build on: everything runs locally in the browser with no backend.

```bash
npm install
npm run dev        # http://localhost:5173
npm test           # date + recurrence unit tests
npm run build      # typecheck, then production build into dist/
```

## What's in the baseline

### Shell
- A vertical app rail switches between the three apps (`⌘1` / `⌘2` / `⌘3`).
- **Quick Find** (`⌘K` or `/`) searches reminders, events and notes at once and
  jumps straight to the hit.
- Light / dark / system themes, a system-tint accent picker, week-start,
  12- vs 24-hour time, all in Settings (`⌘,`).
- State persists to `localStorage` and is restored on launch.

### Reminders
- Smart lists — Today, Scheduled, All, Flagged — with live counts, plus custom
  lists with a color and symbol, and tags.
- Per-reminder: notes, due date and time, alert, priority, flag, URL, tags and
  subtasks.
- Repeating reminders roll their due date forward when completed instead of
  being struck out, the way Apple Reminders behaves.
- Scheduled and Today group under date headings, with overdue called out.
- "Schedule" turns a reminder into a calendar event in one click.

### Calendar
- Day, week, month and year views (`D` / `W` / `M` / `Y`), arrow keys to step,
  `⌘T` for today.
- A week/day time grid with overlapping-event column layout, an all-day band and
  a live current-time indicator.
- Multiple calendars with colors and per-calendar visibility, plus a sidebar
  mini-month that dots the days with something on them.
- Events carry location, notes, URL, alert and a repeat rule.
- Reminders with due dates optionally overlay the calendar.

### Notes
- Folders, pinning, search, sort by edited / created / title, and a Recently
  Deleted folder with recover and delete-forever.
- A lightweight markup dialect (titles, headings, checklists, bulleted and
  numbered lists, quotes, bold, italic, code) with a formatting bar, a rendered
  view whose checkboxes are clickable, and automatic list continuation on Enter.
- "Make a reminder from this note" pushes a thought into Reminders.

## Keyboard

| Shortcut | Action |
| --- | --- |
| `⌘1` `⌘2` `⌘3` | Switch between Reminders, Calendar, Notes |
| `⌘K` or `/` | Quick Find |
| `⌘N` | New reminder / event / note |
| `⌘T` | Jump to today (Calendar) |
| `D` `W` `M` `Y` | Calendar view (Day / Week / Month / Year) |
| `←` `→` | Previous / next period (Calendar) |
| `⇧⌘S` | Toggle the sidebar |
| `⌘,` | Settings |
| `⌘B` `⌘I` `⇧⌘L` | Bold / italic / checklist (Notes) |

## Layout

```
src/
  types.ts               Shared data model for all three apps
  lib/date.ts            ISO-day + HH:mm helpers and Intl formatting
  lib/recurrence.ts      Repeat rules: next occurrence, expansion over a range
  state/store.ts         Tiny pub/sub store, localStorage persistence
  state/seed.ts          First-run sample content
  state/actions.ts       Every mutation, including the cross-app ones
  state/selectors.ts     Filtering, grouping, event layout, unified search
  components/            App rail, Quick Find, Settings + one folder per app
  styles/                Design tokens, base, then per-app stylesheets
test/                    Unit tests for the date and recurrence logic
```

Dates are stored as `yyyy-mm-dd` strings and times as `HH:mm`, both local. That
keeps day comparison a string comparison and avoids the timezone drift you get
from serializing `Date` objects.

## Not yet built

Sync, notifications that actually fire, shared lists, location-based alerts,
attachments, drag-to-reschedule, and undo.
