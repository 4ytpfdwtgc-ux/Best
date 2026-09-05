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
- **One line becomes a task.** The quick-add field parses what you type the way
  the Shortcuts bridge parses what you dictate — "call the plumber tomorrow at
  5pm #home !!" — and shows what it made of the phrase before Enter commits it.
  A phrase it does not recognise stays a plain title; nothing is invented.
- **Recently Deleted.** Deleting a task moves it there for thirty days rather
  than dropping it, so the swipe is recoverable. The trash has no swipe of its
  own: the only action left there is irreversible.
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
- **Drag to reschedule.** In the day and week grids an event is dragged to a
  new time, across to another day, or by its bottom edge to change how long it
  runs; in the month view a chip is dragged to another day and keeps its time.
  Everything snaps to a quarter of an hour, the event previews where it would
  land, and the change is written only on release. A finger has to hold for a
  moment first, or the grid could never be scrolled.
- **Time zones**, opt-in per event. Without one an event floats: noon is noon
  wherever you are, which is right for most of a personal calendar. Pinned to a
  zone, it is stored in that zone's wall time and shown in yours — so a 9am
  call in New York reads as 2pm in London, and moves on the clock when you
  travel. The editor previews the conversion as you pick.
- A **repeating** event can be moved in time but not onto another day: its day
  comes from its rule, and dragging one occurrence to Friday would silently
  rewrite every other occurrence too.
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
- **Pictures**: `/picture` adds one, or paste a copied image, or drag image
  files onto the page. On iPhone the picker offers the photo library and the
  camera. Several at once become several blocks, the block's own text is the
  caption, and tapping a picture opens it full-screen.
- **Pages nest inside pages.** A page keeps only its parent's id, so the tree
  is derived rather than stored and moving one is a single field. Every branch
  starts folded and opens only when its own control is tapped — nothing
  expands on its own, including adding a subpage. A search shows its matches
  flat rather than opening branches to reveal them. The breadcrumb walks back
  up, and deleting or archiving a page carries whatever is nested under it.
- **Drag a page** to move it: hold it, then drop it on another page to nest it
  inside, on the list heading to lift it back out, or on a folder to move it
  there. Whatever is nested under it goes too. A page cannot be dropped inside
  its own descendant, and nothing lights up where a page cannot actually go.
- **Links in the writing**: `[text](url)` becomes a link, and `[[Page name]]`
  links to another page — creating it if it does not exist yet, since writing
  the link is usually how a page comes to exist. Each page lists the pages that
  link to it. A link is followed from a block you are not editing; inside the
  block you are in, the same click places the caret, or a link's own words
  could never be corrected.
- **Tables**: `/table` inserts a grid. Tab and Enter walk the cells and add a
  row when they run off the end, rows and columns are added and removed from
  the margins, a wide table scrolls inside itself rather than pushing the page
  sideways, and copying one out gives a markdown table.
- **Files**: `/file` attaches a PDF or anything else, and a dropped or pasted
  file becomes a picture or an attachment according to what it is, so one drop
  of a photo and a PDF makes one of each. An attachment is stored exactly as it
  came — re-encoding one could only damage it — and can be handed back through
  the share sheet.
- **Link cards**: paste a web address into an empty block and it becomes a card
  — the site's icon, a title, and the site underneath — the way iOS does it.
  `/link` adds one by hand. Tap the card to open it, tap its title to correct
  it. An address pasted into writing stays writing.
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

### Gestures

`lib/gestures.ts` holds every threshold in the app behind one `SENSITIVITY`
number. Below 1 a gesture asks for more movement and a longer hold before it
engages; it is currently 0.7, so a swipe needs 11px to start and 103px to
commit, a drag needs 6px, and a finger holds for half a second before it picks
anything up. They used to be five magic numbers in five files, which meant
"the app is too twitchy" had no single answer.

An engaged gesture also takes text selection out of the way. A press-and-hold
is how a page is picked up and also how every platform begins selecting text —
on iOS it raises the magnifier and the copy/paste callout too — so without this
the drag happens under a spreading highlight. `suppressSelection()` counts
nested gestures so one ending does not lift a suppression another still needs,
and the rows and chips whose own gesture is a hold decline selection outright.
Prose is untouched: the page editor and every input stay selectable.

A note row is both a swipe row and something that can be picked up, and one
pointer reaches both handlers. Moving first is a swipe; holding first picks the
page up, and the winner fires `releaseOtherGestures()` so the loser springs
back rather than acting. Overloading `pointercancel` for that does not work —
every handler listens for it, including the one sending it, so it cancels
itself.

A swiped-away row leaves in two beats: it slides out under its own width and
fades over 260ms while its height is held, then the gap it occupied closes
over 200ms. Removing it outright made the whole list jump, which is what read
as abrupt. Under `prefers-reduced-motion` it simply goes.

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

