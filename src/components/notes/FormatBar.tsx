import { useEffect, useRef, useState } from 'react'
import type { Block, BlockType, NoteFont, Note, TintName } from '../../types'
import { NOTE_SCALES } from '../../types'
import { TINTS } from '../../types'
import type { MarkName } from '../../lib/inline'
import { Icon } from '../ui/Icon'
import { AttachMenu, type AttachAction } from './AttachMenu'

/** The styles the sheet offers, in the order iOS Notes lists them. */
const STYLES: { type: BlockType; label: string; glyph: string }[] = [
  { type: 'h1', label: 'Title', glyph: 'T' },
  { type: 'h2', label: 'Heading', glyph: 'H' },
  { type: 'h3', label: 'Subheading', glyph: 'S' },
  { type: 'text', label: 'Body', glyph: 'B' },
  { type: 'code', label: 'Monostyled', glyph: 'M' },
]

const LISTS: { type: BlockType; label: string; glyph: string }[] = [
  { type: 'todo', label: 'Checklist', glyph: '☑' },
  { type: 'bullet', label: 'Bulleted', glyph: '•' },
  { type: 'numbered', label: 'Numbered', glyph: '1.' },
  { type: 'quote', label: 'Quote', glyph: '"' },
]

const FONTS: { font: NoteFont; label: string }[] = [
  { font: 'system', label: 'System' },
  { font: 'serif', label: 'Serif' },
  { font: 'rounded', label: 'Rounded' },
  { font: 'mono', label: 'Mono' },
]

/** The marks the bar carries, with what each one looks like on the button. */
const MARK_BUTTONS: { name: MarkName; label: string; className: string; glyph: string }[] = [
  { name: 'bold', label: 'Bold', className: 'fmt__b', glyph: 'B' },
  { name: 'italic', label: 'Italic', className: 'fmt__i', glyph: 'I' },
  { name: 'underline', label: 'Underline', className: 'fmt__u', glyph: 'U' },
  { name: 'strike', label: 'Strikethrough', className: 'fmt__s', glyph: 'S' },
  { name: 'highlight', label: 'Highlight', className: 'fmt__hl', glyph: 'H' },
  { name: 'code', label: 'Monospace', className: 'fmt__code', glyph: '<>' },
]

/**
 * The formatting bar, and the sheet behind its Aa.
 *
 * It appears while a block is being edited and sits at the bottom of the page,
 * where iOS puts the same thing: above the keyboard when there is one, above
 * the tab bar when there is not.
 *
 * Every control refuses the pointer's default action, so pressing one never
 * moves focus out of the text being formatted. Losing the selection to the
 * button that is about to format it is the failure this whole component is
 * arranged to avoid.
 */
