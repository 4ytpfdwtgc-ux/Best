# Cadence

An all-in-one **Tasks**, **Calendar** and **Notes** app in a single window,
wearing Notion's clothes: a near-monochrome interface, a real block editor with
slash commands, and tasks as a database you can view as a list, a board or a
table. Built for iPhone Safari first — installable to the Home screen — and
equally at home on a desktop browser. Everything runs locally with no backend.

Opening the app lands on the **split Today view**: reminders in the top third,
the day's calendar in the bottom two thirds, both aimed at the same day.

```bash
npm install
npm run dev            # http://localhost:5173
npm run dev -- --host  # also serve on the LAN, to open it on a phone
npm test               # dates, recurrence, blocks, marks, ics, capture
npm run build          # typecheck, then production build into dist/
```

## Deploying

Pushing to the development branch (or `main`) runs
`.github/workflows/deploy.yml`, which tests, builds and publishes `dist/` to
GitHub Pages.

**One workflow, not two.** GitHub's Pages setup screen offers a Jekyll starter
workflow. Do not add it: it builds the repository root with Jekyll and publishes
*that*, so it competes with `deploy.yml` for the same Pages deployment. Both use
the `pages` concurrency group, so they queue rather than cancel, and whichever
finishes last is what the site serves — a coin flip between the built app and
the raw source.

**Set Source to GitHub Actions, not a branch.** Under **Settings → Pages →
Build and deployment**, *Source* must be **GitHub Actions**. With the default
"Deploy from a branch", Pages serves the repository source instead of the build:
the root `index.html` points at `src/main.tsx`, which a browser cannot execute,
so the site loads as a near-empty page and the deploy workflow fails at
`configure-pages`. If that happens the page now says so rather than showing
nothing.

The build uses `base: './'`, so the same `dist/` works from a domain root, from
a Pages project subpath like `/Best/`, or from any other static host. The web
manifest's `start_url`, `scope` and icon path are relative for the same reason —
absolute ones would resolve to the domain root and break the installed app.

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
  phone widths it becomes a bottom tab bar.
- **Quick Find** (`⌘K` or `/`) searches reminders, events and notes at once and
  jumps straight to the hit.
- Light / dark / system themes, a system-tint accent picker, week-start,
  12- vs 24-hour time, all in Settings (`⌘,`).
- State persists to `localStorage` and is restored on launch.

### Tasks — a Notion database
- **Three views over the same rows**: List (grouped, closest to a to-do list),
  Board (kanban, drag cards between columns) and Table (a spreadsheet with one
  column per property). Each view keeps its own grouping, sort and filters.
- **Typed properties** you define yourself: select, multi-select, text, number,
  checkbox, date and URL. Add a column from the table header; select options are
  created inline as you type them. The ships-with set is Status, Effort, Area
  and Estimate.
- **Filter, sort and group** by any built-in field or property, from the toolbar
  the way Notion does it.
- Status and the completion checkbox are two views of one fact, so dragging a
  card to Done ticks it, and ticking it moves the card.
- Still a task list underneath: due date and time, alerts, priority, flags,
  subtasks, tags, and smart lists (Today, Scheduled, All, Flagged). Lists carry
  a colour and a symbol chosen from the icon set.
- Repeating tasks roll their due date forward when completed instead of being
  struck out.
- "Schedule" turns a task into a calendar event in one click.

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

### Notes — a block editor
- Pages have an emoji icon and a large title, and a body made of **blocks**:
  text, three heading levels, to-dos, bulleted, numbered and toggle lists,
  quotes, callouts, dividers and code.
