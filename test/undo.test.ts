import assert from 'node:assert/strict'
import { afterEach, test } from 'node:test'
import { clearUndo, getUndo, offerUndo, takeUndo } from '../src/state/undo.ts'
import { pluck, spliceBack } from '../src/lib/records.ts'

afterEach(() => clearUndo())

test('an offer stands until it is taken', () => {
  let undone = 0
  offerUndo('Deleted “Packing list”', () => undone++)
  assert.equal(getUndo()?.label, 'Deleted “Packing list”')
  assert.equal(takeUndo(), true)
  assert.equal(undone, 1)
  assert.equal(getUndo(), null)
})

test('taking an offer twice does not run the revert twice', () => {
  let undone = 0
  offerUndo('Deleted', () => undone++)
  takeUndo()
  assert.equal(takeUndo(), false)
  assert.equal(undone, 1)
})

test('with nothing to undo, a shortcut is told so and can fall through', () => {
  assert.equal(takeUndo(), false)
})

test('a second deletion replaces the first rather than queueing behind it', () => {
  const done: string[] = []
  offerUndo('first', () => done.push('first'))
  offerUndo('second', () => done.push('second'))
  assert.equal(getUndo()?.label, 'second')
  takeUndo()
  // The first offer is gone for good: only Recently Deleted goes back further.
  assert.deepEqual(done, ['second'])
})

test('every offer is distinct, so a repeat still reads as something new', () => {
  offerUndo('Deleted “Notes”', () => {})
  const first = getUndo()?.seq
  offerUndo('Deleted “Notes”', () => {})
  assert.notEqual(getUndo()?.seq, first)
})

test('an offer expires on its own', async () => {
  offerUndo('Deleted', () => {}, 10)
  assert.ok(getUndo())
  await new Promise((r) => setTimeout(r, 30))
  assert.equal(getUndo(), null)
})

test('records go back where they came from, not on the end', () => {
  const before = ['a', 'b', 'c', 'd']
  const taken = pluck(before, (x) => x === 'b' || x === 'd')
  assert.deepEqual(taken, [{ at: 1, item: 'b' }, { at: 3, item: 'd' }])
  const after = before.filter((x) => x !== 'b' && x !== 'd')
  assert.deepEqual(spliceBack(after, taken), before)
})

test('a position past the end lands at the end rather than being lost', () => {
  // Something else was deleted while the offer stood.
  const taken = pluck(['a', 'b', 'c'], (x) => x === 'c')
  assert.deepEqual(spliceBack(['a'], taken), ['a', 'c'])
})

test('nothing removed means nothing to put back', () => {
  assert.deepEqual(pluck(['a'], () => false), [])
  assert.deepEqual(spliceBack(['a'], []), ['a'])
})
