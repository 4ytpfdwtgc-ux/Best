import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { Note, TintName } from '../../types'
import { useApp } from '../../state/store'
import {
  ALPHA_DECAY, ALPHA_MIN, ALPHA_START, DEFAULT_FORCES, buildGraph, graphBounds, neighbourhood,
  nodeRadius, tick, type Forces, type Graph, type GraphNode,
} from '../../lib/graph'
import { addNote, setSelectedNote, updateNote } from '../../state/actions'
import { Icon } from '../ui/Icon'
import { ToolButton } from '../ui/primitives'

interface Palette {
  ink: string
  /** Lines between pages. Not the hairline the app rules its panels with: on
   *  white that is very nearly white, and the web looked like dots and air. */
  edge: string
  paper: string
  accent: string
  font: string
  tint: (name: TintName) => string
}

/** Every colour the web is drawn in, read from the stylesheet in one go. */
function readPalette(): Palette {
  const styles = getComputedStyle(document.documentElement)
  const read = (name: string, fallback: string) => styles.getPropertyValue(name).trim() || fallback
  const tints = new Map<string, string>()
  return {
    ink: read('--text', '#37352f'),
    edge: read('--text-tertiary', '#9b9a97'),
    paper: read('--bg-window', '#ffffff'),
    accent: read('--accent', '#2383e2'),
    font: read('--font', 'system-ui'),
    tint: (name) => {
      const known = tints.get(name)
      if (known) return known
      const value = read(`--tint-${name}`, '#888')
      tints.set(name, value)
      return value
    },
  }
}

/** Nodes are coloured by the folder they live in, cycling the tint palette. */
const FOLDER_TINTS: TintName[] = ['blue', 'purple', 'green', 'orange', 'pink', 'teal', 'red', 'indigo']

interface Camera {
  x: number
  y: number
  zoom: number
}

/**
 * The web of pages: a node for every page, an edge for every link between two.
 *
 * Drawn to a canvas rather than to elements. A few hundred nodes redrawn sixty
 * times a second is thousands of style recalculations a frame as SVG, and none
 * of it is text a screen reader could use anyway -- so the picture is a canvas
 * and the pages themselves are listed beside it for anything that cannot see
 * a picture.
 */