- **`/` opens the insert menu**, filtered as you type, driven by the arrow keys.
- **Markdown shortcuts convert as you type**: `# `, `## `, `- `, `1. `, `[] `,
  `> `, ` ``` ` and `--- `.
- **Drag the handle to reorder** — a block carries whatever is nested under it.
  The handle also opens a menu to turn a block into another type, recolour a
  callout, duplicate or delete it.
- Keyboard model: Enter splits a block and continues lists, Backspace at the
  start merges or lifts out, Tab and Shift-Tab indent, arrows move between
  blocks, and `⌘B` / `⌘I` / `⌘E` mark the selection.
- Toggles collapse the deeper blocks that follow them.
- Pages have an icon from the same set the rest of the interface uses, chosen
  from a picker on the page itself.
- **Swipe a page in the list**: left to delete, right to archive — and right
  again in the Archive to restore it. The gesture uses pointer events, so it
  works with a finger or a mouse, and vertical movement hands control back to
  the scroller so it never fights the list. Under the commit distance the row
  springs back; past it the action fills before firing.
- Folders, pinning, search, sort, an Archive for pages that are done but worth
  keeping, and a Recently Deleted folder with restore and delete-permanently.
  Recently Deleted deliberately has no swipe: the only action left there is
  irreversible.
- "Create a reminder from this page" pushes a thought into Tasks.

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
| `/` | Insert a block (in the editor) |
| `⌘B` `⌘I` `⌘E` | Bold / italic / code on the selection |
| `Tab` `⇧Tab` | Indent / outdent a block |

## Getting things in and out of iOS

The app is a web app, so it cannot read or write iOS Calendar directly —
EventKit has no web API, and Siri intents are native-only. These two bridges are
what iOS actually leaves open to a web app, and both work with no backend.

**Events → iOS Calendar.** Every event editor has *Add to Calendar*, and
Settings exports the lot at once. Both produce an RFC 5545 `.ics`; on iPhone the
share sheet opens so the file can go straight to Calendar, and elsewhere it
downloads. Times are written as *floating* local values — no `Z`, no `TZID` —
which matches what the app stores (a wall-clock time with no zone) and avoids
shipping a VTIMEZONE block. Recurrence becomes an `RRULE`, alerts become a
`VALARM`, and all-day events use `DATE` values with the exclusive end date the
spec requires. This is one-way and you confirm each import; live two-way sync
would need a backend or a native app.

**“Hey Siri” capture → tasks and pages.** The app accepts work in the query
string:

```
?add=buy oat milk tomorrow at 5pm
?note=redesign thoughts. try a lighter grid.
```

In Shortcuts, chain *Dictate Text* → *URL* → *Open URLs* and name it
“Add to Cadence”; then say **“Hey Siri, Add to Cadence.”** Settings shows the
exact address for this deployment with a copy button. The catch is that opening
a URL foregrounds the browser, so it is not the silent capture Apple's own apps
get.

Dictated text is parsed for a date, a time, `#tags` and priority, and the rest
becomes the title. It understands today / tomorrow / tonight / next week,
weekday names, `in 3 days`, `September 17`, `12/15`, `at 5pm`, `at 17:00`, noon
and midnight. A bare hour is read as afternoon for 1–7 and morning for 8–11,
which is how people speak. Anything it does not recognise is left in the title
rather than silently dropped, and the URL is cleared once consumed so a refresh
cannot add the same thing twice.

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
  lib/blocks.ts          Block model, slash-menu catalogue, markdown shortcuts
  lib/ics.ts             RFC 5545 output: escaping, folding, RRULE, VALARM
  lib/capture.ts         Dictated phrase to a task: date, time, tags, priority
  lib/deliver.ts         Share sheet on iOS, download everywhere else
  lib/inline.ts          Inline marks, rendered without changing textContent
  lib/caret.ts           Caret offsets across contentEditable blocks
  lib/useMediaQuery.ts   Phone-width detection for layout that JS must know about
  state/store.ts         Tiny pub/sub store, localStorage persistence
  state/seed.ts          First-run content, default properties and views
  state/migrate.ts       Schema upgrades for state saved by an older build
  state/capture.ts       Consumes ?add= / ?note= handed over by a shortcut
  state/actions.ts       Every mutation, including the cross-app ones
  state/selectors.ts     The database engine plus event layout and search
  components/home/       The split Today view and its week strip
  components/notes/      Block editor, slash menu, block menu
  components/reminders/  List, board and table views, properties, view controls
  styles/                Design tokens, base, per-app sheets, then phone.css
test/                    Unit tests: dates, recurrence, blocks, inline marks,
                         iCalendar output and the capture parser
```

### Two implementation notes

**Blocks are stored flat, with an `indent` level**, rather than nested. It keeps
reordering, indenting and keyboard handling simple, and a collapsed toggle is
just "hide the deeper blocks that follow me".

**Inline marks keep their markers in the text**, rendered dimmed beside the
styled run. The editable element's `textContent` therefore always equals the
stored string, so caret offsets stay meaningful and there is no parallel
rich-text model to keep in sync.

### Saved data

The schema is versioned. State written by an older build is migrated on load
rather than discarded, and the upgraded state is written straight back so a
migration runs once. `state/migrate.ts` turns the previous markdown note bodies
into blocks, gives every task the property bag, and converts list symbols and
page icons from the emoji they used to be into icon names. A symbol it does not
recognise is left alone — an emoji still renders, so nothing chosen elsewhere is
lost.

Dates are stored as `yyyy-mm-dd` strings and times as `HH:mm`, both local. That
keeps day comparison a string comparison and avoids the timezone drift you get
from serializing `Date` objects.

## Not yet built

Sync, notifications that actually fire, shared lists, location-based alerts,
attachments, drag-to-reschedule, swipe gestures, and undo.

Two-way calendar sync and real Siri intents are not on this list because they
are not reachable from a web app at all: both need either a server (a subscribed
`webcal://` feed, or CalDAV against iCloud) or a native wrapper around this UI
with EventKit and App Intents.