export function FormatBar({
  note,
  block,
  marks,
  onMark,
  onStyle,
  onIndent,
  onColor,
  onBackground,
  onFont,
  onScale,
  onAttach,
  onPause,
  onResume,
  onDone,
  focusedAt,
}: {
  note: Note
  /** The block being edited, or the last one that was. */
  block: Block
  /** Which marks the current selection already carries. */
  marks: ReadonlySet<MarkName>
  onMark: (name: MarkName) => void
  onStyle: (type: BlockType) => void
  onIndent: (delta: 1 | -1) => void
  onColor: (color?: TintName) => void
  onBackground: (tint?: TintName) => void
  onFont: (font: NoteFont) => void
  onScale: (scale: number) => void
  /** The plus: a photo, the camera, a scan, a recording, a file. */
  onAttach: (action: AttachAction) => void
  /** Put the keyboard away, so a panel can have the room it was using. */
  onPause: () => void
  /** Bring it back, with the caret where it was. */
  onResume: () => void
  /** Finished writing: keyboard away, bar gone. */
  onDone: () => void
  /**
   * Rises whenever a block takes focus. Going back to the writing puts a
   * panel away, or the keyboard would come up underneath it and the two would
   * be sharing the screen again.
   */
  focusedAt: number
}) {
  const [open, setOpen] = useState(false)
  const [attaching, setAttaching] = useState(false)
  const scale = note.fontScale ?? 1
  const step = (delta: number) => {
    const at = NOTE_SCALES.indexOf(scale as (typeof NOTE_SCALES)[number])
    const next = NOTE_SCALES[Math.min(NOTE_SCALES.length - 1, Math.max(0, (at === -1 ? 1 : at) + delta))]
    onScale(next)
  }

  useEffect(() => {
    setOpen(false)
    setAttaching(false)
  }, [focusedAt])

  useKeyboardInset()

  /* A press must not take focus from the text it is about to format. */
  const hold = (e: React.PointerEvent | React.MouseEvent) => e.preventDefault()

  /**
   * A panel replaces the keyboard rather than stacking on top of it.
   *
   * On a phone the keyboard already owns half the screen. A card that opens
   * above it gets whatever is left, which on a small screen is a scrolling
   * sliver -- and the writing it is meant to be formatting is pushed off
   * entirely. So opening one puts the keyboard away and takes the room it was
   * using, which is what iOS does with the same panel; closing it brings the
   * keyboard back with the caret where it was left.
   */
  const show = (panel: 'format' | 'attach' | null) => {
    const wasOpen = open || attaching
    setOpen(panel === 'format')
    setAttaching(panel === 'attach')
    if (panel) onPause()
    else if (wasOpen) onResume()
  }

  return (
    <div className="fmt" contentEditable={false}>
      {open && !attaching && (
        <div className="fmt__sheet" role="dialog" aria-label="Format">
          <div className="fmt__head">
            <span className="fmt__title">Format</span>
            <button
              type="button"
              className="fmt__close"
              onPointerDown={hold}
              onClick={() => show(null)}
              aria-label="Close formatting"
            >
              <Icon name="close" size={15} strokeWidth={2.2} />
            </button>
          </div>

          <Group label="Style">
            {STYLES.map((s) => (
              <Choice
                key={s.type}
                on={block.type === s.type}
                label={s.label}
                onPick={() => onStyle(s.type)}
                className={`fmt__style fmt__style--${s.type}`}
              >
                {s.label}
              </Choice>
            ))}
          </Group>

          <Group label="List">
            {LISTS.map((l) => (
              <Choice
                key={l.type}
                on={block.type === l.type}
                label={l.label}
                onPick={() => onStyle(block.type === l.type ? 'text' : l.type)}
              >
                <span className="fmt__glyph">{l.glyph}</span>
                {l.label}
              </Choice>
            ))}
          </Group>

          <Group label="Font">
            {FONTS.map((f) => (
              <Choice
                key={f.font}
                on={(note.font ?? 'system') === f.font}
                label={f.label}
                onPick={() => onFont(f.font)}
                className={`fmt__font note-font--${f.font}`}
              >
                {f.label}
              </Choice>
            ))}
            <span className="fmt__sizes">
              <button
                type="button"
                className="fmt__size"
                onPointerDown={hold}
                onClick={() => step(-1)}
                aria-label="Smaller text"
                disabled={scale <= NOTE_SCALES[0]}
              >
                A
              </button>
              <button
                type="button"
                className="fmt__size fmt__size--big"
                onPointerDown={hold}
                onClick={() => step(1)}
                aria-label="Bigger text"
                disabled={scale >= NOTE_SCALES[NOTE_SCALES.length - 1]}
              >
                A
              </button>
            </span>
          </Group>

          <Group label="Text colour">
            <Swatch on={!block.color} label="Default" onPick={() => onColor(undefined)} />
            {TINTS.map((tint) => (
              <Swatch
                key={tint}
                tint={tint}
                on={block.color === tint}
                label={tint}
                onPick={() => onColor(tint)}
              />
            ))}
          </Group>

          <Group label="Background">
            <Swatch on={!block.tint} label="None" onPick={() => onBackground(undefined)} />
            {TINTS.map((tint) => (
              <Swatch
                key={tint}
                tint={tint}
                filled
                on={block.tint === tint}
                label={tint}
                onPick={() => onBackground(tint)}
              />
            ))}
          </Group>
        </div>
      )}

      {attaching && (
        <AttachMenu
          onPick={(action) => {
            // The action either opens a picker or wants the caret back.
            setAttaching(false)
            onAttach(action)
          }}
          onClose={() => show(null)}
        />
      )}

      <div className="fmt__bar">
        <div className="fmt__scroll">
        <button
          type="button"
          className={`fmt__btn fmt__plus${attaching ? ' is-on' : ''}`}
          onPointerDown={hold}
          onClick={() => show(attaching ? null : 'attach')}
          aria-expanded={attaching}
          aria-label="Attach a photo, a scan, a recording or a file"
        >
          <Icon name="plus" size={17} strokeWidth={2} />
        </button>

        <button
          type="button"
          className={`fmt__btn fmt__aa${open ? ' is-on' : ''}`}
          onPointerDown={hold}
          onClick={() => show(open ? null : 'format')}
          aria-expanded={open}
          aria-label="Style, font and colour"
        >
          Aa
        </button>

        <span className="fmt__sep" />

        {MARK_BUTTONS.map((m) => (
          <button
            key={m.name}
            type="button"
            className={`fmt__btn ${m.className}${marks.has(m.name) ? ' is-on' : ''}`}
            onPointerDown={hold}
            onClick={() => onMark(m.name)}
            aria-pressed={marks.has(m.name)}
            aria-label={m.label}
            title={m.label}
          >
            {m.glyph}
          </button>
        ))}

        <span className="fmt__sep" />

        <button
          type="button"
          className="fmt__btn"
          onPointerDown={hold}
          onClick={() => onIndent(-1)}
          aria-label="Outdent"
          title="Outdent"
          disabled={block.indent === 0}
        >
          <Icon name="chevronLeft" size={15} strokeWidth={2.2} />
        </button>
        <button
          type="button"
          className="fmt__btn"
          onPointerDown={hold}
          onClick={() => onIndent(1)}
          aria-label="Indent"
          title="Indent"
        >
          <Icon name="chevronRight" size={15} strokeWidth={2.2} />
        </button>
        </div>

        {/*
          * Done sits outside the scrolling row. On a narrow phone the marks
          * run past the edge, and the one button that puts everything away
          * must never be the one scrolled off it.
          */}
        <button
          type="button"
          className="fmt__btn fmt__done"
          onPointerDown={hold}
          onClick={() => {
            setOpen(false)
            setAttaching(false)
            onDone()
          }}
          aria-label="Done editing"
          title="Done"
        >
          <Icon name="chevronDown" size={16} strokeWidth={2.2} />
        </button>
      </div>
    </div>
  )
}