export function GraphView({
  focusId,
  onClose,
}: {
  /** Set for one page's own web; absent for the whole library. */
  focusId?: string
  onClose: () => void
}) {
  const state = useApp()
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [settings, setSettings] = useState(false)
  const [query, setQuery] = useState('')
  const [nesting, setNesting] = useState(true)
  const [orphans, setOrphans] = useState(true)
  const [ghosts, setGhosts] = useState(true)
  const [labels, setLabels] = useState(true)
  const [depth, setDepth] = useState(1)
  const [forces, setForces] = useState<Forces>(DEFAULT_FORCES)
  const [hovered, setHovered] = useState<GraphNode | null>(null)

  const graph = useMemo(() => {
    const whole = buildGraph(state.notes, { nesting, orphans, ghosts, query })
    return focusId && whole.nodes.some((n) => n.id === focusId)
      ? neighbourhood(whole, focusId, depth)
      : whole
  }, [state.notes, nesting, orphans, ghosts, query, focusId, depth])

  /* The simulation owns these between frames; React only reads them to draw. */
  const graphRef = useRef<Graph>(graph)
  const cameraRef = useRef<Camera>({ x: 0, y: 0, zoom: 1 })
  const alphaRef = useRef(ALPHA_START)
  const forcesRef = useRef(forces)
  forcesRef.current = forces
  const labelsRef = useRef(labels)
  labelsRef.current = labels
  const hoverRef = useRef<GraphNode | null>(null)
  const focusRef = useRef(focusId)
  focusRef.current = focusId
  const frameRef = useRef<number>()
  /** The first web has to be framed; after that the camera is the reader's. */
  const framedRef = useRef(false)
  /*
   * Everything below is measured or resolved once and kept, because it used to
   * be done per frame -- the canvas box (a layout), the theme's colours (a
   * style resolution, once per node), and the node lookup (an allocation).
   * Sixty times a second, on a phone, that was most of the frame.
   */
  const boxRef = useRef({ left: 0, top: 0, width: 0, height: 0 })
  const paletteRef = useRef<Palette | null>(null)
  const indexRef = useRef(new Map<string, GraphNode>())
  /** Ask for a frame. The loop stops when there is nothing left to draw. */
  const kickRef = useRef<() => void>(() => {})
  const runningRef = useRef(false)
  const dirtyRef = useRef(true)
  /** Frame it once it has stopped moving, not while it is still spreading out. */
  const pendingFitRef = useRef(false)

  /*
   * Turning names on or off changes the picture and nothing else -- no new
   * graph, nothing moving to simulate -- so the frame has to be asked for.
   */
  useEffect(() => kickRef.current(), [labels])

  const folderTint = useCallback(
    (node: GraphNode) => {
      if (node.ghost) return 'gray' as TintName
      const at = state.folders.findIndex((f) => f.id === node.folderId)
      return FOLDER_TINTS[(at < 0 ? 0 : at) % FOLDER_TINTS.length]
    },
    [state.folders],
  )

  /** Put the whole web on screen, whatever size it has settled to. */
  const fit = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const box = boxRef.current.width ? boxRef.current : canvas.getBoundingClientRect()
    const bounds = graphBounds(graphRef.current)
    const zoom = Math.min(3, Math.max(0.15, Math.min(box.width / (bounds.width + 80), box.height / (bounds.height + 80))))
    cameraRef.current = {
      zoom,
      x: box.width / 2 - (bounds.x + bounds.width / 2) * zoom,
      y: box.height / 2 - (bounds.y + bounds.height / 2) * zoom,
    }
  }, [])

  /*
   * A rebuilt web keeps the places it had.
   *
   * Every toggle in the settings panel builds a new graph, and a new graph
   * starts on the spiral -- so hiding unlinked pages used to throw the whole
   * arrangement in the air and settle it somewhere else, which is disorienting
   * for a change that removed two dots. Nodes that were already on screen keep
   * their coordinates, and only what is genuinely new has to find a place.
   */
  useEffect(() => {
    const placed = new Map(graphRef.current.nodes.map((n) => [n.id, n]))
    let kept = 0
    for (const node of graph.nodes) {
      const was = placed.get(node.id)
      if (!was) continue
      node.x = was.x
      node.y = was.y
      kept++
    }
    graphRef.current = graph
    indexRef.current = new Map(graph.nodes.map((n) => [n.id, n]))
    alphaRef.current = ALPHA_START
    dirtyRef.current = true
    kickRef.current()
    hoverRef.current = null
    setHovered(null)
    // Only frame it again when this is a different web, not a filtered one.
    if (framedRef.current && kept >= graph.nodes.length / 2 && kept > 0) return
    /*
     * The flag is set when the framing actually happens, not when it is
     * scheduled. In development every effect is run twice; setting it up front
     * meant the first pass scheduled the fit, the cleanup cancelled it, and the
     * second pass thought the work was done -- so the web was drawn in the
     * corner of the canvas, mostly off the edge of it.
     */
    framedRef.current = true
    pendingFitRef.current = true
  }, [graph, fit])

  /*
   * The loop: cool the simulation, draw, and stop when there is nothing left
   * to do. It used to ask for a frame forever, which on a phone is a wake-up
   * sixty times a second for a picture that is not changing -- and the reason
   * a tap or a pinch felt a beat behind.
   */
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const context = canvas.getContext('2d')
    if (!context) return

    const resize = () => {
      const box = canvas.getBoundingClientRect()
      boxRef.current = { left: box.left, top: box.top, width: box.width, height: box.height }
      const ratio = window.devicePixelRatio || 1
      canvas.width = Math.round(box.width * ratio)
      canvas.height = Math.round(box.height * ratio)
      context.setTransform(ratio, 0, 0, ratio, 0, 0)
      dirtyRef.current = true
      kick()
    }

    const draw = () => {
      const box = boxRef.current
      const camera = cameraRef.current
      const { nodes, links } = graphRef.current
      const paint = paletteRef.current ?? (paletteRef.current = readPalette())
      const index = indexRef.current
      const scale = 1 / camera.zoom

      context.save()
      context.fillStyle = paint.paper
      context.fillRect(0, 0, box.width, box.height)
      context.translate(camera.x, camera.y)
      context.scale(camera.zoom, camera.zoom)

      const near = hoverRef.current
      const lit = new Set<string>()
      if (near) {
        lit.add(near.id)
        for (const link of links) {
          if (link.source === near.id) lit.add(link.target)
          if (link.target === near.id) lit.add(link.source)
        }
      }

      for (const link of links) {
        const a = index.get(link.source)
        const b = index.get(link.target)
        if (!a || !b) continue
        const involved = !near || (lit.has(a.id) && lit.has(b.id))
        context.strokeStyle = near && involved ? paint.accent : paint.edge
        context.globalAlpha = near ? (involved ? 1 : 0.1) : link.nested ? 0.5 : 0.9
        context.lineWidth = (near && involved ? 2 : link.nested ? 1 : 1.3) * scale
        if (link.nested) context.setLineDash([4 * scale, 4 * scale])
        context.beginPath()
        context.moveTo(a.x, a.y)
        context.lineTo(b.x, b.y)
        context.stroke()
        if (link.nested) context.setLineDash([])
      }

      context.textAlign = 'center'
      context.textBaseline = 'top'
      for (const node of nodes) {
        const radius = nodeRadius(node)
        context.globalAlpha = near ? (lit.has(node.id) ? 1 : 0.2) : 1
        context.beginPath()
        context.arc(node.x, node.y, radius, 0, Math.PI * 2)
        /*
         * A ring of the page's own colour behind every dot. Two dots that
         * overlap read as two, and a dot sitting on a line is not cut in half
         * by it.
         */
        context.fillStyle = node.ghost ? paint.paper : paint.tint(folderTint(node))
        context.fill()
        context.strokeStyle = node.ghost ? paint.edge : paint.paper
        context.lineWidth = (node.ghost ? 2 : 1.5) * scale
        context.stroke()
        if (node.id === focusRef.current) {
          context.strokeStyle = paint.ink
          context.lineWidth = 2.5 * scale
          context.stroke()
        }

        // Labels only where they can be read: close enough in, or the one
        // under the pointer. Otherwise the web disappears under its own names.
        if (node.id === near?.id || (labelsRef.current && camera.zoom > 0.55)) {
          context.font = `${11 * scale}px ${paint.font}`
          const y = node.y + radius + 3 * scale
          // Drawn on a halo of the background, so a name over a line is still
          // a name.
          context.lineWidth = 3 * scale
          context.strokeStyle = paint.paper
          context.lineJoin = 'round'
          context.strokeText(clip(node.title), node.x, y)
          context.fillStyle = paint.ink
          context.fillText(clip(node.title), node.x, y)
        }
      }

      context.restore()
      context.globalAlpha = 1
    }

    const loop = () => {
      const moving = alphaRef.current > ALPHA_MIN
      if (moving) {
        tick(graphRef.current, forcesRef.current, alphaRef.current, indexRef.current)
        alphaRef.current *= ALPHA_DECAY
        /*
         * A web spreads out as it settles, over several seconds. Framing it
         * once at the start would leave it hanging off the canvas, and framing
         * it only at the end would leave the corner of it on screen until
         * then -- so it is kept framed the whole way, until it stops or the
         * reader takes hold of the camera.
         */
        if (pendingFitRef.current) fit()
        dirtyRef.current = true
      } else if (pendingFitRef.current) {
        pendingFitRef.current = false
        fit()
        dirtyRef.current = true
      }

      if (dirtyRef.current) {
        dirtyRef.current = false
        draw()
      }
      if (moving || dirtyRef.current) {
        frameRef.current = requestAnimationFrame(loop)
      } else {
        runningRef.current = false
      }
    }

    function kick() {
      dirtyRef.current = true
      if (runningRef.current) return
      runningRef.current = true
      frameRef.current = requestAnimationFrame(loop)
    }
    kickRef.current = kick

    resize()
    const observer = new ResizeObserver(resize)
    observer.observe(canvas)
    // The theme can change without this component hearing about it, and every
    // colour it draws with came from the stylesheet.
    const themes = new MutationObserver(() => {
      paletteRef.current = null
      kick()
    })
    themes.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme', 'style'] })

    return () => {
      cancelAnimationFrame(frameRef.current ?? 0)
      runningRef.current = false
      observer.disconnect()
      themes.disconnect()
    }
  }, [folderTint, fit])

  /**
   * Something moved: settle again, and draw.
   *
   * `to` of zero means only the picture changed -- a pan, a zoom, a hover --
   * so there is a frame to draw but nothing to re-simulate.
   */
  const reheat = (to = 0.45) => {
    alphaRef.current = Math.max(alphaRef.current, to)
    kickRef.current()
  }

  /* ---------------------------------------------------------------- */
  /* Pointer: drag a node, pan the field, pinch or wheel to zoom        */
  /* ---------------------------------------------------------------- */

  const pointers = useRef(new Map<number, { x: number; y: number }>())
  const dragRef = useRef<{ node: GraphNode | null; moved: boolean; x: number; y: number } | null>(null)
  const pinchRef = useRef<{ distance: number; zoom: number } | null>(null)

  const atPointer = (e: React.PointerEvent): { x: number; y: number } => {
    // From the box measured at the last resize or press, not a fresh one: a
    // getBoundingClientRect per pointer move is a layout per pointer move.
    const box = boxRef.current
    const camera = cameraRef.current
    return {
      x: (e.clientX - box.left - camera.x) / camera.zoom,
      y: (e.clientY - box.top - camera.y) / camera.zoom,
    }
  }

  const nodeAt = (world: { x: number; y: number }): GraphNode | null => {
    let best: GraphNode | null = null
    let bestDistance = Infinity
    for (const node of graphRef.current.nodes) {
      const distance = Math.hypot(node.x - world.x, node.y - world.y)
      const reach = Math.max(nodeRadius(node) + 4, 12 / cameraRef.current.zoom)
      if (distance < reach && distance < bestDistance) {
        best = node
        bestDistance = distance
      }
    }
    return best
  }

  function onPointerDown(e: React.PointerEvent<HTMLCanvasElement>) {
    // Touching it makes the camera the reader's: no automatic framing after.
    pendingFitRef.current = false
    const canvas = canvasRef.current
    if (canvas) {
      const box = canvas.getBoundingClientRect()
      boxRef.current = { left: box.left, top: box.top, width: box.width, height: box.height }
    }
    canvas?.setPointerCapture(e.pointerId)
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
    if (pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()]
      pinchRef.current = { distance: Math.hypot(a.x - b.x, a.y - b.y), zoom: cameraRef.current.zoom }
      dragRef.current = null
      return
    }
    const world = atPointer(e)
    const node = nodeAt(world)
    if (node) node.pinned = true
    dragRef.current = { node, moved: false, x: e.clientX, y: e.clientY }
    reheat(node ? 0.35 : 0)
  }

  function onPointerMove(e: React.PointerEvent<HTMLCanvasElement>) {
    if (pointers.current.has(e.pointerId)) pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY })

    if (pinchRef.current && pointers.current.size >= 2) {
      const [a, b] = [...pointers.current.values()]
      const distance = Math.hypot(a.x - b.x, a.y - b.y)
      const box = boxRef.current
      zoomAt(
        (pinchRef.current.zoom * distance) / (pinchRef.current.distance || 1),
        (a.x + b.x) / 2 - box.left,
        (a.y + b.y) / 2 - box.top,
      )
      return
    }

    const drag = dragRef.current
    if (!drag) {
      // Nothing held: this is a hover, which lights a page and its links.
      const node = nodeAt(atPointer(e))
      if (node?.id !== hoverRef.current?.id) {
        hoverRef.current = node
        setHovered(node)
        reheat(0)
      }
      return
    }

    const dx = e.clientX - drag.x
    const dy = e.clientY - drag.y
    if (Math.abs(dx) > 3 || Math.abs(dy) > 3) drag.moved = true
    drag.x = e.clientX
    drag.y = e.clientY

    if (drag.node) {
      drag.node.x += dx / cameraRef.current.zoom
      drag.node.y += dy / cameraRef.current.zoom
      reheat(0.3)
    } else {
      cameraRef.current.x += dx
      cameraRef.current.y += dy
      reheat(0)
    }
  }

  function onPointerUp(e: React.PointerEvent<HTMLCanvasElement>) {
    pointers.current.delete(e.pointerId)
    if (pointers.current.size < 2) pinchRef.current = null
    const drag = dragRef.current
    dragRef.current = null
    if (!drag) return
    if (drag.node) {
      drag.node.pinned = false
      reheat(0.3)
    }
    // A press that went nowhere is a tap, and a tap opens the page.
    if (!drag.moved && drag.node) open(drag.node)
  }

  /** Zoom about a point on the canvas, so what is under the finger stays there. */
  function zoomAt(next: number, atX: number, atY: number) {
    const camera = cameraRef.current
    const zoom = Math.min(4, Math.max(0.1, next))
    camera.x = atX - ((atX - camera.x) / camera.zoom) * zoom
    camera.y = atY - ((atY - camera.y) / camera.zoom) * zoom
    camera.zoom = zoom
    reheat(0)
  }

  function onWheel(e: React.WheelEvent<HTMLCanvasElement>) {
    pendingFitRef.current = false
    const box = boxRef.current
    zoomAt(cameraRef.current.zoom * Math.exp(-e.deltaY / 320), e.clientX - box.left, e.clientY - box.top)
  }

  /**
   * Open what was tapped. A ghost is a page nobody has written yet, so tapping
   * one writes it -- which is how a link written ahead of its page is meant to
   * be resolved.
   */
  function open(node: GraphNode) {
    if (!node.ghost) {
      setSelectedNote(node.id)
      onClose()
      return
    }
    const created: Note = addNote()
    updateNote(created.id, { title: node.title })
    setSelectedNote(created.id)
    onClose()
  }

  const counts = `${graph.nodes.length} ${graph.nodes.length === 1 ? 'page' : 'pages'} · ${graph.links.length} ${
    graph.links.length === 1 ? 'link' : 'links'
  }`

  return (
    <div className="graph">
      <header className="toolbar toolbar--tight">
        <ToolButton icon="chevronLeft" label="Back to the notes" onClick={onClose} />
        <span className="graph__title">
          {focusId ? 'This page’s web' : 'Web of pages'}
          <span className="graph__count">{counts}</span>
        </span>
        <div className="toolbar__spacer" />
        <div className="search-field search-field--sm">
          <Icon name="search" size={14} />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Filter"
            aria-label="Filter the web"
          />
        </div>
        <ToolButton icon="target" label="Fit to the screen" onClick={fit} />
        <ToolButton icon="gear" label="Web settings" onClick={() => setSettings((v) => !v)} active={settings} />
      </header>

      <div className="graph__stage">
        <canvas
          ref={canvasRef}
          className="graph__canvas"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          onPointerLeave={() => {
            if (dragRef.current) return
            hoverRef.current = null
            setHovered(null)
            kickRef.current()
          }}
          onWheel={onWheel}
        />

        {!graph.nodes.length && (
          <p className="graph__empty">
            {query ? 'No page matches that.' : 'Write a [[link]] on a page and it will show up here.'}
          </p>
        )}

        {hovered && (
          <div className="graph__peek">
            <strong>{hovered.title}</strong>
            <span>
              {hovered.ghost
                ? 'Not written yet — tap to start it'
                : `${hovered.degree} ${hovered.degree === 1 ? 'link' : 'links'}`}
            </span>
          </div>
        )}

        {settings && (
          <div className="graph__panel">
            <div className="graph__group">
              <div className="fmt__label">Show</div>
              <Toggle on={labels} onChange={setLabels} label="Names" />
              <Toggle on={nesting} onChange={setNesting} label="Nested pages" />
              <Toggle on={orphans} onChange={setOrphans} label="Unlinked pages" />
              <Toggle on={ghosts} onChange={setGhosts} label="Unwritten pages" />
            </div>

            {focusId && (
              <div className="graph__group">
                <div className="fmt__label">Reach</div>
                <Slider
                  label={`${depth} ${depth === 1 ? 'step' : 'steps'} out`}
                  min={1}
                  max={4}
                  step={1}
                  value={depth}
                  onChange={setDepth}
                />
              </div>
            )}

            <div className="graph__group">
              <div className="fmt__label">Forces</div>
              <Slider
                label="Repel"
                min={400}
                max={6000}
                step={100}
                value={forces.repel}
                onChange={(repel) => {
                  setForces((f) => ({ ...f, repel }))
                  reheat()
                }}
              />
              <Slider
                label="Link length"
                min={20}
                max={200}
                step={5}
                value={forces.linkDistance}
                onChange={(linkDistance) => {
                  setForces((f) => ({ ...f, linkDistance }))
                  reheat()
                }}
              />
              <button
                type="button"
                className="btn"
                onClick={() => {
                  setForces(DEFAULT_FORCES)
                  reheat()
                }}
              >
                Reset forces
              </button>
            </div>
          </div>
        )}
      </div>

      {/* The same web as a list, for anything that cannot read a canvas. */}
      <ul className="sr-only">
        {graph.nodes.map((node) => (
          <li key={node.id}>
            <button type="button" onClick={() => open(node)}>
              {node.title}
              {node.ghost ? ' (not written yet)' : ''}, {node.degree} links
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}

function Toggle({ on, onChange, label }: { on: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <label className="graph__toggle">
      <input type="checkbox" checked={on} onChange={(e) => onChange(e.target.checked)} />
      {label}
    </label>
  )
}

function Slider({
  label,
  min,
  max,
  step,
  value,
  onChange,
}: {
  label: string
  min: number
  max: number
  step: number
  value: number
  onChange: (v: number) => void
}) {
  return (
    <label className="graph__slider">
      <span>{label}</span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
      />
    </label>
  )
}

/** A name long enough to cover its neighbours is cut down to one that is not. */
function clip(title: string): string {
  return title.length > 24 ? `${title.slice(0, 23)}…` : title
}
