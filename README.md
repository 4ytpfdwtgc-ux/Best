# Cadence

An all-in-one **Reminders**, **Calendar** and **Notes** app in a single window,
borrowing the interaction model of Apple's three apps. Built for iPhone Safari
first — installable to the Home screen — and equally at home on a desktop
browser. Everything runs locally with no backend.

Opening the app lands on the **split Today view**: reminders in the top third,
the day's calendar in the bottom two thirds, both aimed at the same day.

```bash
npm install
npm run dev        # http://localhost:5173
npm test           # date + recurrence unit tests
npm run build      # typecheck, then production build into dist/
```

## What's in the baseline

### Today (the split view)
- The launch screen: reminders due today (overdue included) in the top third,
  the day's hour-by-hour calendar in the bottom two thirds.
- A week strip moves both panes together; either pane header opens the full app.
- On today the grid opens on the day's first event, or the current hour when the
  day is empty; the red now-line marks the time.
- In landscape the split turns on its side — reminders left third, calendar
  right two thirds — because a landscape phone has width but no height.

### Shell
- A vertical app rail switches between the apps (`⌘0` / `⌘1` / `⌘2` / `⌘3`); at
  phone widths it becomes an iOS-style bottom tab bar.
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
  `⌘T` for today. On a phone the week view is dropped (seven columns are
  unreadable) and the month grid shows dots with a day agenda beneath it, the
  way iOS Calendar does.
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
| `⌘0` `⌘1` `⌘2` `⌘3` | Switch between Today, Reminders, Calendar, Notes |
| `⌘K` or `/` | Quick Find |
| `⌘N` | New reminder / event / note |
| `⌘T` | Jump to today (Calendar) |
| `D` `W` `M` `Y` | Calendar view (Day / Week / Month / Year) |
| `←` `→` | Previous / next period (Calendar) |
| `⇧⌘S` | Toggle the sidebar |
| `⌘,` | Settings |
| `⌘B` `⌘I` `⇧⌘L` | Bold / italic / checklist (Notes) |

## On iPhone

- Add to Home Screen runs it standalone, with no Safari chrome
  (`manifest.webmanifest` plus the `apple-mobile-web-app-*` tags).
- Layout uses `100dvh` and `env(safe-area-inset-*)`, so nothing hides behind the
  status bar, the home indicator, or a notch in landscape.
- Every text field is 16px at phone widths — below that iOS zooms the page when
  a field takes focus. Pinch-zoom is deliberately left enabled.
- Sidebars become modal drawers, the reminder inspector and the note editor
  become pushed full-screen screens, and dialogs slide up from the bottom.
- Hover-revealed controls stay visible on touch, and tap targets grow to ~34px
  under `@media (hover: none)`.

Verified at 375×667 (SE), 375×812, 393×852, 430×932, landscape, and iPad
portrait: the split holds at exactly 1/3 and nothing overflows horizontally.

## Layout

```
src/
  types.ts               Shared data model for all four views
  lib/date.ts            ISO-day + HH:mm helpers and Intl formatting
  lib/recurrence.ts      Repeat rules: next occurrence, expansion over a range
  lib/useMediaQuery.ts   Phone-width detection for layout that JS must know about
  state/store.ts         Tiny pub/sub store, localStorage persistence
  state/seed.ts          First-run sample content
  state/actions.ts       Every mutation, including the cross-app ones
  state/selectors.ts     Filtering, grouping, event layout, unified search
  components/home/       The split Today view and its week strip
  components/            App rail, tab bar, Quick Find, Settings + one folder per app
  styles/                Design tokens, base, per-app sheets, then phone.css
test/                    Unit tests for the date and recurrence logic
```

Dates are stored as `yyyy-mm-dd` strings and times as `HH:mm`, both local. That
keeps day comparison a string comparison and avoids the timezone drift you get
from serializing `Date` objects.

## Not yet built

Sync, notifications that actually fire, shared lists, location-based alerts,
attachments, drag-to-reschedule, swipe gestures, and undo.
