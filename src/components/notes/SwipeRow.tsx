import { useEffect, useRef, useState, type ReactNode } from 'react'
import type { TintName } from '../../types'
import { Icon } from '../ui/Icon'

export interface SwipeAction {
  label: string
  icon: string
  tint: TintName
  run: () => void
}

/** Past this many pixels, letting go performs the action. */
const COMMIT = 72
/** Movement before a drag counts as a swipe rather than a tap. */
const SLOP = 8

/**
 * A row that reveals an action when dragged sideways.
 *
 * Pointer events are used rather than touch events, so the same gesture works
 * with a finger and a mouse. Vertical movement hands control back to the
 * scroller, so a swipe never fights the list.
 */
export function SwipeRow({
  left,
  right,
  disabled,
  children,
}: {
  /** Revealed by dragging right. */
  left?: SwipeAction
  /** Revealed by dragging left. */
  right?: SwipeAction
  disabled?: boolean
  children: ReactNode
}) {
  const [offset, setOffset] = useState(0)
  const [settling, setSettling] = useState(false)
  const swipedRef = useRef(false)
  const timerRef = useRef<number>()

  useEffect(() => () => window.clearTimeout(timerRef.current), [])

  function onPointerDown(e: React.PointerEvent) {
    if (disabled || e.button !== 0) return
    const startX = e.clientX
    const startY = e.clientY
    let engaged = false
    swipedRef.current = false

    const onMove = (ev: PointerEvent) => {
      const dx = ev.clientX - startX
      const dy = ev.clientY - startY

      if (!engaged) {
        // Let the list scroll unless the movement is clearly sideways.
        if (Math.abs(dy) > Math.abs(dx)) return void cleanup()
        if (Math.abs(dx) < SLOP) return
        engaged = true
        swipedRef.current = true
        setSettling(false)
      }

      // Only offer a direction that has an action behind it.
      const allowed = dx > 0 ? !!left : !!right
      setOffset(allowed ? resist(dx) : 0)
    }

    const onUp = () => {
      const current = offsetRef.current
      cleanup()
      if (!engaged) return

      const action = current > 0 ? left : right
      if (Math.abs(current) >= COMMIT && action) {
        setSettling(true)
        setOffset(current > 0 ? 1000 : -1000)
        // Fire on a timer rather than transitionend, which never arrives when
        // the viewer has reduced motion turned on.
        timerRef.current = window.setTimeout(action.run, 160)
        return
      }
      setSettling(true)
      setOffset(0)
    }

    const cleanup = () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('pointercancel', onUp)
    }

    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    window.addEventListener('pointercancel', onUp)
  }

  // Keep the live offset readable from the pointerup handler.
  const offsetRef = useRef(0)
  offsetRef.current = offset

  const revealed = offset > 0 ? left : offset < 0 ? right : undefined
  const armed = Math.abs(offset) >= COMMIT

  if (disabled) return <>{children}</>

  return (
    <div className="swipe" onPointerDown={onPointerDown}>
      {revealed && (
        <div
          className={`swipe__action swipe__action--${offset > 0 ? 'left' : 'right'} tint-${revealed.tint}${
            armed ? ' is-armed' : ''
          }`}
          aria-hidden="true"
        >
          <Icon name={revealed.icon} size={16} />
          <span>{revealed.label}</span>
        </div>
      )}
      <div
        className={`swipe__content${settling ? ' is-settling' : ''}`}
        style={offset ? { transform: `translateX(${offset}px)` } : undefined}
        onTransitionEnd={() => setSettling(false)}
        // A swipe must not also register as a tap on the row beneath.
        onClickCapture={(e) => {
          if (!swipedRef.current) return
          e.preventDefault()
          e.stopPropagation()
          swipedRef.current = false
        }}
      >
        {children}
      </div>
    </div>
  )
}

/** Rubber-band the drag so it slows past the commit point. */
function resist(dx: number): number {
  const limit = COMMIT * 1.6
  if (Math.abs(dx) <= limit) return dx
  const over = Math.abs(dx) - limit
  return Math.sign(dx) * (limit + over * 0.35)
}
