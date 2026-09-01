import { useEffect, useMemo, useRef, useState } from 'react'
import type { BlockType } from '../../types'
import { BLOCK_MENU } from '../../lib/blocks'

/** The `/` insert menu. Filtering, arrow keys and Enter are handled here. */
export function SlashMenu({
  query,
  position,
  onPick,
  onClose,
}: {
  query: string
  position: { top: number; left: number }
  onPick: (type: BlockType) => void
  onClose: () => void
}) {
  const [cursor, setCursor] = useState(0)
  const listRef = useRef<HTMLDivElement>(null)

  const items = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return BLOCK_MENU
    return BLOCK_MENU.filter(
      (b) => b.label.toLowerCase().includes(q) || b.keywords.some((k) => k.startsWith(q)),
    )
  }, [query])

  useEffect(() => setCursor(0), [query])

  // Nothing matches any more, so the user is just typing prose.
  useEffect(() => {
    if (items.length === 0) onClose()
  }, [items.length, onClose])

  /* The menu never takes focus — the block keeps it — so keys are caught here. */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setCursor((c) => (c + 1) % Math.max(1, items.length))
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        setCursor((c) => (c - 1 + items.length) % Math.max(1, items.length))
      } else if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault()
        if (items[cursor]) onPick(items[cursor].type)
      } else if (e.key === 'Escape') {
        e.preventDefault()
        onClose()
      }
    }
    document.addEventListener('keydown', onKey, true)
    return () => document.removeEventListener('keydown', onKey, true)
  }, [items, cursor, onPick, onClose])

  useEffect(() => {
    listRef.current
      ?.querySelector<HTMLElement>('.menu__item.is-on')
      ?.scrollIntoView({ block: 'nearest' })
  }, [cursor])

  if (!items.length) return null

  return (
    <div
      ref={listRef}
      className="menu slash"
      style={{ top: position.top, left: position.left }}
      role="listbox"
      aria-label="Insert a block"
    >
      <div className="menu__label">Basic blocks</div>
      {items.map((item, i) => (
        <button
          key={item.type}
          type="button"
          role="option"
          aria-selected={i === cursor}
          className={`menu__item${i === cursor ? ' is-on' : ''}`}
          onMouseEnter={() => setCursor(i)}
          // Keep focus in the block: mousedown would blur it first.
          onMouseDown={(e) => {
            e.preventDefault()
            onPick(item.type)
          }}
        >
          <span className="menu__icon">{item.glyph}</span>
          <span className="menu__text">
            {item.label}
            <span className="menu__sub">{item.hint}</span>
          </span>
        </button>
      ))}
    </div>
  )
}
