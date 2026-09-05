import type { Block } from '../../types'
import { SKETCH_HEIGHT, SKETCH_WIDTH } from '../../types'
import { isBlank, strokePoints } from '../../lib/sketch'
import { Icon } from '../ui/Icon'

/** A drawing on the page: the same lines the pad collected, at page size. */
export function SketchBlock({ block, onEdit }: { block: Block; onEdit: () => void }) {
  const strokes = block.strokes ?? []

  if (isBlank(strokes)) {
    return (
      <div className="sketch" contentEditable={false}>
        <button type="button" className="sketch__empty" onClick={onEdit}>
          <Icon name="text" size={16} />
          Draw something
        </button>
      </div>
    )
  }

  return (
    <div className="sketch" contentEditable={false}>
      <button type="button" className="sketch__frame" onClick={onEdit} aria-label="Edit this sketch">
        <svg
          className="sketch__svg"
          viewBox={`0 0 ${SKETCH_WIDTH} ${block.sketchHeight ?? SKETCH_HEIGHT}`}
          preserveAspectRatio="xMidYMid meet"
          role="img"
          aria-label={block.text || 'Sketch'}
        >
          {strokes.map((stroke, i) => (
            <polyline
              key={i}
              points={strokePoints(stroke)}
              className={`sketch__line sketch__line--${stroke.color}`}
              strokeWidth={stroke.width}
            />
          ))}
        </svg>
      </button>
    </div>
  )
}
