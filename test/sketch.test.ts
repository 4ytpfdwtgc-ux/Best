import assert from 'node:assert/strict'
import { test } from 'node:test'
import { extendStroke, heightForSurface, isBlank, strokePoints, toSketchSpace } from '../src/lib/sketch.ts'

test('points that say nothing new are dropped as they arrive', () => {
  let points = extendStroke([], 10, 10)
  assert.deepEqual(points, [10, 10])
  // A finger barely moving between frames: hundreds of these per line.
  points = extendStroke(points, 11, 11)
  assert.deepEqual(points, [10, 10], 'too close to be worth keeping')
  points = extendStroke(points, 20, 10)
  assert.deepEqual(points, [10, 10, 20, 10])
})

test('points are rounded, so a drawing is not stored to a millionth of a pixel', () => {
  assert.deepEqual(extendStroke([], 10.4732, 9.5), [10, 10])
})

test('a pointer lands in the sketch space whatever size it is drawn at', () => {
  const rect = { left: 100, top: 50, width: 500, height: 300 } as DOMRect
  assert.deepEqual(toSketchSpace(rect, 100, 50, 600), { x: 0, y: 0 })
  assert.deepEqual(toSketchSpace(rect, 600, 350, 600), { x: 1000, y: 600 })
  assert.deepEqual(toSketchSpace(rect, 350, 200, 600), { x: 500, y: 300 })
})

test('a pointer that strays outside stays inside the drawing', () => {
  const rect = { left: 0, top: 0, width: 1000, height: 600 } as DOMRect
  assert.deepEqual(toSketchSpace(rect, -40, -40, 600), { x: 0, y: 0 })
  assert.deepEqual(toSketchSpace(rect, 5000, 5000, 600), { x: 1000, y: 600 })
})

test('a new sketch takes the shape of the surface it is drawn on', () => {
  // A laptop: wide, so the drawing is wide.
  assert.equal(heightForSurface(1200, 700), 583)
  // A phone held upright, which would otherwise draw into a letterbox.
  assert.equal(heightForSurface(360, 620), 1000, 'capped, or it swallows the page')
  // Absurdly wide: still tall enough to draw anything on.
  assert.equal(heightForSurface(2000, 300), 400)
  assert.equal(heightForSurface(0, 0), 400, 'nothing measured yet')
})

test('a tap is drawn as a dot rather than as nothing', () => {
  // A polyline with one point draws nothing at all; doubled, the round cap
  // makes the dot the tap meant.
  assert.equal(strokePoints({ points: [4, 5], color: 'ink', width: 3 }), '4,5 4,5')
  assert.equal(strokePoints({ points: [0, 0, 10, 10], color: 'ink', width: 3 }), '0,0 10,10')
})

test('a sketch nobody drew on is blank', () => {
  assert.equal(isBlank(undefined), true)
  assert.equal(isBlank([]), true)
  assert.equal(isBlank([{ points: [1, 2], color: 'ink', width: 3 }]), false)
})