function Group({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="fmt__group">
      <div className="fmt__label">{label}</div>
      <div className="fmt__row">{children}</div>
    </div>
  )
}

function Choice({
  on,
  label,
  onPick,
  className = '',
  children,
}: {
  on: boolean
  label: string
  onPick: () => void
  className?: string
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      className={`fmt__choice ${className}${on ? ' is-on' : ''}`}
      onPointerDown={(e) => e.preventDefault()}
      onClick={onPick}
      aria-pressed={on}
      aria-label={label}
    >
      {children}
    </button>
  )
}

function Swatch({
  tint,
  on,
  filled,
  label,
  onPick,
}: {
  tint?: TintName
  on: boolean
  filled?: boolean
  label: string
  onPick: () => void
}) {
  return (
    <button
      type="button"
      className={`fmt__swatch${tint ? ` tint-${tint}` : ' fmt__swatch--none'}${
        filled ? ' fmt__swatch--filled' : ''
      }${on ? ' is-on' : ''}`}
      onPointerDown={(e) => e.preventDefault()}
      onClick={onPick}
      aria-pressed={on}
      aria-label={label}
      title={label}
    >
      {tint ? '' : '⦸'}
    </button>
  )
}

/**
 * Keep the bar above the on-screen keyboard.
 *
 * A fixed element belongs to the layout viewport, which iOS does not shrink
 * when the keyboard appears -- so a bar pinned to the bottom would sit behind
 * it. The visual viewport knows how much is covered; the root carries it as a
 * length the stylesheet can use.
 */
function useKeyboardInset() {
  const raf = useRef<number>()
  useEffect(() => {
    const vv = window.visualViewport
    if (!vv) return
    const apply = () => {
      cancelAnimationFrame(raf.current ?? 0)
      raf.current = requestAnimationFrame(() => {
        const covered = Math.max(0, window.innerHeight - vv.height - vv.offsetTop)
        document.documentElement.style.setProperty('--keyboard', `${Math.round(covered)}px`)
      })
    }
    apply()
    vv.addEventListener('resize', apply)
    vv.addEventListener('scroll', apply)
    return () => {
      cancelAnimationFrame(raf.current ?? 0)
      vv.removeEventListener('resize', apply)
      vv.removeEventListener('scroll', apply)
      document.documentElement.style.removeProperty('--keyboard')
    }
  }, [])
}
