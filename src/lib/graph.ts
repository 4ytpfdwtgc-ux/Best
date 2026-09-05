import type { ID, Note } from '../types.ts'
import { noteTitle, wikiLinksIn } from './notes.ts'

/**
 * The page web: every page as a node, every link between them as an edge.
 *
 * The layout is a force simulation rather than anything stored -- pages have
 * no coordinates, and a drawing that had to be maintained by hand would be
 * wrong the moment a link was written. Repulsion pushes every node off every
 * other, links pull the pages that mention each other together, and a weak
 * pull towards the middle stops the whole thing drifting off the canvas.
 */

export interface GraphNode {
  /** A page's id, or `ghost:<name>` for a page that is linked to but unwritten. */
  id: string
  title: string
  folderId?: ID
  /** Linked to from somewhere, but nobody has written it yet. */
  ghost?: boolean
  /** How many edges touch it, which is what sizes the dot. */
  degree: number
  x: number
  y: number
  vx: number
  vy: number
  /** Held by a pointer: the simulation moves everything except this. */
  pinned?: boolean
}

export interface GraphLink {
  source: string
  target: string
  /** A page nested inside another, rather than one mentioning another. */
  nested?: boolean
}

export interface Graph {
  nodes: GraphNode[]
  links: GraphLink[]
}

export interface BuildOptions {
  /** Draw an edge from a page to the pages nested inside it. */
  nesting?: boolean
  /** Keep pages that link to nothing and that nothing links to. */
  orphans?: boolean
  /** Show pages that are linked to but not yet written. */
  ghosts?: boolean
  /** Only pages whose title contains this. */
  query?: string
}

const GHOST = 'ghost:'

/**
 * Build the web from the pages.
 *
 * Links are matched on title, the way they are written and the way they
 * resolve when followed, so a link keeps pointing at its page through a
 * rename of anything else.
 */
export function buildGraph(notes: Note[], options: BuildOptions = {}): Graph {
  const { nesting = true, orphans = true, ghosts = true, query = '' } = options
  const live = notes.filter((n) => !n.trashedAt)
  const byTitle = new Map<string, Note>()
  for (const note of live) byTitle.set(noteTitle(note).trim().toLowerCase(), note)

  const nodes = new Map<string, GraphNode>()
  const links: GraphLink[] = []
  const seen = new Set<string>()

  const add = (id: string, title: string, folderId?: ID, ghost?: boolean) => {
    if (!nodes.has(id)) nodes.set(id, { id, title, folderId, ghost, degree: 0, x: 0, y: 0, vx: 0, vy: 0 })
    return nodes.get(id)!
  }
  const join = (source: string, target: string, nested?: boolean) => {
    // One edge per pair: two pages that mention each other are one connection,
    // and a link written twice on a page is still one link.
    const key = source < target ? `${source}|${target}` : `${target}|${source}`
    if (source === target || seen.has(key)) return
    seen.add(key)
    links.push({ source, target, nested })
    nodes.get(source)!.degree++
    nodes.get(target)!.degree++
  }

  for (const note of live) add(note.id, noteTitle(note), note.folderId)

  for (const note of live) {
    for (const name of wikiLinksIn(note)) {
      const target = byTitle.get(name.trim().toLowerCase())
      if (target) {
        join(note.id, target.id)
      } else if (ghosts) {
        add(GHOST + name.toLowerCase(), name, undefined, true)
        join(note.id, GHOST + name.toLowerCase())
      }
    }
    if (nesting && note.parentId && nodes.has(note.parentId)) join(note.parentId, note.id, true)
  }

  let list = [...nodes.values()]
  if (query.trim()) {
    const wanted = query.trim().toLowerCase()
    const kept = new Set(list.filter((n) => n.title.toLowerCase().includes(wanted)).map((n) => n.id))
    list = list.filter((n) => kept.has(n.id))
    return place(finish(list, links.filter((l) => kept.has(l.source) && kept.has(l.target))))
  }
  if (!orphans) list = list.filter((n) => n.degree > 0)

  const kept = new Set(list.map((n) => n.id))
  return place(finish(list, links.filter((l) => kept.has(l.source) && kept.has(l.target))))
}

/** Degrees counted against the edges actually kept, not the ones filtered out. */
function finish(nodes: GraphNode[], links: GraphLink[]): Graph {
  const degree = new Map<string, number>()
  for (const link of links) {
    degree.set(link.source, (degree.get(link.source) ?? 0) + 1)
    degree.set(link.target, (degree.get(link.target) ?? 0) + 1)
  }
  return { nodes: nodes.map((n) => ({ ...n, degree: degree.get(n.id) ?? 0 })), links }
}

/**
 * Starting positions, on a spiral rather than at random.
 *
 * The same library lays out the same way every time it is opened, which makes
 * the web something you can learn the shape of; and no two nodes start on top
 * of each other, where the repulsion between them would be infinite.
 */
