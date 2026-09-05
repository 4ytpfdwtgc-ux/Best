import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import type { Stroke } from '../../types'
import { SKETCH_HEIGHT, SKETCH_WIDTH } from '../../types'
import { extendStroke, heightForSurface, strokePoints, toSketchSpace } from '../../lib/sketch'
import { Icon } from '../ui/Icon'

type Ink = Stroke['color']

const INKS: Ink[] = ['ink', 'blue', 'red', 'green', 'yellow']
const WIDTHS = [3, 7, 16]

/**
 * The drawing surface, over the whole window.
 *
 * Strokes are collected as SVG rather than painted to a canvas: the sketch is
 * stored as its lines, so drawing them is the same operation as showing them
 * afterwards, and nothing has to be traced back out of pixels.
 *
 * A pencil's pressure widens the line it is drawing. Apple Pencil reports it
 * through the same pointer events a finger uses; a finger and a mouse report
 * nothing and draw at the chosen width, which is what they mean to do.
 */
export function SketchPad({
  strokes,
  height,
  onDone,
  onCancel,
}: {
  strokes: Stroke[]
  /** The shape an existing drawing was made at; absent for a new one. */
  height?: number
  onDone: (strokes: Stroke[], height: number) => void
  onCancel: () => void
}) {
  const [drawn, setDrawn] = useState<Stroke[]>(strokes)
  /** Fixed once, from the surface: a drawing must not change shape mid-stroke. */
  const [space, setSpace] = useState(height ?? SKETCH_HEIGHT)
  const surfaceBoxRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (height) return
    const box = surfaceBoxRef.current?.getBoundingClientRect()
    if (box) setSpace(heightForSurface(box.width, box.height))
  }, [height])
  const [live, setLive] = useState<Stroke | null>(null)
  const [ink, setInk] = useState<Ink>('ink')
  const [width, setWidth] = useState(WIDTHS[1])
  const surfaceRef = useRef<SVGSVGElement>(null)
  const liveRef = useRef<Stroke | null>(null)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel()
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault()
        setDrawn((current) => current.slice(0, -1))
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onCancel])

  function begin(e: React.PointerEvent<SVGSVGElement>) {
    const surface = surfaceRef.current
    if (!surface || e.button !== 0) return
    surface.setPointerCapture(e.pointerId)
    const box = surface.getBoundingClientRect()
    const at = toSketchSpace(box, e.clientX, e.clientY, space)
    /*
     * The width is stored in the sketch's own units, not in screen pixels, so
     * the line keeps its weight relative to the drawing -- a sketch shown
     * larger on a laptop shows thicker ink, as ink on paper would.
     */
    const scale = box.width ? SKETCH_WIDTH / box.width : 1
    const stroke: Stroke = {
      points: [Math.round(at.x), Math.round(at.y)],
      color: ink,
      width: Math.round(penWidth(width, e) * scale * 10) / 10,
    }
    liveRef.current = stroke
    setLive(stroke)
  }

  function extend(e: React.PointerEvent<SVGSVGElement>) {
    const surface = surfaceRef.current
    const stroke = liveRef.current
    if (!surface || !stroke) return
    const at = toSketchSpace(surface.getBoundingClientRect(), e.clientX, e.clientY, space)
    const points = extendStroke(stroke.points, at.x, at.y)
    if (points === stroke.points) return
    const next = { ...stroke, points }
    liveRef.current = next
    setLive(next)
  }

  function end() {
    const stroke = liveRef.current
    liveRef.current = null
    setLive(null)
    if (stroke) setDrawn((current) => [...current, stroke])
  }

  const all = live ? [...drawn, live] : drawn

  /*
   * Rendered against the document rather than in place: the pane it is opened
   * from sits inside a stacking context that a fixed element cannot escape, so
   * in place the drawing surface stopped politely above the tab bar.
   */
  return createPortal(
    <div className="sketch-pad" role="dialog" aria-label="Sketch">
      <header className="sketch-pad__bar">
        <div className="sketch-pad__actions">
          <button type="button" className="btn" onClick={onCancel}>Cancel</button>
          <span className="sketch-pad__spacer" />
          <button
            type="button"
            className="tool-btn"
            onClick={() => setDrawn((current) => current.slice(0, -1))}
            disabled={!drawn.length}
            title="Undo"
            aria-label="Undo the last stroke"
          >
            <Icon name="repeat" size={15} />
          </button>
          <button
            type="button"
            className="tool-btn"
            onClick={() => setDrawn([])}
            disabled={!drawn.length}
            title="Clear"
            aria-label="Clear the drawing"
          >
            <Icon name="trash" size={15} />
          </button>
          <button type="button" className="btn btn--primary" onClick={() => onDone(drawn, space)}>Done</button>
        </div>

        <div className="sketch-pad__tools">
          {INKS.map((name) => (
            <button
              key={name}
              type="button"
              className={`sketch-pad__ink sketch-pad__ink--${name}${ink === name ? ' is-on' : ''}`}
              onClick={() => setInk(name)}
              aria-pressed={ink === name}
              aria-label={name === 'ink' ? 'Black' : name}
              title={name === 'ink' ? 'Black' : name}
            />
          ))}
          <span className="sketch-pad__sep" />
          {WIDTHS.map((w) => (
            <button
              key={w}
              type="button"
              className={`sketch-pad__nib${width === w ? ' is-on' : ''}`}
              onClick={() => setWidth(w)}
              aria-pressed={width === w}
              aria-label={`${w > 10 ? 'Thick' : w > 5 ? 'Medium' : 'Fine'} line`}
            >
              <span style={{ width: w + 2, height: w + 2 }} />
            </button>
          ))}
        </div>
      </header>

      <div className="sketch-pad__surface" ref={surfaceBoxRef}>
        <svg
          ref={surfaceRef}
          className="sketch-pad__svg"
          viewBox={`0 0 ${SKETCH_WIDTH} ${space}`}
          preserveAspectRatio="xMidYMid meet"
          onPointerDown={begin}
          onPointerMove={extend}
          onPointerUp={end}
          onPointerCancel={end}
        >
          <rect x="0" y="0" width={SKETCH_WIDTH} height={space} className="sketch-pad__paper" />
          {all.map((stroke, i) => (
            <polyline
              key={i}
              points={strokePoints(stroke)}
              className={`sketch__line sketch__line--${stroke.color}`}
              strokeWidth={stroke.width}
            />
          ))}
        </svg>
      </div>
    </div>,
    document.body,
  )
}

/** A pencil pressing harder draws a fatter line; everything else draws as set. */
function penWidth(base: number, e: React.PointerEvent): number {
  if (e.pointerType !== 'pen') return base
  const pressure = e.pressure || 0.5
  return Math.round(base * (0.55 + pressure) * 10) / 10
}
