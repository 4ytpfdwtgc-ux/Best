import { useEffect, useMemo, useRef, useState } from 'react'
import { useApp } from '../../state/store'
import { noteSnippet, visibleNotes } from '../../state/selectors'
import { canDropPage, noteTree } from '../../lib/notes'
import {
  MOUSE_HOLD_MS, TOUCH_HOLD_MS, TOUCH_SLOP, releaseOtherGestures, suppressSelection,
} from '../../lib/gestures'
import {
  addFolder, addNote, addSubpage, archiveNote, deleteFolder, emptyTrash, moveNoteToFolder,
  noteTitle, reparentNote, setPrefs, setSelectedFolder, setSelectedNote, trashNote, unarchiveNote,
  updateFolder,
} from '../../state/actions'
import { relativeStamp } from '../../lib/date'
import { useIsPhone } from '../../lib/useMediaQuery'
import { Icon, isIconName } from '../ui/Icon'
import { EmptyState, ToolButton } from '../ui/primitives'
import { NoteEditor } from './NoteEditor'
import { SwipeRow } from '../ui/SwipeRow'

export function NotesApp({
  sidebarOpen,
  onToggleSidebar,
}: {
  sidebarOpen: boolean
  onToggleSidebar: () => void
}) {
  const state = useApp()
  const isPhone = useIsPhone()
  const [query, setQuery] = useState('')

  const notes = useMemo(() => visibleNotes(state, query), [state, query])
  /*
   * Which pages have been opened by hand. Empty to begin with, so every branch
   * starts folded; nothing here ever opens one on its own. View state rather
   * than the page's own, so it is not persisted or carried between devices.
   */
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(new Set())
  /*
   * A search shows its matches flat. Nesting them would hide a match inside a
   * folded parent, and opening the parents to reveal it would be exactly the
   * self-expanding behaviour this avoids.
   */
  const searching = query.trim().length > 0
  const rows = useMemo(
    () =>
      searching
        ? notes.map((note) => ({ note, depth: 0, hasChildren: false }))
        : noteTree(notes, expanded),
    [notes, expanded, searching],
  )
  const selected = state.notes.find((n) => n.id === state.selectedNoteId) ?? null
  const trashCount = state.notes.filter((n) => n.trashedAt).length
  const archiveCount = state.notes.filter((n) => n.archivedAt && !n.trashedAt).length

  /*
   * Dragging a page onto another nests it inside; onto a folder, or onto the
   * list's own heading, moves it out to that folder's top level. There is no
   * reordering between siblings: the list is sorted by whatever the sort
   * control says, and a manual order underneath a sort nobody asked for would
   * only ever disagree with it.
   */
  const [pageDrag, setPageDrag] = useState<{ id: string; over: string | null } | null>(null)
  const pageDragRef = useRef<{ id: string; over: string | null } | null>(null)
  const draggedRef = useRef(false)

  function startPageDrag(e: React.PointerEvent, id: string) {
    if (e.button !== 0 || state.selectedFolderId === 'trash' || searching) return
    const startX = e.clientX
    const startY = e.clientY
    const touch = e.pointerType === 'touch'
    let engaged = false
    let holdTimer: number | undefined
    let release: (() => void) | undefined
    draggedRef.current = false

    const engage = () => {
      engaged = true
      draggedRef.current = true
      // The hold that picks a page up is also the one that starts selecting.
      release = suppressSelection()
      /*
       * The row is also a swipe row, and both handlers see this one pointer.
       * Telling the swipe to let go is what stops a page dragged towards a
       * folder on the left also being read as a swipe left — which deleted it.
       */
      releaseOtherGestures()
      pageDragRef.current = { id, over: null }
      setPageDrag(pageDragRef.current)
    }

    /*
     * Picking a page up takes a hold, on a mouse as well as a finger. It is
     * what separates moving a page from swiping it: move first and it is a
     * swipe, hold first and it is a move.
     */
    holdTimer = window.setTimeout(engage, touch ? TOUCH_HOLD_MS : MOUSE_HOLD_MS)

    const onMove = (ev: PointerEvent) => {
      if (!engaged) {
        // Moving before the hold completes belongs to the swipe, or the scroll.
        const far =
          Math.abs(ev.clientX - startX) > TOUCH_SLOP || Math.abs(ev.clientY - startY) > TOUCH_SLOP
        if (far) cleanup()
        return
      }

      const el = document
        .elementsFromPoint(ev.clientX, ev.clientY)
        .find((n): n is HTMLElement => n instanceof HTMLElement && n.dataset.drop !== undefined)
      const over = el?.dataset.drop ?? null
      const page = over?.startsWith('page:') ? over.slice(5) : undefined
      // Only light up somewhere the page could actually go.
      const allowed =
        over === null ||
        (over.startsWith('folder:') ? true : canDropPage(state.notes, id, page))
      pageDragRef.current = { id, over: allowed ? over : null }
      setPageDrag(pageDragRef.current)
    }

    const onUp = () => {
      const current = pageDragRef.current
      cleanup()
      window.setTimeout(() => void (draggedRef.current = false), 0)
      if (!current?.over) return
      if (current.over.startsWith('folder:')) moveNoteToFolder(current.id, current.over.slice(7))
      else if (current.over.startsWith('page:')) reparentNote(current.id, current.over.slice(5))
      else if (current.over === 'root') reparentNote(current.id, undefined)
    }

    const cleanup = () => {
      window.clearTimeout(holdTimer)
      release?.()
      release = undefined
      pageDragRef.current = null
      setPageDrag(null)
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('pointercancel', cleanup)
    }

    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    window.addEventListener('pointercancel', cleanup)
  }

  // Keep a valid selection as the filtered list changes. On a phone the editor
  // is a pushed screen, so nothing is auto-selected — that would skip the list.
  useEffect(() => {
    if (notes.some((n) => n.id === state.selectedNoteId)) return
    const next = isPhone ? null : (notes[0]?.id ?? null)
    if (next !== state.selectedNoteId) setSelectedNote(next)
  }, [notes, state.selectedNoteId, isPhone])

  // Entering Notes on a phone lands on the list, not on whichever note was
  // last open — the editor is a pushed screen you get to by tapping.
  useEffect(() => {
    if (isPhone) setSelectedNote(null)
  }, [isPhone])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'n') {
        e.preventDefault()
        addNote()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const folderTitle =
    state.selectedFolderId === 'all'
      ? 'All Notes'
      : state.selectedFolderId === 'trash'
        ? 'Recently Deleted'
        : state.selectedFolderId === 'archive'
          ? 'Archive'
          : (state.folders.find((f) => f.id === state.selectedFolderId)?.name ?? 'Notes')

  return (
    <div className="module">
      {isPhone && sidebarOpen && (
        <div className="sidebar-scrim" onClick={onToggleSidebar} role="presentation" />
      )}
      <aside className="sidebar" hidden={!sidebarOpen} aria-label="Note folders">
        <div className="sidebar__head">
          <span className="sidebar__title">Notes</span>
          {isPhone && (
            <button type="button" className="icon-btn icon-btn--lg" onClick={onToggleSidebar} aria-label="Close folders">
              <Icon name="close" size={17} />
            </button>
          )}
        </div>

        <div
          className="sidebar__body scroll"
          onClick={(e) => {
            // On a phone the drawer is modal, so choosing a folder dismisses
            // it — but renaming one, or reaching its delete button, must not.
            if (!isPhone) return
            if ((e.target as HTMLElement).closest('input, .side-item__more')) return
            onToggleSidebar()
          }}
        >
          <ul className="side-list">
            <li>
              <button
                type="button"
                className={`side-item tint-gray${state.selectedFolderId === 'all' ? ' is-on' : ''}`}
                onClick={() => setSelectedFolder('all')}
              >
                <span className="side-item__glyph side-item__glyph--plain"><Icon name="folder" size={16} /></span>
                <span className="side-item__name">All Notes</span>
                <span className="side-item__count">{state.notes.filter((n) => !n.trashedAt).length}</span>
              </button>
            </li>
          </ul>

          <div className="sidebar__section">Folders</div>
          <ul className="side-list">
            {state.folders.map((folder) => (
              <li key={folder.id}>
                <div
                  className={`side-item tint-${folder.tint}${
                    state.selectedFolderId === folder.id ? ' is-on' : ''
                  }${pageDrag?.over === `folder:${folder.id}` ? ' is-droptarget' : ''}`}
                  data-drop={`folder:${folder.id}`}
                >
                  <span className="side-item__glyph side-item__glyph--plain" onClick={() => setSelectedFolder(folder.id)}>
                    <Icon name="folder" size={16} />
                  </span>
                  <input
                    className="side-item__name side-item__rename"
                    value={folder.name}
                    onFocus={() => setSelectedFolder(folder.id)}
                    onChange={(e) => updateFolder(folder.id, { name: e.target.value })}
                    aria-label="Folder name"
                  />
                  <span className="side-item__count">
                    {state.notes.filter((n) => n.folderId === folder.id && !n.trashedAt).length}
                  </span>
                  <span
                    className="side-item__more"
                    role="button"
                    tabIndex={-1}
                    aria-label={`Delete ${folder.name}`}
                    onClick={() => {
                      if (confirm(`Delete “${folder.name}”? Its notes move to Recently Deleted.`)) {
                        deleteFolder(folder.id)
                      }
                    }}
                  >
                    <Icon name="trash" size={14} />
                  </span>
                </div>
              </li>
            ))}
          </ul>

          <div className="sidebar__section">Other</div>
          <ul className="side-list">
            <li>
              <button
                type="button"
                className={`side-item tint-gray${state.selectedFolderId === 'archive' ? ' is-on' : ''}`}
                onClick={() => setSelectedFolder('archive')}
              >
                <span className="side-item__glyph side-item__glyph--plain"><Icon name="inbox" size={16} /></span>
                <span className="side-item__name">Archive</span>
                <span className="side-item__count">{archiveCount}</span>
              </button>
            </li>
            <li>
              <button
                type="button"
                className={`side-item tint-gray${state.selectedFolderId === 'trash' ? ' is-on' : ''}`}
                onClick={() => setSelectedFolder('trash')}
              >
                <span className="side-item__glyph side-item__glyph--plain"><Icon name="trash" size={16} /></span>
                <span className="side-item__name">Recently Deleted</span>
                <span className="side-item__count">{trashCount}</span>
              </button>
            </li>
          </ul>

          <button type="button" className="side-add" onClick={() => addFolder('New Folder')}>
            <Icon name="plus" size={15} strokeWidth={2.2} />
            New Folder
          </button>
        </div>
      </aside>

      <div className="notes-list">
        <header className="toolbar toolbar--tight">
          <ToolButton icon="sidebar" label="Toggle sidebar" onClick={onToggleSidebar} active={sidebarOpen} />
          <div className="search-field">
            <Icon name="search" size={14} />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search"
              aria-label="Search notes"
            />
          </div>
          <select
            className="select input--sm notes-list__sort"
            value={state.prefs.notesSort}
            onChange={(e) => setPrefs({ notesSort: e.target.value as 'edited' | 'created' | 'title' })}
            aria-label="Sort notes"
          >
            <option value="edited">Edited</option>
            <option value="created">Created</option>
            <option value="title">Title</option>
          </select>
          {state.selectedFolderId === 'trash' ? (
            <ToolButton icon="trash" label="Empty trash" onClick={() => trashCount && emptyTrash()} />
          ) : (
            <ToolButton icon="plus" label="New note (⌘N)" onClick={() => addNote()} />
          )}
        </header>

        <div
          className={`notes-list__head${pageDrag?.over === 'root' ? ' is-droptarget' : ''}`}
          data-drop="root"
        >
          {folderTitle}
          {pageDrag && <span className="notes-list__hint">Drop here to move it out</span>}
        </div>

        <ul className="notes-list__items scroll">
          {notes.length === 0 && (
            <li className="notes-list__empty">{query ? 'No matches' : 'No notes'}</li>
          )}
          {rows.map(({ note, depth, hasChildren }) => (
            <li key={note.id}>
              <SwipeRow
                // Recently Deleted holds only an irreversible action, which is
                // not something a swipe should be able to reach.
                disabled={state.selectedFolderId === 'trash'}
                right={{ label: 'Delete', icon: 'trash', tint: 'red', run: () => trashNote(note.id) }}
                left={
                  state.selectedFolderId === 'archive'
                    ? { label: 'Restore', icon: 'arrowRight', tint: 'green', run: () => unarchiveNote(note.id) }
                    : { label: 'Archive', icon: 'inbox', tint: 'blue', run: () => archiveNote(note.id) }
                }
              >
              <div
                className={`note-row${pageDrag?.id === note.id ? ' is-dragging' : ''}${
                  pageDrag && pageDrag.over === `page:${note.id}` ? ' is-droptarget' : ''
                }`}
                style={{ paddingLeft: depth * 14 }}
                data-drop={`page:${note.id}`}
                onPointerDown={(e) => {
                  // The twist and the add button are their own controls.
                  if ((e.target as HTMLElement).closest('.note-row__twist, .note-row__add')) return
                  startPageDrag(e, note.id)
                }}
              >
                <button
                  type="button"
                  className={`note-row__twist${hasChildren ? '' : ' is-empty'}${
                    expanded.has(note.id) ? ' is-open' : ''
                  }`}
                  aria-label={expanded.has(note.id) ? 'Hide pages inside' : 'Show pages inside'}
                  aria-expanded={hasChildren ? expanded.has(note.id) : undefined}
                  tabIndex={hasChildren ? 0 : -1}
                  onClick={() =>
                    setExpanded((current) => {
                      if (!hasChildren) return current
                      const next = new Set(current)
                      if (next.has(note.id)) next.delete(note.id)
                      else next.add(note.id)
                      return next
                    })
                  }
                >
                  <Icon name="chevronRight" size={12} strokeWidth={2.2} />
                </button>

                <button
                  type="button"
                  className={`note-card${note.id === state.selectedNoteId ? ' is-on' : ''}`}
                  onClick={() => {
                    if (draggedRef.current) return
                    setSelectedNote(note.id)
                  }}
                >
                  <span className="note-card__title">
                    <span className="note-card__icon">
                      {isIconName(note.icon ?? 'note')
                        ? <Icon name={note.icon ?? 'note'} size={14} />
                        : note.icon}
                    </span>
                    {noteTitle(note)}
                    {note.pinned && <Icon name="pin" size={11} filled />}
                  </span>
                  <span className="note-card__meta">
                    <span className="note-card__stamp">{relativeStamp(note.updatedAt)}</span>
                    <span className="note-card__snippet">{noteSnippet(note)}</span>
                  </span>
                </button>

                {state.selectedFolderId !== 'trash' && state.selectedFolderId !== 'archive' && (
                  <button
                    type="button"
                    className="note-row__add"
                    title="New page inside"
                    aria-label={`New page inside ${noteTitle(note)}`}
                    onClick={() => {
                      const child = addSubpage(note.id)
                      if (!child) return
                      // The new page opens in the editor; the branch in the
                      // list stays shut, because nothing opens one but a tap.
                      setSelectedNote(child.id)
                    }}
                  >
                    <Icon name="plus" size={13} strokeWidth={2.2} />
                  </button>
                )}
              </div>
              </SwipeRow>
            </li>
          ))}
        </ul>
      </div>

      {selected ? (
        <NoteEditor
          key={selected.id}
          note={selected}
          onBack={isPhone ? () => setSelectedNote(null) : undefined}
        />
      ) : isPhone ? null : (
        <section className="editor">
          <EmptyState
            icon="note"
            title="No page selected"
            hint="Pick a page on the left, or press ⌘N to start a new one."
            action={
              <button type="button" className="btn btn--primary" onClick={() => addNote()}>
                New page
              </button>
            }
          />
        </section>
      )}
    </div>
  )
}