An event may also carry an IANA `timeZone`, in which case its stored time is
the wall time *there* and `lib/timezone.ts` converts it for whoever is looking.
Offsets are read back out of `Intl` rather than from a table, so daylight
saving is right on both sides of every changeover without shipping a zone
database. A repeating event is expanded on its own dates and each occurrence
converted afterwards — a weekly 9am in New York is 9am there every week, and
only that order keeps it at the right local time either side of a changeover,
since the two zones do not change on the same day. Exported, a zoned event is
written as an absolute UTC instant: `TZID` would be more faithful but obliges
the file to carry that zone's whole rule history as a VTIMEZONE block.

Pictures and attached files are the one exception to "everything is one JSON
blob". localStorage
caps out around 5MB — less than a single photo off an iPhone, before base64
inflates it by a third — so `lib/assets.ts` keeps them in IndexedDB as binary
and a block stores only the key. A picture over 1600px on its long edge is
scaled down and re-encoded on the way in; a PNG stays a PNG so it keeps its
transparency, a GIF or an SVG is stored untouched, and anything already small
is left exactly as it came. Deleting a block or a page does not delete its
bytes, because a duplicated block shares the key — instead a sweep at launch
drops every picture no page refers to any more.

A link card is built from the address alone: the site, a title de-slugged from
the last path segment, and the site's own `/favicon.ico`, which loads as an
ordinary image and so is not subject to CORS. iOS reads a page's Open Graph
tags because it fetches the page itself; a static site has no server to fetch
through and a browser is refused by CORS on very nearly every site it would
want to read. Hence the editable title, and a monogram on the site's own colour
when it serves no icon. Only `http:` and `https:` ever reach an href — a
`javascript:` address is refused and stays inert text.

Two things follow from where pictures live. Pictures are on the device, not in the
saved state, so they do not travel with an exported note or to another browser.
And Safari can evict a site's storage after about a week of not being opened;
adding the app to the Home screen is what stops that.

### Backup, and why it matters here

Settings exports the whole library — state, pictures and files — as one JSON
file, and restores one. Everything is held in this browser alone: no account,
no server. Clearing website data or moving to another phone takes it with it,
and Safari evicts the storage of a site left unopened for about a week. An
exported file is the only way back, which is why it is a section of Settings
rather than a line in a menu. Restoring runs the same schema migration as any
older save, so a backup from an earlier build is brought forward rather than
refused; assets are written before the state, or the launch sweep would see
them as orphans and reclaim them.

### Offline

`src/sw-template.js` is a service worker with the built filenames substituted
in at build time by a small plugin in `vite.config.ts` — a hand-written worker
cannot know Vite's hashed names, and a plugin that generates one would be a
dependency for thirty lines of substitution. Navigations are network-first, so
a deploy is picked up on the next launch with a signal; everything else is
cache-first, which is safe because the assets carry a content hash. Only this
app's own origin is served: a link card's favicon still goes to the network.
The app also asks for persistent storage, which iOS usually grants to an
installed app and usually refuses to a tab.

### Importing notes

iOS gives no other app a way to read Apple Notes, so Shortcuts has to do it:
*Find All Notes* → *Repeat with Each* → *Save File*, once, into a folder in
Files. Settings then takes those files — all of them at once — and makes a page
of each, titled by its filename. `lib/import.ts` is deliberately generous about
what it accepts, because a recipe can be built several ways: one file per note,
one file with all of them run together behind a separator, the JSON a *Get
Contents* step emits, and `Title:`/`Folder:` headers when the recipe wrote
them. A note that names a folder lands in one of that name, created if it does
not exist, so an Apple Notes folder structure survives the trip. Markdown
structure survives too — headings, lists, checkboxes, quotes and code.

Importing is additive: it never replaces what is already here, which is what
separates it from restoring a backup. Images, attachments, tables, scanned
documents and drawings cannot come across at all — a text export has nowhere
to put them — and locked notes are unreadable to Shortcuts in the first place.

### Sharing

A page or a task list can be sent to someone as markdown, from the button in
its own toolbar — the iOS share sheet on a phone, a download elsewhere. That is
a copy, not a shared document. Two people editing the same page, or a list that
stays in step between them, needs an account, a server to hold the document and
a way to merge two simultaneous edits; none of that is reachable from an app
that runs entirely in one browser, so it is honestly absent rather than half
present. Pictures, files and nested pages do not travel with the text, and the
share warns before it goes.

## Not yet built

Sync, notifications that actually fire, real-time collaboration,
location-based alerts, and undo.

Two-way calendar sync and real Siri intents are not on this list because they
are not reachable from a web app at all: both need either a server (a subscribed
`webcal://` feed, or CalDAV against iCloud) or a native wrapper around this UI
with EventKit and App Intents.
