import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  buildGraph, DEFAULT_FORCES, graphBounds, neighbourhood, nodeRadius, tick,
} from '../src/lib/graph.ts'
import type { Note } from '../src/types.ts'

let n = 0
function page(title: string, body = '', extra: Partial<Note> = {}): Note {
  n++
  return {
    id: `note_${n}`,
    folderId: 'fold_notes',
    title,
    blocks: [{ id: `blk_${n}`, type: 'text', text: body, indent: 0 }],
    pinned: false,
    locked: false,
    tags: [],
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...extra,
  }
}

test('a link written on one page joins it to the page it names', () => {
  const a = page('Alpha', 'see [[Bravo]]')
  const b = page('Bravo')
  const graph = buildGraph([a, b], { nesting: false })
  assert.deepEqual(graph.nodes.map((x) => x.title), ['Alpha', 'Bravo'])
  assert.equal(graph.links.length, 1)
  assert.deepEqual(graph.nodes.map((x) => x.degree), [1, 1])
})

test('two pages that link to each other are one connection, not two', () => {
  const a = page('Alpha', 'see [[Bravo]]')
  const b = page('Bravo', 'see [[Alpha]] and [[Alpha]] again')
  const graph = buildGraph([a, b], { nesting: false })
  assert.equal(graph.links.length, 1)
})

test('a link to a page nobody has written is a ghost, and can be turned off', () => {
  const a = page('Alpha', 'see [[Not written yet]]')
  const withGhosts = buildGraph([a], { nesting: false })
  assert.deepEqual(withGhosts.nodes.map((x) => [x.title, !!x.ghost]), [['Alpha', false], ['Not written yet', true]])

  const without = buildGraph([a], { nesting: false, ghosts: false })
  assert.deepEqual(without.nodes.map((x) => x.title), ['Alpha'])
  assert.equal(without.links.length, 0)
})

test('a page nested inside another is joined to it, unless nesting is off', () => {
  const parent = page('Parent')
  const child = page('Child', '', { parentId: parent.id })
  assert.equal(buildGraph([parent, child]).links.length, 1)
  assert.equal(buildGraph([parent, child], { nesting: false }).links.length, 0)
})

test('a page in the trash is not on the web at all', () => {
  const a = page('Alpha', 'see [[Bravo]]')
  const b = page('Bravo', '', { trashedAt: '2026-01-02T00:00:00.000Z' })
  const graph = buildGraph([a, b], { nesting: false, ghosts: false })
  assert.deepEqual(graph.nodes.map((x) => x.title), ['Alpha'])
})

test('pages joined to nothing can be hidden', () => {
  const a = page('Alpha', 'see [[Bravo]]')
  const b = page('Bravo')
  const lonely = page('Nobody')
  const all = buildGraph([a, b, lonely], { nesting: false })
  assert.equal(all.nodes.length, 3)
  const joined = buildGraph([a, b, lonely], { nesting: false, orphans: false })
  assert.deepEqual(joined.nodes.map((x) => x.title), ['Alpha', 'Bravo'])
})

test('a search keeps the matching pages and the links between them', () => {
  const a = page('Trip planning', 'see [[Packing list]]')
  const b = page('Packing list')
  const c = page('Something else')
  const graph = buildGraph([a, b, c], { nesting: false, query: 'p' })
  assert.deepEqual(graph.nodes.map((x) => x.title).sort(), ['Packing list', 'Trip planning'])
  assert.equal(graph.links.length, 1)
})

test('degrees count the links that survive the filters, not the ones removed', () => {
  const a = page('Alpha', 'see [[Bravo]] and [[Charlie]]')
  const b = page('Bravo')
  const c = page('Charlie')
  // "l" is in Alpha and Charlie and not in Bravo.
  const graph = buildGraph([a, b, c], { nesting: false, query: 'l' })
  // So Alpha is left with one link, not the two it wrote.
  assert.deepEqual(
    graph.nodes.map((x) => [x.title, x.degree]).sort(),
    [['Alpha', 1], ['Charlie', 1]],
  )
})

