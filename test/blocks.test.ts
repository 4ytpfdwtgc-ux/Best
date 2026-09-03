import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  blocksToMarkdown, blocksToText, emptyBlock, hasChildren, hiddenBlockIds,
  markdownToBlocks, matchShortcut, orderedIndex,
} from '../src/lib/blocks.ts'
import { decorateInline, toggleMark } from '../src/lib/inline.ts'
import type { Block } from '../src/types.ts'

const block = (type: Block['type'], text: string, indent = 0, extra: Partial<Block> = {}): Block => ({
  ...emptyBlock(type, indent),
  text,
  ...extra,
})

test('markdown shortcuts fire on the marker plus a space', () => {
  assert.equal(matchShortcut('# '), 'h1')
  assert.equal(matchShortcut('## '), 'h2')
  assert.equal(matchShortcut('- '), 'bullet')
  assert.equal(matchShortcut('1. '), 'numbered')
  assert.equal(matchShortcut('[] '), 'todo')
  assert.equal(matchShortcut('> '), 'quote')
  assert.equal(matchShortcut('```'), 'code')
  // Not a shortcut until the space, and never mid-sentence.
  assert.equal(matchShortcut('#'), null)
  assert.equal(matchShortcut('a # '), null)
})

test('a collapsed toggle hides exactly its own nested run', () => {
  const blocks = [
    block('toggle', 'Parent', 0, { collapsed: true }),
    block('text', 'Child A', 1),
    block('text', 'Grandchild', 2),
    block('text', 'Sibling', 0),
  ]
  const hidden = hiddenBlockIds(blocks)
  assert.equal(hidden.size, 2)
  assert.ok(hidden.has(blocks[1].id))
  assert.ok(hidden.has(blocks[2].id))
  assert.ok(!hidden.has(blocks[3].id))
})

test('an expanded toggle hides nothing', () => {
  const blocks = [block('toggle', 'Parent', 0, { collapsed: false }), block('text', 'Child', 1)]
  assert.equal(hiddenBlockIds(blocks).size, 0)
})

test('hasChildren looks at nesting, not block type', () => {
  const blocks = [block('toggle', 'Parent'), block('text', 'Child', 1), block('toggle', 'Lonely')]
  assert.equal(hasChildren(blocks, 0), true)
  assert.equal(hasChildren(blocks, 2), false)
})

test('ordered lists number within their own run and level', () => {
  const blocks = [
    block('numbered', 'one'),
    block('numbered', 'two'),
    block('numbered', 'nested', 1),
    block('numbered', 'three'),
    block('text', 'break'),
    block('numbered', 'restarted'),
  ]
  assert.equal(orderedIndex(blocks, 0), 1)
  assert.equal(orderedIndex(blocks, 1), 2)
  assert.equal(orderedIndex(blocks, 2), 1)
  assert.equal(orderedIndex(blocks, 3), 3)
  assert.equal(orderedIndex(blocks, 5), 1)
})

test('markdown parses into the block types it came from', () => {
  const blocks = markdownToBlocks(
    ['# Title', '', 'A paragraph', '- [x] done', '- [ ] todo', '- bullet', '1. first', '> quoted', '---'].join('\n'),
  )
  assert.deepEqual(
    blocks.map((b) => b.type),
    ['h1', 'text', 'todo', 'todo', 'bullet', 'numbered', 'quote', 'divider'],
  )
  assert.equal(blocks[2].checked, true)
  assert.equal(blocks[3].checked, false)
  assert.equal(blocks[0].text, 'Title')
})

test('a fenced code block survives the round trip', () => {
  const blocks = markdownToBlocks(['```', 'const a = 1', 'const b = 2', '```'].join('\n'))
  assert.equal(blocks.length, 1)
  assert.equal(blocks[0].type, 'code')
  assert.equal(blocks[0].text, 'const a = 1\nconst b = 2')
})

test('parsing an empty body still yields one editable block', () => {
  const blocks = markdownToBlocks('')
  assert.equal(blocks.length, 1)
  assert.equal(blocks[0].type, 'text')
})

test('indentation survives the round trip through markdown', () => {
  const blocks = markdownToBlocks(['- parent', '  - child'].join('\n'))
  assert.deepEqual(blocks.map((b) => b.indent), [0, 1])
  assert.match(blocksToMarkdown(blocks), /^- parent\n {2}- child$/)
})

test('plain text skips dividers and empty blocks', () => {
  const blocks = [block('h1', 'Title'), block('divider', ''), block('text', ''), block('text', 'Body')]
  assert.equal(blocksToText(blocks), 'Title Body')
})

/* ---------------------------------------------------------------- */
/* Inline marks                                                      */
/* ---------------------------------------------------------------- */

test('decorated inline markup keeps the plain text intact', () => {
  const text = 'a **bold** and *italic* and `code`'
  const html = decorateInline(text)
  const stripped = html.replace(/<[^>]+>/g, '')
  assert.equal(stripped, text, 'textContent must be unchanged so caret offsets survive')
  assert.ok(html.includes('<strong>bold</strong>'))
  assert.ok(html.includes('<em>italic</em>'))
  assert.ok(html.includes('<code>code</code>'))
})

test('decoration escapes markup in the source text', () => {
  const html = decorateInline('<script>alert(1)</script>')
  assert.ok(!html.includes('<script>'))
  assert.ok(html.includes('&lt;script&gt;'))
})

test('toggling a mark wraps the selection and reports the new range', () => {
  const result = toggleMark('hello world', 6, 11, '**')
  assert.equal(result.text, 'hello **world**')
  assert.equal(result.text.slice(result.start, result.end), 'world')
})

test('toggling an already-marked selection unwraps it', () => {
  const wrapped = toggleMark('hello world', 6, 11, '**')
  const undone = toggleMark(wrapped.text, wrapped.start, wrapped.end, '**')
  assert.equal(undone.text, 'hello world')
})

test('toggling an empty selection changes nothing', () => {
  assert.deepEqual(toggleMark('abc', 1, 1, '**'), { text: 'abc', start: 1, end: 1 })
})

test('a picture survives a copy out as a markdown image', () => {
  const picture = { ...emptyBlock('image'), text: 'Ferry at dusk', assetId: 'img_1' }
  assert.equal(blocksToMarkdown([picture]), '![Ferry at dusk](picture)')
  // Its caption is the block's words, so search and previews can still see it.
  assert.equal(blocksToText([picture]), 'Ferry at dusk')
})
