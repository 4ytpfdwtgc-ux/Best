import { useEffect, useRef } from 'react'
import { Icon } from '../ui/Icon'

export type AttachAction =
  | 'photos'
  | 'camera'
  | 'scan'
  | 'scanText'
  | 'audio'
  | 'file'
  | 'table'
  | 'link'

interface Item {
  action: AttachAction
  label: string
  icon: string
  hint?: string
  /** Only worth offering where the camera and the system's own text scanner are. */
  handheld?: boolean
}

/**
 * What iOS Notes puts behind its plus, as far as a web page can reach it.
 *
 * Two of them are honest approximations rather than the real thing, and say
 * so in the menu instead of pretending: a web page cannot open iOS's
 * multi-page document scanner, and it cannot read text out of a photo -- there
 * is no OCR in the browser, and shipping one would mean megabytes of engine
 * for a job the phone already does perfectly well. So Scan Documents opens the
 * camera a page at a time, and Scan Text hands the job to iOS, which offers it
 * inside any text field.
 */
const ITEMS: Item[] = [
  { action: 'camera', label: 'Take Photo', icon: 'image', hint: 'Straight from the camera', handheld: true },
  { action: 'scan', label: 'Scan Documents', icon: 'clipboard', hint: 'A page at a time', handheld: true },
  { action: 'scanText', label: 'Scan Text', icon: 'text', hint: "Touch and hold, then 'Scan Text'", handheld: true },
  { action: 'photos', label: 'Photo Library', icon: 'image' },
  { action: 'audio', label: 'Record Audio', icon: 'music' },
  { action: 'file', label: 'Attach File', icon: 'download' },
  { action: 'table', label: 'Add Table', icon: 'grid' },
  { action: 'link', label: 'Add Link', icon: 'link' },
]

export function AttachMenu({
  onPick,
  onClose,
}: {
  onPick: (action: AttachAction) => void
  onClose: () => void
}) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const onDown = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) onClose()
    }
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    // Pointerdown, so a tap outside closes it on the way down as a sheet does.
    document.addEventListener('pointerdown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('pointerdown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [onClose])

  // The camera items are worth offering everywhere -- a laptop has one too --
  // but the hint about holding to scan text is only true on a phone or tablet.
  const touch = typeof matchMedia === 'function' && matchMedia('(hover: none)').matches

  return (
    <div ref={ref} className="attach" role="menu" aria-label="Attach">
      {ITEMS.map((item) => (
        <button
          key={item.action}
          type="button"
          role="menuitem"
          className="attach__item"
          onPointerDown={(e) => e.preventDefault()}
          onClick={() => onPick(item.action)}
        >
          <span className="attach__icon"><Icon name={item.icon} size={15} /></span>
          <span className="attach__text">
            {item.label}
            {item.hint && (!item.handheld || touch) && <span className="attach__hint">{item.hint}</span>}
          </span>
        </button>
      ))}
    </div>
  )
}
