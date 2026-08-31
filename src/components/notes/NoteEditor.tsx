import { useEffect, useRef, useState } from 'react'
import type { Note } from '../../types'
import { useApp } from '../../state/store'
import {
  addTag, deleteNoteForever, noteTitleOf, reminderFromNote, restoreNote,
  setModule, toggleNotePin, trashNote, updateNote,
} from '../../state/actions'
import { relativeStamp } from '../../lib/date'
import { Icon } from '../ui/Icon'
import { RenderedNote, toggleCheckLine } from './NoteMarkup'

type Format = 'title' | 'heading' | 'body' | 'checklist' | 'bullet' | 'numbered' | 'quote'

const LINE_PREFIX: Record<Format, string> = {
  title: '# ',
  heading: '## ',
  body: '',
  checklist: '- [ ] ',
  bullet: '- ',
  numbered: '1. ',
  quote: '> ',
}

const STRIP = /^(\s*)(#{1,3}\s+|[-*]\s+\[[ xX]\]\s?|[-*]\s+|\d+[.)]\s+|>\s?)?/

export function NoteEditor({ note, onBack }: { note: Note; onBack?: () => void }) {
  const state = useApp()
  const [preview, setPreview] = useState(true)
  const [newTag, setNewTag] = useState('')
  const areaRef = useRef<HTMLTextAreaElement>(null)

  const folder = state.folders.find((f) => f.id === note.folderId)

  // A freshly created note opens ready to type; an existing one opens rendered.
  useEffect(() => setPreview(note.body.trim().length > 0), [note.id])

  /** Apply a block format to every line the selection touches. */
  function applyFormat(format: Format) {
    const area = areaRef.current
    const body = note.body
    const start = area?.selectionStart ?? body.length
    const end = area?.selectionEnd ?? start

    const lines = body.split('\n')
    let offset = 0
    const next = lines.map((line) => {
      const lineStart = offset
      const lineEnd = offset + line.length
      offset = lineEnd + 1
      if (lineEnd < start || lineStart > end) return line
      const stripped = line.replace(STRIP, '$1')
      return LINE_PREFIX[format] + stripped
    })
    updateNote(note.id, { body: next.join('\n') })
    requestAnimationFrame(() => area?.focus())
  }

  function wrapSelection(marker: string) {
    const area = areaRef.current
    if (!area) return
    const { selectionStart: s, selectionEnd: e } = area
    if (s === e) return
    const body = note.body
    updateNote(note.id, { body: body.slice(0, s) + marker + body.slice(s, e) + marker + body.slice(e) })
    requestAnimationFrame(() => {
      area.focus()
      area.setSelectionRange(s + marker.length, e + marker.length)
    })
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    const meta = e.metaKey || e.ctrlKey
    if (meta && e.key.toLowerCase() === 'b') {
      e.preventDefault()
      wrapSelection('**')
    } else if (meta && e.key.toLowerCase() === 'i') {
      e.preventDefault()
      wrapSelection('*')
    } else if (meta && e.shiftKey && e.key.toLowerCase() === 'l') {
      e.preventDefault()
      applyFormat('checklist')
    } else if (e.key === 'Enter') {
      // Continue lists on Enter, the way a note-taking app should.
      const area = e.currentTarget
      const upto = note.body.slice(0, area.selectionStart)
      const line = upto.slice(upto.lastIndexOf('\n') + 1)
      const cont = line.match(/^(\s*)([-*]\s+\[[ xX]\]\s?|[-*]\s+|(\d+)[.)]\s+)/)
      if (!cont) return
      e.preventDefault()
      const rest = note.body.slice(area.selectionEnd)
      if (line.replace(cont[0], '').trim() === '') {
        // Empty list item: end the list instead of adding another bullet.
        const body = note.body.slice(0, area.selectionStart - cont[0].length) + '\n' + rest
        updateNote(note.id, { body })
        return
      }
      const marker = cont[3]
        ? `${cont[1]}${Number(cont[3]) + 1}. `
        : `${cont[1]}${cont[2].replace(/\[[xX]\]/, '[ ]')}`
      const body = note.body.slice(0, area.selectionStart) + '\n' + marker + rest
      updateNote(note.id, { body })
      requestAnimationFrame(() => {
        const pos = area.selectionStart + 1 + marker.length
        area.setSelectionRange(pos, pos)
      })
    }
  }

  if (note.trashedAt) {
    return (
      <section className={`editor${onBack ? ' editor--pushed' : ''}`}>
        {onBack && <BackBar onBack={onBack} />}
        <div className="editor__trashbar">
          <span>This note is in the Recently Deleted folder.</span>
          <button type="button" className="btn" onClick={() => restoreNote(note.id)}>Recover</button>
          <button type="button" className="btn btn--danger" onClick={() => deleteNoteForever(note.id)}>Delete Forever</button>
        </div>
        <div className="editor__page scroll">
          <RenderedNote body={note.body} onToggleCheck={() => undefined} />
        </div>
      </section>
    )
  }

  return (
    <section className={`editor${onBack ? ' editor--pushed' : ''}`} aria-label="Note editor">
      {onBack && <BackBar onBack={onBack} />}
      <header className="editor__bar">
        <div className="editor__formats">
          <button type="button" className="fmt" onClick={() => applyFormat('title')} title="Title">T</button>
          <button type="button" className="fmt" onClick={() => applyFormat('heading')} title="Heading">H</button>
          <button type="button" className="fmt" onClick={() => applyFormat('body')} title="Body">¶</button>
          <span className="fmt__sep" />
          <button type="button" className="fmt" onClick={() => applyFormat('checklist')} title="Checklist (⇧⌘L)">
            <Icon name="checklist" size={15} />
          </button>
          <button type="button" className="fmt" onClick={() => applyFormat('bullet')} title="Bulleted list">
            <Icon name="list" size={15} />
          </button>
          <button type="button" className="fmt" onClick={() => applyFormat('numbered')} title="Numbered list">1.</button>
          <button type="button" className="fmt" onClick={() => applyFormat('quote')} title="Quote">”</button>
          <span className="fmt__sep" />
          <button type="button" className="fmt" onClick={() => wrapSelection('**')} title="Bold (⌘B)"><b>B</b></button>
          <button type="button" className="fmt" onClick={() => wrapSelection('*')} title="Italic (⌘I)"><i>I</i></button>
          <button type="button" className="fmt" onClick={() => wrapSelection('`')} title="Code"><code>{'<>'}</code></button>
        </div>

        <div className="toolbar__spacer" />

        <button
          type="button"
          className={`tool-btn${note.pinned ? ' is-active' : ''}`}
          onClick={() => toggleNotePin(note.id)}
          title={note.pinned ? 'Unpin' : 'Pin'}
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
          title="Make a reminder from this note"
        >
          <Icon name="checklist" size={15} />
        </button>
        <button type="button" className="tool-btn" onClick={() => trashNote(note.id)} title="Delete note">
          <Icon name="trash" size={15} />
        </button>
        <button
          type="button"
          className={`tool-btn${preview ? ' is-active' : ''}`}
          onClick={() => setPreview((v) => !v)}
          title={preview ? 'Edit markup' : 'Preview'}
        >
          <Icon name={preview ? 'text' : 'grid'} size={15} />
        </button>
      </header>

      <div className="editor__page scroll">
        <p className="editor__stamp">
          {relativeStamp(note.updatedAt)}
          {folder ? ` · ${folder.name}` : ''}
        </p>

        {preview ? (
          <div className="editor__rendered" onDoubleClick={() => setPreview(false)}>
            {note.body.trim() ? (
              <RenderedNote
                body={note.body}
                onToggleCheck={(line) => updateNote(note.id, { body: toggleCheckLine(note.body, line) })}
              />
            ) : (
              <p className="editor__placeholder">Empty note — double-click to start writing.</p>
            )}
          </div>
        ) : (
          <textarea
            ref={areaRef}
            className="editor__area"
            value={note.body}
            placeholder="Start writing…"
            onChange={(e) => updateNote(note.id, { body: e.target.value })}
            onKeyDown={onKeyDown}
            aria-label={noteTitleOf(note.body)}
            spellCheck
          />
        )}

        <div className="editor__tags">
          {note.tags.map((id) => {
            const tag = state.tags.find((t) => t.id === id)
            if (!tag) return null
            return (
              <button
                key={id}
                type="button"
                className={`tag-chip tint-${tag.tint} is-on`}
                onClick={() => updateNote(note.id, { tags: note.tags.filter((t) => t !== id) })}
                title="Remove tag"
              >
                #{tag.name}
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
              placeholder="Add tag…"
              value={newTag}
              onChange={(e) => setNewTag(e.target.value)}
              aria-label="Add tag"
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