function place(graph: Graph): Graph {
  const golden = Math.PI * (3 - Math.sqrt(5))
  graph.nodes.forEach((node, i) => {
    const radius = 14 * Math.sqrt(i + 0.5)
    node.x = Math.cos(i * golden) * radius
    node.y = Math.sin(i * golden) * radius
  })
  return graph
}

/**
 * The part of the web around one page: itself, what it links to, what links to
 * it, and so on out to `depth`.
 */
export function neighbourhood(graph: Graph, id: string, depth: number): Graph {
  const kept = new Set<string>([id])
  let edge = [id]
  for (let step = 0; step < depth; step++) {
    const next: string[] = []
    for (const link of graph.links) {
      if (edge.includes(link.source) && !kept.has(link.target)) { kept.add(link.target); next.push(link.target) }
      if (edge.includes(link.target) && !kept.has(link.source)) { kept.add(link.source); next.push(link.source) }
    }
    if (!next.length) break
    edge = next
  }
  return place(
    finish(
      graph.nodes.filter((n) => kept.has(n.id)),
      graph.links.filter((l) => kept.has(l.source) && kept.has(l.target)),
    ),
  )
}

export interface Forces {
  /** How hard every node pushes every other away. */
  repel: number
  /** How far apart a link would like its two ends. */
  linkDistance: number
  /** How firmly it insists. */
  linkStrength: number
  /** The pull towards the middle that stops the web drifting away. */
  center: number
}

export const DEFAULT_FORCES: Forces = {
  repel: 2600,
  linkDistance: 70,
  linkStrength: 0.06,
  center: 0.012,
}

/** Movement left in the simulation before it settles, and how fast it cools. */
export const ALPHA_START = 1
export const ALPHA_DECAY = 0.985
export const ALPHA_MIN = 0.02
/** Anything below this is standing still, so the canvas can stop redrawing. */
const DAMPING = 0.78
/** Two nodes at the same point would repel each other infinitely hard. */
const MIN_DISTANCE = 8

/**
 * One step of the simulation.
 *
 * O(n²) in the nodes, which for a library of pages is nothing: a thousand
 * pages is half a million pair calculations a frame, and a real library is an
 * order of magnitude smaller. A quadtree would be the answer if it ever were.
 */
export function tick(
  graph: Graph,
  forces: Forces,
  alpha: number,
  /** The caller's node lookup, so a frame does not have to build one. */
  index: Map<string, GraphNode> = new Map(graph.nodes.map((n) => [n.id, n])),
): void {
  const { nodes, links } = graph

  for (let i = 0; i < nodes.length; i++) {
    const a = nodes[i]
    for (let j = i + 1; j < nodes.length; j++) {
      const b = nodes[j]
      let dx = b.x - a.x
      let dy = b.y - a.y
      let distance = Math.sqrt(dx * dx + dy * dy)
      if (distance < MIN_DISTANCE) {
        // Nudge them apart deterministically rather than dividing by zero.
        dx = dx || (i - j) * 0.5
        dy = dy || 0.5
        distance = MIN_DISTANCE
      }
      const push = (forces.repel / (distance * distance)) * alpha
      const ux = (dx / distance) * push
      const uy = (dy / distance) * push
      a.vx -= ux
      a.vy -= uy
      b.vx += ux
      b.vy += uy
    }
  }

  for (const link of links) {
    const a = index.get(link.source)
    const b = index.get(link.target)
    if (!a || !b) continue
    const dx = b.x - a.x
    const dy = b.y - a.y
    const distance = Math.max(MIN_DISTANCE, Math.sqrt(dx * dx + dy * dy))
    const pull = ((distance - forces.linkDistance) * forces.linkStrength * alpha) / 2
    const ux = (dx / distance) * pull
    const uy = (dy / distance) * pull
    a.vx += ux
    a.vy += uy
    b.vx -= ux
    b.vy -= uy
  }

  for (const node of nodes) {
    if (node.pinned) {
      node.vx = 0
      node.vy = 0
      continue
    }
    node.vx = (node.vx - node.x * forces.center * alpha) * DAMPING
    node.vy = (node.vy - node.y * forces.center * alpha) * DAMPING
    node.x += node.vx
    node.y += node.vy
  }
}

/** The dot's radius, from how many links it has. */
export function nodeRadius(node: GraphNode): number {
  return 4 + Math.min(9, Math.sqrt(node.degree) * 2.4)
}

/** The bounds of everything drawn, for fitting the web to the canvas. */
export function graphBounds(graph: Graph): { x: number; y: number; width: number; height: number } {
  if (!graph.nodes.length) return { x: -50, y: -50, width: 100, height: 100 }
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  for (const node of graph.nodes) {
    const r = nodeRadius(node)
    minX = Math.min(minX, node.x - r)
    minY = Math.min(minY, node.y - r)
    maxX = Math.max(maxX, node.x + r)
    maxY = Math.max(maxY, node.y + r)
  }
  return { x: minX, y: minY, width: Math.max(1, maxX - minX), height: Math.max(1, maxY - minY) }
}
