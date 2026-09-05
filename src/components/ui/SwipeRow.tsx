import { useEffect, useRef, useState, type ReactNode } from 'react'
import type { TintName } from '../../types'
import {
  SWIPE_COLLAPSE_MS, SWIPE_COMMIT, SWIPE_EXIT_MS, SWIPE_SLOP,
} from '../../lib/gestures'
import { Icon } from './Icon'

export interface SwipeAction {
  label: string
  icon: string
  tint: TintName
  run: () => void
  /**
   * The row survives the action, so it springs back rather than sliding off.
   * Completing a reminder does this: the row stays, struck through.
   */
  keepsRow?: boolean
}

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
  /** The live offset, authoritative for the release decision. */
  const offsetRef = useRef(0)
  const [settling, setSettling] = useState(false)
  /** Set while the row flies out and its space closes up behind it. */
  const [leaving, setLeaving] = useState<'left' | 'right' | null>(null)
  const swipedRef = useRef(false)
  const timerRef = useRef<number>()
  const rootRef = useRef<HTMLDivElement>(null)

  useEffect(() => () => window.clearTimeout(timerRef.current), [])

  function onPointerDown(e: React.PointerEvent) {
    if (disabled || leaving || e.button !== 0) return
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
        if (Math.abs(dx) < SWIPE_SLOP) return
        engaged = true
        swipedRef.current = true
        setSettling(false)
      }

      // Only offer a direction that has an action behind it.
      const allowed = dx > 0 ? !!left : !!right
      /*
       * Written straight to the ref, not read back off a render. A quick flick
       * releases before React has committed the last few moves, and reading
       * the rendered value there would see a stale offset and decide the swipe
       * never went far enough.
       */
      offsetRef.current = allowed ? resist(dx) : 0
      setOffset(offsetRef.current)
    }

    const onUp = () => {
      const current = offsetRef.current
      cleanup()
      if (!engaged) return

      const action = current > 0 ? left : right
      if (Math.abs(current) >= SWIPE_COMMIT && action) {
        if (action.keepsRow) {
          // Nothing is leaving, so land the change as the row comes back.
          setSettling(true)
          offsetRef.current = 0
          setOffset(0)
          action.run()
          return
        }
        /*
         * Freeze the height before the row leaves, so the gap it occupied can
         * close on its own rather than the list snapping shut underneath.
         */
        const height = rootRef.current?.offsetHeight
        if (height) rootRef.current?.style.setProperty('--swipe-h', `${height}px`)
        setSettling(false)
        setLeaving(current > 0 ? 'left' : 'right')
        // Fire on a timer rather than transitionend, which never arrives when
        // the viewer has reduced motion turned on.
        timerRef.current = window.setTimeout(action.run, SWIPE_EXIT_MS + SWIPE_COLLAPSE_MS)
        return
      }
      setSettling(true)
      offsetRef.current = 0
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


  const revealed = leaving
    ? leaving === 'left'
      ? left
      : right
    : offset > 0
      ? left
      : offset < 0
        ? right
        : undefined
  const armed = !!leaving || Math.abs(offset) >= SWIPE_COMMIT

  if (disabled) return <>{children}</>

  return (
    <div
      ref={rootRef}
      className={`swipe${leaving ? ` is-leaving is-leaving--${leaving}` : ''}`}
      onPointerDown={onPointerDown}
    >
      {revealed && (
        <div
          className={`swipe__action swipe__action--${
            (leaving ? leaving === 'left' : offset > 0) ? 'left' : 'right'
          } tint-${revealed.tint}${armed ? ' is-armed' : ''}`}
          aria-hidden="true"
        >
          <Icon name={revealed.icon} size={16} />
          <span>{revealed.label}</span>
        </div>
      )}
      <div
        className={`swipe__content${settling ? ' is-settling' : ''}`}
        style={leaving ? undefined : offset ? { transform: `translateX(${offset}px)` } : undefined}
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
  const limit = SWIPE_COMMIT * 1.6
  if (Math.abs(dx) <= limit) return dx
  const over = Math.abs(dx) - limit
  return Math.sign(dx) * (limit + over * 0.35)
}
