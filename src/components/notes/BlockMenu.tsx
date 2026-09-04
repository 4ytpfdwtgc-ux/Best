import { useEffect, useRef } from 'react'
import type { Block, BlockType, TintName } from '../../types'
import { BLOCK_MENU, CALLOUT_TINTS } from '../../lib/blocks'
import { Icon } from '../ui/Icon'

/** The menu behind a block's drag handle: turn into, colour, duplicate, delete. */
export function BlockMenu({
  block,
  position,
  onClose,
  onTurnInto,
  onTint,
  onDuplicate,
  onDelete,
}: {
  block: Block
  position: { top: number; left: number }
  onClose: () => void
  onTurnInto: (type: BlockType) => void
  onTint: (tint: TintName) => void
  onDuplicate: () => void
  onDelete: () => void
}) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) onClose()
    }
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [onClose])

  return (
    <div ref={ref} className="menu blockmenu" style={{ top: position.top, left: position.left }} role="menu">
      <button type="button" className="menu__item" onClick={onDuplicate} role="menuitem">
        <span className="menu__icon"><Icon name="grid" size={14} /></span>
        Duplicate
      </button>
      <button type="button" className="menu__item menu__item--danger" onClick={onDelete} role="menuitem">
        <span className="menu__icon"><Icon name="trash" size={14} /></span>
        Delete
      </button>

      {!['image', 'link', 'file'].includes(block.type) && (
        <>
      <div className="menu__sep" />
      <div className="menu__label">Turn into</div>
      <div className="blockmenu__grid">
        {/* A picture or a card cannot be conjured from text, and turning one
            into text would drop it silently, so neither is offered. */}
        {BLOCK_MENU.filter((b) => !['divider', 'image', 'link', 'file'].includes(b.type)).map((item) => (
          <button
            key={item.type}
            type="button"
            role="menuitem"
            className={`blockmenu__type${block.type === item.type ? ' is-on' : ''}`}
            onClick={() => onTurnInto(item.type)}
            title={item.label}
          >
            <span className="blockmenu__glyph">{item.glyph}</span>
            {item.label}
          </button>
        ))}
      </div>
        </>
      )}

      {block.type === 'callout' && (
        <>
          <div className="menu__sep" />
          <div className="menu__label">Colour</div>
          <div className="blockmenu__tints">
            {CALLOUT_TINTS.map((tint) => (
              <button
                key={tint}
                type="button"
                role="menuitem"
                aria-label={tint}
                title={tint}
                className={`tint-picker__dot tint-${tint}${block.tint === tint ? ' is-on' : ''}`}
                onClick={() => onTint(tint)}
              />
            ))}
          </div>
        </>
      )}
    </div>
  )
}
