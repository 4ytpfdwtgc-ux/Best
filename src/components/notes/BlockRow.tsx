import { useEffect, useRef } from 'react'
import type { Block } from '../../types'
import { hasChildren, orderedIndex } from '../../lib/blocks'
import { decorateInline } from '../../lib/inline'
import { Icon } from '../ui/Icon'
import { ImageBlock } from './ImageBlock'
import { LinkBlock } from './LinkBlock'
import { FileBlock } from './FileBlock'
import { TableBlock } from './TableBlock'

/**
 * One block. The editable element holds plain text; inline markers are styled
 * in place, so its textContent always matches what is stored.
 */
export function BlockRow({
  block,
  index,
  blocks,
  active,
  dragging,
  onChange,
  onKeyDown,
  onFocus,
  onBlur,
  onToggleCheck,
  onToggleCollapse,
  onInsertAfter,
  onOpenMenu,
  onDragStart,
  onPickImage,
  onClearImageError,
  onPasteImages,
  onPasteURL,
  onSetURL,
  onSetRows,
  onFollowLink,
  imageBusy,
  imageError,
}: {
  block: Block
  index: number
  blocks: Block[]
  active: boolean
  dragging: boolean
  onChange: (text: string) => void
  onKeyDown: (e: React.KeyboardEvent<HTMLDivElement>, el: HTMLElement) => void
  onFocus: (el: HTMLElement) => void
  onBlur: () => void
  onToggleCheck: () => void
  onToggleCollapse: () => void
  onInsertAfter: () => void
  onOpenMenu: (anchor: DOMRect) => void
  onDragStart: (e: React.PointerEvent) => void
  /** `image` only: pictures chosen for this block. */
  onPickImage: (files: File[]) => void
  onClearImageError: () => void
  /** Pictures pasted into this block's text. */
  onPasteImages: (files: File[]) => void
  /** A pasted address, when the block was empty. Returns false to paste as text. */
  onPasteURL: (url: string) => boolean
  /** `link` only. */
  onSetURL: (url: string) => void
  /** `table` only. */
  onSetRows: (rows: string[][]) => void
  /** A link inside the text was clicked: an address, or a `[[Page]]` name. */
  onFollowLink: (target: { href?: string; wiki?: string }) => void
  imageBusy: boolean
  imageError?: string
}) {
  const ref = useRef<HTMLDivElement>(null)
  const handleRef = useRef<HTMLButtonElement>(null)

  /*
   * React must not own this element's contents while it is being typed into,
   * or every keystroke would reset the caret. Sync only when the stored text
   * and the DOM have actually diverged.
   */
  useEffect(() => {
    const el = ref.current
    if (!el) return
    if (el.textContent === block.text) {
      // Text agrees; refresh the inline styling once editing moves elsewhere.
      if (!active && block.type !== 'code') {
        const html = decorateInline(block.text)
        if (el.innerHTML !== html) el.innerHTML = html
      }
      return
    }
    if (active || block.type === 'code') el.textContent = block.text
    else el.innerHTML = decorateInline(block.text)
  }, [block.text, block.type, active])

  const editable = (
    <div
      ref={ref}
      className="blk__text"
      contentEditable
      suppressContentEditableWarning
      spellCheck
      role="textbox"
      aria-multiline="false"
      data-placeholder={placeholderFor(block, active)}
      onInput={(e) => onChange(e.currentTarget.textContent ?? '')}
      onKeyDown={(e) => onKeyDown(e, e.currentTarget)}
      onFocus={(e) => onFocus(e.currentTarget)}
      /*
       * Losing focus is what turns the raw text back into styled text. Without
       * it a block stayed "active" once clicked, and its marks and links only
       * came back when some other block was focused.
       */
      onBlur={onBlur}
      /*
       * A click on a link follows it, but only from a block that is not being
       * edited. Inside the block you are already in, the same click has to
       * place the caret instead — otherwise a link's own text could never be
       * corrected. Caught on mousedown so focus never moves in the first case.
       */
      onMouseDown={(e) => {
        if (active) return
        const link = (e.target as HTMLElement).closest<HTMLElement>('a.ln')
        if (!link) return
        e.preventDefault()
        onFollowLink({ href: link.dataset.href, wiki: link.dataset.wiki })
      }}
      onPaste={(e) => {
        // A copied picture becomes a picture; everything else pastes as plain
        // text, so pasted markup cannot smuggle nodes into the editable.
        const files = [...e.clipboardData.files].filter((f) => f.type.startsWith('image/'))
        e.preventDefault()
        if (files.length) {
          onPasteImages(files)
          return
        }
        // An address pasted into an empty block becomes a card, the way iOS
        // does it. Pasted into writing it stays writing.
        const text = e.clipboardData.getData('text/plain')
        if (onPasteURL(text)) return
        document.execCommand('insertText', false, text)
      }}
    />
  )

  return (
    <div
      className={`blk blk--${block.type}${dragging ? ' is-dragging' : ''}${
        block.type === 'callout' ? ` tint-${block.tint ?? 'gray'}` : ''
      }`}
      data-block-id={block.id}
      data-block-index={index}
      style={{ marginLeft: block.indent * 24 }}
    >
      <div className="blk__gutter" contentEditable={false}>
        <button type="button" className="blk__add" onClick={onInsertAfter} aria-label="Add a block below" title="Add a block below">
          <Icon name="plus" size={15} strokeWidth={2} />
        </button>
        <button
          ref={handleRef}
          type="button"
          className="blk__handle"
          aria-label="Drag to move, click for options"
          title="Drag to move, click for options"
          onPointerDown={onDragStart}
          onClick={() => {
            const rect = handleRef.current?.getBoundingClientRect()
            if (rect) onOpenMenu(rect)
          }}
        >
          <DragGlyph />
        </button>
      </div>

      <div className="blk__body">
        {block.type === 'todo' && (
          <button
            type="button"
            className={`blk__check${block.checked ? ' is-on' : ''}`}
            onClick={onToggleCheck}
            aria-pressed={block.checked ?? false}
            aria-label={block.text || 'To-do'}
            contentEditable={false}
          >
            {block.checked ? <Icon name="check" size={11} strokeWidth={3} /> : null}
          </button>
        )}

        {block.type === 'toggle' && (
          <button
            type="button"
            className={`blk__toggle${block.collapsed ? '' : ' is-open'}`}
            onClick={onToggleCollapse}
            aria-expanded={!block.collapsed}
            aria-label={block.collapsed ? 'Expand' : 'Collapse'}
            contentEditable={false}
            data-empty={hasChildren(blocks, index) ? undefined : 'true'}
          >
            <Icon name="chevronRight" size={13} strokeWidth={2.4} />
          </button>
        )}

        {block.type === 'bullet' && <span className="blk__bullet" contentEditable={false}>•</span>}

        {block.type === 'numbered' && (
          <span className="blk__number" contentEditable={false}>{orderedIndex(blocks, index)}.</span>
        )}

        {block.type === 'callout' && (
          <span className="blk__callout-icon" contentEditable={false}>{block.icon ?? '💡'}</span>
        )}

        {block.type === 'table' && <TableBlock block={block} onChange={onSetRows} />}

        {block.type === 'file' && (
          <FileBlock
            block={block}
            busy={imageBusy}
            error={imageError}
            onPick={onPickImage}
            onRetry={onClearImageError}
          />
        )}

        {block.type === 'image' && (
          <ImageBlock
            block={block}
            busy={imageBusy}
            error={imageError}
            onPick={onPickImage}
            onRetry={onClearImageError}
          />
        )}

        {/* A card carries the editable itself, as its title. */}
        {block.type === 'link' ? (
          <LinkBlock block={block} title={editable} onSetURL={onSetURL} />
        ) : block.type === 'divider' ? (
          <hr className="blk__divider" />
        ) : (
          editable
        )}
      </div>
    </div>
  )
}

function placeholderFor(block: Block, active: boolean): string {
  if (block.text) return ''
  switch (block.type) {
    case 'h1': return 'Heading 1'
    case 'h2': return 'Heading 2'
    case 'h3': return 'Heading 3'
    case 'todo': return 'To-do'
    case 'bullet':
    case 'numbered': return 'List'
    case 'toggle': return 'Toggle'
    case 'quote': return 'Empty quote'
    case 'callout': return 'Write something…'
    case 'code': return 'Code'
    case 'image': return active ? 'Write a caption…' : ''
    case 'file': return active ? 'Name this file…' : ''
    case 'table': return active ? 'Caption this table…' : ''
    case 'link': return 'Untitled link'
    default: return active ? "Type '/' for commands" : ''
  }
}

/** Notion's six-dot drag affordance. */
function DragGlyph() {
  return (
    <svg width="12" height="14" viewBox="0 0 12 14" aria-hidden="true">
      {[3, 7, 11].map((y) =>
        [3, 9].map((x) => <circle key={`${x}-${y}`} cx={x} cy={y} r="1.15" fill="currentColor" />),
      )}
    </svg>
  )
}
