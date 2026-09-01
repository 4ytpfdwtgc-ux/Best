import { useEffect, useRef } from 'react'
import type { Block } from '../../types'
import { hasChildren, orderedIndex } from '../../lib/blocks'
import { decorateInline } from '../../lib/inline'
import { Icon } from '../ui/Icon'

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
  onToggleCheck,
  onToggleCollapse,
  onInsertAfter,
  onOpenMenu,
  onDragStart,
}: {
  block: Block
  index: number
  blocks: Block[]
  active: boolean
  dragging: boolean
  onChange: (text: string) => void
  onKeyDown: (e: React.KeyboardEvent<HTMLDivElement>, el: HTMLElement) => void
  onFocus: (el: HTMLElement) => void
  onToggleCheck: () => void
  onToggleCollapse: () => void
  onInsertAfter: () => void
  onOpenMenu: (anchor: DOMRect) => void
  onDragStart: (e: React.PointerEvent) => void
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
      // Paste as plain text so pasted markup cannot smuggle in nodes.
      onPaste={(e) => {
        e.preventDefault()
        const text = e.clipboardData.getData('text/plain')
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

        {block.type === 'divider' ? <hr className="blk__divider" /> : editable}
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
    default: return active ? "Type '/' for commands" : ''
  }
}

/** Notion's six-dot drag affordance. */
function DragGlyph() {
  return (
    <svg width="12" height="14" viewBox="0 0 12 14" aria-hidden="true">
      {[3, 7, 11].map((y) =>
        [3, 9].map((x) => <circle key={`${x}-${y}`} cx={x} cy={y} r="1.4" fill="currentColor" />),
      )}
    </svg>
  )
}
