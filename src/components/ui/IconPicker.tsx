import { useEffect, useRef } from 'react'
import { Icon, PAGE_SYMBOLS } from './Icon'

/** A popover grid for choosing a page icon. */
export function IconPicker({
  value,
  anchor,
  onPick,
  onClear,
  onClose,
}: {
  value?: string
  anchor: DOMRect
  onPick: (name: string) => void
  onClear: () => void
  onClose: () => void
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
    <div
      ref={ref}
      className="menu iconpicker"
      style={{
        top: Math.min(anchor.bottom + 6, window.innerHeight - 280),
        left: Math.min(anchor.left, window.innerWidth - 268),
      }}
      role="dialog"
      aria-label="Page icon"
    >
      <div className="iconpicker__head">
        <span className="menu__label">Icon</span>
        <button type="button" className="btn btn--plain" onClick={onClear}>Remove</button>
      </div>
      <div className="iconpicker__grid" role="radiogroup" aria-label="Page icon">
        {PAGE_SYMBOLS.map((name) => (
          <button
            key={name}
            type="button"
            role="radio"
            aria-checked={value === name}
            aria-label={name}
            title={name}
            className={`iconpicker__item${value === name ? ' is-on' : ''}`}
            onClick={() => onPick(name)}
          >
            <Icon name={name} size={17} />
          </button>
        ))}
      </div>
    </div>
  )
}