test('a local web reaches as far out as it is asked to', () => {
  const a = page('A', 'see [[B]]')
  const b = page('B', 'see [[C]]')
  const c = page('C', 'see [[D]]')
  const d = page('D')
  const whole = buildGraph([a, b, c, d], { nesting: false })
  assert.deepEqual(neighbourhood(whole, a.id, 1).nodes.map((x) => x.title), ['A', 'B'])
  assert.deepEqual(neighbourhood(whole, a.id, 2).nodes.map((x) => x.title), ['A', 'B', 'C'])
  assert.deepEqual(neighbourhood(whole, a.id, 9).nodes.map((x) => x.title), ['A', 'B', 'C', 'D'])
})

test('nodes start apart and in the same places every time', () => {
  const pages = [page('One'), page('Two'), page('Three')]
  const first = buildGraph(pages)
  const again = buildGraph(pages)
  assert.deepEqual(first.nodes.map((x) => [x.x, x.y]), again.nodes.map((x) => [x.x, x.y]))
  // No two on top of each other, where repulsion would divide by zero.
  const places = new Set(first.nodes.map((x) => `${x.x},${x.y}`))
  assert.equal(places.size, first.nodes.length)
})

test('linked pages are drawn together and unlinked ones pushed apart', () => {
  const a = page('Alpha', 'see [[Bravo]]')
  const b = page('Bravo')
  const linked = buildGraph([a, b], { nesting: false })
  const apart = (g: typeof linked) => Math.hypot(g.nodes[0].x - g.nodes[1].x, g.nodes[0].y - g.nodes[1].y)

  // Start them much too far apart, and let the link reel them in.
  linked.nodes[1].x = 900
  linked.nodes[1].y = 0
  const started = apart(linked)
  for (let i = 0; i < 400; i++) tick(linked, DEFAULT_FORCES, 1)
  assert.ok(apart(linked) < started, 'a link pulls')
  assert.ok(Math.abs(apart(linked) - DEFAULT_FORCES.linkDistance) < 30, `settled at ${apart(linked)}`)

  const strangers = buildGraph([page('One'), page('Two')], { nesting: false })
  const before = apart(strangers)
  for (let i = 0; i < 60; i++) tick(strangers, DEFAULT_FORCES, 1)
  assert.ok(apart(strangers) > before, 'nothing joins them, so they push apart')
})

test('a pinned node stays exactly where it is put', () => {
  const graph = buildGraph([page('One', 'see [[Two]]'), page('Two')], { nesting: false })
  graph.nodes[0].pinned = true
  graph.nodes[0].x = 123
  graph.nodes[0].y = -45
  for (let i = 0; i < 50; i++) tick(graph, DEFAULT_FORCES, 1)
  assert.deepEqual([graph.nodes[0].x, graph.nodes[0].y], [123, -45])
  assert.notEqual(graph.nodes[1].x, 0)
})

test('the web settles rather than drifting off the canvas', () => {
  const pages = Array.from({ length: 12 }, (_, i) => page(`Page ${i}`, i ? `see [[Page ${i - 1}]]` : ''))
  const graph = buildGraph(pages, { nesting: false })
  for (let i = 0; i < 600; i++) tick(graph, DEFAULT_FORCES, 1)
  const bounds = graphBounds(graph)
  assert.ok(Number.isFinite(bounds.width) && bounds.width < 4000, `width ${bounds.width}`)
  assert.ok(graph.nodes.every((n) => Number.isFinite(n.x) && Number.isFinite(n.y)))
})

test('a page with more links is a bigger dot', () => {
  assert.ok(nodeRadius({ degree: 8 } as never) > nodeRadius({ degree: 1 } as never))
  assert.ok(nodeRadius({ degree: 0 } as never) > 0)
})

test('an empty library still has bounds to draw', () => {
  assert.ok(graphBounds({ nodes: [], links: [] }).width > 0)
})
