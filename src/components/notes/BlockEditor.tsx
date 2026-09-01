import { useCallback, useMemo, useRef, useState } from 'react'
import type { Block, BlockType, Note, TintName } from '../../types'
import {
  emptyBlock, hiddenBlockIds, LIST_TYPES, matchShortcut,
} from '../../lib/blocks'
import { focusBlock, getCaretOffset, isCaretAtEnd, isCaretAtStart } from '../../lib/caret'
import { toggleMark } from '../../lib/inline'
import { setBlocks, updateNote } from '../../state/actions'
import { BlockRow } from './BlockRow'
import { SlashMenu } from './SlashMenu'
import { BlockMenu } from './BlockMenu'

interface DragState {
  id: string
  overIndex: number
  after: boolean
}

/** The page body: a title, an optional icon, and a list of blocks. */
export function BlockEditor({ note }: { note: Note }) {
  const [activeId, setActiveId] = useState<string | null>(null)
  const [slash, setSlash] = useState<{ blockId: string; start: number; top: number; left: number } | null>(null)
  const [menu, setMenu] = useState<{ blockId: string; top: number; left: number } | null>(null)
  const [drag, setDrag] = useState<DragState | null>(null)
  // The pointer handlers read the live value here; `drag` only drives rendering.
  const dragRef = useRef<DragState | null>(null)
  const blocksRef = useRef(note.blocks)
  blocksRef.current = note.blocks

  const hidden = useMemo(() => hiddenBlockIds(note.blocks), [note.blocks])

  const commit = useCallback(
    (next: Block[]) => {
      blocksRef.current = next
      setBlocks(note.id, next)
    },
    [note.id],
  )

  const patchBlock = useCallback(
    (id: string, patch: Partial<Block>) =>
      commit(blocksRef.current.map((b) => (b.id === id ? { ...b, ...patch } : b))),
    [commit],
  )

  /* ---------------------------------------------------------------- */
  /* Typing                                                            */
  /* ---------------------------------------------------------------- */

  function onChange(block: Block, text: string) {
    // A markdown prefix converts the block instead of staying as text.
    const shortcut = matchShortcut(text)
    if (shortcut && block.type !== 'code') {
      const converted: Partial<Block> =
        shortcut === 'divider'
          ? { type: 'divider', text: '' }
          : { type: shortcut, text: '', ...(shortcut === 'todo' ? { checked: false } : {}) }
      patchBlock(block.id, converted)
      if (shortcut === 'divider') {
        const fresh = emptyBlock('text', block.indent)
        const next = [...blocksRef.current]
        next.splice(next.findIndex((b) => b.id === block.id) + 1, 0, fresh)
        commit(next)
        focusBlock(fresh.id)
      } else {
        focusBlock(block.id, 0)
      }
      return
    }

    patchBlock(block.id, { text })

    if (slash?.blockId === block.id) {
      // A space right after the slash means they meant a slash, not a command.
      const after = text.slice(slash.start + 1)
      if (text[slash.start] !== '/' || after.startsWith(' ')) setSlash(null)
    }
  }

  function insertAfter(block: Block, type: BlockType = 'text'): Block {
    const fresh = emptyBlock(type, block.indent)
    const next = [...blocksRef.current]
    next.splice(next.findIndex((b) => b.id === block.id) + 1, 0, fresh)
    commit(next)
    focusBlock(fresh.id)
    return fresh
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLDivElement>, el: HTMLElement, block: Block, index: number) {
    const blocks = blocksRef.current
    const meta = e.metaKey || e.ctrlKey

    if (meta && ['b', 'i', 'e'].includes(e.key.toLowerCase())) {
      e.preventDefault()
      const marker = e.key.toLowerCase() === 'b' ? '**' : e.key.toLowerCase() === 'i' ? '*' : '`'
      const selection = window.getSelection()
      if (!selection || selection.isCollapsed) return
      const end = getCaretOffset(el)
      const start = end - selection.toString().length
      const result = toggleMark(block.text, start, end, marker)
      patchBlock(block.id, { text: result.text })
      focusBlock(block.id, result.end)
      return
    }

    if (e.key === '/' && !slash) {
      const rect = caretRect(el)
      setSlash({ blockId: block.id, start: getCaretOffset(el), top: rect.bottom + 6, left: rect.left })
      return
    }

    if (e.key === 'Escape') {
      setSlash(null)
      return
    }

    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      if (slash) return

      // Enter on an empty list item lifts it out of the list, as Notion does.
      if (LIST_TYPES.includes(block.type) && !block.text) {
        if (block.indent > 0) patchBlock(block.id, { indent: block.indent - 1 })
        else patchBlock(block.id, { type: 'text' })
        return
      }

      const offset = getCaretOffset(el)
      const before = block.text.slice(0, offset)
      const after = block.text.slice(offset)
      const carryType = LIST_TYPES.includes(block.type) && block.type !== 'toggle' ? block.type : 'text'
      const fresh: Block = { ...emptyBlock(carryType, block.indent), text: after }
      const next = [...blocks]
      next[index] = { ...block, text: before }
      next.splice(index + 1, 0, fresh)
      commit(next)
      focusBlock(fresh.id, 0)
      return
    }

    if (e.key === 'Tab') {
      e.preventDefault()
      const previous = blocks[index - 1]
      if (e.shiftKey) {
        if (block.indent > 0) patchBlock(block.id, { indent: block.indent - 1 })
      } else if (previous && block.indent <= previous.indent) {
        patchBlock(block.id, { indent: block.indent + 1 })
      }
      focusBlock(block.id, getCaretOffset(el))
      return
    }

    if (e.key === 'Backspace' && isCaretAtStart(el)) {
      if (block.indent > 0) {
        e.preventDefault()
        patchBlock(block.id, { indent: block.indent - 1 })
        focusBlock(block.id, 0)
        return
      }
      if (block.type !== 'text') {
        e.preventDefault()
        patchBlock(block.id, { type: 'text', checked: undefined, icon: undefined })
        focusBlock(block.id, 0)
        return
      }
      const previous = blocks[index - 1]
      if (!previous) return
      e.preventDefault()
      if (previous.type === 'divider') {
        commit(blocks.filter((b) => b.id !== previous.id))
        focusBlock(block.id, 0)
        return
      }
      const offset = previous.text.length
      const next = blocks
        .map((b) => (b.id === previous.id ? { ...b, text: previous.text + block.text } : b))
        .filter((b) => b.id !== block.id)
      commit(next)
      focusBlock(previous.id, offset)
      return
    }

    if (e.key === 'ArrowUp' && isCaretAtStart(el)) {
      const previous = visible[visible.findIndex((b) => b.id === block.id) - 1]
      if (previous) {
        e.preventDefault()
        focusBlock(previous.id)
      }
      return
    }

    if (e.key === 'ArrowDown' && isCaretAtEnd(el)) {
      const next = visible[visible.findIndex((b) => b.id === block.id) + 1]
      if (next) {
        e.preventDefault()
        focusBlock(next.id, 0)
      }
    }
  }

  /** Replace the slash command with the chosen block type. */
  function pickBlockType(type: BlockType) {
    if (!slash) return
    const block = blocksRef.current.find((b) => b.id === slash.blockId)
    if (!block) return setSlash(null)

    const text = block.text.slice(0, slash.start) + block.text.slice(slash.start).replace(/^\/[^\s]*/, '')
    setSlash(null)

    if (type === 'divider') {
      const next = [...blocksRef.current]
      const index = next.findIndex((b) => b.id === block.id)
      next[index] = { ...block, type: 'divider', text: '' }
      const fresh = emptyBlock('text', block.indent)
      next.splice(index + 1, 0, fresh)
      commit(next)
      focusBlock(fresh.id)
      return
    }

    const fresh = emptyBlock(type, block.indent)
    patchBlock(block.id, {
      type,
      text,
      checked: fresh.checked,
      collapsed: fresh.collapsed,
      tint: fresh.tint,
      icon: fresh.icon,
    })
    focusBlock(block.id, slash.start)
  }

  /* ---------------------------------------------------------------- */
  /* Drag to reorder                                                   */
  /* ---------------------------------------------------------------- */

  function startDrag(e: React.PointerEvent, block: Block) {
    e.preventDefault()
    const origin = { x: e.clientX, y: e.clientY }
    let moved = false

    const onMove = (ev: PointerEvent) => {
      if (Math.hypot(ev.clientX - origin.x, ev.clientY - origin.y) < 4) return
      moved = true
      const target = document
        .elementFromPoint(ev.clientX, ev.clientY)
        ?.closest<HTMLElement>('[data-block-index]')
      if (!target) return
      const rect = target.getBoundingClientRect()
      dragRef.current = {
        id: block.id,
        overIndex: Number(target.dataset.blockIndex),
        after: ev.clientY > rect.top + rect.height / 2,
      }
      setDrag(dragRef.current)
    }

    const onUp = () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('pointercancel', onUp)
      const current = dragRef.current
      dragRef.current = null
      setDrag(null)
      if (moved && current) applyDrop(block.id, current)
    }

    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    window.addEventListener('pointercancel', onUp)
  }

  function applyDrop(id: string, state: DragState) {
    const blocks = blocksRef.current
    const from = blocks.findIndex((b) => b.id === id)
    if (from === -1) return

    // A block carries whatever is nested under it.
    let end = from + 1
    while (end < blocks.length && blocks[end].indent > blocks[from].indent) end++
    const moving = blocks.slice(from, end)
    if (state.overIndex >= from && state.overIndex < end) return

    const rest = [...blocks.slice(0, from), ...blocks.slice(end)]
    const anchor = blocks[state.overIndex]
    const target = rest.findIndex((b) => b.id === anchor?.id)
    const at = target === -1 ? rest.length : target + (state.after ? 1 : 0)
    rest.splice(at, 0, ...moving)
    commit(rest)
  }

  const visible = note.blocks.filter((b) => !hidden.has(b.id))
  const menuBlock = menu ? note.blocks.find((b) => b.id === menu.blockId) : null

  return (
    <div className="page">
      <div className="page__header">
        <button
          type="button"
          className="page__icon"
          onClick={() => {
            const icon = prompt('Page icon (emoji)', note.icon ?? '📄')
            if (icon !== null) updateNote(note.id, { icon: icon.trim() || undefined })
          }}
          aria-label="Change page icon"
        >
          {note.icon ?? '📄'}
        </button>
        <input
          className="page__title"
          value={note.title}
          placeholder="Untitled"
          aria-label="Page title"
          onChange={(e) => updateNote(note.id, { title: e.target.value })}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || (e.key === 'ArrowDown' && note.blocks[0])) {
              e.preventDefault()
              focusBlock(note.blocks[0].id, 0)
            }
          }}
        />
      </div>

      <div className="page__blocks">
        {visible.map((block) => {
          const index = note.blocks.findIndex((b) => b.id === block.id)
          const showLine = drag && drag.overIndex === index && drag.id !== block.id
          return (
            <div key={block.id} className="blk__slot">
              {showLine && !drag!.after && <div className="blk__dropline" />}
              <BlockRow
                block={block}
                index={index}
                blocks={note.blocks}
                active={activeId === block.id}
                dragging={drag?.id === block.id}
                onChange={(text) => onChange(block, text)}
                onKeyDown={(e, el) => onKeyDown(e, el, block, index)}
                onFocus={() => setActiveId(block.id)}
                onToggleCheck={() => patchBlock(block.id, { checked: !block.checked })}
                onToggleCollapse={() => patchBlock(block.id, { collapsed: !block.collapsed })}
                onInsertAfter={() => insertAfter(block)}
                onOpenMenu={(rect) => setMenu({ blockId: block.id, top: rect.bottom + 6, left: rect.left })}
                onDragStart={(e) => startDrag(e, block)}
              />
              {showLine && drag!.after && <div className="blk__dropline" />}
            </div>
          )
        })}

        <button
          type="button"
          className="page__tail"
          onClick={() => {
            const last = note.blocks[note.blocks.length - 1]
            if (last && !last.text && last.type === 'text') focusBlock(last.id)
            else if (last) insertAfter(last)
          }}
          aria-label="Add a block"
        >
          Click here to continue writing…
        </button>
      </div>

      {slash && (
        <SlashMenu
          query={
            (note.blocks.find((b) => b.id === slash.blockId)?.text ?? '')
              .slice(slash.start + 1)
              .split(' ')[0]
          }
          position={{ top: slash.top, left: slash.left }}
          onPick={pickBlockType}
          onClose={() => setSlash(null)}
        />
      )}

      {menu && menuBlock && (
        <BlockMenu
          block={menuBlock}
          position={{ top: menu.top, left: menu.left }}
          onClose={() => setMenu(null)}
          onTurnInto={(type) => {
            const fresh = emptyBlock(type, menuBlock.indent)
            patchBlock(menuBlock.id, {
              type,
              checked: fresh.checked,
              collapsed: fresh.collapsed,
              tint: type === 'callout' ? (menuBlock.tint ?? fresh.tint) : undefined,
              icon: type === 'callout' ? (menuBlock.icon ?? fresh.icon) : undefined,
            })
            setMenu(null)
          }}
          onTint={(tint: TintName) => {
            patchBlock(menuBlock.id, { tint })
            setMenu(null)
          }}
          onDuplicate={() => {
            const next = [...blocksRef.current]
            const index = next.findIndex((b) => b.id === menuBlock.id)
            next.splice(index + 1, 0, { ...menuBlock, id: emptyBlock().id })
            commit(next)
            setMenu(null)
          }}
          onDelete={() => {
            commit(blocksRef.current.filter((b) => b.id !== menuBlock.id))
            setMenu(null)
          }}
        />
      )}
    </div>
  )
}

function caretRect(fallback: HTMLElement): DOMRect {
  const selection = window.getSelection()
  if (selection && selection.rangeCount) {
    const rect = selection.getRangeAt(0).getBoundingClientRect()
    if (rect.width || rect.height || rect.top) return rect
  }
  return fallback.getBoundingClientRect()
}
