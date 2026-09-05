import type { Stroke } from '../types.ts'
import { SKETCH_MAX_HEIGHT, SKETCH_MIN_HEIGHT, SKETCH_WIDTH } from '../types.ts'

/**
 * Drawing, kept small enough to live in the page.
 *
 * A sketch is stored as its strokes rather than as a picture, which means it
 * shares the state's one localStorage budget with everything else. A finger
 * dragged across a screen produces a point per frame -- hundreds for a single
 * line -- so points that say nothing new are dropped as they arrive, and the
 * rest are rounded to whole units of a 1000-wide space. Neither is visible in
 * the result; together they cut a drawing to a fraction of what it was.
 */

/** How far a finger must travel before the point is worth keeping. */
const MIN_STEP = 4

/** Add a point to a stroke, unless it says nothing the last one did not. */
export function extendStroke(points: number[], x: number, y: number): number[] {
  const rx = Math.round(x)
  const ry = Math.round(y)
  if (points.length >= 2) {
    const dx = rx - points[points.length - 2]
    const dy = ry - points[points.length - 1]
    if (dx * dx + dy * dy < MIN_STEP * MIN_STEP) return points
  }
  return [...points, rx, ry]
}

/** Map a pointer's page position into the sketch's own space. */
export function toSketchSpace(
  rect: DOMRect,
  clientX: number,
  clientY: number,
  height: number,
): { x: number; y: number } {
  const x = ((clientX - rect.left) / rect.width) * SKETCH_WIDTH
  const y = ((clientY - rect.top) / rect.height) * height
  return {
    x: Math.min(SKETCH_WIDTH, Math.max(0, x)),
    y: Math.min(height, Math.max(0, y)),
  }
}

/**
 * The height a new sketch takes, from the shape of the surface offered to it.
 *
 * A phone held upright is far taller than it is wide, and a fixed landscape
 * canvas would leave most of that screen unused; the bounds stop the drawing
 * becoming a column that swallows the page it ends up on.
 */
export function heightForSurface(width: number, height: number): number {
  if (!width || !height) return SKETCH_MIN_HEIGHT
  const wanted = Math.round((height / width) * SKETCH_WIDTH)
  return Math.min(SKETCH_MAX_HEIGHT, Math.max(SKETCH_MIN_HEIGHT, wanted))
}

/**
 * A stroke as an SVG points list.
 *
 * A single tap has one point, which `polyline` draws as nothing at all -- so
 * it is doubled, and the round cap turns it into the dot the tap meant.
 */
export function strokePoints(stroke: Stroke): string {
  const { points } = stroke
  if (points.length === 2) return `${points[0]},${points[1]} ${points[0]},${points[1]}`
  const pairs: string[] = []
  for (let i = 0; i + 1 < points.length; i += 2) pairs.push(`${points[i]},${points[i + 1]}`)
  return pairs.join(' ')
}

/** Whether there is anything drawn at all. */
export function isBlank(strokes: Stroke[] | undefined): boolean {
  return !strokes?.some((s) => s.points.length >= 2)
}
