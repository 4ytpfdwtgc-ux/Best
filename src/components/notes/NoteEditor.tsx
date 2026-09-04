import { useState } from 'react'
import type { Note } from '../../types'
import { useApp } from '../../state/store'
import {
  addTag, archiveNote, deleteNoteForever, noteTitle, reminderFromNote, restoreNote,
  setModule, setSelectedNote, toggleNotePin, trashNote, unarchiveNote, updateNote,
} from '../../state/actions'
import { noteAncestors } from '../../lib/notes'
import { relativeStamp } from '../../lib/date'
import { Icon } from '../ui/Icon'
import { BlockEditor } from './BlockEditor'

export function NoteEditor({ note, onBack }: { note: Note; onBack?: () => void }) {
  const state = useApp()
  const [newTag, setNewTag] = useState('')

  const folder = state.folders.find((f) => f.id === note.folderId)
  const ancestors = noteAncestors(state.notes, note)

  if (note.trashedAt) {
    return (
      <section className={`editor${onBack ? ' editor--pushed' : ''}`}>
        {onBack && <BackBar onBack={onBack} />}
        <div className="editor__notice editor__notice--danger">
          <span>This page is in Recently Deleted.</span>
          <button type="button" className="btn" onClick={() => restoreNote(note.id)}>Restore</button>
          <button type="button" className="btn btn--danger" onClick={() => deleteNoteForever(note.id)}>
            Delete permanently
          </button>
        </div>
        <div className="editor__page scroll">
          <BlockEditor note={note} />
        </div>
      </section>
    )
  }

  return (
    <section className={`editor${onBack ? ' editor--pushed' : ''}`} aria-label="Page">
      {onBack && <BackBar onBack={onBack} />}

      {note.archivedAt && (
        <div className="editor__notice">
          <span>This page is archived.</span>
          <button type="button" className="btn" onClick={() => unarchiveNote(note.id)}>Restore</button>
        </div>
      )}

      <header className="editor__bar">
        <span className="editor__crumb">
          {folder ? `${folder.name} / ` : ''}
          {ancestors.map((up) => (
            <button
              key={up.id}
              type="button"
              className="editor__up"
              onClick={() => setSelectedNote(up.id)}
              title={`Open ${noteTitle(up)}`}
            >
              {noteTitle(up)}
            </button>
          ))}
          <strong>{note.title.trim() || 'Untitled'}</strong>
        </span>

        <div className="toolbar__spacer" />

        <span className="editor__stamp">Edited {relativeStamp(note.updatedAt)}</span>
        <button
          type="button"
          className={`tool-btn${note.pinned ? ' is-active' : ''}`}
          onClick={() => toggleNotePin(note.id)}
          title={note.pinned ? 'Unpin' : 'Pin to top'}
          aria-label={note.pinned ? 'Unpin' : 'Pin to top'}
        >
          <Icon name="pin" size={15} filled={note.pinned} />
        </button>
        <button
          type="button"
          className="tool-btn"
          onClick={() => {
            reminderFromNote(note.id)
            setModule('reminders')
          }}
          title="Create a reminder from this page"
          aria-label="Create a reminder from this page"
        >
          <Icon name="checklist" size={15} />
        </button>
        {!note.archivedAt && (
          <button
            type="button"
            className="tool-btn"
            onClick={() => archiveNote(note.id)}
            title="Archive"
            aria-label="Archive"
          >
            <Icon name="inbox" size={15} />
          </button>
        )}
        <button
          type="button"
          className="tool-btn"
          onClick={() => trashNote(note.id)}
          title="Move to Recently Deleted"
          aria-label="Move to Recently Deleted"
        >
          <Icon name="trash" size={15} />
        </button>
      </header>

      <div className="editor__page scroll">
        <BlockEditor note={note} />

        <div className="editor__tags">
          {note.tags.map((id) => {
            const tag = state.tags.find((t) => t.id === id)
            if (!tag) return null
            return (
              <button
                key={id}
                type="button"
                className={`pill tint-${tag.tint}`}
                onClick={() => updateNote(note.id, { tags: note.tags.filter((t) => t !== id) })}
                title="Remove tag"
              >
                {tag.name}
              </button>
            )
          })}
          <form
            onSubmit={(e) => {
              e.preventDefault()
              if (!newTag.trim()) return
              const tag = addTag(newTag)
              if (!note.tags.includes(tag.id)) updateNote(note.id, { tags: [...note.tags, tag.id] })
              setNewTag('')
            }}
          >
            <input
              className="editor__tagfield"
              placeholder="Add a tag…"
              value={newTag}
              onChange={(e) => setNewTag(e.target.value)}
              aria-label="Add a tag"
            />
          </form>
        </div>
      </div>
    </section>
  )
}

/** The pushed-screen back affordance used at phone widths. */
function BackBar({ onBack }: { onBack: () => void }) {
  return (
    <div className="editor__backbar">
      <button type="button" className="btn btn--plain" onClick={onBack}>
        <Icon name="chevronLeft" size={15} strokeWidth={2.4} /> Notes
      </button>
    </div>
  )
}
