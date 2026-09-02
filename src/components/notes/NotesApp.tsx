import { useEffect, useMemo, useState } from 'react'
import { useApp } from '../../state/store'
import { noteSnippet, visibleNotes } from '../../state/selectors'
import {
  addFolder, addNote, archiveNote, deleteFolder, emptyTrash, noteTitle, setPrefs,
  setSelectedFolder, setSelectedNote, trashNote, unarchiveNote, updateFolder,
} from '../../state/actions'
import { relativeStamp } from '../../lib/date'
import { useIsPhone } from '../../lib/useMediaQuery'
import { Icon, isIconName } from '../ui/Icon'
import { EmptyState, ToolButton } from '../ui/primitives'
import { NoteEditor } from './NoteEditor'
import { SwipeRow } from './SwipeRow'

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
  const selected = state.notes.find((n) => n.id === state.selectedNoteId) ?? null
  const trashCount = state.notes.filter((n) => n.trashedAt).length
  const archiveCount = state.notes.filter((n) => n.archivedAt && !n.trashedAt).length

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
                <div className={`side-item tint-${folder.tint}${state.selectedFolderId === folder.id ? ' is-on' : ''}`}>
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

        <div className="notes-list__head">{folderTitle}</div>

        <ul className="notes-list__items scroll">
          {notes.length === 0 && (
            <li className="notes-list__empty">{query ? 'No matches' : 'No notes'}</li>
          )}
          {notes.map((note) => (
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
              <button
                type="button"
                className={`note-card${note.id === state.selectedNoteId ? ' is-on' : ''}`}
                onClick={() => setSelectedNote(note.id)}
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
